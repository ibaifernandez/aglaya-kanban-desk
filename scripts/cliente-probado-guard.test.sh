#!/usr/bin/env bash
# cliente-probado-guard.test.sh — el sello. Tarjeta `97307036`.
#
# Le fabrica clientes y workflows de mentira y exige que muerda en las TRES
# averías, que son distintas y se confunden:
#
#   · no quedan pruebas        → el corredor corre y no mide nada;
#   · el guion no llama a vitest → sale con 0 sin correr nada: el falso verde;
#   · CI no las invoca         → existen, y nadie las ejecuta. Ésta es la que
#     esta casa ya pagó con el #34: una comprobación ausente no se distingue de
#     una que pasó.
#
# Y el caso fino: las dos señales de la tercera —`working-directory: ./client` y
# `npm test`— **tienen que estar en el mismo paso**. Sueltas por el fichero las
# hay ya (el paso del build usa el mismo directorio), así que un guardián que las
# buscara por separado daría verde sin que nadie corriera nada.
#
# Uso: bash scripts/cliente-probado-guard.test.sh
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="$RAIZ/scripts/cliente-probado-guard.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0

# $1 = nombre del caso · $2 = guion test · $3 = ¿hay prueba? (si/no)
cliente_de_mentira() {
  local dir="$TMP/cliente-$1"
  mkdir -p "$dir/src/components"
  printf '{"name":"c","scripts":{"test":"%s"}}\n' "$2" > "$dir/package.json"
  [ "$3" = si ] && echo "it('x', () => {});" > "$dir/src/components/algo.test.jsx"
  printf '%s' "$dir"
}

# $1 = qué pasos lleva: completo | sin-paso | separado
ci_de_mentira() {
  local f="$TMP/ci-$1.yml"
  {
    echo "jobs:"
    echo "  client-build:"
    echo "    steps:"
    echo "      - name: Install"
    echo "        working-directory: ./client"
    echo "        run: npm ci"
    if [ "$1" = completo ]; then
      echo "      - name: Client tests"
      echo "        working-directory: ./client"
      echo "        run: npm test"
    fi
    # Las cuatro formas de dejar el paso puesto y que no gobierne nada. Las tres
    # primeras las midió el vigilante sobre el `ci.yml` de verdad, y las tres
    # daban verde: el paso existía y el guardián lo daba por bueno.
    #
    # A2 es la que devolvió la PR, y no por retorcida sino por lo contrario:
    # `continue-on-error: true` es el idioma que ese mismo fichero usa seis
    # líneas más arriba para los guardianes. Copiarlo aquí es un descuido de una
    # línea que deja las pruebas corriendo y sin poder poner nada en rojo.
    if [ "$1" = si-falso ]; then
      echo "      - name: Client tests"
      echo "        working-directory: ./client"
      echo "        if: false"
      echo "        run: npm test"
    fi
    if [ "$1" = tolerado ]; then
      echo "      - name: Client tests"
      echo "        working-directory: ./client"
      echo "        continue-on-error: true"
      echo "        run: npm test"
    fi
    if [ "$1" = solo-por-reloj ]; then
      echo "      - name: Client tests"
      echo "        working-directory: ./client"
      echo "        if: github.event_name == 'schedule'"
      echo "        run: npm test"
    fi
    if [ "$1" = sin-pruebas-vale ]; then
      echo "      - name: Client tests"
      echo "        working-directory: ./client"
      echo "        run: npm test -- --passWithNoTests src/no-existe"
    fi
    if [ "$1" = separado ]; then
      # Las dos señales existen, pero en pasos DISTINTOS: el directorio del
      # cliente en el build, y un `npm test` en el job del servidor.
      echo "      - name: Build"
      echo "        working-directory: ./client"
      echo "        run: npm run build"
      echo "  server-tests:"
      echo "    steps:"
      echo "      - name: Tests del servidor"
      echo "        run: npm test"
    fi
    echo "      - name: Build"
    echo "        working-directory: ./client"
    echo "        run: npm run build"
  } > "$f"
  printf '%s' "$f"
}

# $1 = qué se prueba · $2 = exit esperado · $3 = trozo esperado · $4 = dir · $5 = ci
corre() {
  local que="$1" esperado="$2" espera_msg="$3" dir="$4" ci="$5" salida code
  salida="$(CLIENTE_DIR="$dir" CLIENTE_CI="$ci" bash "$GUARD" 2>&1)"; code=$?
  if [ -n "$espera_msg" ] && ! grep -qF "$espera_msg" <<< "$salida"; then
    FAIL=$((FAIL + 1)); printf '  FALLO %s — el mensaje no dice «%s»\n' "$que" "$espera_msg"
    printf '%s\n' "$salida" | sed 's/^/          /'; return
  fi
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    printf '%s\n' "$salida" | sed 's/^/          /'
  fi
}

echo "Sello del guardián de las pruebas de cliente ($GUARD)"
echo
echo "Tiene que MORDER:"
corre "no queda ninguna prueba de cliente" 1 "no queda ni una prueba de cliente" \
  "$(cliente_de_mentira vacio 'vitest run' no)" "$(ci_de_mentira completo)"
corre "el guion «test» no llama a vitest" 1 "no llama a vitest" \
  "$(cliente_de_mentira falso 'echo ok' si)" "$(ci_de_mentira completo)"
corre "el guion «test» no existe" 1 "no tiene guion «test»" \
  "$(cliente_de_mentira singuion '' si)" "$(ci_de_mentira completo)"
corre "CI no invoca las pruebas" 1 "no invoca las pruebas del cliente" \
  "$(cliente_de_mentira ok1 'vitest run' si)" "$(ci_de_mentira sin-paso)"
corre "las dos señales, pero en pasos DISTINTOS" 1 "no invoca las pruebas del cliente" \
  "$(cliente_de_mentira ok2 'vitest run' si)" "$(ci_de_mentira separado)"

echo
echo "Tiene que MORDER un paso PUESTO pero neutralizado — las cuatro formas:"
corre "el paso lleva «if: false»"                 1 "no invoca las pruebas del cliente" \
  "$(cliente_de_mentira n1 'vitest run' si)" "$(ci_de_mentira si-falso)"
corre "el paso lleva «continue-on-error: true»"   1 "no invoca las pruebas del cliente" \
  "$(cliente_de_mentira n2 'vitest run' si)" "$(ci_de_mentira tolerado)"
corre "el paso solo corre por reloj"              1 "no invoca las pruebas del cliente" \
  "$(cliente_de_mentira n3 'vitest run' si)" "$(ci_de_mentira solo-por-reloj)"
corre "el paso acepta no encontrar pruebas"       1 "no invoca las pruebas del cliente" \
  "$(cliente_de_mentira n4 'vitest run' si)" "$(ci_de_mentira sin-pruebas-vale)"

echo
echo "Tiene que ROMPERSE, no saltar en verde:"
corre "no existe el directorio del cliente" 2 "no existe el directorio del cliente" \
  "$TMP/no-existe" "$(ci_de_mentira completo)"
corre "no existe el workflow" 2 "no existe" \
  "$(cliente_de_mentira ok3 'vitest run' si)" "$TMP/no-existe.yml"

echo
echo "Tiene que CALLAR:"
corre "pruebas, guion con vitest, y CI que las corre" 0 "OK" \
  "$(cliente_de_mentira ok4 'vitest run' si)" "$(ci_de_mentira completo)"

echo
echo "Y sobre el cliente y el workflow de VERDAD:"
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
echo "El guardián muerde en las averías que dice vigilar, incluido el paso neutralizado, y calla donde debe."
