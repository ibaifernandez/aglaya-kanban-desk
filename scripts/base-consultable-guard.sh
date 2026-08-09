#!/usr/bin/env bash
# base-consultable-guard.sh — el documento que enseña a preguntarle a la base
# tiene que seguir nombrando lo que de verdad puede contestar.
#
# ─────────────────────────────────────────────────────────────────────────────
# QUÉ VIGILA, Y POR QUÉ HACE FALTA VIGILARLO
#
# La tarjeta `e07ca50c` pedía escribir, donde se busca, qué preguntas sobre la
# base contesta cada workflow y cómo dispararlo. Eso es, inevitablemente, UNA
# LISTA — y una lista escrita a mano está completa **el día que se escribe**.
# Esta casa ya lo pagó dos veces: la de ficheros de `contract-guard`, que se
# quedó corta el mismo día; y la de tools del MCP en `CLAUDE.md`, que nombraba
# siete cuando ya había el doble y nadie lo notó porque las siete funcionaban.
#
# Así que la lista se escribe, pero no se deja sola: este guardián la DERIVA del
# árbol y exige que coincida.
#
# LAS DOS DIRECCIONES SIGNIFICAN COSAS DISTINTAS, y por eso se miran las dos:
#
#   · **en el árbol y no en el documento** → hay una vía de preguntarle a la
#     base que nadie cuenta. El daño no es que falte un renglón: es que el papel
#     automático que lea el documento concluirá que no se puede preguntar, y
#     volverá a poner a una persona en el camino crítico de una lectura. Es
#     exactamente el defecto que la tarjeta cerró — y volvería en silencio.
#
#   · **en el documento y no en el árbol** → el documento manda disparar algo
#     que ya no existe o que ya no alcanza la base. Es el peor de los dos: quien
#     lo siga no obtiene «no se puede», obtiene nada, y **nada se parece mucho a
#     que no había nada que encontrar**.
#
# QUÉ CUENTA COMO «PUEDE CONTESTAR SOBRE LA BASE», y se deriva, no se decide:
# un workflow que (a) se puede disparar a mano —`workflow_dispatch`— y (b) usa
# `secrets.DATABASE_URL`, que es la credencial que llega a la base de verdad.
# Las dos condiciones a la vez: sin la primera no se le puede preguntar cuando
# hace falta, y sin la segunda no está mirando esta base. En `ci.yml` conviven
# valores falsos de Supabase para las pruebas y el secreto real; por eso se
# busca `secrets.DATABASE_URL` y no la palabra suelta.
#
# LO QUE ESTE GUARDIÁN NO PUEDE HACER, dicho para que su verde no se lea de más:
# comprueba que el documento nombra los workflows que hay, **no que explique
# bien qué contesta cada uno**. Que el texto describa la medición sigue siendo
# trabajo de quien revise. Cierra el caso en que nadie miró.
#
# Uso:
#   bash scripts/base-consultable-guard.sh
#   BASE_CONSULTABLE_WORKFLOWS=<dir> BASE_CONSULTABLE_DOC=<fichero> bash …
#
# Exit 0 = coinciden. 1 = divergen. 2 = no se pudo medir.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR_WF="${BASE_CONSULTABLE_WORKFLOWS:-$RAIZ/.github/workflows}"
DOC="${BASE_CONSULTABLE_DOC:-$RAIZ/docs/ARCHITECTURE.md}"

INICIO='<!-- base-consultable:inicio -->'
FIN='<!-- base-consultable:fin -->'

roto() { echo "::error::base-consultable-guard: $1"; exit 2; }

[ -d "$DIR_WF" ] || roto "no existe el directorio de workflows «$DIR_WF»."
[ -f "$DOC" ]    || roto "no existe el documento «$DOC». Si se movió, este guardián no puede saber a dónde: dilo aquí."

# ── Lo que el ÁRBOL puede contestar ──────────────────────────────────────────
en_arbol="$(
  for f in "$DIR_WF"/*.yml "$DIR_WF"/*.yaml; do
    [ -f "$f" ] || continue
    grep -qE '^[[:space:]]*workflow_dispatch:' "$f" || continue
    grep -q 'secrets\.DATABASE_URL'              "$f" || continue
    basename "$f"
  done | sort -u
)"

# Cero es «no se midió», no «está todo bien». Si el patrón de la credencial
# cambia —otro nombre de secreto, otra forma de escribirlo— este guardián se
# quedaría sin nada que comparar y daría verde sobre un documento que podría
# estar entero equivocado. Un guardián que no encuentra nada que vigilar está
# roto, no conforme.
[ -n "$en_arbol" ] || roto "ningún workflow con disparo manual usa «secrets.DATABASE_URL». O no queda ninguna vía de preguntarle a la base, o cambió la forma de nombrar la credencial y este guardián dejó de reconocerla. Las dos cosas hay que mirarlas: ninguna es un verde."

# ── Lo que el DOCUMENTO dice que se puede contestar ──────────────────────────
grep -qF "$INICIO" "$DOC" || roto "el documento no lleva la marca «$INICIO». Sin ella no se sabe qué trozo es la lista, y comparar contra el fichero entero engancharía cualquier mención de paso."
grep -qF "$FIN"    "$DOC" || roto "el documento lleva «$INICIO» y no «$FIN»: el bloque está abierto."

bloque="$(awk -v i="$INICIO" -v f="$FIN" '
  index($0,i){dentro=1; next}
  index($0,f){dentro=0}
  dentro{print}
' "$DOC")"

en_doc="$(printf '%s\n' "$bloque" | grep -oE '`[A-Za-z0-9._-]+\.ya?ml`' | tr -d '`' | sort -u)"

[ -n "$en_doc" ] || roto "el bloque del documento no nombra ningún workflow. Un bloque vacío entre las dos marcas se lee como «no hay vías», que es justo la creencia falsa que esto existe para impedir."

# ── Comparación, en las dos direcciones ──────────────────────────────────────
faltan="$(comm -23 <(printf '%s\n' "$en_arbol") <(printf '%s\n' "$en_doc"))"
sobran="$(comm -13 <(printf '%s\n' "$en_arbol") <(printf '%s\n' "$en_doc"))"

fallo=0

if [ -n "$faltan" ]; then
  fallo=1
  while IFS= read -r w; do
    [ -z "$w" ] && continue
    echo "::error file=$(realpath --relative-to="$RAIZ" "$DOC" 2>/dev/null || echo "$DOC")::«$w» puede preguntarle a la base y el documento NO lo nombra. Quien lo lea creerá que esa vía no existe, y volverá a pedirle la lectura a una persona."
  done <<< "$faltan"
fi

if [ -n "$sobran" ]; then
  fallo=1
  while IFS= read -r w; do
    [ -z "$w" ] && continue
    echo "::error file=$(realpath --relative-to="$RAIZ" "$DOC" 2>/dev/null || echo "$DOC")::el documento nombra «$w» y hoy NO puede contestar sobre la base — o no existe, o perdió el disparo manual, o ya no usa «secrets.DATABASE_URL». Quien lo siga no obtendrá un error: obtendrá nada."
  done <<< "$sobran"
fi

if [ "$fallo" -ne 0 ]; then
  echo
  echo "base-consultable-guard: el documento que enseña a preguntarle a la base"
  echo "ya no describe lo que la base puede contestar."
  exit 1
fi

n=$(printf '%s\n' "$en_arbol" | grep -c .)
echo "base-consultable-guard: $n vía(s) de preguntar a la base, y el documento nombra exactamente esas — OK."
