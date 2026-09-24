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
# Y UNA TERCERA COSA, QUE NO SE DERIVA Y SE DICE: el conector MCP de Supabase de
# esta máquina alcanza el proyecto de producción y contesta consultas sueltas
# —políticas RLS, recuentos, el contenido de una fila—, cosa que ningún workflow
# hace. Eso NO está en ningún fichero de este repositorio: vive en la
# configuración de MCP de la máquina, así que este guardián **no puede
# comprobar que siga funcionando**. Lo que sí fija es que el documento no vuelva
# a decir lo contrario: hasta el 24-sep-2026, `CLAUDE.md` afirmaba que ese MCP
# «apunta a otra organización», y esa frase costó semanas de lecturas pedidas a
# mano y un cierre bloqueado. Si alguien la repone, esto se pone rojo.
#
# LO QUE ESTE GUARDIÁN NO PUEDE HACER, dicho para que su verde no se lea de más:
# comprueba que el documento nombra los workflows que hay, **no que explique
# bien qué contesta cada uno**. Que el texto describa la medición sigue siendo
# trabajo de quien revise. Cierra el caso en que nadie miró.
#
# Uso:
#   bash scripts/base-consultable-guard.sh
#   BASE_CONSULTABLE_WORKFLOWS=<dir> BASE_CONSULTABLE_DOC=<fichero> bash …
#   BASE_CONSULTABLE_DOCS_NIEGAN=<fichero[:fichero…]> bash …   (los que no pueden negar)
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

# ── Tercera dirección: que no se vuelva a negar la vía del conector ──────────
#
# Esto NO se deriva del árbol, y por eso se dice aquí: la existencia del conector
# no está en ningún fichero. Lo que se fija es lo que sí es texto — que el
# documento lo nombre, y que ningún documento vigente afirme lo contrario.
MARCA_CONECTOR='<!-- base-consultable:conector -->'
NIEGAN="${BASE_CONSULTABLE_DOCS_NIEGAN:-$DOC:$RAIZ/CLAUDE.md}"

if ! grep -qF "$MARCA_CONECTOR" "$DOC"; then
  fallo=1
  echo "::error::el documento ya no nombra la vía del conector de Supabase (marca «$MARCA_CONECTOR»). Sin ella, quien lo lea concluirá que una consulta suelta no se puede hacer — que es la creencia falsa que costó semanas."
fi

# Las frases que costaron la jornada, y sus parientes: negar la vía o atribuir
# el conector a otra organización.
#
# ⚠️ SIN MIRAR LO RETRACTADO. Un documento que corrige una frase falsa tiene que
# poder CITARLA para desmentirla —así se escribe aquí, y es lo que conserva la
# lección—, y el párrafo que prohíbe negar la vía contiene, por fuerza, la
# negación. La primera versión de este control se puso roja contra su propio
# texto y contra la retractación de `CLAUDE.md`. Así que lo que va entre
# `<!-- base-consultable:retractado -->` y su cierre NO se mira. La marca es
# explícita a propósito: envolver una afirmación viva en ella para escapar del
# guardián es un acto deliberado que se ve en la revisión.
# Y en UNA SOLA LÍNEA. La frase que se colaba en `ARCHITECTURE.md` iba partida en
# dos renglones («…está autenticado\n**contra otra organización**»), así que un
# grep por líneas la dejaba pasar: el guardián daba verde con la negación puesta,
# en la sección escrita para agentes. Lo encontró el vigilante, no yo.
sin_retractado() {
  awk '
    index($0,"<!-- base-consultable:retractado -->"){dentro=1; next}
    index($0,"<!-- base-consultable:retractado-fin -->"){dentro=0; next}
    !dentro{print}
  ' "$1" | tr '\n' ' '
}

while IFS= read -r doc; do
  [ -z "$doc" ] && continue
  [ -f "$doc" ] || roto "no existe «$doc», que es uno de los documentos que no pueden negar la vía."
  if sin_retractado "$doc" | grep -nEi 'MCP de Supabase[^.]{0,80}(otra organizaci|no alcanza|no apunta)|apunta a \*\*otra organizaci|(base|producci[óo]n) es inconsultable'; then
    fallo=1
    echo "::error file=$doc::este documento vuelve a decir que no se puede preguntarle a la base desde aquí. Se midió que sí el 24-sep-2026 (tarjeta \`0c318033\`): si de verdad ha dejado de contestar, lo que se cambia es la sección del conector, con su medición y su fecha — no se repone la frase."
  fi
done <<< "$(printf '%s\n' "$NIEGAN" | tr ':' '\n')"

if [ "$fallo" -ne 0 ]; then
  echo
  echo "base-consultable-guard: el documento que enseña a preguntarle a la base"
  echo "ya no describe lo que la base puede contestar."
  exit 1
fi

n=$(printf '%s\n' "$en_arbol" | grep -c .)
echo "base-consultable-guard: $n vía(s) de preguntar a la base, el documento nombra exactamente esas, y sigue diciendo que el conector contesta consultas sueltas — OK."
