#!/usr/bin/env bash
# base-consultable-guard.test.sh — el sello.
#
# Le fabrica un árbol de workflows y un documento de mentira y exige que muerda
# en LAS DOS DIRECCIONES, que significan cosas distintas:
#
#   · una vía que existe y el documento calla → el papel automático creerá que
#     no se puede preguntar, y volverá a poner a una persona en medio;
#   · una vía que el documento anuncia y ya no contesta → quien la siga no
#     obtiene un error, obtiene nada, y nada se parece a que no había nada.
#
# Un guardián que solo mirase una es la mitad de un guardián y se lee como
# entero.
#
# Uso: bash scripts/base-consultable-guard.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${BASE_CONSULTABLE_GUARD:-$REPO_ROOT/scripts/base-consultable-guard.sh}"
TMP="$(mktemp -d)"

PASS=0
FAIL=0

# ── Un árbol de mentira, con las cuatro combinaciones que importan ───────────
WF="$TMP/wf"; mkdir -p "$WF"

# Cuenta: disparo manual + credencial real.
cat > "$WF/mide.yml" <<'YML'
name: mide
on:
  schedule:
    - cron: '0 1 * * *'
  workflow_dispatch:
jobs:
  x:
    steps:
      - env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: bash scripts/algo.sh
YML

# Cuenta también.
cat > "$WF/tambien-mide.yml" <<'YML'
name: tambien-mide
on:
  workflow_dispatch:
jobs:
  x:
    steps:
      - env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: bash scripts/otro.sh
YML

# NO cuenta: toca la base pero no se puede disparar a mano. Preguntarle cuando
# hace falta es imposible, así que no es una vía.
cat > "$WF/sin-disparo.yml" <<'YML'
name: sin-disparo
on:
  schedule:
    - cron: '0 2 * * *'
jobs:
  x:
    steps:
      - env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: bash scripts/algo.sh
YML

# NO cuenta: se dispara a mano pero no mira ESTA base. El valor falso de las
# pruebas es justo la trampa que hay en `ci.yml` de verdad — si el guardián
# buscara la palabra suelta, contaría workflows que no miden nada.
cat > "$WF/valores-de-mentira.yml" <<'YML'
name: valores-de-mentira
on:
  workflow_dispatch:
jobs:
  x:
    steps:
      - env:
          SUPABASE_URL: http://localhost
          DATABASE_URL: postgres://falso
        run: npx jest
YML

doc_con() {  # $1… = nombres de workflow que el documento nombrará
  local f="$TMP/doc.md"
  {
    echo "# Documento de mentira"
    echo
    echo "Texto de antes que menciona \`otro.yml\` fuera del bloque, para que"
    echo "el guardián NO lo enganche: comparar contra el fichero entero cazaría"
    echo "cualquier mención de paso."
    echo
    echo '<!-- base-consultable:inicio -->'
    for w in "$@"; do echo "| \`$w\` | lo que conteste |"; done
    echo '<!-- base-consultable:fin -->'
    echo
    echo "Y texto de después, con \`ni-este.yml\` suelto."
  } > "$f"
  printf '%s' "$f"
}

# $1 = qué se prueba · $2 = exit esperado · $3 = trozo esperado · $4 = doc
corre() {
  local que="$1" esperado="$2" espera_msg="$3" doc="$4"
  local salida code
  salida="$(BASE_CONSULTABLE_WORKFLOWS="$WF" BASE_CONSULTABLE_DOC="$doc" bash "$GUARD" 2>&1)"
  code=$?
  if [ -n "$espera_msg" ] && ! printf '%s' "$salida" | grep -qF "$espera_msg"; then
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

echo "Sello del guardián de «se le puede preguntar a la base» ($GUARD)"
echo
echo "Tiene que MORDER — dirección 1: hay una vía que el documento no cuenta:"
corre "falta una vía entera"           1 "y el documento NO lo nombra" "$(doc_con mide.yml)"
corre "y el mensaje la nombra"         1 "«tambien-mide.yml»"          "$(doc_con mide.yml)"
# «Faltan las dos» tiene que probarse con un bloque NO vacío: un bloque vacío es
# el caso ROTO —se mide más abajo— y confundirlos haría que este caso pasara por
# el motivo equivocado. Lo encontró el propio sello al escribirse.
corre "faltan las dos, y salen las dos" 1 "«mide.yml»"            "$(doc_con ajena.yml)"
corre "…la segunda también"             1 "«tambien-mide.yml»"    "$(doc_con ajena.yml)"

echo
echo "Tiene que MORDER — dirección 2: el documento anuncia lo que ya no contesta:"
corre "una vía que no existe"          1 "obtendrá nada" "$(doc_con mide.yml tambien-mide.yml fantasma.yml)"
corre "y el mensaje la nombra"         1 "«fantasma.yml»" "$(doc_con mide.yml tambien-mide.yml fantasma.yml)"
# Éstos son la parte fina: existen en el árbol y aun así NO son vías.
corre "uno que toca la base sin disparo manual" 1 "«sin-disparo.yml»" \
  "$(doc_con mide.yml tambien-mide.yml sin-disparo.yml)"
corre "uno con disparo pero sin la credencial real" 1 "«valores-de-mentira.yml»" \
  "$(doc_con mide.yml tambien-mide.yml valores-de-mentira.yml)"

echo
echo "Tiene que MORDER las dos a la vez, sin que una tape a la otra:"
salida="$(BASE_CONSULTABLE_WORKFLOWS="$WF" BASE_CONSULTABLE_DOC="$(doc_con mide.yml fantasma.yml)" \
          bash "$GUARD" 2>&1)"
if printf '%s' "$salida" | grep -qF "«tambien-mide.yml»" && \
   printf '%s' "$salida" | grep -qF "«fantasma.yml»"; then
  PASS=$((PASS + 1)); printf '  ok    la que falta y la que sobra salen las dos\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO una tapó a la otra\n'
  printf '%s\n' "$salida" | sed 's/^/          /'
fi

echo
echo "Tiene que ROMPERSE, no saltar en verde:"
corre "el documento no existe"          2 "no existe el documento" "$TMP/no-hay.md"
printf '%s' "sin marcas" > "$TMP/sin-marcas.md"
corre "el documento no lleva las marcas" 2 "no lleva la marca" "$TMP/sin-marcas.md"
printf '%s\n' '<!-- base-consultable:inicio -->' > "$TMP/abierto.md"
corre "el bloque queda abierto"          2 "el bloque está abierto" "$TMP/abierto.md"
printf '%s\n%s\n' '<!-- base-consultable:inicio -->' '<!-- base-consultable:fin -->' > "$TMP/vacio.md"
corre "el bloque está vacío"             2 "no nombra ningún workflow" "$TMP/vacio.md"

# Y el caso que más importa de los rotos: si CAMBIA la forma de nombrar la
# credencial, este guardián se queda sin nada que comparar. Dar verde ahí sería
# certificar un documento que podría estar entero equivocado.
VACIO="$TMP/wf-vacio"; mkdir -p "$VACIO"
cat > "$VACIO/otra-forma.yml" <<'YML'
name: otra-forma
on:
  workflow_dispatch:
jobs:
  x:
    steps:
      - env:
          CADENA_DE_LA_BASE: ${{ secrets.OTRO_NOMBRE }}
        run: bash scripts/algo.sh
YML
salida="$(BASE_CONSULTABLE_WORKFLOWS="$VACIO" BASE_CONSULTABLE_DOC="$(doc_con mide.yml)" bash "$GUARD" 2>&1)"
code=$?
if [ "$code" -eq 2 ] && printf '%s' "$salida" | grep -qF "dejó de reconocerla"; then
  PASS=$((PASS + 1)); printf '  ok    la credencial cambió de nombre: se rompe, no da verde\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO con la credencial renombrada dio exit %s\n' "$code"
  printf '%s\n' "$salida" | sed 's/^/          /'
fi

echo
echo "Tiene que CALLAR:"
corre "el documento nombra exactamente las vías que hay" 0 "OK" \
  "$(doc_con mide.yml tambien-mide.yml)"
corre "y da igual el orden"                              0 "OK" \
  "$(doc_con tambien-mide.yml mide.yml)"

echo
echo "Y sobre el árbol y el documento de VERDAD:"
salida="$(bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 0 ]; then
  PASS=$((PASS + 1)); printf '  ok    el repo real cuadra\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO el repo real no cuadra (exit %s)\n' "$code"
  printf '%s\n' "$salida" | sed 's/^/          /'
fi

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián muerde en las dos direcciones y calla donde debe."
