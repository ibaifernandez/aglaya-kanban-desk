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
# LO QUE NO PUEDE HACER: no entiende SQL, busca sentencias. Una migración que
# altere estructura desde dentro de un `DO $$ … $$` con el verbo construido en
# tiempo de ejecución se le escapa. Es raro y el coste de acertarlo es un parser;
# queda dicho aquí en vez de fingir que lo cubre.
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

# Verbos que ALTERAN: estructura, permisos o políticas. Si aparece uno, el
# documento tiene que enterarse. `COMMENT ON` entra porque el esquema documenta
# comentarios de columna.
VERBOS_DDL='^[[:space:]]*(CREATE|ALTER|DROP|GRANT|REVOKE|COMMENT[[:space:]]+ON|TRUNCATE)[[:space:]]'

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

  if grep -qiE "$VERBOS_DDL" "$ruta"; then
    estructurales="${estructurales}${m}"$'\n'

    # Una tabla nueva sin permisos explícitos ni RLS es la puerta abierta que
    # esta casa ya documentó. Esto no cambia respecto a la regla anterior.
    if grep -qiE '^[[:space:]]*CREATE[[:space:]]+TABLE' "$ruta"; then
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

  if ! printf '%s\n' "$cambiados" | grep -qxF "$ESQUEMA"; then
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
