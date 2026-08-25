#!/usr/bin/env bash
# digest-horas-guard.test.sh — el sello del guardián de las horas del digest.
#
# Le pone delante cada forma de divergencia y exige rojo, y cada forma legítima y
# exige verde. Las dos direcciones: un guardián que solo muerde acaba desactivado,
# y uno que solo calla no protege.
#
# Y una tercera categoría que aquí importa especialmente: **lo que no sabe leer
# tiene que decirlo, no darlo por bueno**. Un `cron` con rangos o pasos no se
# adivina — dar por buena una lectura inventada sería peor que no mirar.
#
# Uso: bash scripts/digest-horas-guard.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${DIGEST_HORAS_GUARD:-$REPO_ROOT/scripts/digest-horas-guard.sh}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# wf <fichero> <línea(s) de cron>
wf() {
  local destino="$1"; shift
  { printf 'name: Digest\n\non:\n  schedule:\n'
    for c in "$@"; do printf "    - cron: '%s'\n" "$c"; done
    printf '  workflow_dispatch:\n\njobs:\n  x:\n    runs-on: ubuntu-latest\n'
  } > "$TMP/$destino"
}

# js <fichero> <cuerpo de la lista>
js() {
  printf 'const DIGEST_HOURS = Object.freeze([%s]);\nmodule.exports = { DIGEST_HOURS };\n' \
    "$2" > "$TMP/$1"
}

# caso <qué> <exit esperado> <workflow> <constantes> [trozo del mensaje]
caso() {
  local que="$1" esperado="$2" w="$3" c="$4" espera_msg="${5:-}"
  local salida code
  salida="$(DIGEST_GUARD_WORKFLOW="$TMP/$w" DIGEST_GUARD_CONSTANTES="$TMP/$c" bash "$GUARD" 2>&1)"
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

echo "Sello del guardián de las horas del digest ($GUARD)"
echo
echo "Tiene que MORDER:"

# EL CASO. El servidor admite una hora que el reloj no visita: quien la elija se
# queda sin digest y sin error que leer.
wf una.yml   '0 11 * * *'
js dos.js    '11, 12'
caso "el servidor admite una hora que el reloj no visita" 1 una.yml dos.js \
  "SIN DIGEST y sin error que leer"

# El reverso: una pasada que no puede servir a nadie.
wf dos.yml   '0 11 * * *' '0 12 * * *'
js una.js    '11'
caso "el reloj visita una hora que el servidor no admite" 1 dos.yml una.js \
  "NO dicen lo mismo"

wf otra.yml  '0 7 * * *'
caso "coinciden en cuántas, pero no en cuáles" 1 otra.yml una.js "NO dicen lo mismo"

echo
echo "Tiene que CALLAR:"

caso "una hora y una sola pasada, iguales" 0 una.yml una.js "OK"

wf varias.yml '0 7,11,12 * * *'
js varias.js  '7, 11, 12'
caso "varias horas en un solo cron, iguales" 0 varias.yml varias.js "OK"

wf sueltas.yml '0 12 * * *' '0 7 * * *'
js desorden.js '12, 7'
caso "varias pasadas y la lista desordenada: compara conjuntos" 0 sueltas.yml desorden.js "OK"

echo
echo "Y lo que no sabe leer, lo DICE — no lo da por bueno:"

wf rango.yml '0 7-12 * * *'
caso "un cron con rango de horas" 2 rango.yml una.js "no sé leer el campo de horas"

wf paso.yml '0 */2 * * *'
caso "un cron con paso" 2 paso.yml una.js "no sé leer el campo de horas"

wf corto.yml '0 11 * *'
caso "un cron que no trae cinco campos" 2 corto.yml una.js "no son cinco campos"

# Un workflow sin `cron:` — por ejemplo si alguien deja solo el disparo manual —
# no puede leerse como «coincide con la lista vacía».
{ printf 'name: Digest\n\non:\n  workflow_dispatch:\n\njobs:\n  x:\n    runs-on: ubuntu-latest\n'; } > "$TMP/sincron.yml"
caso "un workflow sin ningún cron" 2 sincron.yml una.js "no encontré ni un"

js vacia.js ''
caso "la lista canónica vacía" 2 una.yml vacia.js "vacía o no es una lista"

salida="$(DIGEST_GUARD_WORKFLOW="$TMP/no-existe.yml" DIGEST_GUARD_CONSTANTES="$TMP/una.js" bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    el workflow no existe → exit 2, no verde\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO workflow inexistente — esperaba exit 2, dio %s\n' "$code"
fi

# Los comentarios NO cuentan: la cabecera de este workflow CITA el cron viejo
# para explicar por qué se bajó. Si el guardián leyera comentarios, mordería su
# propia explicación.
{ printf "name: Digest\n\n# Antes corría '0 * * * *' y se bajó, ver la tarjeta.\n#    - cron: '0 3 * * *'\non:\n  schedule:\n    - cron: '0 11 * * *'\n  workflow_dispatch:\n\njobs:\n  x:\n    runs-on: ubuntu-latest\n"; } > "$TMP/comentado.yml"
caso "un cron citado dentro de un comentario no cuenta" 0 comentado.yml una.js "OK"

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || exit 1
echo "El reloj y las horas admisibles no pueden separarse sin que esto lo diga."
