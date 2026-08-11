#!/usr/bin/env bash
# hook-guard.test.sh — el sello del guardián del enganche.
#
# Le pone delante cada forma en que el enganche puede desaparecer y exige rojo.
# El caso 2 no es hipotético: es exactamente lo que pasó el 6-ago-2026 al cambiar
# de rama, y lo que motivó el guardián.
#
# Uso: bash scripts/hook-guard.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${HOOK_GUARD:-$REPO_ROOT/scripts/hook-guard.sh}"
TMP="$(mktemp -d)"

PASS=0
FAIL=0

# $1 = qué se prueba · $2 = exit esperado · $3 = contenido del settings.json
# $4 = (opcional) trozo que el mensaje DEBE contener.
#
# El cuarto argumento no es adorno. Sin él, este harness solo comprobaba el
# COLOR, y varios casos caen en rojo por caminos distintos: con `PreToolUse`
# vacío la lista de comandos también queda vacía, así que el guardián muerde
# por «el comando no invoca permiso.py» en vez de por «no hay enganche».
# Comprobado por mutación: neutralizar la comprobación de «no hay enganche»
# pasaba 10 de 10 en verde. Sigue protegiendo, pero el diagnóstico cambia — y un
# guardián que acierta el color y falla el motivo manda a arreglar otra cosa.
caso() {
  local que="$1" esperado="$2" contenido="$3" espera_msg="${4:-}"
  printf '%s' "$contenido" > "$TMP/settings.json"
  local salida code
  salida="$(HOOK_GUARD_SETTINGS="$TMP/settings.json" bash "$GUARD" 2>&1)"
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

BUENO='{"hooks":{"PreToolUse":[{"matcher":"*","hooks":[{"type":"command","command":"python3 \"/ruta/a/permiso.py\""}]}]}}'

echo "Sello del guardián del enganche ($GUARD)"
echo
echo "Tiene que MORDER:"
# EL caso. Fichero presente, JSON válido, cero protección. Pasó de verdad.
caso "settings.json vacío — lo que pasó al cambiar de rama" 1 '{}' "NO declara"
caso "hay bloque hooks pero sin PreToolUse"                 1 '{"hooks":{"PostToolUse":[]}}' "NO declara"
caso "PreToolUse presente pero vacío"                       1 '{"hooks":{"PreToolUse":[]}}' "NO declara"
caso "el comando ya no invoca el script de permisos"        1 '{"hooks":{"PreToolUse":[{"matcher":"*","hooks":[{"type":"command","command":"echo ok"}]}]}}' "no invoca"
caso "JSON roto — el enganche no se podría cargar"          1 '{"hooks":' "no es JSON"
# Un enganche que declara la entrada pero sin comando dentro no protege nada.
caso "entrada PreToolUse con la lista de hooks vacía"       1 '{"hooks":{"PreToolUse":[{"matcher":"*","hooks":[]}]}}' "no invoca"

echo
echo "Tiene que CALLAR:"
caso "el enganche declarado como toca"                      0 "$BUENO"
# La ruta puede cambiar sin que el enganche desaparezca: lo que se fija es el
# script, no dónde vive. Fijar la ruta aquí sería copiar el dato que discutimos.
caso "misma protección desde otra ruta"                     0 '{"hooks":{"PreToolUse":[{"matcher":"*","hooks":[{"type":"command","command":"python3 /otro/sitio/permiso.py"}]}]}}'
caso "con otros bloques alrededor"                          0 '{"permissions":{"allow":["Bash"]},"hooks":{"PreToolUse":[{"matcher":"*","hooks":[{"type":"command","command":"python3 permiso.py"}]}]}}'

echo
echo "Y sin fichero no se salta en verde:"
salida="$(HOOK_GUARD_SETTINGS="$TMP/no-existe.json" bash "$GUARD" 2>&1)"
if [ $? -ne 0 ]; then
  PASS=$((PASS + 1)); printf '  ok    un settings.json ausente falla, no se omite\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO un settings.json ausente dio verde\n'
fi

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián muerde donde debe y calla donde debe."
