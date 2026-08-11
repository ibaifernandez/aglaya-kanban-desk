#!/usr/bin/env bash
# corridas-guard.test.sh — el sello del guardián de las corridas que faltan.
#
# EL CASO QUE MANDA es el tercero: **cero corridas de Actions NO es «ninguna
# fallida»**. Es el que originó la tarjeta, el que devolvió «ninguna» sobre el
# PR #46, y el que un instrumento que busca fallos entre los presentes no puede
# ver por construcción.
#
# El resto están para que el guardián no sea un `exit 1` con adornos: tiene que
# CALLAR cuando corrió todo, y no puede contar como esperado un workflow que no
# se dispara con un PR — si lo hiciera, cada corrida sería roja y en dos días
# nadie lo miraría.
#
# Los fixtures son directorios de workflows de mentira. No hay red: qué corrió
# se inyecta. Mismo truco que el resto de sellos de esta casa.
#
# Uso: bash scripts/corridas-guard.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${CORRIDAS_GUARD:-$REPO_ROOT/scripts/corridas-guard.sh}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# wf <dir> <fichero> <name> <bloque on:>
wf() {
  local dir="$1" fichero="$2" nombre="$3" disparador="$4"
  mkdir -p "$TMP/$dir"
  { printf 'name: %s\n\non:\n' "$nombre"; printf '%s\n' "$disparador"; printf '\njobs:\n  x:\n    runs-on: ubuntu-latest\n'; } \
    > "$TMP/$dir/$fichero"
}

# caso <qué> <exit esperado> <dir de workflows> <lo que corrió> [trozo del mensaje]
caso() {
  local que="$1" esperado="$2" dir="$3" corrieron="$4" espera_msg="${5:-}"
  local salida code
  salida="$(CORRIDAS_GUARD_WORKFLOWS="$TMP/$dir" CORRIDAS_GUARD_BASE=main \
            CORRIDAS_GUARD_CORRIERON="$corrieron" bash "$GUARD" --pr 46 2>&1)"
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

# Un repo de mentira con tres workflows: dos que corren en PR y uno de reloj.
wf tres ci.yml         'CI'         '  push:
    branches: [main]
  pull_request:
    branches: [main]'
wf tres otro.yml       'Otro en PR' '  pull_request:
    branches: [main]'
wf tres reloj.yml      'Solo reloj' "  schedule:
    - cron: '41 6 * * *'
  workflow_dispatch:"

echo "Sello del guardián de las corridas que faltan ($GUARD)"
echo
echo "Tiene que MORDER:"

# ── EL CASO. Es el de la tarjeta, literal.
caso "PR en conflicto: CERO corridas de Actions" 1 tres '' \
  "no falló ninguna porque no corrió ninguna"

caso "y lo dice con las dos palabras que se confunden" 1 tres '' \
  "«Ninguna comprobación fallida» es CIERTO aquí"

caso "falta una de las dos que debían" 1 tres 'CI' \
  "Otro en PR"

caso "corrió una que no se esperaba, pero falta una que sí" 1 tres $'CI\nUna de fuera' \
  "Otro en PR"

# Sin workflows que esperar, un guardián nunca echa nada de menos. Eso no es
# verde: es que no está mirando.
mkdir -p "$TMP/vacio"
caso "ningún workflow del que derivar expectativa" 1 vacio 'CI' \
  "eso no es verde, es ceguera"

echo
echo "Tiene que CALLAR:"

caso "corrieron las dos que debían" 0 tres $'CI\nOtro en PR' \
  "corrieron las 2 que debían"

caso "y no exige el workflow que solo tiene reloj" 0 tres $'CI\nOtro en PR' \
  "corridas-guard"

caso "sobra una corrida ajena, pero están todas las que debían" 0 tres $'CI\nOtro en PR\nNetlify' \
  "OK"

# Un workflow acotado a otra rama no se espera en un PR contra `main`.
wf otrarama ci.yml 'CI'        '  pull_request:
    branches: [main]'
wf otrarama solo-dev.yml 'Solo dev' '  pull_request:
    branches: [dev]'
caso "un workflow acotado a otra rama no se espera aquí" 0 otrarama 'CI' "OK"

echo
echo "Y no puede dar verde sin haber podido mirar:"

# La derivación revienta a mitad: un `.yml` que no se puede leer porque es un
# directorio. Lo ya impreso sería una expectativa MÁS CORTA que la real — un
# guardián que echa de menos menos cosas. Este caso nació de una mutación que
# sobrevivía: rompiendo el bucle a mitad, el sello daba 11 de 11.
mkdir -p "$TMP/roto"
cp "$TMP/tres/ci.yml" "$TMP/roto/aaa-ci.yml"
mkdir -p "$TMP/roto/zzz-imposible.yml"
caso "la derivación revienta a mitad de la lista" 1 roto 'CI' \
  "falló a mitad"

# El BARRIDO de varios PR, y su recuento. Sin esto, «se juzgaron todos los que
# había» solo se ejercía con red delante — es decir, no se ejercía.
salida="$(CORRIDAS_GUARD_WORKFLOWS="$TMP/tres" CORRIDAS_GUARD_BASE=main \
          CORRIDAS_GUARD_CORRIERON=$'CI\nOtro en PR' \
          CORRIDAS_GUARD_PRS=$'1|aaa|main\n2|bbb|main' bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 0 ] && [ "$(grep -c '✅  PR #' <<< "$salida")" = "2" ]; then
  PASS=$((PASS + 1)); printf '  ok    barrido de dos PR: juzga los dos\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO barrido de dos PR — exit %s\n' "$code"
  sed 's/^/          /' <<< "$salida"
fi

# Una línea de la lista que no se puede juzgar NO puede desaparecer en silencio:
# el recuento tiene que cazarla.
salida="$(CORRIDAS_GUARD_WORKFLOWS="$TMP/tres" CORRIDAS_GUARD_BASE=main \
          CORRIDAS_GUARD_CORRIERON=$'CI\nOtro en PR' \
          CORRIDAS_GUARD_PRS=$'1|aaa|main\n|bbb|main' bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    un PR de la lista sin juzgar → exit 2, no verde\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO PR sin juzgar — esperaba exit 2, dio %s\n' "$code"
  sed 's/^/          /' <<< "$salida"
fi

salida="$(CORRIDAS_GUARD_WORKFLOWS="$TMP/no-existe" CORRIDAS_GUARD_CORRIERON='CI' bash "$GUARD" --pr 1 2>&1)"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    directorio de workflows inexistente → exit 2\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO directorio inexistente — esperaba exit 2, dio %s\n' "$code"
fi

salida="$(CORRIDAS_GUARD_WORKFLOWS="$TMP/tres" bash "$GUARD" --argumento-que-no-existe 2>&1)"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    argumento desconocido → exit 2, no verde\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO argumento desconocido — esperaba exit 2, dio %s\n' "$code"
fi

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || exit 1
echo "Distingue «ninguna fallida» de «ninguna». Y no da verde sin haber mirado."
