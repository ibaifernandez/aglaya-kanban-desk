#!/usr/bin/env bash
# ci-verdicto.test.sh — el sello del que decide el color del job agrupado.
#
# Le pone delante cada forma en que una comprobación en rojo podría quedarse
# escondida dentro de un job en verde, y exige rojo. El caso que más importa no
# es el `failure`: es el **resultado vacío** por un `id` renombrado, que no da
# error en GitHub y se lee como «no falló».
#
# Uso: bash scripts/ci-verdicto.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERDICTO="${CI_VERDICTO:-$REPO_ROOT/scripts/ci-verdicto.sh}"

PASS=0
FAIL=0

# $1 = qué se prueba · $2 = exit esperado · $3 = (opcional) trozo que el
# mensaje DEBE contener · resto = los pares que se le pasan.
#
# El tercer argumento no es adorno: el rojo sale por caminos distintos —una
# comprobación fallida, una vacía, una llamada sin pares— y un sello que
# acierta el color y falla el motivo manda a arreglar otra cosa.
caso() {
  local que="$1" esperado="$2" espera_msg="$3"; shift 3
  local salida code
  salida="$(bash "$VERDICTO" "$@" 2>&1)"
  code=$?
  if [ -n "$espera_msg" ] && ! grep -q "$espera_msg" <<< "$salida"; then
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

echo "Sello del verdicto del job agrupado ($VERDICTO)"
echo
echo "Tiene que PONER ROJO:"

caso "una sola comprobación fallida"            1 "no están en verde" \
  "email-guard|failure"

caso "una fallida entre nueve verdes — la que se escondería" 1 "1 de 10" \
  "a|success" "b|success" "c|success" "d|success" "e|success" \
  "f|success" "g|success" "h|success" "i|success" "grants-guard|failure"

# EL caso. Renombrar el id de un paso deja `${{ steps.x.outcome }}` vacío, y
# GitHub no protesta. Un verdicto que solo mirase «¿es failure?» daría verde.
caso "resultado VACÍO por un id renombrado"     1 "vacío" \
  "contract-guard|" "otra|success"

caso "el nombre del paso desaparecido sale en el mensaje" 1 "contract-guard" \
  "contract-guard|" "otra|success"

# `skipped` es rojo a propósito: en ese job ningún paso tiene `if:`.
caso "una comprobación saltada"                 1 "skipped" \
  "hook-guard|skipped" "otra|success"

caso "una comprobación cancelada"               1 "cancelled" \
  "server|cancelled"

# Un resultado que no es ninguno de los conocidos tampoco se adivina.
caso "un resultado inventado"                   1 "no están en verde" \
  "algo|verde-que-yo-me-sé"

caso "par mal formado, sin la barra"            1 "separador" \
  "esto-no-lleva-barra"

echo
echo "Y sin nada que juzgar NO se salta en verde:"
caso "llamado sin ninguna comprobación"         2 "ninguna comprobación"

echo
echo "Tiene que PONER VERDE:"

caso "una sola en verde"                        0 "" \
  "email-guard|success"

caso "las diez del job real, todas en verde"    0 "Las 10 en verde" \
  "Riel · validación de destino|success" \
  "Riel · envoltorio|success" \
  "contract-guard · sello|success" \
  "contract-guard · guardián|success" \
  "grants-guard · sello|success" \
  "grants-guard · guardián|success" \
  "hook-guard · sello|success" \
  "hook-guard · guardián|success" \
  "email-guard · sello|success" \
  "email-guard · guardián|success"

# Los nombres reales llevan espacios, puntos y «·». Si el script partiera por
# espacios en vez de por «|», esto se rompería.
caso "nombres con espacios y puntos medios"     0 "" \
  "Riel · validación de destino|success"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El verdicto pone rojo donde debe y verde donde debe."
