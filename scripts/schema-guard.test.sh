#!/usr/bin/env bash
# schema-guard.test.sh — el sello del guardián del esquema.
#
# Le pone delante cada forma que dice vigilar, con migraciones de mentira
# escritas al vuelo. Los dos casos que importan son opuestos:
#
#   · una migración que ALTERA estructura sin tocar el documento → rojo
#   · una que solo MUEVE DATOS sin tocarlo                       → verde
#
# El segundo es la razón de existir de este cambio: el guardián anterior pedía
# tocar el documento siempre, y un guardián que obliga a un gesto vacío enseña a
# hacer gestos vacíos.
#
# Uso: bash scripts/schema-guard.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${SCHEMA_GUARD:-$REPO_ROOT/scripts/schema-guard.sh}"
TMP="$(mktemp -d)"
mkdir -p "$TMP/docs/schema" "$TMP/migrations"

PASS=0
FAIL=0

ESQUEMA="docs/schema/supabase-schema.sql"
: > "$TMP/$ESQUEMA"

# $1 = qué se prueba · $2 = exit esperado · $3… = ficheros cambiados
caso() {
  local que="$1" esperado="$2"; shift 2
  local salida code
  salida="$(SCHEMA_GUARD_ROOT="$TMP" SCHEMA_GUARD_CHANGED="$(printf '%s\n' "$@")" bash "$GUARD" 2>&1)"
  code=$?
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    printf '%s\n' "$salida" | sed 's/^/          /'
  fi
}

# --- migraciones de mentira -------------------------------------------------
cat > "$TMP/docs/schema/migration-solo-datos.sql" <<'SQL'
-- Renumera filas. No toca ninguna estructura.
WITH numerada AS (SELECT id, row_number() OVER () AS n FROM public.columns)
UPDATE public.columns c SET "order" = n.n FROM numerada n WHERE c.id = n.id;
SQL

cat > "$TMP/docs/schema/migration-altera.sql" <<'SQL'
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS nuevo TEXT;
SQL

cat > "$TMP/docs/schema/migration-tabla-completa.sql" <<'SQL'
CREATE TABLE IF NOT EXISTS public.nueva (id UUID PRIMARY KEY);
GRANT SELECT ON public.nueva TO anon;
ALTER TABLE public.nueva ENABLE ROW LEVEL SECURITY;
SQL

cat > "$TMP/docs/schema/migration-tabla-sin-grant.sql" <<'SQL'
CREATE TABLE IF NOT EXISTS public.floja (id UUID PRIMARY KEY);
ALTER TABLE public.floja ENABLE ROW LEVEL SECURITY;
SQL

cat > "$TMP/docs/schema/migration-tabla-sin-rls.sql" <<'SQL'
CREATE TABLE IF NOT EXISTS public.floja2 (id UUID PRIMARY KEY);
GRANT SELECT ON public.floja2 TO anon;
SQL

cat > "$TMP/docs/schema/migration-solo-permisos.sql" <<'SQL'
-- Ni crea ni altera tablas, pero mueve permisos: el esquema los documenta.
REVOKE ALL ON public.cards FROM anon;
GRANT SELECT ON public.cards TO anon;
SQL

cat > "$TMP/docs/schema/migration-una-linea-altera.sql" <<'SQL'
BEGIN; ALTER TABLE public.cards ADD COLUMN x TEXT; COMMIT;
SQL

cat > "$TMP/docs/schema/migration-una-linea-tabla.sql" <<'SQL'
BEGIN; CREATE TABLE public.secreta (id INT); COMMIT;
SQL

cat > "$TMP/docs/schema/migration-select-into.sql" <<'SQL'
SELECT * INTO public.cards_copia FROM public.cards;
SQL

cat > "$TMP/docs/schema/migration-solo-lo-dice-un-comentario.sql" <<'SQL'
-- Esta migración NO hace un ALTER TABLE ni un CREATE TABLE: solo lo menciona.
/* Y este comentario de bloque tampoco:
   GRANT SELECT ON public.cards TO anon;
   DROP TABLE public.cards; */
UPDATE public.cards SET priority = 'none' WHERE priority IS NULL;
SQL

echo "Sello del guardián del esquema ($GUARD)"
echo
echo "LO NUEVO — una migración de solo datos NO exige tocar el documento:"
caso "solo datos, sin documento" 0 "docs/schema/migration-solo-datos.sql"
caso "solo datos, con documento (tampoco molesta)" 0 \
  "docs/schema/migration-solo-datos.sql" "$ESQUEMA"

echo
echo "Lo de siempre — alterar estructura SÍ lo exige:"
caso "ALTER TABLE sin documento" 1 "docs/schema/migration-altera.sql"
caso "ALTER TABLE con documento" 0 "docs/schema/migration-altera.sql" "$ESQUEMA"
# Los permisos no cambian estructura pero el esquema los declara, así que cuentan.
caso "solo permisos, sin documento" 1 "docs/schema/migration-solo-permisos.sql"
# Una de datos no puede tapar a una estructural que venga en el mismo cambio.
caso "una de datos y una estructural juntas, sin documento" 1 \
  "docs/schema/migration-solo-datos.sql" "docs/schema/migration-altera.sql"

echo
echo "Tabla nueva: GRANT y RLS siguen siendo obligatorios:"
caso "tabla completa, con documento" 0 "docs/schema/migration-tabla-completa.sql" "$ESQUEMA"
caso "tabla sin GRANT" 1 "docs/schema/migration-tabla-sin-grant.sql" "$ESQUEMA"
caso "tabla sin RLS"   1 "docs/schema/migration-tabla-sin-rls.sql"   "$ESQUEMA"

echo
echo "Y lo que no es migración no dispara nada:"
caso "sin migraciones" 0 "README.md" "server/routes/cards.js"
caso "sin lista de ficheros" 0

echo
echo "La sentencia no empieza siempre en la primera columna:"
# REGRESIÓN MEDIDA, y por eso este bloque existe. La comprobación de `main` era
# `grep -qiE 'CREATE TABLE'` SIN anclar, y veía esto. La primera versión de este
# guardián ancló a principio de línea y dejó de verlo: un falso verde sobre
# permisos, que es la avería que esta casa ya pagó una vez.
#
# El caso HEREDADO de la comprobación anterior es el segundo. Si alguien vuelve
# a anclar sobre el fichero crudo, este bloque se pone rojo.
caso "BEGIN; ALTER … ; COMMIT en una línea, sin documento" 1 \
  "docs/schema/migration-una-linea-altera.sql"
caso "BEGIN; CREATE TABLE … ; COMMIT sin GRANT (lo cazaba el guardián VIEJO)" 1 \
  "docs/schema/migration-una-linea-tabla.sql" "$ESQUEMA"
caso "SELECT … INTO crea tabla aunque no diga CREATE" 1 \
  "docs/schema/migration-select-into.sql"
# Y el contrapeso: desanclar sin quitar comentarios cambia el falso verde por un
# falso rojo. Esta migración solo MENCIONA los verbos, en comentario de línea y
# de bloque, y no altera nada.
caso "verbos que solo aparecen dentro de comentarios NO cuentan" 0 \
  "docs/schema/migration-solo-lo-dice-un-comentario.sql"

echo
echo "¿Sabe si tiene algo que mirar?"
rel_case() {
  local que="$1" esperado="$2" diff="$3"
  local got
  got="$(SCHEMA_GUARD_CAMBIADOS="$diff" bash "$GUARD" --relevante 2>/dev/null)"
  if [ "$got" = "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba %s, dijo %s\n' "$que" "$esperado" "$got"
  fi
}
rel_case "una migración"                     SI "docs/schema/migration-x.sql"
rel_case "una migración en migrations/"      SI "migrations/add_x.sql"
rel_case "el documento del esquema"          SI "docs/schema/supabase-schema.sql"
rel_case "el propio guardián"                SI "scripts/schema-guard.sh"
# Sin datos NO se calla: correr de más cuesta un minuto; callar de menos deja una
# migración sin vigilar y nadie se entera.
rel_case "sin diff, se corre entero"         SI ""
rel_case "un cambio que no le toca nada"     NO "server/routes/cards.js"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián distingue estructura de datos, y sigue mordiendo donde debía."
