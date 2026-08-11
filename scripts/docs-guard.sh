#!/usr/bin/env bash
# docs-guard.sh — un documento puede describir diseño y decisiones; no puede
# describir estado. Si hace falta estado, se consulta.
#
# Ante cada línea la pregunta es: ¿es este documento el CUSTODIO de este dato,
# o lo copia? Una copia siempre acaba divergiendo — y la copia con suerte (la
# que hoy acierta) es la peor, porque nadie la comprueba.
#
# Causa raíz que previene (2026-07-21, auditoría del orquestador de flota):
#   · README declaraba «106 tests · 13 suites · 102 en verde». El runner decía
#     14 suites / 107 tests / 103 verde. Las tres cifras fósiles desde que entró
#     `digest-personal-filter.test.js`. Ninguna estaba «mal» al escribirse.
#   · README tecleaba la versión en un badge Y dentro de la propia frase que
#     nombraba `package.json` como fuente única. La cita prestaba credibilidad
#     a la copia.
#   · CLAUDE.md duplicaba fase y backlog, que viven en docs/ROADMAP.md y
#     docs/BACKLOG.md. AGENTS.md se declaraba «resumen» de CLAUDE.md y acabó
#     afirmando lo contrario que él.
#
# ÁMBITO — deliberadamente estrecho. Una alarma ruidosa acaba apagándola alguien.
#   Vigila:   README.md · CLAUDE.md   (puertas de entrada al repo)
#             kanban-mcp/server.py · kanban-mcp/validation.py
#             docs/SECURITY.md · docs/PERMISSIONS.md · docs/RUNBOOK.md ·
#             docs/PRD.md   — SOLO bajo V1: ver la tabla DOCS_V1_ONLY
#
#   El ámbito se amplió el 2026-07-27 después de correr estas mismas reglas
#   sobre los docs que NO vigilaba: cinco tenían la versión tecleada, y
#   `SECURITY.md` la escribía dentro de la frase que nombraba `package.json`
#   como fuente única — la causa raíz de este guardián, textual, en un fichero
#   fuera de su alcance. El ámbito estrecho está bien argumentado; lo que no
#   estaba comprobado es dónde vivía el vicio.
#
#   Los crosschecks tienen su propio ámbito, más ancho, y cada uno lo explica
#   en su función: PORTS y LINKS miran las dos puertas del repo; ELIDED y ATLAS
#   miran todo el markdown versionado, porque ningún documento tiene derecho a
#   un puntero que no se puede seguir.
#
#   Las fuentes del riel entraron el 2026-07-27. La descripción de `list_workspaces`
#   afirmaba cuántas filas veía el riel de cuántas hay — un estado, escrito DENTRO de
#   una puerta. Se leía como autoridad porque es lo que el modelo lee antes de llamar
#   a la tool, y este guardián no lo cazaba por una sola razón: no era un markdown.
#   V2 sí muerde esa línea (`6 filas` es «cifra + plural»); nunca se la habíamos puesto
#   delante. Medido antes de adoptarlo: los tres ficheros del riel dan verde hoy.
#
#   Ojo con lo que esto es: un regex por línea sobre TODO el fichero, no un parser de
#   docstrings. Vigila también el código y los comentarios — y está bien, porque un
#   conteo a mano en un comentario es el mismo vicio. Pero si algún día una línea de
#   código legítima muerde, el arreglo es discutir la regla, no ampliar excepciones.
#
#   NO vigila:
#     docs/CHANGELOG.md  → versiones y fechas son su oficio, es el custodio.
#                          Un hito histórico («migrado en la 1.1.0») va AHÍ.
#     docs/legal/        → bajo Art. 30 RGPD el RAT DEBE fechar y describir
#                          tratamientos: ahí la regla se aplica al revés
#     docs/ROADMAP.md    → custodio de la fase
#     docs/BACKLOG.md    → custodio de la cola
#     docs/audits/       → observaciones fechadas; un informe de mayo DEBE
#                          llevar las cifras de mayo
#
# Sellado por scripts/docs-guard.test.sh (sabotea cada forma vigilada y exige
# rojo) y por scripts/docs-guard.mutation.sh (destripa cada regla y exige que
# el sello lo note). Si añades una regla aquí, añade su sabotaje allí.
#
# Uso: bash scripts/docs-guard.sh [fichero...]   (por defecto: README.md CLAUDE.md)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"


# --- tabla de reglas -------------------------------------------------------
# El orden de estas listas es el orden de evaluación. La mutación amputa reglas
# quitando ids de aquí, así que no las conviertas en algo más listas.
#   RULES       — regex, se aplican a cada fichero vigilado
#   CROSSCHECKS — cruzan dos fuentes; corren una vez, no por fichero
RULES=(V1 V2 V3)
CROSSCHECKS=(PORTS LINKS ELIDED ATLAS)

# Documentos que entran SOLO bajo V1 (la versión), no bajo V2 ni V3.
#
# No es una concesión: es que la respuesta a «¿es este documento el custodio?»
# depende del dato, y estos cuatro custodian unos sí y otros no.
#
#   · La VERSIÓN no la custodia ninguno. Nunca. La custodia `package.json`, y la
#     tenían tecleada los cuatro. `SECURITY.md` además la escribía dentro de la
#     frase que nombraba `package.json` como fuente única — la misma forma exacta
#     que motivó este guardián, en un fichero que el guardián no miraba.
#
#   · Sus CIFRAS, en cambio, sí son suyas en su mayoría: «retención 30 días» es
#     una política, «79 hallazgos» es un registro fechado de auditoría, «3
#     tableros en el plan Free» es la especificación del producto. V2 no sabe
#     distinguir eso de un fósil, así que meterlos bajo V2 obligaría a contorsionar
#     un documento de compliance para que pase un regex. Una regla que obliga a
#     contorsionar acaba desactivada.
#
#   · Y sus cifras que SÍ eran fósiles —«9/9 tablas con RLS» cuando eran 10/10,
#     «4 residuales» cuando `npm audit` decía cinco— se quitaron a mano el
#     2026-07-27, sustituidas por el nombre de su custodio. Eso lo arregla un
#     humano leyendo, no un regex, y queda dicho aquí para que conste que no
#     están vigiladas.
DOCS_V1_ONLY=(docs/SECURITY.md docs/PERMISSIONS.md docs/RUNBOOK.md docs/PRD.md
              docs/PUERTA-EXTERNA.md)
# Sobrescribible para que el sello pueda probar la SELECCIÓN de reglas, no solo
# las reglas. Sin esta costura, «V2 no se aplica aquí» sería una afirmación del
# comentario de arriba y de nadie más.
if [ -n "${DOCS_GUARD_V1_ONLY:-}" ]; then
  DOCS_V1_ONLY=(); while IFS= read -r l; do [ -n "$l" ] && DOCS_V1_ONLY+=("$l")
                  done <<<"$DOCS_GUARD_V1_ONLY"
fi

# NO entran, y por qué:
#   docs/ARCHITECTURE.md      → registro de decisiones (ADR). «Downgrade a
#                               jest@29.7.0» ES la decisión: la versión es el
#                               contenido, no una copia. Su cabecera sí llevaba
#                               la versión del producto y se quitó.
#   docs/operator-checklist.md→ evidencia de compliance RGPD, fechada y
#                               referenciada por documentos inmutables. Sus
#                               cifras son las del audit que las midió. Además es
#                               una checklist: V3 mordería sus casillas, que son
#                               su forma legítima.

# rules_for <ruta relativa> — qué reglas aplican a este fichero.
# Se intersecta siempre con RULES para que amputar una regla de la tabla la
# apague en TODAS partes; si no, la mutación creería haberla quitado y seguiría
# viva por esta puerta.
rules_for() {
  local rel="$1" f id
  for f in "${DOCS_V1_ONLY[@]}"; do
    if [ "$rel" = "$f" ]; then
      for id in "${RULES[@]}"; do [ "$id" = "V1" ] && printf '%s\n' "$id"; done
      return
    fi
  done
  printf '%s\n' "${RULES[@]}"
}

# V1 · versión literal. Cualquier semver x.y.z tecleado es una copia de
# package.json — incluida la que hoy acierta. Usa un badge derivado:
#   img.shields.io/github/package-json/v/<owner>/<repo>
# `React 18` o `Node.js 20+` no son semver y no muerden.
RULE_V1_PATTERN='[vV]?[0-9]+\.[0-9]+\.[0-9]+'
RULE_V1_CUSTODIAN='package.json (o docs/CHANGELOG.md si es un hito histórico)'
RULE_V1_WHY='versión literal tecleada'

# V2 · cualquier conteo de artefactos: «cifra + sustantivo en plural».
# Nació mirando solo tests|suites|pruebas — una lista escrita a mano, que es el
# vicio que este guardián persigue. Dejó pasar «7 índices de rendimiento» cuando
# había 13. La forma es la cifra junto al plural, no un catálogo de sustantivos.
# Los números en palabra («tres tipos de workspace») NO muerden: describen diseño.
# Las cifras miden, y lo medido lo custodia quien lo produce.
RULE_V2_PATTERN='(tests-[0-9]+|[0-9]+[[:space:]]*(tests?|suites?|pruebas?)\b|[0-9]+[[:space:]]+[A-Za-zÁÉÍÓÚÑáéíóúñ]+s\b|[0-9]+[[:space:]]+en[[:space:]]+verde)'
RULE_V2_CUSTODIAN='quien produce la cifra (el runner, la DB, el código, Railway)'
RULE_V2_WHY='conteo o medida escrita a mano'

# V3 · estado de fase/backlog: checkbox de progreso o columna «Estado».
RULE_V3_PATTERN='(^[[:space:]]*[-*][[:space:]]*\[[ xX]\]|\|[[:space:]]*Estado[[:space:]]*\|)'
RULE_V3_CUSTODIAN='docs/ROADMAP.md (fase) y docs/BACKLOG.md (cola)'
RULE_V3_WHY='estado de fase/backlog duplicado'
# ---------------------------------------------------------------------------

ONLY_PORTS=0
if [ "${1:-}" = "--only-ports" ]; then ONLY_PORTS=1; shift; fi
if [ "${1:-}" = "--relevante" ]; then MODO_RELEVANTE=1; shift; fi
if [ "${1:-}" = "--entradas" ]; then MODO_ENTRADAS=1; shift; fi

if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  FILES=("$REPO_ROOT/README.md" "$REPO_ROOT/CLAUDE.md"
         "$REPO_ROOT/kanban-mcp/server.py" "$REPO_ROOT/kanban-mcp/validation.py")
  for f in "${DOCS_V1_ONLY[@]}"; do FILES+=("$REPO_ROOT/$f"); done
fi

# ---------------------------------------------------------------------------
# `--relevante`: ¿tiene este cambio algo que este guardián deba mirar?
#
# POR QUÉ VIVE AQUÍ, y por qué DESPUÉS de construir FILES.
#
# Primero estuvo en un `paths:` del workflow. Mal: un guardián que no se dispara
# NO APARECE en el PR, y una comprobación ausente no se distingue de una que
# pasó — el #34 lo pagó con nueve checks frente a diez.
#
# Luego estuvo aquí arriba, con su propia lista. **También mal, y es el mismo
# defecto con otra cara:** cambié el mecanismo y dejé el conjunto aparte. El
# guardián lee NUEVE ficheros y aquella lista reconocía DOS. El vigilante lo
# ejerció: una versión literal en `docs/SECURITY.md` la caza el guardián con
# `exit=1`, y la relevancia decía `NO`. Dos listas escritas aparte divergen; la
# pregunta no es si, es cuándo.
#
# Así que NO hay lista: se deriva de `FILES`, que es la misma construcción que
# usa el guardián al correr. Si mañana alguien añade un documento a
# `DOCS_V1_ONLY`, la relevancia lo hereda sin tocar nada.
#
# Uso:  DOCS_GUARD_CAMBIADOS="$(git diff --name-status BASE HEAD)" \
#         bash scripts/docs-guard.sh --relevante
# Escribe SI o NO en stdout; el motivo va a stderr.
# `--entradas`: escribe lo que este guardián lee, derivado de FILES.
# Existe para que el SELLO tampoco tenga que teclear la lista: si la tuviera,
# sería la tercera copia y volveríamos al mismo sitio.
if [ "${MODO_ENTRADAS:-0}" = "1" ]; then
  for f in "${FILES[@]}"; do printf '%s\n' "${f#"$REPO_ROOT/"}"; done
  printf '%s\n' client/vite.config.js server/index.js .claude/launch.json
  exit 0
fi

if [ "${MODO_RELEVANTE:-0}" = "1" ]; then
  cambios="${DOCS_GUARD_CAMBIADOS:-}"

  # Sin diff no se calla: correr de más cuesta un minuto, callar de menos deja
  # una regla sin vigilar y nadie se entera.
  if [ -z "$cambios" ]; then
    echo "sin diff — se corre entero, que es el lado seguro de no saber" >&2
    echo "SI"; exit 0
  fi

  # Lo que el guardián LEE, derivado de donde lo lee:
  #   · FILES            — los documentos vigilados, tal cual los construye arriba
  #   · las 3 fuentes de PORTS, que son código y no documentos
  #   · él mismo y su workflow
  entradas=()
  for f in "${FILES[@]}"; do entradas+=("${f#"$REPO_ROOT/"}"); done
  entradas+=(client/vite.config.js server/index.js .claude/launch.json)

  for e in "${entradas[@]}"; do
    if grep -qxF "$e" < <(awk '{print $NF}' <<< "$cambios"); then
      echo "relevante: cambió $e, que este guardián lee" >&2
      echo "SI"; exit 0
    fi
  done

  if grep -qE '^(scripts/docs-guard|\.github/workflows/ci\.yml$)' \
       < <(awk '{print $NF}' <<< "$cambios"); then
    echo "relevante: cambió el propio guardián" >&2
    echo "SI"; exit 0
  fi

  # Y la regla LINKS, que NO tiene lista ni puede tenerla: comprueba que los
  # enlaces apunten a ficheros que existen, así que un borrado o un renombrado
  # en cualquier rincón del repo puede romperla.
  if grep -qE '^(D|R[0-9]*)[[:space:]]' <<< "$cambios"; then
    echo "relevante: hay borrados o renombrados, y LINKS mira si los enlaces siguen existiendo" >&2
    echo "SI"; exit 0
  fi

  echo "nada que mirar: ni sus entradas, ni él mismo, ni ningún borrado o renombrado" >&2
  echo "NO"; exit 0
fi

FAIL=0

# PORTS · todo puerto tecleado en los docs, contra el CÓDIGO que lo custodia.
#
# No es regex sobre el doc: ningún patrón sabe si «3003» sigue siendo el puerto.
# Hay que cruzar dos fuentes. El canon lo fija el código —vite.config.js y
# server/index.js— y launch.json debe coincidir con él; el doc solo puede repetirlo.
#
# La primera versión de esta regla miraba SOLO la tabla `**NNNN**`: dos de los
# dieciséis sitios donde el puerto está escrito, y se le escapaban dos en el mismo
# fichero, cuatro líneas por debajo de la tabla. Construir el cruce y apuntarlo a
# la instancia más bonita es no construirlo.
#
# Ancla por CONTEXTO, no por forma: solo mira líneas que hablan de puertos
# (`puerto`/`port`/`localhost`). Medido antes de adoptarlo — `ISO 8601` y el `5432`
# de Postgres viven en estos docs y no son puertos nuestros.
check_PORTS() {
  local root="${DOCS_GUARD_PORTS_ROOT:-$REPO_ROOT}"
  local vite="$root/client/vite.config.js"
  local index="$root/server/index.js"
  local json="$root/.claude/launch.json"

  local docs
  if [ -n "${DOCS_GUARD_PORTS_DOCS:-}" ]; then
    # Separado por SALTOS DE LÍNEA, no por espacios: este repo vive en
    # "/Users/AGLAYA/Local Sites/…" y un `read -a` partía la ruta en dos trozos
    # inexistentes. El guardián no fallaba: se saltaba el fichero y daba VERDE.
    # Un falso negativo silencioso en el propio guardián — peor que un falso positivo.
    docs=(); while IFS= read -r l; do [ -n "$l" ] && docs+=("$l"); done <<<"$DOCS_GUARD_PORTS_DOCS"
  else
    docs=("$root/CLAUDE.md" "$root/README.md")
  fi

  for f in "$vite" "$index" "$json"; do
    [ -f "$f" ] || { echo "docs-guard[PORTS]: falta $f — omitido."; return 0; }
  done

  # Canon: lo que declara el código.
  local canon
  canon="$( { grep -oE 'port:[[:space:]]*[0-9]{4}' "$vite" | grep -oE '[0-9]{4}'
              grep -oE 'localhost:[0-9]{4}'         "$vite" | grep -oE '[0-9]{4}'
              grep -oE 'PORT[^0-9]{0,6}[0-9]{4}'    "$index" | grep -oE '[0-9]{4}'
            } | sort -u | tr '\n' ' ')"

  # launch.json debe repetir el canon, no ampliarlo.
  local jports
  jports="$(grep -oE '"port"[[:space:]]*:[[:space:]]*[0-9]{4}' "$json" | grep -oE '[0-9]{4}' | sort -u | tr '\n' ' ')"
  if [ "$jports" != "$canon" ]; then
    echo "::error file=.claude/launch.json::docs-guard[PORTS]: launch.json no coincide con el código."
    echo "  código (vite.config.js · server/index.js): ${canon:-(ninguno)}"
    echo "  launch.json:                               ${jports:-(ninguno)}"
    FAIL=1
  fi

  # Todo puerto citado en los docs debe estar en el canon.
  for md in "${docs[@]}"; do
    [ -f "$md" ] || continue
    local rel="${md#"$root"/}"
    while IFS=: read -r lineno text; do
      [ -n "$lineno" ] || continue
      for p in $(printf '%s' "$text" | grep -oE '\b[0-9]{4}\b'); do
        # Un año en una línea que habla de puertos no es un puerto.
        case "$p" in 19??|20??) continue ;; esac
        case " $canon " in
          *" $p "*) ;;
          *) echo "::error file=${rel},line=${lineno}::docs-guard[PORTS]: puerto ${p} no existe en el código."
             echo "  ${rel}:${lineno}: ${text}"
             echo "    → custodio: client/vite.config.js · server/index.js (canon: ${canon})"
             FAIL=1 ;;
        esac
      done
      # Selección de línea por CONTEXTO, no por proximidad. La versión anterior exigía
      # la cifra a <=3 caracteres de «puerto» y un adjetivo la derrotaba: «Puertos
      # sagrados 9999» pasaba verde. Encontrado corriendo este guardián sobre un
      # documento ajeno — un texto que no es el tuyo ejercita lo que el propio no toca.
    done < <(grep -nE '(\*\*[0-9]{4}\*\*|[Pp]uertos?\b|[Pp]ort\b|PORT=|localhost:)' "$md" || true)
  done
}

# LINKS · toda ruta de fichero citada en los docs vigilados debe resolver en disco.
#
# Es la parte tratable de la clase «el documento nombra algo que puede no existir»:
# un fichero sí se puede comprobar, un nombre de workspace no.
#
# Mira enlaces markdown Y rutas sueltas (backticks, bloques de código). La primera
# versión solo miraba `](ruta)` — y el fallo real que motivó la regla, un
# `cp .env.example .env` que apuntaba a un fichero inexistente, vivía en un bloque
# de código. Cerrar la mitad con mejor sintaxis es no cerrar la clase.
#
# Se ignoran, por este orden:
#   · externos (http…), que no custodia este repo
#   · plantillas con <>, $ o * — no son rutas, son huecos
#   · rutas gitignoreadas (`.env`): no se espera que existan en un clon limpio
#   · rutas cuyo primer segmento no es un directorio de este repo (son de otra nave).
#     Se autodetecta: sin listas blancas que envejezcan. Ni siquiera aquí se teclea una
#     ruta real del atlas del capitán: un comentario también caduca.
check_LINKS() {
  local root="${DOCS_GUARD_LINKS_ROOT:-$REPO_ROOT}"
  local docs
  if [ -n "${DOCS_GUARD_LINKS_DOCS:-}" ]; then
    docs=(); while IFS= read -r l; do [ -n "$l" ] && docs+=("$l"); done <<<"$DOCS_GUARD_LINKS_DOCS"
  else
    docs=("$root/CLAUDE.md" "$root/README.md")
  fi

  local exts='md|js|jsx|json|sql|sh|py|yml|yaml|example|txt|toml'
  # Verbos de shell tras los cuales un nombre suelto SÍ es una ruta. Sin esto,
  # `Node.js` en prosa y los `app.js` del árbol de arquitectura son falsos
  # positivos: un nombre con extensión no es una ruta si nadie lo abre.
  local verbs='cp|mv|cat|less|source|psql|node|bash|sh|rm|touch|python3?|npx|vim|nano'

  for md in "${docs[@]}"; do
    [ -f "$md" ] || continue
    local rel="${md#"$root"/}"
    while IFS=: read -r lineno rest; do
      [ -n "$lineno" ] || continue
      for raw in $( { # (a) destino de enlace markdown — inequívoco
                      printf '%s' "$rest" | grep -oE "\]\((\./)?[A-Za-z0-9_.][A-Za-z0-9_./#-]*\)" \
                        | sed -E 's/^\]\(//; s/\)$//; s/#.*$//'
                      # (b) con barra: es una ruta, no una etiqueta
                      printf '%s' "$rest" | grep -oE "(\./)?[A-Za-z0-9_.][A-Za-z0-9_.-]*/[A-Za-z0-9_./-]*\.($exts)\b"
                      # (c) nombre suelto, pero detrás de un verbo que lo abre
                      printf '%s' "$rest" | grep -oE "\b($verbs)[[:space:]]+(-[A-Za-z][[:space:]]+)?[A-Za-z0-9_.][A-Za-z0-9_.-]*\.($exts)\b" \
                        | grep -oE "[A-Za-z0-9_.][A-Za-z0-9_.-]*\.($exts)$"
                    } | sed -E 's|^\./||' | sort -u ); do
        case "$raw" in
          *'<'*|*'>'*|*'$'*|*'*'*|/*|'~'*) continue ;;
        esac
        # gitignoreada → no se espera en un clon limpio
        ( cd "$root" && git check-ignore -q "$raw" 2>/dev/null ) && continue
        # primer segmento no es un directorio de este repo → referencia externa
        case "$raw" in
          */*) [ -d "$root/${raw%%/*}" ] || continue ;;
        esac
        if [ ! -e "$root/$raw" ]; then
          echo "::error file=${rel},line=${lineno}::docs-guard[LINKS]: cita una ruta que no existe: ${raw}"
          echo "  ${rel}:${lineno} → ${raw}"
          echo "    → custodio: el sistema de ficheros"
          FAIL=1
        fi
      done
    done < <(grep -nE "[A-Za-z0-9_.][A-Za-z0-9_./-]*\.($exts)\b" "$md" | grep -v 'https\?://' || true)
  done
}

# ELIDED · una ruta que sustituye su parte de EN MEDIO por puntos suspensivos, dejando
# un segmento a cada lado. (Este comentario vive en un .sh, que no se vigila; en un .md
# no se podría escribir el ejemplo sin morderse. Es deliberado: la regla no distingue
# usar de citar, igual que V1 muerde la versión escrita dentro de la frase que nombra a
# package.json como fuente. La excepción «lo decía de ejemplo» mata guardianes.)
#
# Es el agujero de LINKS, y no por descuido: una ruta elidida se cuela por sus DOS
# escapes a la vez. No la mira porque el primer segmento no es un directorio de este
# repo («será de otro repo, no lo custodio yo»), y aunque la mirara, nunca existiría.
# Se le parece a un placeholder (`docs/migration-<n>.sql`) y no lo es: un placeholder
# es un hueco que el lector RELLENA — sabe qué poner. Una elisión es un hueco donde
# estaba el dato, y el lector no puede recuperarlo. Parece que apunta a algo; no apunta.
#
# La forma es la elisión INTERIOR — algo antes, algo después. `ruta/...` al final es
# otra cosa: es truncar para mostrar («este repo vive en `/Users/AGLAYA/Local Sites/…`»,
# `app.use('/api/...')`), y truncar honestamente no engaña a nadie. Medido sobre todos
# los markdown versionados antes de adoptar la regla: la forma interior aparecía UNA vez
# y era la que motivó la regla; las tres truncadas son legítimas. Un guardián que nace
# rojo se normaliza y acaba apagándolo alguien.
#
# ÁMBITO ANCHO, al revés que V1/V2/V3, y por un motivo: aquellas son estrechas porque
# CHANGELOG, ROADMAP, BACKLOG y audits SON custodios de estado — tienen derecho a las
# cifras que las otras no. Ninguno tiene derecho a un puntero que no se puede seguir.
# La lista sale de `git ls-files`: se mantiene sola, sin listas blancas que envejezcan.
check_ELIDED() {
  local root="${DOCS_GUARD_ELIDED_ROOT:-$REPO_ROOT}"
  local docs
  if [ -n "${DOCS_GUARD_ELIDED_DOCS:-}" ]; then
    docs=(); while IFS= read -r l; do [ -n "$l" ] && docs+=("$l"); done <<<"$DOCS_GUARD_ELIDED_DOCS"
  else
    # `--others --exclude-standard` incluye los markdown NUEVOS aún sin commitear:
    # el momento útil para cazar una elisión es antes de que entre, no en el CI del
    # día siguiente. Respeta .gitignore, así que node_modules y graphify-out no entran.
    docs=(); while IFS= read -r l; do [ -n "$l" ] && docs+=("$root/$l")
            done < <(cd "$root" && git ls-files --cached --others --exclude-standard '*.md' 2>/dev/null)
  fi

  for md in "${docs[@]}"; do
    [ -f "$md" ] || continue
    local rel="${md#"$root"/}"
    while IFS=: read -r lineno text; do
      [ -n "$lineno" ] || continue
      echo "::error file=${rel},line=${lineno}::docs-guard[ELIDED]: ruta con la parte de en medio elidida — no se puede seguir."
      echo "  ${rel}:${lineno}: ${text}"
      echo "    → no hay custodio que arregle esto: pregunta por la puerta (MCP aglaya-atlas)"
      echo "      o cita una ruta entera de ESTE repo. Media ruta no es una ruta."
      FAIL=1
    done < <(grep -nE '[A-Za-z0-9_.-]+/(\.\.\.|…)/[A-Za-z0-9_.-]' "$md" || true)
  done
}

# ATLAS · una ruta que entra en el repo del capitán. Al capitán se le PREGUNTA,
# no se le cita.
#
# Es el agujero que quedaba después de ELIDED, y se descubrió probándolo: se
# escribió una ruta ENTERA del atlas en un documento y el guardián dio verde por
# los dos lados. ELIDED solo mira la elisión interior. Y LINKS la ignora a
# propósito —su primer segmento no es un directorio de este repo, «será de otro
# repo, no lo custodio yo»—, que es justo por donde se cuela. Cerrar la mitad
# elidida y dejar abierta la entera es no cerrar la clase.
#
# Por qué una ruta suya no vale aunque hoy exista: el capitán reorganiza su
# atlas cuando quiere y aquí nadie se entera. La ruta no se rompe, que sería
# tolerable — deja de apuntar a lo que decía, en silencio. El nombre del repo y
# la pregunta (`ficha`, `contrato`, `donde_pregunto`) no caducan; la ruta sí.
#
# La forma es la BARRA. `aglaya-orchestrator` a secas es el nombre del repo y es
# legítimo —hay que poder decir de quién hablamos—; `aglaya-orchestrator/algo`
# ya es un puntero. Igual con `aglaya-atlas`, que es el nombre del MCP, frente a
# `atlas/algo`, que es un camino dentro de su árbol. Medido antes de adoptarla:
# «atlas» y «aglaya-atlas» aparecen en prosa por todo el repo y ninguna muerde.
#
# ÁMBITO ANCHO, como ELIDED y por el mismo motivo: ningún documento tiene
# derecho a un puntero que no se puede seguir ni comprobar desde aquí, y eso
# incluye a CHANGELOG, ROADMAP y BACKLOG, que sí son custodios de otras cosas.
# Incluye además las fuentes del riel: sus docstrings son lo que el modelo lee
# ANTES de llamar a la tool, así que una ruta caducada ahí se lee como autoridad.
check_ATLAS() {
  local root="${DOCS_GUARD_ATLAS_ROOT:-$REPO_ROOT}"
  local docs
  if [ -n "${DOCS_GUARD_ATLAS_DOCS:-}" ]; then
    docs=(); while IFS= read -r l; do [ -n "$l" ] && docs+=("$l"); done <<<"$DOCS_GUARD_ATLAS_DOCS"
  else
    docs=(); while IFS= read -r l; do [ -n "$l" ] && docs+=("$root/$l")
            done < <(cd "$root" && git ls-files --cached --others --exclude-standard \
                       '*.md' 'kanban-mcp/*.py' 2>/dev/null)
  fi

  for md in "${docs[@]}"; do
    [ -f "$md" ] || continue
    local rel="${md#"$root"/}"
    while IFS=: read -r lineno text; do
      [ -n "$lineno" ] || continue
      echo "::error file=${rel},line=${lineno}::docs-guard[ATLAS]: ruta dentro del repo del capitán — se le pregunta, no se le cita."
      echo "  ${rel}:${lineno}: ${text}"
      echo "    → custodio: el capitán. Pregúntale por la puerta (MCP aglaya-atlas):"
      echo "      ficha(nave) · contrato(nombre) · donde_pregunto(tema) — contestan citando su fuente viva."
      echo "      El nombre del repo sí puede escribirse; la ruta dentro de él caduca en silencio."
      FAIL=1
    done < <(grep -nE '(aglaya-orchestrator|aglaya-atlas|\batlas)/[A-Za-z0-9_.-]' "$md" || true)
  done
}

# Ejecutar UN solo crosscheck (lo usa el sello). Va por la tabla CROSSCHECKS a
# propósito: si la mutación amputa un id, aquí no se llama a nada y el sello lo
# nota. Llamar a check_<ID> directamente haría el sello inmune al destripamiento,
# que es justo el fallo que este proyecto persigue.
[ "$ONLY_PORTS" = "1" ] && DOCS_GUARD_ONLY=PORTS
if [ -n "${DOCS_GUARD_ONLY:-}" ]; then
  for id in "${CROSSCHECKS[@]}"; do
    [ "$id" = "$DOCS_GUARD_ONLY" ] && "check_$id"
  done
  [ "$FAIL" = "0" ] || exit 1
  echo "docs-guard[${DOCS_GUARD_ONLY}]: OK"
  exit 0
fi

# report <fichero> <regex> <custodio> <por qué>
report() {
  local file="$1" pattern="$2" custodian="$3" why="$4"
  local hits
  hits="$(grep -nE "$pattern" "$file" 2>/dev/null || true)"
  [ -z "$hits" ] && return 0

  local rel="${file#"$REPO_ROOT"/}"
  while IFS= read -r line; do
    local lineno="${line%%:*}"
    local text="${line#*:}"
    echo "::error file=${rel},line=${lineno}::docs-guard: ${why} — el custodio es ${custodian}, no este documento."
    echo "  ${rel}:${lineno}: ${text}"
    echo "    → custodio: ${custodian}"
  done <<<"$hits"
  FAIL=1
}

for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "docs-guard: no existe $f — nada que vigilar."; continue; }
  rel="${f#"$REPO_ROOT"/}"
  echo "--- ${rel}"
  while IFS= read -r id; do
    [ -n "$id" ] || continue
    p="RULE_${id}_PATTERN"; c="RULE_${id}_CUSTODIAN"; w="RULE_${id}_WHY"
    report "$f" "${!p}" "${!c}" "${!w}"
  done < <(rules_for "$rel")
done

for id in "${CROSSCHECKS[@]}"; do "check_$id"; done

if [ "$FAIL" != "0" ]; then
  echo
  echo "docs-guard: hay estado escrito donde su custodio contesta gratis."
  echo "Borra el dato y enlaza/consulta la fuente. Si el dato es imprescindible aquí,"
  echo "es que este documento debería ser su custodio — y entonces discútelo, no lo copies."
  exit 1
fi

echo "docs-guard: OK — ningún documento vigilado se hace dueño de un estado ajeno."
