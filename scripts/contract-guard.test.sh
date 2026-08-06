#!/usr/bin/env bash
# contract-guard.test.sh — el sello del guardián del contrato.
#
# Un guardián que corre y da verde estando destripado es peor que no tenerlo,
# porque además tranquiliza. Este harness le pone delante CADA caso que
# `contract-guard.sh` dice vigilar y exige el veredicto correcto.
#
# El caso 1 no es hipotético: es la forma exacta de los PR #13, #14 y #15.
#
# Uso: bash scripts/contract-guard.test.sh
# Exit 0 = el guardián muerde donde debe y calla donde debe.
# Exit 1 = está destripado.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Overridable para poder correr el harness contra un guardián MUTADO y demostrar
# que el propio harness no es vacuo — mismo truco que docs-guard.mutation.sh.
GUARD="${CONTRACT_GUARD:-$REPO_ROOT/scripts/contract-guard.sh}"

PASS=0
FAIL=0

# $1 = qué se está probando · $2 = exit esperado · $3… = ficheros cambiados
caso() {
  local que="$1"; local esperado="$2"; shift 2
  local salida code
  salida="$(CONTRACT_GUARD_CHANGED="$(printf '%s\n' "$@")" bash "$GUARD" 2>&1)"
  code=$?
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1))
    printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1))
    printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    printf '%s\n' "$salida" | sed 's/^/          /'
  fi
}

echo "Sello del guardián del contrato ($GUARD)"
echo

echo "Tiene que MORDER:"
# La forma exacta de los tres PR del incidente.
caso "Puerta 2 sola, sin contrato (la forma de #13/#14/#15)" 1 \
  "server/routes/internalRoute.js"
caso "Puerta 1: las tools del riel, sin contrato" 1 \
  "kanban-mcp/server.py"
caso "Puerta 1: la validación que el contrato describe, sin contrato" 1 \
  "kanban-mcp/validation.py"
caso "una puerta escondida entre ficheros inocentes" 1 \
  "README.md" "server/tests/algo.test.js" "kanban-mcp/server.py" "docs/CHANGELOG.md"
# Tocar el CHANGELOG no exime: son documentos distintos con custodios distintos,
# y el que el capitán sirve en vivo es el contrato.
caso "CHANGELOG en vez de contrato NO cuenta" 1 \
  "server/routes/internalRoute.js" "docs/CHANGELOG.md"

echo
echo "Tiene que CALLAR:"
caso "puerta tocada Y contrato tocado" 0 \
  "server/routes/internalRoute.js" "docs/contracts/CONTRACT.md"
caso "ninguna puerta tocada" 0 \
  "README.md" "server/routes/cards.js" "docs/ROADMAP.md"
caso "sin lista de ficheros no se inventa un veredicto" 0
# Un nombre PARECIDO al de una puerta no es esa puerta.
caso "un fichero que solo se parece en el nombre" 0 \
  "server/tests/internalRoute.test.js" "kanban-mcp/test_validation.py"
# Y este es el que de verdad ejercita las anclas `^…$`: la ruta de una puerta
# CONTENIDA dentro de otra más larga. Sin anclas, el patrón casa por subcadena y
# un fichero archivado dispara el rojo — o peor, alguien mueve la puerta de sitio
# y el guardián sigue vigilando la copia muerta.
#
# Escrito después de comprobarlo: el caso de arriba NO cubría esto. Se corrió el
# sello contra un guardián sin anclas y dio 10/10 en verde, o sea que juraba
# vigilar un anclaje que no medía. Con este caso, ese mismo mutante se pone rojo.
caso "la ruta de una puerta DENTRO de otra ruta más larga" 0 \
  "archivo/server/routes/internalRoute.js" "viejo/kanban-mcp/server.py"
# `client/` consume las rutas pero no define la forma de ninguna puerta.
caso "la UI que consume las rutas no es una puerta" 0 \
  "client/src/api/cards.js"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián muerde donde debe y calla donde debe."
