#!/usr/bin/env bash
# correo-cero-guard.test.sh — el sello del guardián del correo cero.
#
# Un guardián de «esto ya no existe» es el más fácil de dejar destripado: como
# lo normal es que no encuentre nada, un guardián roto y un árbol limpio dan
# exactamente el mismo verde. Aquí se le da de comer cada vía de vuelta, una a
# una, y se exige que muerda.
#
# Uso: bash scripts/correo-cero-guard.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${CORREO_GUARD:-$REPO_ROOT/scripts/correo-cero-guard.sh}"

PASS=0
FAIL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Árbol de mentira: un repo git de verdad (el guardián mira lo VERSIONADO, así
# que un fichero sin añadir no cuenta — y eso también se comprueba abajo).
nuevo_arbol() {
  local d="$TMP/$1"
  rm -rf "$d"; mkdir -p "$d/server/routes" "$d/scripts" "$d/.github/workflows" "$d/docs"
  git -C "$d" init -q
  git -C "$d" config user.email t@t.t
  git -C "$d" config user.name t
  printf 'const x = 1;\n' > "$d/server/routes/cards.js"
  printf '{ "dependencies": { "express": "^4" } }\n' > "$d/package.json"
  echo "$d"
}

versiona() { git -C "$1" add -A >/dev/null 2>&1; }

corre() { CORREO_GUARD_RAIZ="$1" bash "$GUARD" 2>&1; }

muerde() {
  local que="$1" arbol="$2"
  local salida; salida="$(corre "$arbol")"; local code=$?
  if [ "$code" -eq 1 ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit 1, dio %s\n' "$que" "$code"
    printf '        %s\n' "$(tail -1 <<< "$salida")"
  fi
}

calla() {
  local que="$1" arbol="$2"
  local salida; salida="$(corre "$arbol")"; local code=$?
  if [ "$code" -eq 0 ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit 0, dio %s\n' "$que" "$code"
    printf '        %s\n' "$(grep -m1 '::error' <<< "$salida")"
  fi
}

echo "Sello del guardián del correo cero ($GUARD)"
echo
echo "Tiene que MORDER cada vía de vuelta:"

a="$(nuevo_arbol dep)"
printf '{ "dependencies": { "resend": "^6.12.2" } }\n' > "$a/package.json"
versiona "$a"; muerde "vuelve la dependencia que se retiró (resend)" "$a"

# El que vuelva no tiene por qué ser el que se fue. Sin esta pareja, el
# guardián valdría solo contra el pasado exacto.
a="$(nuevo_arbol otrodep)"
printf '{ "dependencies": { "nodemailer": "^7" } }\n' > "$a/package.json"
versiona "$a"; muerde "vuelve OTRO SDK de correo, no el mismo" "$a"

a="$(nuevo_arbol ruta)"
printf "app.use('/api/digest', r);\n" > "$a/server/routes/cards.js"
versiona "$a"; muerde "vuelve la superficie /api/digest" "$a"

a="$(nuevo_arbol envoltorio)"
printf "const { sendEmail } = require('../utils/mailer');\n" > "$a/server/routes/cards.js"
versiona "$a"; muerde "vuelve el envoltorio utils/mailer" "$a"

a="$(nuevo_arbol envio)"
printf "await sendEmail({ to, subject, html });\n" > "$a/server/routes/cards.js"
versiona "$a"; muerde "alguien manda un correo, aunque el envoltorio se llame de otra forma" "$a"

a="$(nuevo_arbol reloj)"
printf "on:\n  schedule:\n    - cron: '0 * * * *'\njobs:\n  x:\n    steps:\n      - run: curl /api/digest/cron-trigger\n" \
  > "$a/.github/workflows/algo.yml"
versiona "$a"; muerde "vuelve el reloj que disparaba el digest" "$a"

echo
echo "Y tiene que CALLAR donde debe:"

a="$(nuevo_arbol limpio)"
versiona "$a"; calla "un árbol sin ninguna vía de correo" "$a"

# Si mordiera la documentación, retirar el correo sería imposible: contar por
# qué se retiró exige nombrarlo.
a="$(nuevo_arbol docs)"
printf '# El digest se retiró; `/api/digest` ya no existe y sendEmail() tampoco.\n' > "$a/docs/ADR.md"
printf 'Se usaba `resend`.\n' > "$a/README.md"
versiona "$a"; calla "la documentación puede contar lo que se retiró" "$a"

# Y un comentario en código tampoco es una vía: el propio guardián lleva la
# palabra dentro. Sin esto se mordería a sí mismo.
a="$(nuevo_arbol comentario)"
printf '// Aquí vivía sendEmail() y la ruta /api/digest. Ya no.\nconst x = 1;\n' > "$a/server/routes/cards.js"
versiona "$a"; calla "un comentario que explica lo retirado" "$a"

# La prueba de la ausencia tiene que poder nombrar lo ausente.
a="$(nuevo_arbol pruebaausencia)"
mkdir -p "$a/server/tests"
printf "it('no existe', () => request(app).post('/api/digest/send-me'));\n" > "$a/server/tests/correo-cero.test.js"
versiona "$a"; calla "la prueba de que /api/digest ya no existe puede nombrarlo" "$a"

# ⚠️ Y la excepción es UN FICHERO, no «los tests». Si se ensanchara, cualquiera
# podría mandar correo de verdad desde una prueba y este guardián callaría.
a="$(nuevo_arbol otraprueba)"
mkdir -p "$a/server/tests"
printf "await sendEmail({ to: 'x@y.z' });\n" > "$a/server/tests/otra.test.js"
versiona "$a"; muerde "otra prueba cualquiera NO está exenta" "$a"

echo
echo "Y no puede dar verde sin haber medido:"

vacio="$TMP/sin-git"; mkdir -p "$vacio"
salida="$(CORREO_GUARD_RAIZ="$vacio" bash "$GUARD" 2>&1)"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    sin repositorio → exit 2, que no es «está limpio»\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO sin repositorio — esperaba exit 2, dio %s\n' "$code"
fi

# El caso que convierte un guardián en decorado: mirar CERO ficheros y decir OK.
a="$(nuevo_arbol nada)"
rm -f "$a/server/routes/cards.js" "$a/package.json"
printf 'hola\n' > "$a/otro.txt"
versiona "$a"
salida="$(corre "$a")"; code=$?
if [ "$code" -eq 2 ]; then
  PASS=$((PASS + 1)); printf '  ok    nada que mirar → exit 2, no verde\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO nada que mirar — esperaba exit 2, dio %s\n' "$code"
fi

# Mira el árbol versionado, no el disco: un fichero sin añadir no existe para él.
a="$(nuevo_arbol sinversionar)"
versiona "$a"
printf "await sendEmail({ to });\n" > "$a/server/routes/fuga.js"   # NO versionado
calla "un fichero sin versionar no cuenta (mira el árbol de verdad)" "$a"

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || exit 1
echo "Muerde cada vía de vuelta del correo, calla ante lo que solo habla de él, y no da verde sin mirar."
