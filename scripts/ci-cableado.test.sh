#!/usr/bin/env bash
# ci-cableado.test.sh — el sello del guardián del cableado del verdicto.
#
# Le pone delante cada forma en que un paso puede quedarse sin juzgar dentro de
# un job en verde, y exige rojo. Ejerce las DOS direcciones —el paso huérfano y
# la entrada fantasma— porque un guardián que solo mira una es la mitad de un
# guardián y se lee como entero.
#
# Uso: bash scripts/ci-cableado.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${CI_CABLEADO:-$REPO_ROOT/scripts/ci-cableado.sh}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# Monta un ci.yml de mentira. $1 = nombre · $2 = el bloque de pasos del job.
# La cabecera y el pie son fijos para que lo único que varíe sea lo que se prueba.
monta() {
  local nombre="$1" pasos="$2"
  local f="$TMP/$nombre.yml"
  {
    printf 'name: CI\n\non:\n  pull_request:\n    branches: [main]\n\njobs:\n'
    printf '  otro-job:\n    runs-on: ubuntu-latest\n    steps:\n'
    printf '      - name: algo\n        run: echo hola\n\n'
    printf '  comprobaciones-baratas:\n    runs-on: ubuntu-latest\n    steps:\n'
    printf '%s\n' "$pasos"
    printf '\n  client-build:\n    runs-on: ubuntu-latest\n    steps:\n'
    printf '      - name: build\n        run: echo build\n'
  } > "$f"
  echo "$f"
}

# $1 = qué se prueba · $2 = exit esperado · $3 = trozo esperado en el mensaje
# $4 = fichero · $5 = (opcional) job
corre() {
  local que="$1" esperado="$2" espera_msg="$3" fichero="$4" job="${5:-comprobaciones-baratas}"
  local salida code
  salida="$(CI_CABLEADO_WORKFLOW="$fichero" CI_CABLEADO_JOB="$job" bash "$GUARD" 2>&1)"
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

# ── bloques de pasos ─────────────────────────────────────────────────────────
BIEN='      - name: Checkout
        uses: actions/checkout@v4

      - name: Guardián uno
        id: uno
        continue-on-error: true
        run: bash scripts/uno.sh

      - name: Guardián dos
        id: dos
        continue-on-error: true
        run: bash scripts/dos.sh

      - name: Sello del verdicto
        run: bash scripts/ci-verdicto.test.sh

      - name: Verdicto
        run: |
          bash scripts/ci-verdicto.sh \
            "uno|${{ steps.uno.outcome }}" \
            "dos|${{ steps.dos.outcome }}"'

# Falta «dos» en la llamada: puede fallar y nadie lo mira. EL fallo.
HUERFANO='      - name: Guardián uno
        id: uno
        continue-on-error: true
        run: bash scripts/uno.sh

      - name: Guardián dos
        id: dos
        continue-on-error: true
        run: bash scripts/dos.sh

      - name: Verdicto
        run: |
          bash scripts/ci-verdicto.sh \
            "uno|${{ steps.uno.outcome }}"'

# La llamada cita un paso que ya no existe.
FANTASMA='      - name: Guardián uno
        id: uno
        continue-on-error: true
        run: bash scripts/uno.sh

      - name: Verdicto
        run: |
          bash scripts/ci-verdicto.sh \
            "uno|${{ steps.uno.outcome }}" \
            "borrado|${{ steps.borrado.outcome }}"'

# Puede fallar y no tiene nombre con el que citarlo.
SIN_ID='      - name: Guardián sin id
        continue-on-error: true
        run: bash scripts/uno.sh

      - name: Verdicto
        run: |
          bash scripts/ci-verdicto.sh \
            "algo|${{ steps.algo.outcome }}"'

# Pasos que pueden fallar y NADIE llama al verdicto: el agujero entero.
SIN_VERDICTO='      - name: Guardián uno
        id: uno
        continue-on-error: true
        run: bash scripts/uno.sh'

# MISMO NÚMERO, distintos nombres. Un guardián que comparase tamaños en vez de
# conjuntos daría verde aquí, y es el atajo que cualquiera escribiría primero.
MISMO_TAMANO='      - name: Guardián uno
        id: uno
        continue-on-error: true
        run: bash scripts/uno.sh

      - name: Verdicto
        run: |
          bash scripts/ci-verdicto.sh \
            "otro|${{ steps.otro.outcome }}"'

# El mismo conjunto, citado en otro orden. Es un conjunto, no una lista.
DESORDEN='      - name: Guardián uno
        id: uno
        continue-on-error: true
        run: bash scripts/uno.sh

      - name: Guardián dos
        id: dos
        continue-on-error: true
        run: bash scripts/dos.sh

      - name: Verdicto
        run: |
          bash scripts/ci-verdicto.sh \
            "dos|${{ steps.dos.outcome }}" \
            "uno|${{ steps.uno.outcome }}"'

# Pasos SIN continue-on-error: no entran en el conjunto y no se echan de menos.
# Es el caso del `checkout` y del sello del verdicto en el fichero real.
SOLO_DUROS='      - name: Checkout
        uses: actions/checkout@v4

      - name: Un paso con id pero que SÍ tumba el job
        id: duro
        run: bash scripts/duro.sh

      - name: Guardián uno
        id: uno
        continue-on-error: true
        run: bash scripts/uno.sh

      - name: Verdicto
        run: |
          bash scripts/ci-verdicto.sh \
            "uno|${{ steps.uno.outcome }}"'

echo "Sello del guardián del cableado ($GUARD)"
echo
echo "Tiene que MORDER — dirección 1: un paso puede fallar y nadie lo juzga:"
F="$(monta huerfano "$HUERFANO")"
corre "paso con continue-on-error fuera de la llamada"  1 "NADIE lo juzga"  "$F"
corre "y el mensaje nombra el id que falta"             1 "«dos»"           "$F"

echo
echo "Tiene que MORDER — dirección 2: la llamada cita algo que no existe:"
F="$(monta fantasma "$FANTASMA")"
corre "entrada que apunta a un id inexistente"          1 "no hay ningún paso" "$F"
corre "y el mensaje nombra el id fantasma"              1 "steps.borrado"      "$F"

echo
echo "Tiene que MORDER — el que no tiene nombre con el que citarse:"
F="$(monta sin_id "$SIN_ID")"
corre "continue-on-error sin id"                        1 "SIN \`id\`"      "$F"

echo
echo "Tiene que MORDER — mismo número de entradas, distintos nombres:"
F="$(monta mismo_tamano "$MISMO_TAMANO")"
corre "un paso y una entrada, pero no la suya"          1 "NADIE lo juzga"  "$F"
corre "y también señala la entrada fantasma"            1 "steps.otro"      "$F"

echo
echo "Tiene que MORDER — el agujero del tamaño del job:"
F="$(monta sin_verdicto "$SIN_VERDICTO")"
corre "pasos que pueden fallar y nadie llama al verdicto" 1 "no llama a ci-verdicto.sh" "$F"

echo
echo "Tiene que ROMPERSE, no saltar en verde:"
F="$(monta bien "$BIEN")"
corre "el job vigilado ya no está en el fichero"        2 "no está en"      "$F" "job-que-no-existe"
corre "el fichero de workflow no existe"               2 "no existe"       "$TMP/no-hay.yml"

echo
echo "Tiene que CALLAR:"
F="$(monta bien "$BIEN")"
corre "los dos conjuntos coinciden"                     0 "OK"              "$F"
F="$(monta desorden "$DESORDEN")"
corre "el mismo conjunto en otro orden"                 0 "OK"              "$F"
F="$(monta solo_duros "$SOLO_DUROS")"
corre "pasos sin continue-on-error no se echan de menos" 0 "OK"             "$F"

echo
echo "Y sobre el ci.yml de verdad, que es donde tiene que estrenar verde:"
salida="$(bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 0 ]; then
  PASS=$((PASS + 1)); printf '  ok    el cableado real cuadra — %s\n' "$salida"
else
  FAIL=$((FAIL + 1)); printf '  FALLO el cableado real NO cuadra\n'
  printf '%s\n' "$salida" | sed 's/^/          /'
fi

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián del cableado muerde en las dos direcciones y calla donde debe."
