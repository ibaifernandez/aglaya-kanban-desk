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
CROSSCHECKS=(PORTS LINKS)

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

if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  FILES=("$REPO_ROOT/README.md" "$REPO_ROOT/CLAUDE.md")
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
    read -r -a docs <<<"$DOCS_GUARD_PORTS_DOCS"
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
        case " $canon " in
          *" $p "*) ;;
          *) echo "::error file=${rel},line=${lineno}::docs-guard[PORTS]: puerto ${p} no existe en el código."
             echo "  ${rel}:${lineno}: ${text}"
             echo "    → custodio: client/vite.config.js · server/index.js (canon: ${canon})"
             FAIL=1 ;;
        esac
      done
    done < <(grep -nE '(\*\*[0-9]{4}\*\*|[Pp]uertos?[^0-9]{0,3}[0-9]{4}|[Pp]ort[^0-9]{0,3}[0-9]{4}|PORT=[0-9]{4}|localhost:[0-9]{4})' "$md" || true)
  done
}

# LINKS · todo enlace relativo de los docs vigilados debe resolver en disco.
# Es la parte tratable de la clase «el documento nombra algo que puede no existir»:
# un fichero sí se puede comprobar, un nombre de workspace no. Los externos (http)
# se ignoran: su custodio está fuera del repo.
check_LINKS() {
  local root="${DOCS_GUARD_LINKS_ROOT:-$REPO_ROOT}"
  local docs
  if [ -n "${DOCS_GUARD_LINKS_DOCS:-}" ]; then
    read -r -a docs <<<"$DOCS_GUARD_LINKS_DOCS"
  else
    docs=("$root/CLAUDE.md" "$root/README.md")
  fi

  for md in "${docs[@]}"; do
    [ -f "$md" ] || continue
    local rel="${md#"$root"/}"
    while IFS=: read -r lineno target; do
      [ -n "$target" ] || continue
      target="${target#./}"
      target="${target%%#*}"                      # descarta anclas #seccion
      [ -n "$target" ] || continue
      if [ ! -e "$root/$target" ]; then
        echo "::error file=${rel},line=${lineno}::docs-guard[LINKS]: el enlace apunta a algo que no existe: ${target}"
        echo "  ${rel}:${lineno} → ${target}"
        echo "    → custodio: el sistema de ficheros"
        FAIL=1
      fi
    done < <(grep -noE '\]\((\./)?[A-Za-z0-9_][A-Za-z0-9_./#-]*\)' "$md" \
             | sed -E 's/\]\(//; s/\)$//' || true)
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
  echo "--- ${f#"$REPO_ROOT"/}"
  for id in "${RULES[@]}"; do
    p="RULE_${id}_PATTERN"; c="RULE_${id}_CUSTODIAN"; w="RULE_${id}_WHY"
    report "$f" "${!p}" "${!c}" "${!w}"
  done
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
