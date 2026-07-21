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
# Los casos de regex prueban UN fichero temporal. Los crosschecks (LINKS, PORTS)
# tienen que apuntar también a ese temporal: si no, corren contra el repo real y
# contaminan el resultado de un test que no va sobre ellos.
run_guard() {
  DOCS_GUARD_LINKS_ROOT="$TMP" DOCS_GUARD_LINKS_DOCS="$1" \
  DOCS_GUARD_PORTS_ROOT="$TMP" DOCS_GUARD_PORTS_DOCS="$1" \
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
# V2 se escribió a medida de los tests y dejó pasar cualquier otro conteo. El README
# decía "7 índices" cuando había 13, y el guardián no sonó. La forma es «cifra +
# sustantivo en plural», no «cifra + una lista de sustantivos que se me ocurrieron».
expect_red "conteo de índices"               '- 7 índices de rendimiento en columnas de alta frecuencia'
expect_red "conteo de tablas"                'El schema tiene 10 tablas con RLS.'
expect_red "conteo de rutas"                 'El backend expone 12 endpoints REST.'
expect_red "config con cifra (custodio: el código)" '- JWT con expiración de 7 días'

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
echo "PORTS · tabla de puertos ↔ .claude/launch.json (cruzado, no regex)"
# Antes esto era una confesión escrita: "no modificar launch.json sin actualizar
# este archivo". Una copia que documenta su propio procedimiento manual sigue
# siendo una copia: el día que nadie se acuerde, nadie lo nota.
# ports_case <nombre> <línea del doc> <esperado>
# Monta un mini-repo con los custodios REALES del puerto (vite.config.js,
# server/index.js, launch.json) todos en 3003/5175, y mete la línea a probar en
# el doc. El canon sale del CÓDIGO; el doc solo puede repetirlo.
ports_case() {
  local name="$1" doc_line="$2" expect="$3"
  local d="$TMP/ports"; rm -rf "$d"; mkdir -p "$d/.claude" "$d/client" "$d/server"

  printf 'export default { server: { port: 5175, proxy: { "/api": { target: "http://localhost:3003" } } } }\n' >"$d/client/vite.config.js"
  printf 'const PORT = process.env.PORT || 3003;\n' >"$d/server/index.js"
  printf '{"configurations":[{"port":5175},{"port":3003}]}\n' >"$d/.claude/launch.json"
  printf '%s\n' "$doc_line" >"$d/DOC.md"

  local code
  DOCS_GUARD_PORTS_ROOT="$d" DOCS_GUARD_PORTS_DOCS="$d/DOC.md" \
    bash "$GUARD" --only-ports >"$TMP/out.txt" 2>&1
  code=$?

  if [ "$expect" = "red" ] && [ "$code" != "0" ]; then
    echo "  ✅ ROJO (esperado) — $name"; PASS=$((PASS + 1))
  elif [ "$expect" = "green" ] && [ "$code" = "0" ]; then
    echo "  ✅ VERDE (esperado) — $name"; PASS=$((PASS + 1))
  else
    echo "  ❌ $name — esperaba $expect, exit=$code"
    sed 's/^/     /' "$TMP/out.txt"; FAIL=$((FAIL + 1))
  fi
}

# La versión anterior de esta regla miraba SOLO la tabla `**NNNN**` — dos de los
# dieciséis sitios donde el puerto está tecleado, y se le escapaban dos en el
# mismo fichero que vigilaba, cuatro líneas más abajo. Estas formas son las reales.
ports_case "tabla — puerto correcto"        '| Server (Express) | **3003** |'          green
ports_case "tabla — puerto inventado"       '| Server (Express) | **9999** |'          red
ports_case "prosa «puerto NNNN» correcta"   'preview_start → Server (puerto 3003)'     green
ports_case "prosa «puerto NNNN» desviada"   'preview_start → Server (puerto 9999)'     red
ports_case "par «puertos A/B» desviado"     '- No matar procesos en puertos 3003/9999' red
ports_case "localhost:NNNN desviado"        '# Servidor → http://localhost:9999'       red
ports_case "PORT=NNNN desviado"             'PORT=9999'                                red
ports_case "ISO 8601 no es un puerto"       '- `dueDate` (ISO 8601) son opcionales'    green
ports_case "5432 de Postgres no es nuestro" 'psql "postgresql://postgres@$H:5432/postgres"' green

echo
echo "LINKS · enlaces relativos ↔ sistema de ficheros (cruzado, no regex)"
links_case() {
  local name="$1" doc_line="$2" expect="$3"
  local d="$TMP/links"; rm -rf "$d"; mkdir -p "$d/docs"
  printf 'existe\n' >"$d/docs/EXISTE.md"
  printf '.env\n' >"$d/.gitignore"
  ( cd "$d" && git init -q 2>/dev/null )   # para que `git check-ignore` funcione
  printf '%s\n' "$doc_line" >"$d/DOC.md"

  local code
  DOCS_GUARD_ONLY=LINKS DOCS_GUARD_LINKS_ROOT="$d" DOCS_GUARD_LINKS_DOCS="$d/DOC.md" \
    bash "$GUARD" >"$TMP/out.txt" 2>&1
  code=$?

  if [ "$expect" = "red" ] && [ "$code" != "0" ]; then
    echo "  ✅ ROJO (esperado) — $name"; PASS=$((PASS + 1))
  elif [ "$expect" = "green" ] && [ "$code" = "0" ]; then
    echo "  ✅ VERDE (esperado) — $name"; PASS=$((PASS + 1))
  else
    echo "  ❌ $name — esperaba $expect, exit=$code"
    sed 's/^/     /' "$TMP/out.txt"; FAIL=$((FAIL + 1))
  fi
}
links_case "enlace a fichero existente"      'Ver [docs](./docs/EXISTE.md) para más.'      green
links_case "enlace a fichero inexistente"    'Ver [docs](./docs/FANTASMA.md) para más.'    red
links_case "enlace con ancla, fichero ok"    'Ver [x](./docs/EXISTE.md#seccion).'          green
links_case "enlace externo se ignora"        'Ver [web](https://aglaya.biz) para más.'     green

# El `cp .env.example .env` roto del README vivía en un BLOQUE DE CÓDIGO, no en un
# enlace markdown. La primera versión de LINKS cerró la mitad bonita de la clase.
links_case "ruta en bloque de código, existe"      'cp docs/EXISTE.md /tmp/x'          green
links_case "ruta en bloque de código, no existe"   'cp .env.example .env'              red
links_case "ruta entre backticks, existe"          'Mira `docs/EXISTE.md` para eso.'   green
links_case "ruta entre backticks, no existe"       'Mira `docs/FANTASMA.md`.'          red
links_case "placeholder <nombre> se ignora"        'psql -f docs/migration-<n>.sql'    green
links_case "ruta gitignoreada se ignora"           'edita .env con tus valores'        green
links_case "ruta de otro repo se ignora"           'vive en `atlas/kanban-manual.md`'  green

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || { echo "El guardián NO muerde en todas sus formas. No lo confíes."; exit 1; }
echo "El guardián muerde en todas las formas que dice vigilar."
