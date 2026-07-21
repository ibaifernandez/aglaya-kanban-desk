#!/usr/bin/env bash
# docs-guard.test.sh — el sello del guardián.
#
# Un guardián que corre y da verde estando destripado es peor que no tenerlo,
# porque además tranquiliza. Este harness sabotea un fichero con CADA forma que
# docs-guard.sh dice vigilar y exige rojo. Si alguien borra una regla, el caso
# que la cubre se pone rojo aquí.
#
# Uso: bash scripts/docs-guard.test.sh
# Exit 0 = el guardián muerde. Exit 1 = el guardián está destripado.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Overridable para poder correr el harness contra un guardián MUTADO y demostrar
# que el propio harness no es vacuo (ver scripts/docs-guard.mutation.sh).
GUARD="${DOCS_GUARD:-$REPO_ROOT/scripts/docs-guard.sh}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# Ejecuta el guardián sobre un fichero suelto y devuelve su exit code.
run_guard() {
  bash "$GUARD" "$1" >"$TMP/out.txt" 2>&1
  echo $?
}

# expect_red <nombre> <contenido>  — el guardián DEBE rechazarlo.
expect_red() {
  local name="$1" content="$2"
  local f="$TMP/README.md"
  printf '%s\n' "$content" >"$f"
  local code; code="$(run_guard "$f")"
  if [ "$code" != "0" ]; then
    echo "  ✅ ROJO (esperado) — $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ VERDE (¡el guardián no muerde!) — $name"
    echo "     contenido saboteado: $content"
    FAIL=$((FAIL + 1))
  fi
}

# expect_green <nombre> <contenido> — el guardián DEBE aceptarlo.
expect_green() {
  local name="$1" content="$2"
  local f="$TMP/README.md"
  printf '%s\n' "$content" >"$f"
  local code; code="$(run_guard "$f")"
  if [ "$code" = "0" ]; then
    echo "  ✅ VERDE (esperado) — $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ ROJO (falso positivo) — $name"
    sed 's/^/     /' "$TMP/out.txt"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== sello docs-guard: sabotaje por cada forma vigilada ==="

if [ ! -f "$GUARD" ]; then
  echo "❌ no existe $GUARD — no hay guardián que sellar."
  exit 1
fi

echo
echo "V1 · versión literal (custodio: package.json)"
expect_red "sello de versión en título"      '## Características — v1.4.0'
expect_red "badge de versión tecleado"       '![Version](https://img.shields.io/badge/version-1.4.0-6366f1)'
expect_red "versión dentro de la cita a su propia fuente" \
                                             '> La fuente de verdad es `package.json` (1.4.0).'
expect_red "versión futura (no solo la de hoy)" 'Publicada la 9.9.9.'

echo
echo "V2 · conteos de tests (custodio: el runner)"
expect_red "badge de tests"                  '![Tests](https://img.shields.io/badge/tests-102%20passing-brightgreen)'
expect_red "conteo en tabla de stack"        '| Tests | Jest + Supertest (106 tests · 13 suites) |'
expect_red "conteo en prosa"                 '106 tests en 13 suites — 102 en verde, 4 skip documentados.'
expect_red "conteo de suites suelto"         'La suite cubre 14 suites.'

echo
echo "V3 · estado de fase/backlog (custodio: docs/ROADMAP.md · docs/BACKLOG.md)"
expect_red "checkbox marcado"                '- [x] Página de ajustes de workspace'
expect_red "checkbox sin marcar"             '- [ ] Deprecación de prototipos legacy'
expect_red "tabla con columna Estado"        '| # | Feature | Prioridad | Estado |'

echo
echo "Falsos positivos — esto NO debe morder"
expect_green "versión mayor de dependencia"  '| Frontend | React 18 + Vite + TailwindCSS |'
expect_green "requisito de runtime"          '- Node.js 20+'
expect_green "badge derivado del custodio"   '![Version](https://img.shields.io/github/package-json/v/ibaifernandez/aglaya-kanban-desk)'
expect_green "badge de CI derivado del runner" \
                                             '![CI](https://github.com/ibaifernandez/aglaya-kanban-desk/actions/workflows/ci.yml/badge.svg)'
expect_green "prosa sin mediciones"          'Kanban multi-tenant para equipos que trabajan con clientes.'
expect_green "puerto, no versión"            'Servidor → http://localhost:3003'
expect_green "enlace al custodio"            'Corre `npm test` para el estado real de la suite.'

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || { echo "El guardián NO muerde en todas sus formas. No lo confíes."; exit 1; }
echo "El guardián muerde en todas las formas que dice vigilar."
