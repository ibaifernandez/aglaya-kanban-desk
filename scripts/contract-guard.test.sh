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
echo "Lo que alimenta la forma de una puerta SIN ser la puerta:"
# El hueco que motivó derivar la lista en vez de teclearla. `priorities.js` es
# hoy el único sitio donde vive el conjunto que decide el 400 y el texto del
# error, los dos declarados en el contrato — y el guardián no lo miraba.
caso "el fichero que define qué prioridades acepta la Puerta 2" 1 \
  "server/constants/priorities.js"
caso "el mismo, con contrato tocado" 0 \
  "server/constants/priorities.js" "docs/contracts/CONTRACT.md"
# El contrato declara que la Puerta 2 usa service_role y salta RLS. Ahí se
# elige la llave: cambiarla cambiaría ese alcance.
caso "el fichero donde la Puerta 2 elige su llave" 1 \
  "server/utils/supabase.js"

echo
echo "Y esto se pone rojo si alguien vuelve a TECLEAR la lista:"
# El caso decisivo, y el único que no se puede pasar con una lista escrita a
# mano: se fabrica un repo de mentira donde una puerta importa un fichero que
# NO existe en este repo, así que ningún patrón tecleado puede conocerlo. Solo
# lo caza quien derive la lista siguiendo los imports.
FALSO="$(mktemp -d)"
mkdir -p "$FALSO/server/routes" "$FALSO/server/nuevo" "$FALSO/kanban-mcp"
cat > "$FALSO/server/routes/internalRoute.js" <<'JS'
const express = require('express');
const { supabaseAdmin } = require('../utils/supabase');
const { FORMA } = require('../nuevo/forma-inventada');
JS
printf 'module.exports = { FORMA: [] };\n' > "$FALSO/server/nuevo/forma-inventada.js"
# Trampa deliberada: un fichero VECINO que se llama igual que un paquete de
# node. `require('express')` no habla de él —habla de node_modules— pero quien
# resuelva sin mirar si la ruta es relativa lo confundirá, y a partir de ahí
# tocar un fichero cualquiera que comparta nombre con una dependencia exige
# tocar el contrato. Sin este caso, quitar ese filtro pasa en verde: se
# comprobó, y el sello daba 19/19 con el filtro fuera.
printf 'module.exports = {};\n' > "$FALSO/server/routes/express.js"
printf 'from ayudante import algo\n' > "$FALSO/kanban-mcp/server.py"
printf 'algo = 1\n' > "$FALSO/kanban-mcp/ayudante.py"

caso_falso() {
  local que="$1" esperado="$2"; shift 2
  local salida code
  salida="$(CONTRACT_GUARD_ROOT="$FALSO" \
            CONTRACT_GUARD_CHANGED="$(printf '%s\n' "$@")" bash "$GUARD" 2>&1)"
  code=$?
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    printf '%s\n' "$salida" | sed 's/^/          /'
  fi
}

caso_falso "un fichero que la puerta importa y NO está en ninguna lista (JS)" 1 \
  "server/nuevo/forma-inventada.js"
caso_falso "lo mismo por el lado del riel (Python)" 1 \
  "kanban-mcp/ayudante.py"
caso_falso "y lo que no importa nadie sigue callado" 0 \
  "server/nuevo/otro.js"
caso_falso "un paquete de node NO es el fichero vecino que se llama igual" 0 \
  "server/routes/express.js"

# Una puerta que ya no está donde dice se caería del cierre en silencio y el
# guardián seguiría dando verde con lo que quedara. Tiene que declararse roto.
VACIO="$(mktemp -d)"
salida_vacia="$(CONTRACT_GUARD_ROOT="$VACIO" CONTRACT_GUARD_CHANGED="README.md" bash "$GUARD" 2>&1)"
code_vacio=$?
if [ "$code_vacio" -eq 1 ]; then
  PASS=$((PASS + 1)); printf '  ok    %s\n' "una puerta que ya no está se declara rota, no verde"
else
  FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit 1, dio %s\n' "una puerta que ya no está se declara rota, no verde" "$code_vacio"
  printf '%s\n' "$salida_vacia" | sed 's/^/          /'
fi

# Y que falte UNA sola también cuenta: es el caso realista —alguien mueve un
# fichero y el guardián se queda vigilando la mitad sin decirlo—.
MEDIO="$(mktemp -d)"
mkdir -p "$MEDIO/kanban-mcp"
printf 'x = 1\n' > "$MEDIO/kanban-mcp/server.py"
salida_medio="$(CONTRACT_GUARD_ROOT="$MEDIO" CONTRACT_GUARD_CHANGED="README.md" bash "$GUARD" 2>&1)"
code_medio=$?
if [ "$code_medio" -eq 1 ]; then
  PASS=$((PASS + 1)); printf '  ok    %s\n' "si falta UNA puerta tampoco vale seguir con las demás"
else
  FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit 1, dio %s\n' "si falta UNA puerta tampoco vale seguir con las demás" "$code_medio"
  printf '%s\n' "$salida_medio" | sed 's/^/          /'
fi
rm -rf "$MEDIO"

rm -rf "$FALSO" "$VACIO"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián muerde donde debe y calla donde debe."
