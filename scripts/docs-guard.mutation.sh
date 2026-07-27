#!/usr/bin/env bash
# docs-guard.mutation.sh — ¿y quién vigila al sello?
#
# docs-guard.test.sh demuestra que el guardián muerde. Este script demuestra que
# ESE harness no es vacuo: destripa el guardián regla por regla y exige que el
# harness lo detecte. Si borras la regla V2 y el sello sigue verde, el sello es
# decoración.
#
# Uso: bash scripts/docs-guard.mutation.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="$REPO_ROOT/scripts/docs-guard.sh"
HARNESS="$REPO_ROOT/scripts/docs-guard.test.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# kill_rule <id> <etiqueta>
# Quita el id de la tabla RULES= del guardián (así es como alguien lo destriparía
# de verdad) y exige que el sello se ponga ROJO.
kill_rule() {
  local id="$1" label="$2"
  local mutant="$TMP/docs-guard.mutant.sh"

  awk -v id="$id" '
    /^(RULES|CROSSCHECKS)=\(/ {
      name = $0; sub(/=\(.*/, "", name)          # RULES | CROSSCHECKS
      line = $0; sub(/^[A-Z]+=\(/, "", line); sub(/\)[[:space:]]*$/, "", line)
      n = split(line, a, " ")
      out = ""
      for (i = 1; i <= n; i++) if (a[i] != id) out = out (out == "" ? "" : " ") a[i]
      print name "=(" out ")"
      next
    }
    { print }
  ' "$GUARD" >"$mutant"

  if cmp -s "$GUARD" "$mutant"; then
    echo "  ❌ no se pudo amputar $id de RULES=/CROSSCHECKS= — mutación no aplicada"
    FAIL=$((FAIL + 1))
    return
  fi

  if DOCS_GUARD="$mutant" bash "$HARNESS" >"$TMP/harness.txt" 2>&1; then
    echo "  ❌ SELLO VERDE con la regla $label amputada — el sello es decoración."
    FAIL=$((FAIL + 1))
  else
    echo "  ✅ SELLO ROJO al amputar $label — el sello detecta el destripamiento."
    PASS=$((PASS + 1))
  fi
}

echo "=== mutación: destripar el guardián y exigir que el sello lo note ==="
echo

kill_rule V1 "V1 (versión literal)"
kill_rule V2 "V2 (conteos de tests)"
kill_rule V3 "V3 (estado fase/backlog)"
kill_rule PORTS "PORTS (puertos ↔ código)"
kill_rule LINKS "LINKS (enlaces ↔ sistema de ficheros)"
kill_rule ELIDED "ELIDED (rutas con la parte de en medio elidida)"

echo
echo "Guardián íntegro debe pasar su propio sello:"
if bash "$HARNESS" >/dev/null 2>&1; then
  echo "  ✅ sello verde con el guardián intacto"
  PASS=$((PASS + 1))
else
  echo "  ❌ el sello está rojo con el guardián intacto — arregla eso primero"
  FAIL=$((FAIL + 1))
fi

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || exit 1
echo "El sello muerde cuando el guardián se destripa. Ambos son confiables."
