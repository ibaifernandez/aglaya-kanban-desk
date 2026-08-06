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
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián distingue estructura de datos, y sigue mordiendo donde debía."
