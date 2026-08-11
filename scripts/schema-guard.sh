#!/usr/bin/env bash
# schema-guard.sh — una migración que CAMBIA EL ESQUEMA sin actualizar el
# documento fuente de verdad pone CI en rojo. Una que solo mueve datos, no.
#
# QUÉ PROBLEMA CIERRA, y por qué es de los sutiles. La regla original exigía
# tocar `docs/schema/supabase-schema.sql` ante CUALQUIER fichero `migration-*.sql`,
# aunque la migración solo moviera filas y no alterara ninguna estructura.
#
# El 6-ago-2026 pasó: una migración que solo renumeraba columnas obligó a tocar el
# documento. Aquel día no hizo daño porque había cosas honestas que escribir. El
# problema es el día que no las haya: **el guardián pide un gesto vacío, y eso
# enseña a hacer gestos vacíos**. A partir de ahí su verde no informa — es la
# misma avería que ya pagó esta casa con un guardián puesto en rojo por dos
# literales de versión, que se normaliza hasta que deja de mirarse.
#
# CÓMO DISTINGUE, y por qué así y no con una marca. La tarjeta ofrecía una marca
# explícita en la migración si distinguir por contenido salía frágil. Se descarta:
# una casilla que se marca sola acaba marcándose siempre, y entonces el guardián
# vuelve a no informar por el otro extremo. Se mira el CONTENIDO: si hay una sola
# sentencia que altere estructura o permisos, es estructural.
#
# Medido contra las siete migraciones que existen hoy en el repo antes de
# adoptarlo: seis salen estructurales y una —la que renumeraba columnas— sale de
# datos. Es exactamente la clasificación que uno haría a mano.
#
# LO QUE NO PUEDE HACER, y todo esto está MEDIDO, no supuesto. No entiende SQL:
# normaliza y busca sentencias.
#
#   · **Verbo construido en tiempo de ejecución.** Un `DO $$ … EXECUTE
#     format('ALTER …') … $$` se le escapa entero. Comprobado.
#   · **Literales de cadena con `--` o `/*` dentro.** El normalizador los trata
#     como comentario y se come el resto. En migraciones no pasa; queda dicho.
#   · **Falso rojo dentro de un `DO $$ … $$`:** un `SELECT … INTO variable` de
#     PL/pgSQL se cuenta como creación de tabla. Es el lado seguro del error y se
#     prefiere a callar, pero es un falso positivo real.
#
# La primera versión de este guardián declaraba SOLO la primera, y el vigilante
# encontró dos más midiendo. Lo que un guardián dice que no cubre es justo
# aquello sobre lo que se decide, así que la lista se amplía en vez de
# defenderse.
#
# REGRESIÓN QUE ESTE FICHERO YA COMETIÓ, para que no vuelva. La detección estaba
# anclada a principio de línea sobre el fichero CRUDO. Eso evitaba bien el falso
# positivo del comentario, y a cambio dejaba pasar `BEGIN; CREATE TABLE …;
# COMMIT;` en un renglón — que la comprobación anterior, sin anclar, SÍ veía. Una
# tabla naciendo sin GRANT ni RLS es la avería que esta casa pagó el 6-ago-2026.
#
# El arreglo no fue desanclar: desanclar sin más cambia ese falso verde por un
# falso rojo en cuanto alguien escriba `-- ALTER TABLE …` en un comentario. Se
# normaliza —comentarios fuera, una sentencia por línea— y entonces las dos
# trampas caen a la vez. El sello tiene un caso por cada una.
#
# Uso:
#   bash scripts/schema-guard.sh fichero1 fichero2 …
#   SCHEMA_GUARD_CHANGED=$'a\nb' bash scripts/schema-guard.sh
#   SCHEMA_GUARD_ROOT=/tmp/x  (para el sello)
#
# Exit 0 = nada que reclamar. Exit 1 = falta el documento, o faltan GRANT/RLS.

set -uo pipefail

RAIZ="${SCHEMA_GUARD_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ESQUEMA="docs/schema/supabase-schema.sql"


# Qué cuenta como migración. Mismo patrón que usaba el workflow.
PATRON_MIGRACION='^(migrations/|docs/schema/migration-).*\.sql$'

# `--relevante`: ¿tiene este cambio algo que este guardián deba mirar?
#
# Vive AQUÍ y no en un `paths:` del workflow, por dos motivos que esta casa pagó
# el mismo día: un guardián que no se dispara NO APARECE en el PR —y una
# comprobación ausente no se distingue de una que pasó, como le pasó al #34—, y
# una lista de rutas en el YAML sería una SEGUNDA lista.
#
# La suya es la más corta de los tres guardianes, y se deriva de lo único que
# mira: migraciones y el documento del esquema. Más él mismo y su workflow.
#
# Uso:  SCHEMA_GUARD_CAMBIADOS="$(git diff --name-only BASE HEAD)" \
#         bash scripts/schema-guard.sh --relevante
# Escribe SI o NO en stdout; el motivo va a stderr.
if [ "${1:-}" = "--relevante" ]; then
  cambios="${SCHEMA_GUARD_CAMBIADOS:-}"
  if [ -z "$cambios" ]; then
    echo "sin diff — se corre entero, que es el lado seguro de no saber" >&2
    echo "SI"; exit 0
  fi
  if grep -qE "$PATRON_MIGRACION|^docs/schema/|^scripts/schema-guard|^\.github/workflows/schema-guard\.yml$" <<< "$cambios"; then
    echo "relevante: cambió una migración, el documento del esquema o el propio guardián" >&2
    echo "SI"; exit 0
  fi
  echo "nada que mirar: este cambio no toca migraciones ni el esquema" >&2
  echo "NO"; exit 0
fi

# Verbos que ALTERAN: estructura, permisos o políticas. Si aparece uno, el
# documento tiene que enterarse. `COMMENT ON` entra porque el esquema documenta
# comentarios de columna.
#
# Se aplican sobre el SQL NORMALIZADO (ver `_sql_normalizado`), donde cada
# sentencia ocupa su propia línea y los comentarios ya no están. Anclar a
# principio de línea sobre el fichero CRUDO era una regresión: `BEGIN; CREATE
# TABLE …; COMMIT;` en un renglón se leía como «solo datos», y la comprobación
# de `main` —sin anclar— sí lo veía. Se cambió un falso positivo por un falso
# negativo sobre permisos, que es el peor cambio posible.
VERBOS_DDL='^[[:space:]]*(CREATE|ALTER|DROP|GRANT|REVOKE|COMMENT[[:space:]]+ON|TRUNCATE)[[:space:]]'

# `SELECT … INTO tabla` CREA UNA TABLA sin decir CREATE, así que no lo caza
# ningún verbo. Cuenta como estructural y como creación de tabla: nace sin
# GRANT y sin RLS igual que cualquier otra, y es la forma que más fácil se cuela
# porque parece una consulta.
CREA_TABLA='^[[:space:]]*(CREATE[[:space:]]+TABLE|SELECT[[:space:]].*[[:space:]]INTO[[:space:]])'

# Deja el SQL en una sentencia por línea y sin comentarios. Sin esto, cualquier
# patrón anclado se engaña con `BEGIN; …` y cualquier patrón sin anclar se
# engaña con un `-- ALTER TABLE …` dentro de un comentario. Las dos trampas son
# reales y una de ellas ya se coló.
#
# LO QUE NO HACE: no entiende literales de cadena. Un `--` o un `/*` DENTRO de
# comillas se trata como comentario. En migraciones no pasa; queda dicho.
_sql_normalizado() {
  awk '
    {
      linea = $0; salida = ""; i = 1
      while (i <= length(linea)) {
        if (enbloque) {
          p = index(substr(linea, i), "*/")
          if (p == 0) { i = length(linea) + 1 }
          else { enbloque = 0; i += p + 1 }
        } else {
          pb = index(substr(linea, i), "/*")
          pl = index(substr(linea, i), "--")
          if (pl > 0 && (pb == 0 || pl < pb)) {
            salida = salida substr(linea, i, pl - 1); i = length(linea) + 1
          } else if (pb > 0) {
            salida = salida substr(linea, i, pb - 1); enbloque = 1; i += pb + 1
          } else {
            salida = salida substr(linea, i); i = length(linea) + 1
          }
        }
      }
      printf "%s ", salida
    }
    END { printf "\n" }
  ' "$1" | tr ';' '\n'
}

cambiados="${SCHEMA_GUARD_CHANGED:-}"
if [ -z "$cambiados" ] && [ "$#" -gt 0 ]; then
  cambiados="$(printf '%s\n' "$@")"
fi

if [ -z "$cambiados" ]; then
  echo "schema-guard: sin lista de ficheros cambiados — nada que comprobar."
  exit 0
fi

migraciones="$(printf '%s\n' "$cambiados" | grep -E "$PATRON_MIGRACION" || true)"

if [ -z "$migraciones" ]; then
  echo "schema-guard: sin migraciones en el cambio — OK."
  exit 0
fi

estructurales=""
solo_datos=""
FALLO=0

for m in $migraciones; do
  ruta="$RAIZ/$m"
  if [ ! -f "$ruta" ]; then
    # Un fichero borrado no se puede clasificar. No se inventa un veredicto, pero
    # tampoco se calla: quien borra una migración debería decirlo.
    echo "schema-guard: $m no existe en el árbol (¿borrado?) — no se clasifica."
    continue
  fi

  normalizado="$(_sql_normalizado "$ruta")"

  # Estructural si aparece un verbo que altera O algo que crea tabla sin decir
  # CREATE. Lo segundo no lo cubre ningún verbo y por eso va aparte.
  if grep -qiE "$VERBOS_DDL|$CREA_TABLA" <<< "$normalizado"; then
    estructurales="${estructurales}${m}"$'\n'

    # Una tabla nueva sin permisos explícitos ni RLS es la puerta abierta que
    # esta casa ya documentó. Esto no cambia respecto a la regla anterior.
    if grep -qiE "$CREA_TABLA" <<< "$normalizado"; then
      grep -qi 'GRANT' "$ruta" || {
        echo "::error file=$m::schema-guard: crea tabla sin GRANT explícito."
        FALLO=1
      }
      grep -qi 'ROW LEVEL SECURITY' "$ruta" || {
        echo "::error file=$m::schema-guard: crea tabla sin ENABLE ROW LEVEL SECURITY."
        FALLO=1
      }
    fi
  else
    solo_datos="${solo_datos}${m}"$'\n'
  fi
done

if [ -n "$solo_datos" ]; then
  echo "Migraciones de solo datos (no exigen tocar el esquema):"
  printf '  %s\n' $solo_datos
fi

if [ -n "$estructurales" ]; then
  echo "Migraciones que alteran estructura o permisos:"
  printf '  %s\n' $estructurales

  if ! grep -qxF "$ESQUEMA" <<< "$cambiados"; then
    echo "::error file=$ESQUEMA::schema-guard: hay migración que altera el esquema y NO se actualizó el documento fuente de verdad."
    echo ""
    echo "Ese fichero es un espejo de la base real. Si diverge, deja de ser fuente"
    echo "de verdad — y lo peor no es que envejezca: es que sigue leyéndose como"
    echo "si no lo hubiera hecho."
    echo ""
    echo "Si tu migración solo MUEVE DATOS y no altera estructura ni permisos,"
    echo "este guardián no te la pide. Si te la está pidiendo, es que encontró una"
    echo "sentencia que altera algo."
    FALLO=1
  fi
fi

[ "$FALLO" = "0" ] || exit 1
echo "schema-guard: OK."
