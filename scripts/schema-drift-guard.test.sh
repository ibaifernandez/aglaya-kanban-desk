#!/usr/bin/env bash
# schema-drift-guard.test.sh — el sello del guardián de deriva.
#
# Le inyecta por `SCHEMA_DRIFT_ROWS` lo que contestaría la base y exige rojo en
# **las dos direcciones**, que significan cosas distintas:
#
#   · declarada y ausente   → una migración escrita que nadie aplicó
#   · presente y no declarada → alguien tocó la base, o una migración hizo más
#     de lo que su documento cuenta
#
# Un guardián que solo mirase una dirección es la mitad de un guardián y se lee
# como entero.
#
# Uso: bash scripts/schema-drift-guard.test.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="${SCHEMA_DRIFT_GUARD:-$REPO_ROOT/scripts/schema-drift-guard.sh}"
TMP="$(mktemp -d)"

PASS=0
FAIL=0

# Un esquema de mentira, chico y con las formas que el de verdad tiene:
# comentarios sueltos, una columna entrecomillada y una restricción de tabla.
ESQUEMA="$TMP/esquema.sql"
cat > "$ESQUEMA" <<'SQL'
-- Un esquema de prueba
CREATE TABLE IF NOT EXISTS public.tablilla (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- un comentario en medio, como en el de verdad
  titulo       TEXT NOT NULL,
  "order"      INTEGER NOT NULL DEFAULT 0,
  CHECK (titulo <> '')
);

CREATE TABLE IF NOT EXISTS public.otra (
  id           UUID PRIMARY KEY,
  dueno_id     UUID REFERENCES public.tablilla(id) ON DELETE CASCADE
);
SQL

# Lo que contestaría la base si coincidiera al milímetro.
CUADRA=$'tablilla|id\ntablilla|titulo\ntablilla|order\notra|id\notra|dueno_id'

# $1 = qué se prueba · $2 = exit esperado · $3 = trozo esperado del mensaje
# $4 = las filas que devuelve la base · $5 = (opcional) esquema
corre() {
  local que="$1" esperado="$2" espera_msg="$3" filas="$4" esquema="${5:-$ESQUEMA}"
  local salida code
  salida="$(SCHEMA_DRIFT_ROWS="$filas" SCHEMA_DRIFT_SCHEMA="$esquema" bash "$GUARD" 2>&1)"
  code=$?
  if [ -n "$espera_msg" ] && ! grep -q "$espera_msg" <<< "$salida"; then
    FAIL=$((FAIL + 1))
    printf '  FALLO %s — el mensaje no dice «%s»\n' "$que" "$espera_msg"
    printf '%s\n' "$salida" | sed 's/^/          /'
    return
  fi
  if [ "$code" -eq "$esperado" ]; then
    PASS=$((PASS + 1)); printf '  ok    %s\n' "$que"
  else
    FAIL=$((FAIL + 1)); printf '  FALLO %s — esperaba exit %s, dio %s\n' "$que" "$esperado" "$code"
    printf '%s\n' "$salida" | sed 's/^/          /'
  fi
}

echo "Sello del guardián de deriva ($GUARD)"
echo
echo "Tiene que MORDER — dirección 1: la migración no se aplicó:"

# EL caso del #28: el documento declara la columna y la base no la tiene.
corre "una columna declarada que falta en la base" 1 "NO existe en la base" \
  $'tablilla|id\ntablilla|titulo\notra|id\notra|dueno_id'
corre "y el mensaje la nombra con su tabla"        1 "«tablilla.order»" \
  $'tablilla|id\ntablilla|titulo\notra|id\notra|dueno_id'
corre "una tabla entera declarada y sin aplicar"   1 "la tabla «otra» está declarada" \
  $'tablilla|id\ntablilla|titulo\ntablilla|order'

echo
echo "Tiene que MORDER — dirección 2: la base tiene algo que nadie declaró:"
corre "una columna en la base que el esquema no declara" 1 "el esquema NO la declara" \
  "$CUADRA"$'\ntablilla|colada'
corre "y el mensaje la nombra"                           1 "«tablilla.colada»" \
  "$CUADRA"$'\ntablilla|colada'
corre "una tabla entera sin declarar"                    1 "la tabla «fantasma» existe en la base" \
  "$CUADRA"$'\nfantasma|id'

echo
echo "Tiene que MORDER las dos a la vez, sin que una tape a la otra:"
salida="$(SCHEMA_DRIFT_ROWS="$(printf 'tablilla|id\ntablilla|titulo\notra|id\notra|dueno_id\ntablilla|colada')" \
          SCHEMA_DRIFT_SCHEMA="$ESQUEMA" bash "$GUARD" 2>&1)"
if grep -q "«tablilla.order»" <<< "$salida" && \
   grep -q "«tablilla.colada»" <<< "$salida"; then
  PASS=$((PASS + 1)); printf '  ok    la que falta y la que sobra salen las dos\n'
else
  FAIL=$((FAIL + 1)); printf '  FALLO una tapó a la otra\n'
  printf '%s\n' "$salida" | sed 's/^/          /'
fi

echo
echo "Tiene que ROMPERSE, no saltar en verde:"
corre "la base no devuelve ninguna columna"        2 "ninguna columna" ""
corre "una fila sin el separador «|»"              2 "sin separador"   $'tablilla id'
corre "el esquema no existe"                       2 "no existe"       "$CUADRA" "$TMP/no-hay.sql"

cat > "$TMP/vacio.sql" <<'SQL'
-- Un fichero que ya no tiene la forma que este guardián sabe leer.
CREATE TABLE public.otra_forma (id uuid);
SQL
corre "el esquema cambió de forma y ya no se reconoce" 2 "no se reconoció" "$CUADRA" "$TMP/vacio.sql"

echo
echo "Tiene que CALLAR:"
corre "la base coincide con el documento"          0 "OK" "$CUADRA"
# El orden de las filas es cosa de la consulta, no del guardián.
corre "las mismas filas en otro orden"             0 "OK" \
  $'otra|dueno_id\ntablilla|order\notra|id\ntablilla|titulo\ntablilla|id'
# Las restricciones de tabla NO son columnas: si se colaran, el guardián pediría
# a la base una columna llamada `CHECK` y nacería rojo sobre el esquema real.
corre "la restricción CHECK no se cuenta como columna" 0 "OK" "$CUADRA"

echo
echo "Y sobre el esquema de VERDAD, con una base que lo refleje:"
FILAS_REALES="$(python3 - "$REPO_ROOT/docs/schema/supabase-schema.sql" <<'PY'
import re, sys
lineas = open(sys.argv[1], encoding="utf-8").read().split("\n")
NO = {"UNIQUE", "PRIMARY", "CONSTRAINT", "CHECK", "FOREIGN", "EXCLUDE", "LIKE"}
i, out = 0, []
while i < len(lineas):
    m = re.match(r"^CREATE TABLE IF NOT EXISTS public\.(\w+)\s*\($", lineas[i])
    if m:
        t = m.group(1); i += 1
        while i < len(lineas) and not lineas[i].startswith(");"):
            l = lineas[i].strip()
            if l and not l.startswith("--"):
                tok = l.split()[0].strip('",')
                if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", tok) and tok.upper() not in NO:
                    out.append(f"{t}|{tok}")
            i += 1
    i += 1
print("\n".join(out))
PY
)"
corre "el esquema real se parsea entero y no da deriva contra sí mismo" 0 "OK" \
  "$FILAS_REALES" "$REPO_ROOT/docs/schema/supabase-schema.sql"

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
echo "El guardián de deriva muerde en las dos direcciones y calla donde debe."
