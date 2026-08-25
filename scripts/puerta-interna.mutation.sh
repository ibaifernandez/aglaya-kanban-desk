#!/usr/bin/env bash
# puerta-interna.mutation.sh — las siete que sobrevivieron, corridas como batería.
#
# ─────────────────────────────────────────────────────────────────────────────
# QUÉ CIERRA, y por qué no es una prueba más
#
# Los tests de ruta de la puerta interna improvisan su propio doble de
# `supabaseAdmin`, uno por fichero. El doble original **no aplicaba `select`,
# `eq` ni `neq`**: devolvía sus fixtures pasara lo que pasara. Con él, cualquier
# aserción sobre la FORMA de la respuesta era una tautología sobre el propio
# doble — la prueba no medía el código, medía su fixture.
#
# Se midió a mano contra los PR #13/#14/#15: **siete mutaciones de
# `server/routes/internalRoute.js` pasaban en verde**, dos de ellas fuga entre
# espacios y enumeración del espacio personal. Los dobles se arreglaron después
# (#16 y el de contrato), pero **nada impide que vuelvan a aflojarse**: un doble
# cómodo es más fácil de escribir que uno fiel, y su verde es indistinguible.
#
# Esto es lo que lo impide. Destripa la ruta siete veces —las siete exactas que
# sobrevivieron— y **exige que la batería de tests se ponga ROJA en cada una**.
# Si alguna sobrevive, el doble volvió a mentir y aquí se sabe, con nombre.
#
# POR QUÉ MUTACIÓN A MANO Y NO UNA HERRAMIENTA. Se encargó una herramienta de
# mutación genérica y la medición desmiente la petición: de las siete, un mutador
# genérico genera una útil (#1), una redundante (#4) y **no genera cinco**. Las
# de los puntos 2, 3 y 7 son mutaciones de DOMINIO —retirar una llamada de una
# cadena, intercambiar un identificador por otro del ámbito— y las escribe quien
# entendió cuál era el defecto. Y la peor es invisible por construcción: las
# herramientas mutan el código de producción, **no los dobles**, y un mutante no
# puede matar un test que nunca ejecutó la lógica que dice vigilar.
#
# Precedente de la casa: `scripts/docs-guard.mutation.sh` hace esto mismo con un
# guardián, y `rail-blindspot.test.sh` sella inyectando filas de mentira.
#
# LO QUE NO PUEDE HACER: comprueba que la batería MUERDE ante siete defectos
# conocidos, no que cubra todo lo que la puerta promete. Un octavo defecto que
# nadie haya medido sigue sin vigilante.
#
# CÓMO TOCA EL ÁRBOL: escribe el mutante SOBRE la ruta real y la restaura al
# salir (también si lo matan). Al terminar comprueba byte a byte que quedó igual
# y se pone rojo si no — restaurar mal es peor que no mutar.
#
# Uso: bash scripts/puerta-interna.mutation.sh
# Exit 0 = las siete mueren · 1 = alguna sobrevive, o la restauración falló.
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUTA="$RAIZ/server/routes/internalRoute.js"
TESTS="${PUERTA_INTERNA_TESTS:-server/tests/internal-}"

# Placeholders para que `require()` no explote al cargar el módulo. No son
# secretos: los tests fijan los suyos (`JWT_SECRET`, `TASK_SECRET`) dentro.
: "${NODE_ENV:=test}"
: "${JWT_SECRET:=test-secret}"
: "${RESEND_API_KEY:=test_key}"
: "${SUPABASE_URL:=http://localhost}"
: "${SUPABASE_SERVICE_ROLE_KEY:=test_service_role}"
: "${SUPABASE_ANON_KEY:=test_anon_key}"
export NODE_ENV JWT_SECRET RESEND_API_KEY SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY

if [ ! -f "$RUTA" ]; then
  echo "::error::puerta-interna.mutation: no existe «$RUTA». No puedo mutar lo que no encuentro."
  exit 1
fi

TMP="$(mktemp -d)"
ORIGINAL="$TMP/internalRoute.original.js"
cp "$RUTA" "$ORIGINAL"

# La restauración va en el trap y no al final del cuerpo: si alguien mata esto a
# media batería, el árbol NO puede quedarse con una ruta destripada dentro.
restaurar() { cp "$ORIGINAL" "$RUTA"; }
trap 'restaurar; rm -rf "$TMP"' EXIT
trap 'restaurar; rm -rf "$TMP"; exit 130' INT TERM

PASS=0
FAIL=0

correr_bateria() {
  ( cd "$RAIZ" && npx jest "$TESTS" --runInBand --no-watchman --forceExit --ci ) \
    >"$TMP/jest.txt" 2>&1
}

# mutar <etiqueta> <qué-debe-ponerse-rojo> <expresión-perl>
mutar() {
  local etiqueta="$1" espera="$2" expr="$3"

  perl -0777 -pe "$expr" "$ORIGINAL" >"$TMP/mutante.js"

  # Una mutación que no se aplicó da un verde que parece un test que pasa. Es el
  # fallo más caro de esta clase de script: el mutante nunca existió y la batería
  # se firma como probada.
  if cmp -s "$ORIGINAL" "$TMP/mutante.js"; then
    echo "  ❌ $etiqueta — LA MUTACIÓN NO SE APLICÓ (la ruta cambió de forma). Nada se midió."
    FAIL=$((FAIL + 1))
    return
  fi

  cp "$TMP/mutante.js" "$RUTA"
  if correr_bateria; then
    echo "  ❌ $etiqueta — BATERÍA VERDE con el defecto dentro."
    echo "     Debía ponerse roja: «$espera»"
    echo "     El doble de esa prueba no ejerce el código que dice vigilar."
    FAIL=$((FAIL + 1))
  else
    echo "  ✅ $etiqueta — roja, como debe."
    PASS=$((PASS + 1))
  fi
  restaurar
}

echo "=== las siete que sobrevivieron: mutar la puerta y exigir rojo ==="
echo

# 1 · Proyección incompleta. La genera un mutador genérico; se conserva porque
#     es la que destapó que el doble ignoraba `select`.
mutar "1 · quitar «emoji» de la proyección de list-workspaces" \
      "cada workspace incluye id, name, type, emoji" \
      "s/\.select\('id, name, type, emoji, organization_id'\)/.select('id, name, type, organization_id')/"

# 2 · FUGA ENTRE ESPACIOS. Sin el filtro, la puerta entrega tableros de
#     workspaces que no se pidieron. De lo peor que puede hacer esta puerta.
mutar "2 · quitar el .eq('workspace_id') de list-boards — fuga entre espacios" \
      "solo devuelve tableros del workspace pedido" \
      "s/^\s*\.eq\('workspace_id', workspaceId\)\n//m"

# 3 · ENUMERA EL ESPACIO PERSONAL. Esta puerta se autentica con TASK_SECRET, que
#     vive fuera de esta máquina: enumerar ese UUID es entregar justo lo que hace
#     falta para apuntar ahí.
mutar "3 · quitar el .neq('type','personal') — enumera el espacio personal" \
      "NO lista los workspaces de tipo personal" \
      "s/^\s*\.neq\('type', 'personal'\)\n//m"

# 4 · Guarda de ambigüedad desactivada: un nombre parcial que casa con varios
#     aterriza en uno arbitrario devolviendo 201.
mutar "4 · desactivar la guarda de ambigüedad de workspace" \
      "rechaza con 400 si el nombre casa con varios" \
      "s/if \(workspaces\.length > 1\)/if (false)/"

# 5 · El 400 sin `candidates` obliga a adivinar otra vez: dice «ambiguo» sin
#     decir entre qué.
mutar "5 · borrar el payload «candidates» del 400 de ambigüedad" \
      "el 400 lista los candidatos con id y nombre" \
      "s/^\s*candidates: workspaces\.map\(w => \(\{ id: w\.id, name: w\.name \}\)\),\n//m"

# 6 · Acuse sin destino resuelto: el que clava trabajo no puede comprobar dónde
#     aterrizó.
#
#     ⚠️ Se ancla al INICIO DEL ACUSE a propósito. `board_id: board.id,` y
#     `column_id: targetColumn.id,` aparecen DOS veces en la ruta: en el `insert`
#     y en el acuse. Sin el ancla, la sustitución pega en la primera —el insert—
#     y esta línea mide una mutación que no es la suya. Pasó al escribirla: dio
#     verde, y el verde era correcto para el mutante equivocado.
#
#     El ancla era `res.status(201).json({` y dejó de existir el 25-ago-2026, al
#     pasar el acuse a una variable para poder añadirle el aviso de tarjeta
#     vacía. **La batería lo cazó en el acto** —«la mutación no se aplicó»— en vez
#     de dar un verde por no haber medido nada, que es justo para lo que existe
#     esa comprobación. Ahora ancla en `const acuse = {`.
mutar "6 · borrar board_id y column_id del acuse" \
      "resuelve el tablero y la columna" \
      "s/(const acuse = \{.*?)^\s*board_id:\s+board\.id,\n/\$1/ms; s/(const acuse = \{.*?)^\s*column_id:\s+targetColumn\.id,\n/\$1/ms"

# 7 · MUTACIÓN DE DOMINIO: devolver la entrada en vez del nombre canónico. Es el
#     defecto original —el acuse devolvía el espacio tal como entró, justo el
#     campo por el que se puede aterrizar mal—. Ningún mutador genérico la genera.
mutar "7 · devolver la entrada en vez del nombre canónico del workspace" \
      "resuelve el workspace, no devuelve la entrada" \
      "s/workspace:\s+workspace\.name,/workspace:    workspaceName,/"

echo
echo "Ruta íntegra: la batería debe estar VERDE (si no, no hay nada que medir)."
restaurar
if correr_bateria; then
  echo "  ✅ verde con la ruta intacta"
  PASS=$((PASS + 1))
else
  echo "  ❌ ROJA con la ruta intacta — arregla eso antes de leer nada de arriba."
  sed -n '1,40p' "$TMP/jest.txt"
  FAIL=$((FAIL + 1))
fi

# Restaurar mal es peor que no mutar: dejaría un defecto sembrado con forma de
# trabajo de otro. Se comprueba, no se confía en el trap.
if ! cmp -s "$ORIGINAL" "$RUTA"; then
  echo
  echo "::error::puerta-interna.mutation: la ruta NO quedó como estaba. Restaura a mano desde git."
  FAIL=$((FAIL + 1))
fi

echo
echo "=== $PASS ok · $FAIL fallos ==="
[ "$FAIL" = "0" ] || exit 1
echo "Las siete mueren. Los dobles ejercen el código que dicen vigilar."
