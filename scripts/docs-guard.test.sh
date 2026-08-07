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
  DOCS_GUARD_ELIDED_ROOT="$TMP" DOCS_GUARD_ELIDED_DOCS="$1" \
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

# Encontrado corriendo este guardián sobre un documento AJENO (la ficha del atlas del
# capitán). Mi ancla exigía la cifra a <=3 caracteres de «puerto», así que un adjetivo
# en medio la derrotaba: «Puertos sagrados 9999» pasaba verde. Un texto que no es el
# tuyo usa el idioma de otra forma y ejercita lo que el propio nunca toca.
ports_case "adjetivo entre «puertos» y la cifra"  '- **Puertos sagrados 9999.** No cambiarlos.'  red
ports_case "misma forma, puerto correcto"        '- **Puertos sagrados 3003.** No cambiarlos.'  green
ports_case "pares tras adjetivo: caza los dos"   'Puertos sagrados 3003/9999.'                  red
ports_case "hermanos citados de otro repo"       'Puertos sagrados 3003/5175. Hermanos: 3001/5173.' red
# Un año en una línea que habla de puertos no es un puerto.
ports_case "año en línea de puertos"             'El puerto 3003 se fijó en 2026.'              green

# Un falso negativo del propio guardián: con la ruta partida por espacios, el fichero
# no existía, se saltaba en silencio y el guardián daba VERDE. Este repo vive en
# "/Users/AGLAYA/Local Sites/…". Un guardián que no encuentra el fichero debe fallar
# ruidoso o no fallar: lo que no puede es aprobar lo que no ha leído.
ports_ruta_con_espacios() {
  local d="$TMP/con espacios"; rm -rf "$d"; mkdir -p "$d/.claude" "$d/client" "$d/server"
  printf 'export default { server: { port: 5175, proxy: { "/api": { target: "http://localhost:3003" } } } }\n' >"$d/client/vite.config.js"
  printf 'const PORT = process.env.PORT || 3003;\n' >"$d/server/index.js"
  printf '{"configurations":[{"port":5175},{"port":3003}]}\n' >"$d/.claude/launch.json"
  printf 'Puertos sagrados 3003/9999.\n' >"$d/DOC.md"

  if DOCS_GUARD_PORTS_ROOT="$d" DOCS_GUARD_PORTS_DOCS="$d/DOC.md" \
       bash "$GUARD" --only-ports >"$TMP/out.txt" 2>&1; then
    echo "  ❌ VERDE con ruta que contiene espacios — el guardián aprobó sin leer"
    FAIL=$((FAIL + 1))
  else
    echo "  ✅ ROJO (esperado) — ruta con espacios: sí lee el fichero"
    PASS=$((PASS + 1))
  fi
}
ports_ruta_con_espacios

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
# Ruta INVENTADA a propósito. La versión anterior usaba una ruta real del atlas del
# capitán, y un fixture es un sitio donde se escribe igual que en cualquier otro: si
# los docs no citan rutas del atlas porque caducan en silencio, el sello tampoco. Con
# una inventada el caso prueba exactamente lo mismo —primer segmento que no es un
# directorio de este repo— y no envejece cuando el capitán reorganice lo suyo.
links_case "ruta de otro repo se ignora"           'vive en `repo-vecino/manual.md`'   green

echo
echo "ELIDED · ruta con los puntos suspensivos EN MEDIO (no se puede seguir)"
# El agujero exacto que dejan las dos líneas de arriba juntas: `placeholder se ignora`
# y `ruta de otro repo se ignora`. Una elisión se cuela por AMBAS — parece un hueco
# rellenable y su primer segmento es de otro repo — y a diferencia de las dos, nunca
# apunta a nada. Sin estos casos, LINKS podría amputarse a medias sin que el sello suene.
elided_case() {
  local name="$1" doc_line="$2" expect="$3"
  local d="$TMP/elided"; rm -rf "$d"; mkdir -p "$d"
  printf '%s\n' "$doc_line" >"$d/DOC.md"

  local code
  DOCS_GUARD_ONLY=ELIDED DOCS_GUARD_ELIDED_ROOT="$d" DOCS_GUARD_ELIDED_DOCS="$d/DOC.md" \
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
# La forma real que motivó la regla (docs/BACKLOG.md, ficha del capitán).
elided_case "elisión con tres puntos"     'Ficha en `aglaya-orchestrator/.../aglaya-kanban-desk.md`' red
elided_case "elisión con carácter …"      'Ficha en `aglaya-orchestrator/…/aglaya-kanban-desk.md`'   red
elided_case "elisión sin extensión"       'Vive en `repo-vecino/.../fichas/` según él'               red
# Truncar para MOSTRAR no es elidir para APUNTAR: no hay que seguir nada.
elided_case "truncado al final (mostrar)" 'Este repo vive en `/Users/AGLAYA/Local Sites/…`'          green
# Comillas dobles + backticks escapados: la línea real de audit-B.md lleva comillas
# simples dentro, y en la primera versión de este caso los backticks SIN escapar se
# ejecutaron como sustitución de comandos. El caso daba VERDE sin haber probado nada
# — verde por vacío, que es el fallo que este harness existe para no cometer.
elided_case "idioma de código /api/..." "Resto de \`app.use('/api/...')\` sin limiter"               green
elided_case "ruta entera no muerde"       'Ver `docs/BACKLOG.md` para la cola'                       green
elided_case "placeholder sigue permitido" 'psql -f docs/migration-<n>.sql'                           green

echo
echo "ATLAS · ruta dentro del repo del capitán (se le pregunta, no se le cita)"

atlas_case() {
  local name="$1" doc_line="$2" expect="$3"
  local d="$TMP/atlas"; rm -rf "$d"; mkdir -p "$d"
  printf '%s\n' "$doc_line" >"$d/DOC.md"

  local code
  DOCS_GUARD_ONLY=ATLAS DOCS_GUARD_ATLAS_ROOT="$d" DOCS_GUARD_ATLAS_DOCS="$d/DOC.md" \
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

# La forma que motivó la regla: se escribió la ruta ENTERA en un documento de
# prueba y el guardián dio verde por ELIDED y por LINKS a la vez.
atlas_case "ruta entera al fichero de la ficha" \
  'La ficha vive en `aglaya-orchestrator/atlas/flota/repos/aglaya-kanban-desk.md`'  red
atlas_case "ruta parcial dentro del atlas" \
  'El manual del riel: `atlas/gobierno/kanban-manual.md`'                           red
atlas_case "ruta sin extensión (carpeta)" \
  'Las fichas están en `aglaya-orchestrator/atlas/flota/`'                          red
atlas_case "ruta al MCP por su nombre de repo" \
  'Ver `aglaya-atlas/server.py` para el catálogo'                                   red
atlas_case "URL de GitHub al atlas" \
  'https://github.com/ibaifernandez/aglaya-orchestrator/blob/main/atlas/ficha.md'   red

# Lo que SÍ puede escribirse: hay que poder decir de quién hablamos y por dónde
# se le pregunta. Ninguna de estas caduca cuando el capitán reorganiza.
atlas_case "nombre del repo a secas" \
  'Existe un orquestador (repo `aglaya-orchestrator`) que enruta la flota'          green
atlas_case "nombre del MCP a secas" \
  'Se pregunta con `ficha("aglaya-kanban-desk")` en el MCP `aglaya-atlas`'          green
atlas_case "la palabra atlas en prosa" \
  'Responde leyendo el atlas en vivo y citando su fuente'                           green
atlas_case "la puerta, no la ruta" \
  'El manual lo custodia el capitán: `donde_pregunto("tarea")`'                     green
# Una ruta de ESTE repo con la palabra dentro no es territorio ajeno.
atlas_case "ruta propia que menciona el atlas" \
  'Ver `docs/BACKLOG.md` para lo que el atlas no contesta'                          green

echo
echo "SELECCIÓN · los docs de docs/ entran solo bajo V1, y eso hay que probarlo"
# El comentario del guardián dice «aquí V2 no se aplica». Sin este bloque, esa
# frase solo la sostiene el comentario. Se prueba en las dos direcciones: que V1
# muerde donde debe Y que V2/V3 no muerden donde se dijo que no — una regla
# apagada de más es tan mala como una encendida de menos.
sel_case() {
  local name="$1" content="$2" v1only="$3" expect="$4"
  local f="$TMP/SEL.md"
  printf '%s\n' "$content" >"$f"
  local only=""; [ "$v1only" = "si" ] && only="$f"
  local code
  DOCS_GUARD_V1_ONLY="$only" \
  DOCS_GUARD_LINKS_ROOT="$TMP" DOCS_GUARD_LINKS_DOCS="$f" \
  DOCS_GUARD_PORTS_ROOT="$TMP" DOCS_GUARD_PORTS_DOCS="$f" \
  DOCS_GUARD_ELIDED_ROOT="$TMP" DOCS_GUARD_ELIDED_DOCS="$f" \
  DOCS_GUARD_ATLAS_ROOT="$TMP" DOCS_GUARD_ATLAS_DOCS="$f" \
    bash "$GUARD" "$f" >"$TMP/out.txt" 2>&1
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

# La versión no la custodia NINGÚN documento: muerde también en el ámbito nuevo.
sel_case "V1 muerde en un doc de solo-V1"   '**Versión:** v1.4.0'            si  red
# Y estas dos son las que justifican que el ámbito sea estrecho: una política y
# un registro fechado de auditoría, que sí son suyos.
sel_case "V2 NO muerde en un doc de solo-V1" 'Retention: 30 días automática' si  green
sel_case "V3 NO muerde en un doc de solo-V1" '- [x] B-CRIT-01 mitigado'      si  green
# Fuera de esa lista, el ámbito normal sigue entero: si esto diera verde, la
# selección estaría apagando reglas en sitios donde nadie lo decidió.
sel_case "V2 SÍ muerde fuera de la lista"    'Suite con 107 tests'           no  red
sel_case "V3 SÍ muerde fuera de la lista"    '- [x] B-CRIT-01 mitigado'      no  red

# --- `--relevante`: decidir si hay algo que mirar ---------------------------
# Este modo existe porque un `paths:` en el disparador haría que el guardián NO
# APARECIERA en el PR, y una comprobación ausente no se distingue de una que
# pasó. La decisión se movió aquí dentro; estos casos son los que impiden que se
# vuelva a estrechar sin que nadie lo note.
rel_case() {
  local que="$1" esperado="$2" diff="$3"
  local got
  got="$(DOCS_GUARD_CAMBIADOS="$diff" bash "$GUARD" --relevante 2>/dev/null)"
  if [ "$got" = "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba %s, dijo %s\n' "$que" "$esperado" "$got"
  fi
}

echo
echo "¿Sabe si tiene algo que mirar?"
rel_case "un documento vigilado"                  SI "$(printf 'M\tCLAUDE.md')"
rel_case "un fichero del que extrae el canon de puertos" SI "$(printf 'M\tclient/vite.config.js')"
rel_case "el propio guardián"                     SI "$(printf 'M\tscripts/docs-guard.sh')"
# El caso que NINGUNA lista de rutas puede expresar, y por el que esto no es un
# `paths:`: la regla LINKS comprueba que los enlaces apunten a algo que existe,
# así que un borrado o un renombrado EN CUALQUIER SITIO puede romperla.
rel_case "un borrado en otro rincón del repo"     SI "$(printf 'D\tserver/viejo.js')"
rel_case "un renombrado en otro rincón"           SI "$(printf 'R100\ta.js\tb.js')"
# Y sin datos NO se calla: correr de más cuesta un minuto; callar de menos deja
# una regla sin vigilar y nadie se entera.
rel_case "sin diff, se corre entero"              SI ""
rel_case "un cambio que no le toca nada"          NO "$(printf 'M\tserver/routes/cards.js')"

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || { echo "El guardián NO muerde en todas sus formas. No lo confíes."; exit 1; }
echo "El guardián muerde en todas las formas que dice vigilar."
