#!/usr/bin/env bash
# verificar-volcado.test.sh — el sello del guardián de la copia de seguridad.
#
# ─────────────────────────────────────────────────────────────────────────────
# ES EL SELLO QUE FALTABA, Y SU AUSENCIA COSTÓ CUATRO DÍAS SIN COPIA.
#
# La verificación del volcado era **el único guardián de su día sin sello**: la
# lógica vivía dentro del YAML, así que no se podía ejercitar ni mutar. El 7-ago
# empezó a abortar copias buenas y no se supo hasta el 10.
#
# EL CASO QUE MANDA es el primero: **un volcado BUENO y GRANDE tiene que salir
# verde.** No es el caso aburrido — es justo el que estaba roto. El guardián
# rechazaba copias correctas, así que un sello que solo probara volcados malos
# habría dado 4/4 mientras la nave se quedaba sin copia.
#
# ⚠️ TRES REQUISITOS QUE LA TARJETA DEJÓ MEDIDOS, y sin ellos este sello NACE
# MINTIENDO. Están aquí porque costaron dos correcciones antes de quedar firmes:
#
#   1. **`pipefail` puesto.** Sin esa opción el defecto no aparece y el sello
#      certificaría verde un guardián roto. Lo pone el propio script bajo prueba.
#   2. **El volcado de prueba, GRANDE de verdad.** Con uno pequeño `gunzip`
#      termina de escribir antes de que el lector salga, no hay `SIGPIPE`, y el
#      guardián roto pasa. Un sello con un fixture cómodo **certifica que
#      funciona algo que no funciona**. Por eso aquí se genera ~1 MB comprimido.
#   3. **Lanzarlo como proceso propio y comparar ESTADOS, no mensajes.** Medido
#      dentro del shell de una herramienta, `pipefail` figura puesto y la tubería
#      devuelve 0 igualmente. Un `echo OK` no distingue «pasó» de «mi entorno no
#      midió», y esa confusión ya costó dos retractaciones en la tarjeta.
#
# Uso: bash scripts/verificar-volcado.test.sh
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${VERIFICAR_VOLCADO:-$REPO_ROOT/scripts/verificar-volcado.sh}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

TABLAS="cards columns boards workspaces users"

# volcado <fichero> <tablas separadas por espacio> <líneas de relleno>
#
# El relleno no es decorado: es lo que hace que el volcado supere el buffer de
# la tubería. Sin él, el fallo que este sello existe para cazar no ocurre.
volcado() {
  local destino="$1" tablas="$2" relleno="$3"
  python3 - "$TMP/$destino" "$tablas" "$relleno" <<'PY'
import gzip, sys
destino, tablas, relleno = sys.argv[1], sys.argv[2].split(), int(sys.argv[3])
with gzip.open(destino, "wt") as f:
    for t in tablas:
        f.write("CREATE TABLE public.%s (id uuid);\n" % t)
    for i in range(relleno):
        f.write("-- relleno %d, para que el volcado pese lo que pesa uno de verdad\n" % i)
PY
}

# caso <qué> <exit esperado> <fichero> [trozo del mensaje]
#
# Se lanza con `bash "$GUARD"` — proceso propio— y se compara el ESTADO. El
# mensaje solo se mira cuando dos casos caen en el mismo código por caminos
# distintos, que es cuando el color no basta.
caso() {
  local que="$1" esperado="$2" fichero="$3" espera_msg="${4:-}"
  local salida code
  salida="$(bash "$GUARD" "$TMP/$fichero" 2>&1)"
  code=$?

  if [ -n "$espera_msg" ] && ! grep -qF "$espera_msg" <<< "$salida"; then
    FAIL=$((FAIL + 1))
    printf '  FALLO %s — el mensaje no dice «%s»\n' "$que" "$espera_msg"
    sed 's/^/          /' <<< "$salida"
    return
  fi
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    sed 's/^/          /' <<< "$salida"
  fi
}

echo "Sello del guardián de la copia ($GUARD)"
echo

# ~1 MB comprimido, como el volcado real del 10-ago que el guardián roto rechazó.
volcado bueno.sql.gz "$TABLAS" 400000
TAM_BUENO="$(wc -c < "$TMP/bueno.sql.gz" | tr -d ' ')"
echo "Volcado de prueba: ${TAM_BUENO} bytes comprimidos — grande a propósito."
echo

echo "Tiene que CALLAR, y ÉSTE es el caso que estaba roto:"

caso "un volcado bueno y GRANDE pasa" 0 bueno.sql.gz \
  "Volcado verificado"

# EL CONTRASTE, y hay que montarlo con cuidado. Un volcado pequeño con las
# mismas tablas también tiene que pasar — pero cae por el SUELO DE TAMAÑO, que es
# otra comprobación. Así que se le baja el suelo a propósito: lo que se mide aquí
# es el contenido, no el peso.
#
# Vale la pena porque separa los dos motivos: si un día el GRANDE falla y el
# pequeño pasa, el problema es de tamaño —o sea, la bomba de la tubería otra
# vez— y este sello lo enseña de un vistazo en vez de mandar a leer el volcado.
volcado pequeno.sql.gz "$TABLAS" 0
salida_peq="$(VOLCADO_MINIMO=1 bash "$GUARD" "$TMP/pequeno.sql.gz" 2>&1)"; code_peq=$?
if [ "$code_peq" -eq 0 ]; then
  PASS=$((PASS + 1)); printf '  ok    %s\n' "y uno pequeño con las mismas tablas, también (con el suelo bajado)"
else
  FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit 0, dio %s\n' "volcado pequeño" "$code_peq"
  sed 's/^/          /' <<< "$salida_peq"
fi

echo
echo "Tiene que MORDER:"

volcado sin-cards.sql.gz "columns boards workspaces users" 400000
caso "le falta una tabla" 1 sin-cards.sql.gz "no contiene la(s) tabla(s): cards"

volcado sin-nada.sql.gz "" 400000
caso "no trae ninguna tabla: pesa, pero no es esta base" 1 sin-nada.sql.gz "no contiene"

volcado otra-base.sql.gz "facturas clientes" 400000
caso "trae tablas, pero de otra base" 1 otra-base.sql.gz "no contiene"

# Un `pg_dump` que termina en 0 y escribe casi nada. Es el caso original por el
# que existe el suelo de tamaño.
printf '' | gzip > "$TMP/vacio.sql.gz"
caso "un volcado por debajo del suelo de tamaño" 1 vacio.sql.gz "por debajo del mínimo"

head -c 500000 "$TMP/bueno.sql.gz" > "$TMP/roto.sql.gz"
caso "un gzip truncado se rechaza POR LO QUE ES" 1 roto.sql.gz "no es un gzip íntegro"

echo
echo "Y no puede dar verde sin haber podido mirar:"

salida="$(bash "$GUARD" "$TMP/no-existe.sql.gz" 2>&1)"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    el fichero no existe → exit 2, no verde\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO fichero inexistente — esperaba exit 2, dio %s\n' "$code"
  sed 's/^/          /' <<< "$salida"
fi

salida="$(bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    sin argumento → exit 2, no verde\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO sin argumento — esperaba exit 2, dio %s\n' "$code"
fi

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || exit 1
echo "Acepta las copias buenas y rechaza lo que no es una copia. Con un volcado grande de verdad."
