#!/usr/bin/env bash
# grants-guard.test.sh — el sello del guardián de privilegios.
#
# Le inyecta por `GRANTS_GUARD_ROWS` lo que contestaría la base y exige el color
# correcto. Sin este sello, un guardián que consulta la DB solo se podría probar
# teniendo la DB delante — y lo que no corre en CI es decoración.
#
# QUÉ CUBRE ESTE SELLO, y qué NO: cubre **la decisión sobre las filas**, no la
# consulta. Que la consulta a `information_schema` sea la correcta no se prueba
# aquí; se prueba corriendo el guardián contra la base, que es lo que hace el job.
#
# LA COMPROBACIÓN QUE NO SE RETIRA. Al cerrar `8eb39541` se añadió a propósito un
# caso que exige que **`anon` siga vigilado**: nadie puede desviar este guardián
# a otro rol y dejar sin mirar el que motivó su existencia. Desde el 8-ago-2026
# se exigen **los dos** —`anon` y `authenticated`—, que es lo que pedía
# `cf3303c7`: sumar, no cambiar cuál.
#
# Uso: bash scripts/grants-guard.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${GRANTS_GUARD:-$REPO_ROOT/scripts/grants-guard.sh}"
TMP="$(mktemp -d)"

PASS=0
FAIL=0

# Un esquema de mentira con la misma forma que el de verdad: un bucle que da el
# default por rol, y —en el segundo— una excepción por tabla.
ESQ_SIMPLE="$TMP/simple.sql"
cat > "$ESQ_SIMPLE" <<'SQL'
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role;', t);
  END LOOP;
END $$;
SQL

ESQ_EXCEPCION="$TMP/excepcion.sql"
cat > "$ESQ_EXCEPCION" <<'SQL'
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename <> 'historial'
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role;', t);
  END LOOP;
END $$;

GRANT SELECT          ON public.historial TO anon;
GRANT SELECT, INSERT  ON public.historial TO authenticated;
SQL

# Una tabla fuera del bucle y sin excepción declarada: nadie dice qué le toca.
ESQ_HUERFANA="$TMP/huerfana.sql"
cat > "$ESQ_HUERFANA" <<'SQL'
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename <> 'historial'
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role;', t);
  END LOOP;
END $$;
SQL

BIEN=$'anon|cards|SELECT\nauthenticated|cards|DELETE,INSERT,SELECT,UPDATE'

# $1 = qué se prueba · $2 = exit esperado · $3 = filas · $4 = (opc) trozo del
# mensaje · $5 = (opc) esquema
caso() {
  local que="$1" esperado="$2" filas="$3" espera_msg="${4:-}" esquema="${5:-$ESQ_SIMPLE}"
  local salida code
  salida="$(GRANTS_GUARD_ROWS="$filas" GRANTS_GUARD_SCHEMA="$esquema" bash "$GUARD" 2>&1)"
  code=$?
  if [ -n "$espera_msg" ] && ! printf '%s' "$salida" | grep -q "$espera_msg"; then
    FAIL=$((FAIL + 1))
    printf '  FALLO %s — el mensaje no dice «%s»\n' "$que" "$espera_msg"
    printf '%s\n' "$salida" | sed 's/^/          /'
    return
  fi
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    printf '%s\n' "$salida" | sed 's/^/          /'
  fi
}

echo "Sello del guardián de privilegios ($GUARD)"
echo
echo "Tiene que MORDER en el rol ANÓNIMO (lo de siempre):"
caso "una tabla nueva con los siete para anon"  1 \
  $'anon|nueva|DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE\nauthenticated|nueva|DELETE,INSERT,SELECT,UPDATE' "nueva"
caso "anon con uno de más"                      1 \
  $'anon|cards|INSERT,SELECT\nauthenticated|cards|DELETE,INSERT,SELECT,UPDATE' "anon"
caso "anon sin ninguno tampoco es lo declarado" 1 \
  $'anon|cards|\nauthenticated|cards|DELETE,INSERT,SELECT,UPDATE' "anon"

echo
echo "Tiene que MORDER en AUTHENTICATED — el rol que hasta hoy no miraba nadie:"
# EL caso de la tarjeta: `TRUNCATE` salta RLS, y era lo que se recortó el 6-ago.
caso "authenticated recupera TRUNCATE"          1 \
  $'anon|cards|SELECT\nauthenticated|cards|DELETE,INSERT,SELECT,TRUNCATE,UPDATE' "TRUNCATE"
caso "authenticated con los siete"              1 \
  $'anon|cards|SELECT\nauthenticated|cards|DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE' "authenticated"
caso "authenticated de menos también canta"     1 \
  $'anon|cards|SELECT\nauthenticated|cards|SELECT' "authenticated"

echo
echo "Tiene que MORDER con las EXCEPCIONES por tabla puestas:"
# La tabla con excepción NO puede tener lo que tienen sus hermanas.
caso "la tabla con excepción conserva UPDATE y DELETE" 1 \
  $'anon|historial|SELECT\nauthenticated|historial|DELETE,INSERT,SELECT,UPDATE' "historial" "$ESQ_EXCEPCION"
# Y la excepción NO se contagia a las demás: una hermana recortada también canta.
caso "una hermana recortada como si fuera la excepción" 1 \
  $'anon|cards|SELECT\nauthenticated|cards|INSERT,SELECT' "cards" "$ESQ_EXCEPCION"

echo
echo "Tiene que ROMPERSE, no saltar en verde:"
caso "la base no devuelve ninguna fila"         1 "" "no devolvió ningún privilegio"
caso "una fila con forma inesperada"            1 $'anon|cards' "forma inesperada"
caso "una tabla fuera del bucle y sin excepción declarada" 1 "$BIEN" "nadie declara" "$ESQ_HUERFANA"
caso "el esquema no existe"                     1 "$BIEN" "no existe" "$TMP/no-hay.sql"
# Una fila de un rol para el que nadie declaró nada. No debería llegar —la
# consulta filtra por los roles vigilados— pero si llegara, juzgarla contra
# «nada» sería inventarse el veredicto. Comprobado por mutación: sin este caso,
# neutralizar esa defensa pasaba 20 de 20 en verde.
caso "una fila de un rol que nadie declara"     1 \
  "$BIEN"$'\nservice_role|cards|DELETE,INSERT,SELECT,UPDATE' "no se puede juzgar"

echo
echo "Tiene que CALLAR:"
caso "los dos roles con lo que el esquema declara" 0 "$BIEN" "OK"
caso "la tabla con excepción, con su excepción"    0 \
  $'anon|cards|SELECT\nauthenticated|cards|DELETE,INSERT,SELECT,UPDATE\nanon|historial|SELECT\nauthenticated|historial|INSERT,SELECT' \
  "excepción" "$ESQ_EXCEPCION"
# El orden en que la base devuelva los privilegios no es cosa del guardián.
caso "los privilegios en otro orden"               0 \
  $'anon|cards|SELECT\nauthenticated|cards|UPDATE,SELECT,INSERT,DELETE' "OK"
caso "una línea en blanco NO es una fila"          0 "$BIEN"$'\n' "OK"
caso "varias líneas en blanco tampoco"             0 $'\n\n'"$BIEN"$'\n\n' "OK"

echo
echo "Y los DOS roles siguen vigilados — esto no se retira, se amplía:"
GUARD_SRC="$(cat "$GUARD")"
# Antes se exigía `GRANTS_GUARD_ROLE:-anon`. La tarjeta `cf3303c7` pedía sumar
# `authenticated` SIN retirar esa garantía: que nadie pueda desviar el guardián
# y dejar sin mirar el rol que lo motivó. Ahora se exigen los dos por defecto.
if printf '%s' "$GUARD_SRC" | grep -qE 'GRANTS_GUARD_ROLES:-[^}]*anon'; then
  printf '  ok    `anon` sigue vigilado por defecto\n'; PASS=$((PASS + 1))
else
  printf '  FALLO `anon` ya no está entre los roles vigilados por defecto\n'; FAIL=$((FAIL + 1))
fi
if printf '%s' "$GUARD_SRC" | grep -qE 'GRANTS_GUARD_ROLES:-[^}]*authenticated'; then
  printf '  ok    `authenticated` está vigilado por defecto\n'; PASS=$((PASS + 1))
else
  printf '  FALLO `authenticated` no está entre los roles vigilados por defecto\n'; FAIL=$((FAIL + 1))
fi

# Y que las excepciones NO vivan dentro del script: es la condición 2 de la
# tarjeta, y una lista aquí dentro sería la avería que el #35 ya cerró.
if printf '%s' "$GUARD_SRC" | grep -qE "^[^#]*card_description_history"; then
  printf '  FALLO hay una excepción por tabla escrita DENTRO del guardián\n'; FAIL=$((FAIL + 1))
else
  printf '  ok    ninguna excepción por tabla vive dentro del guardián\n'; PASS=$((PASS + 1))
fi

echo
echo "Y el esquema REAL se puede derivar (si no, el guardián no tiene contra qué comparar):"
salida="$(python3 "$REPO_ROOT/scripts/grants-expectativa.py" \
            "$REPO_ROOT/docs/schema/supabase-schema.sql" anon authenticated 2>&1)"
if [ $? -eq 0 ] && printf '%s' "$salida" | grep -q '^anon|\*|' && \
   printf '%s' "$salida" | grep -q '^authenticated|\*|'; then
  PASS=$((PASS + 1)); printf '  ok    del esquema real salen los dos defaults\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO no se pudo derivar del esquema real\n'
  printf '%s\n' "$salida" | sed 's/^/          /'
fi

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián muerde en los dos roles, respeta las excepciones y calla donde debe."
