#!/usr/bin/env bash
# grants-guard.test.sh — el sello del guardián de privilegios.
#
# El guardián pregunta a la base de datos, así que sin esto solo se podría probar
# teniendo la DB delante — y lo que no corre en CI es decoración. Aquí se le
# inyectan filas de mentira por `GRANTS_GUARD_ROWS` y se le exige el veredicto,
# sin tocar la red.
#
# ⚠️ LO QUE ESTE SELLO **NO** CUBRE, y hay que decirlo donde se lee el resultado:
# **la consulta SQL.** Al inyectar filas, el `SELECT` no llega a ejecutarse, así
# que este harness mide qué hace el guardián CON las filas, no cuáles le llegan.
# Comprobado por mutación: quitarle el `HAVING` a la consulta —lo que la haría
# devolver todas las tablas— pasa este sello en verde, 9 de 9.
#
# Esa mitad la ejerce CI contra la base real, y ahí sí se nota: sin `HAVING` el
# guardián se pondría rojo con todo el esquema. O sea que el fallo existe pero es
# ruidoso, no silencioso — que es la diferencia que importa. Aun así, un 9/9 aquí
# NO significa «guardián sellado»: significa «la decisión está sellada».
#
# Uso: bash scripts/grants-guard.test.sh
# Exit 0 = el guardián muerde donde debe y calla donde debe.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${GRANTS_GUARD:-$REPO_ROOT/scripts/grants-guard.sh}"

PASS=0
FAIL=0

# $1 = qué se prueba · $2 = exit esperado · $3 = filas inyectadas
caso() {
  local que="$1" esperado="$2" filas="$3"
  local salida code
  salida="$(GRANTS_GUARD_ROWS="$filas" bash "$GUARD" 2>&1)"
  code=$?
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    printf '%s\n' "$salida" | sed 's/^/          /'
  fi
}

echo "Sello del guardián de privilegios ($GUARD)"
echo

echo "Tiene que MORDER:"
# La forma exacta de lo encontrado el 6-ago-2026: una tabla recién creada con
# los siete privilegios que conceden las DEFAULT PRIVILEGES del proyecto.
caso "una tabla nueva con los siete privilegios" 1 \
  "card_description_history|DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE"
caso "una tabla con uno de más" 1 \
  "cards|INSERT,SELECT"
caso "una tabla sin ninguno tampoco es lo declarado" 1 \
  "cards|"
caso "varias tablas a la vez" 1 \
  "a|DELETE,SELECT
b|SELECT,UPDATE"
# Una tabla abierta escondida entre otras que están bien: la consulta ya filtra,
# pero si alguien cambia el HAVING por un LIMIT o se come el filtro, esto avisa.
caso "una abierta entre varias correctas" 1 \
  "buena|SELECT
mala|DELETE,INSERT,SELECT
otra_buena|SELECT"

echo
echo "Tiene que CALLAR:"
caso "sin filas: ninguna tabla se sale de lo declarado" 0 ""
# psql sin resultados devuelve una línea en blanco. Sin limpiarla, el guardián
# nacería rojo con la base perfectamente ordenada — y un guardián que nace rojo
# se normaliza hasta que deja de mirarse.
caso "una línea en blanco NO es una tabla abierta" 0 "
"
caso "varias líneas en blanco tampoco" 0 "

"

echo
echo "Sin credenciales NO se salta en verde:"
# Un guardián que se omite cuando no puede mirar es el falso negativo silencioso
# que este repo persigue. Tiene que fallar, no encogerse de hombros.
salida="$(unset GRANTS_GUARD_ROWS DATABASE_URL SUPABASE_URL SUPABASE_DATABASE_PASSWORD; bash "$GUARD" 2>&1)"
if [ $? -ne 0 ]; then
  PASS=$((PASS + 1)); printf '  ok    sin DATABASE_URL ni SUPABASE_*, falla en vez de callar\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO sin credenciales dio verde — se está omitiendo en silencio\n'
fi

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián muerde donde debe y calla donde debe."
