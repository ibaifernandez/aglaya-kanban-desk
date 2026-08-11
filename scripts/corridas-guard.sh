#!/usr/bin/env bash
# corridas-guard.sh — «ninguna fallida» y «ninguna» no son lo mismo.
#
# ─────────────────────────────────────────────────────────────────────────────
# QUÉ PROBLEMA CIERRA, CON SU FACTURA
#
# **Un PR con conflicto de fusión no genera NINGUNA corrida de Actions.** GitHub
# no puede construir la ref de fusión, así que no hay nada que ejecutar. Y la
# pregunta habitual antes de mergear —«¿hay comprobaciones pendientes o
# fallidas?»— contesta **«ninguna»**.
#
# Y es verdad. No había ninguna fallida. **Porque no había ninguna.**
#
# Medido en el PR #46 el 8-ago-2026: quedaban 5 comprobaciones —todas de
# integraciones externas, que no dependen de la ref de fusión— y **faltaban las
# cuatro de Actions**. Es el mismo fallo del #34 —nueve checks donde había que
# ver diez, y GitHub dando el PR por `CLEAN`— con el agravante de que esta vez
# faltaban todas.
#
# Y no es hipotético: el 11-ago-2026 se mergeó un PR con una comprobación
# **todavía en curso** sobre el SHA aprobado. Salió bien porque una persona
# barrió el diff a mano. `main` **no tiene protección de rama** —comprobado hoy:
# `GET …/branches/main/protection` → `404 Branch not protected`—, así que lo
# único que lo impide es que quien mergea mire, y mirar era justo lo que
# devolvía «ninguna».
#
# QUÉ HACE. Compara **dos conjuntos**, no busca fallos entre los presentes:
#
#   · **el que DEBERÍA correr** — derivado de `.github/workflows/`: los que
#     declaran `pull_request` sobre la rama base del PR;
#   · **el que CORRIÓ** — de la API de Actions, **para el SHA de cabeza del PR**.
#
# **Si falta alguno, rojo.** Y una ausencia total —cero corridas— se dice con
# todas las letras, porque es el caso que se lee como éxito.
#
# ⛔ POR QUÉ NO PUEDE VIVIR DENTRO DEL CI DEL PR QUE JUZGA, y no es una
# preferencia: **si el PR está en conflicto, tampoco corre él.** Un guardián que
# se calla exactamente en el caso que existe para cazar no es un guardián. Por
# eso vive fuera: por reloj sobre los PR abiertos, o a mano antes de mergear
# (`.github/workflows/pr-corridas.yml`).
#
# LO QUE NO PUEDE HACER, para que su verde no se lea de más:
#   · **No juzga el RESULTADO de lo que corrió.** Dice si están todas, no si
#     están verdes. Eso ya lo mira quien mergea, y mal contestado da «ninguna».
#   · **No entiende filtros por ruta** (`paths:`). Hoy ningún workflow de este
#     repo los usa —se pagó el 6-ago con el #34 y quedó escrito en `ci.yml`— así
#     que un workflow con `paths:` se contaría como esperado siempre. Si algún
#     día se usan, esto produce falsos rojos y hay que enseñárselos.
#   · **No mira integraciones externas** (Netlify, GitGuardian): no son corridas
#     de Actions y su ausencia tiene su propia tarjeta.
#
# Uso:
#   bash scripts/corridas-guard.sh                 # todos los PR abiertos
#   bash scripts/corridas-guard.sh --pr 61         # uno concreto
#
# Para el sello, sin red y sin `gh`:
#   CORRIDAS_GUARD_WORKFLOWS=<dir> CORRIDAS_GUARD_BASE=main \
#   CORRIDAS_GUARD_CORRIERON=$'CI\notro' bash scripts/corridas-guard.sh --pr 1
#
# Exit 0 = a todos los PR mirados les corrió lo que debía · 1 = falta alguna ·
# 2 = no se pudo medir.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR_WF="${CORRIDAS_GUARD_WORKFLOWS:-$RAIZ/.github/workflows}"
PR_UNO=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --pr) PR_UNO="${2:-}"; shift 2 ;;
    *) echo "::error::corridas-guard: argumento desconocido «$1»"; exit 2 ;;
  esac
done

if [ ! -d "$DIR_WF" ]; then
  echo "::error::corridas-guard: no existe «$DIR_WF». No puedo derivar qué debería correr."
  exit 2
fi

# ── el conjunto que DEBERÍA correr ───────────────────────────────────────────
# Derivado del árbol, no tecleado: una lista escrita a mano es completa el día
# que se escribe y el crecimiento la vacía en silencio. Es la misma lección que
# `contract-guard` ya pagó con sus puertas.
#
# Se lee por indentación, sin dependencias: `PyYAML` no está en esta máquina y
# este guardián tiene que correr con un `python3` pelado, igual que la validación
# del riel y `ci-cableado`.
esperados_para() {
  local base="$1"
  python3 - "$DIR_WF" "$base" <<'PY'
import os, re, sys
dir_wf, base = sys.argv[1], sys.argv[2]
for f in sorted(os.listdir(dir_wf)):
    if not f.endswith((".yml", ".yaml")):
        continue
    lineas = open(os.path.join(dir_wf, f), encoding="utf-8").read().split("\n")
    nombre = None
    for l in lineas:
        m = re.match(r'^name:\s*(.+?)\s*$', l)
        if m:
            nombre = m.group(1).strip('"\''); break
    if not nombre:
        nombre = f  # sin `name:`, GitHub usa la ruta del fichero
    # bloque `on:` — desde `on:` hasta la siguiente clave de nivel cero
    i = next((k for k, l in enumerate(lineas) if re.match(r'^on:\s*$', l)), None)
    if i is None:
        continue
    j = i + 1
    while j < len(lineas) and (not lineas[j].strip() or lineas[j].startswith((" ", "\t", "#"))):
        j += 1
    bloque = lineas[i+1:j]
    # ¿declara pull_request?
    k = next((n for n, l in enumerate(bloque) if re.match(r'^\s{2}pull_request:\s*$', l)), None)
    if k is None:
        continue
    # ¿acotado a ramas? si no lo declara, vale para todas
    ramas = None
    n = k + 1
    while n < len(bloque) and (not bloque[n].strip() or re.match(r'^\s{4,}', bloque[n])):
        m = re.match(r'^\s{4}branches:\s*\[(.*)\]\s*$', bloque[n])
        if m:
            ramas = [x.strip().strip('"\'') for x in m.group(1).split(",") if x.strip()]
        n += 1
    if ramas is None or base in ramas:
        print(nombre)
PY
}

# ── el conjunto que CORRIÓ ───────────────────────────────────────────────────
corrieron_para() {
  local sha="$1"
  if [ -n "${CORRIDAS_GUARD_CORRIERON+x}" ]; then
    printf '%s\n' "$CORRIDAS_GUARD_CORRIERON"
    return 0
  fi
  gh api "repos/{owner}/{repo}/actions/runs?head_sha=${sha}&per_page=100" \
     --jq '.workflow_runs[] | select(.event == "pull_request") | .name' 2>/dev/null
}

# ── juzgar un PR ─────────────────────────────────────────────────────────────
FALLOS=0
MIRADOS=0

juzgar() {
  local pr="$1" sha="$2" base="$3"
  MIRADOS=$((MIRADOS + 1))

  local esperados corrieron faltan
  # ⚠️ SE COMPRUEBA EL ESTADO, no solo la salida. La derivación recorre ficheros
  # e imprime según los va leyendo: si revienta a mitad, lo ya impreso queda —y
  # es una expectativa MÁS CORTA que la real, o sea un guardián que echa de menos
  # menos cosas—. Cazado por mutación: rompiendo el bucle a mitad, el sello daba
  # 11 de 11 porque lo que sobrevivió al fallo seguía cuadrando. Una lista
  # truncada en silencio es la avería de esta casa entera, cometida aquí.
  if ! esperados="$(esperados_para "$base" | sort -u)"; then
    echo "::error::corridas-guard: la derivación de «qué debería correr» falló a mitad."
    echo "  Lo que llegó a imprimir sería una expectativa más corta que la real, y"
    echo "  con ella este guardián echaría de menos menos cosas. No medir NO es verde."
    FALLOS=$((FALLOS + 1))
    return
  fi

  if [ -z "$esperados" ]; then
    echo "::error::corridas-guard: no derivé NI UN workflow que deba correr en un PR contra «$base»."
    echo "  Un guardián que no espera nada nunca echa nada de menos: eso no es verde, es ceguera."
    FALLOS=$((FALLOS + 1))
    return
  fi

  corrieron="$(corrieron_para "$sha" | sed '/^$/d' | sort -u)"
  faltan="$(comm -23 <(printf '%s\n' "$esperados") <(printf '%s\n' "$corrieron"))"

  if [ -z "$faltan" ]; then
    local n; n="$(printf '%s\n' "$esperados" | wc -l | tr -d ' ')"
    if [ "$n" = "1" ]; then
      echo "  ✅  PR #$pr ($sha) — corrió la única que debía."
    else
      echo "  ✅  PR #$pr ($sha) — corrieron las $n que debían."
    fi
    return
  fi

  FALLOS=$((FALLOS + 1))

  # La ausencia TOTAL se dice aparte: es la que se lee como «ninguna fallida».
  if [ -z "$corrieron" ]; then
    echo "::error::corridas-guard: el PR #$pr NO tiene NINGUNA corrida de Actions sobre $sha."
    echo "  ❌  PR #$pr ($sha) — cero corridas."
    echo "      «Ninguna comprobación fallida» es CIERTO aquí, y no significa nada:"
    echo "      no falló ninguna porque no corrió ninguna. La causa habitual es un"
    echo "      conflicto de fusión — GitHub no puede construir la ref y no ejecuta nada."
  else
    echo "::error::corridas-guard: al PR #$pr le faltan corridas de Actions sobre $sha."
    echo "  ❌  PR #$pr ($sha) — faltan:"
  fi
  printf '%s\n' "$faltan" | sed 's/^/        · /'
}

# ── entrada ──────────────────────────────────────────────────────────────────
if [ -n "${CORRIDAS_GUARD_PRS+x}" ]; then
  # Barrido con la lista inyectada. Existe para que el SELLO pueda alcanzar este
  # camino —el de varios PR y el recuento de cuántos se juzgaron—, que si no solo
  # existiría con red delante y por tanto no lo probaría nadie.
  TMP="$(mktemp)"
  trap 'rm -f "$TMP"' EXIT
  printf '%s\n' "$CORRIDAS_GUARD_PRS" | sed '/^$/d' > "$TMP"
  ABIERTOS="$(grep -c . "$TMP")"

  echo "Corridas de Actions: ¿está todo lo que debería estar?"
  echo

  while IFS='|' read -r pr sha base; do
    [ -n "$pr" ] || continue
    juzgar "$pr" "$sha" "$base"
  done < "$TMP"

  if [ "$MIRADOS" -ne "$ABIERTOS" ]; then
    echo "::error::corridas-guard: había $ABIERTOS PR que mirar y solo se juzgaron $MIRADOS."
    exit 2
  fi
elif [ -n "${CORRIDAS_GUARD_CORRIERON+x}" ]; then
  # Modo sello de un solo PR: sin red. El PR y su base los pone quien prueba.
  juzgar "${PR_UNO:-0}" "${CORRIDAS_GUARD_SHA:-sha-de-prueba}" "${CORRIDAS_GUARD_BASE:-main}"
else
  if ! command -v gh >/dev/null 2>&1; then
    echo "::error::corridas-guard: no hay «gh» en esta máquina y nadie inyectó qué corrió."
    echo "  Sin una de las dos cosas no se puede medir, y no medir NO es verde."
    exit 2
  fi

  if [ -n "$PR_UNO" ]; then
    datos="$(gh pr view "$PR_UNO" --json number,headRefOid,baseRefName 2>/dev/null)"
    if [ -z "$datos" ]; then
      echo "::error::corridas-guard: no pude leer el PR #$PR_UNO."
      exit 2
    fi
    lista="$datos"
  else
    lista="$(gh pr list --state open --json number,headRefOid,baseRefName 2>/dev/null)"
    if [ -z "$lista" ]; then
      echo "::error::corridas-guard: no pude listar los PR abiertos."
      exit 2
    fi
  fi

  echo "Corridas de Actions: ¿está todo lo que debería estar?"
  echo

  # La conversión va a un fichero ANTES de recorrerla, y su código de salida se
  # comprueba. En una tubería no se comprobaba, y la primera versión de esto
  # **dio verde con el conversor roto**: «no hay PR abiertos que mirar», exit 0.
  # Es la familia exacta que este guardián existe para cerrar, cometida por él
  # mismo — no medir se leía como no haber nada que medir.
  TMP="$(mktemp)"
  trap 'rm -f "$TMP"' EXIT

  if ! printf '%s' "$lista" | python3 -c "$(cat <<'PY'
import json, sys
d = json.load(sys.stdin)
if isinstance(d, dict):
    d = [d]
for p in d:
    print("%s|%s|%s" % (p["number"], p["headRefOid"], p["baseRefName"]))
PY
)" > "$TMP"; then
    echo "::error::corridas-guard: no pude interpretar la lista de PR que devolvió «gh»."
    echo "  No medir NO es verde."
    exit 2
  fi

  ABIERTOS="$(grep -c . "$TMP")"

  while IFS='|' read -r pr sha base; do
    [ -n "$pr" ] || continue
    juzgar "$pr" "$sha" "$base"
  done < "$TMP"

  if [ "$MIRADOS" -ne "$ABIERTOS" ]; then
    echo "::error::corridas-guard: había $ABIERTOS PR que mirar y solo se juzgaron $MIRADOS."
    exit 2
  fi

  if [ "$MIRADOS" -eq 0 ]; then
    echo "No hay PR abiertos que mirar — nada que reclamar."
    exit 0
  fi
fi

echo
if [ "$FALLOS" -gt 0 ]; then
  echo "::error::corridas-guard: $FALLOS de $MIRADOS PR no tienen todas sus corridas."
  echo
  echo "NO se mergea así. Y no basta con volver a mirar si alguna falló: el"
  echo "instrumento que pregunta «¿hay fallidas?» contesta «ninguna» cuando no"
  echo "hay ninguna, que es exactamente este caso."
  echo
  echo "Cómo se arregla, casi siempre: resolver el conflicto y volver a empujar."
  exit 1
fi

echo "corridas-guard: $MIRADOS PR mirado(s), a todos les corrió lo que debía — OK."
