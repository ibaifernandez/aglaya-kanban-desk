#!/usr/bin/env bash
# grants-guard.sh — una tabla del esquema público con más privilegios para el
# rol ANÓNIMO de los que su esquema declara pone esto rojo.
#
# QUÉ PROBLEMA CIERRA, en una frase: en este proyecto **toda tabla nueva de
# `public` nace con los siete privilegios concedidos a `anon`**, por las DEFAULT
# PRIVILEGES del propio proyecto (`pg_default_acl`). El esquema fuente de verdad
# declara otra cosa —«`anon` solo SELECT; RLS es el guard efectivo»— y nadie
# cruzaba las dos en esta dirección.
#
# Y lo peor no es la tabla que ya está: es que **se repite cada vez**. El patrón
# que `CLAUDE.md` declara obligatorio para crear tablas CONCEDE y no recorta, así
# que una tabla creada siguiendo la instrucción al pie de la letra queda más
# abierta de lo que el documento dice. Quien lea el esquema verá lo que se
# concedió a mano, no lo que la tabla tiene de verdad.
#
# Encontrado el 6-ago-2026 por un obrero creando una tabla, sin que nadie lo
# pidiera: la suya nació con siete y sus hermanas tenían uno.
#
# POR QUÉ `anon` Y NO TODOS LOS ROLES. `anon` es el rol de cualquiera que llegue
# con la llave pública: no es interno, y es el único cuya apertura tiene efecto
# fuera de la casa. `authenticated` también recibe de más por el mismo defecto
# —siete en vez de los cuatro que el esquema declara— pero eso es cierto HOY en
# todas las tablas, así que meterlo aquí haría nacer rojo a este guardián y un
# guardián que nace rojo se normaliza hasta que deja de mirarse. Queda dicho en
# el PR y en su tarjeta; no se tapa, se separa.
#
# LO QUE ESTE GUARDIÁN NO PUEDE HACER: mira los GRANT, no la RLS. Una tabla con
# `anon` a SELECT y sin política que le aplique no le da nada — y está bien.
# Esto es la segunda capa, la que sigue en pie el día que alguien escriba una
# política pensando en `authenticated` y se le olvide acotar el rol.
#
# Sellado por `scripts/grants-guard.test.sh`, que le inyecta filas de mentira por
# `GRANTS_GUARD_ROWS` y exige rojo. Sin ese sello, un guardián que consulta la DB
# solo se puede probar teniendo la DB delante — y lo que no corre en CI es
# decoración.
#
# Uso:  bash scripts/grants-guard.sh
#       DATABASE_URL=postgres://…  (o SUPABASE_URL + SUPABASE_DATABASE_PASSWORD)

set -uo pipefail

ROL="${GRANTS_GUARD_ROLE:-anon}"
# Lo único que el esquema le declara a `anon`, en todas las tablas.
PERMITIDO="${GRANTS_GUARD_ALLOWED:-SELECT}"

read -r -d '' QUERY <<SQL
SELECT table_name,
       string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND grantee = '${ROL}'
 GROUP BY table_name
HAVING string_agg(privilege_type, ',' ORDER BY privilege_type) <> '${PERMITIDO}'
 ORDER BY table_name;
SQL

# --- de dónde salen las filas ----------------------------------------------
# El sello inyecta por GRANTS_GUARD_ROWS. En CI y en local, se pregunta.
filas=""
if [ -n "${GRANTS_GUARD_ROWS+x}" ]; then
  filas="$GRANTS_GUARD_ROWS"
else
  conn="${DATABASE_URL:-}"
  if [ -z "$conn" ] && [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_DATABASE_PASSWORD:-}" ]; then
    # El host NO se teclea: se deriva. El custodio es Supabase, vía SUPABASE_URL.
    host="db.$(printf '%s' "$SUPABASE_URL" | sed -E 's#https?://([^.]+)\..*#\1#').supabase.co"
    # La contraseña va por PGPASSWORD y no dentro de la URI: la real lleva
    # caracteres que en una URI son sintaxis, y una URI con credenciales acaba
    # entera en la lista de procesos. Mismo criterio que rail-blindspot.sh.
    conn="postgresql://postgres@${host}:5432/postgres"
    export PGPASSWORD="$SUPABASE_DATABASE_PASSWORD"
  fi
  if [ -z "$conn" ]; then
    echo "::error::grants-guard: sin credenciales de base de datos."
    echo "  En CI:    secret DATABASE_URL (el mismo que usa db-backup.yml)."
    echo "  En local: SUPABASE_URL + SUPABASE_DATABASE_PASSWORD en el entorno."
    echo "  Esto NO se salta en verde a propósito: un guardián que se omite"
    echo "  cuando no puede mirar es el falso negativo silencioso que perseguimos."
    exit 1
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "::error::grants-guard: falta psql y no hay otra forma de preguntarle a la DB."
    exit 1
  fi
  filas="$(psql "$conn" -t -A -F'|' -v ON_ERROR_STOP=1 -c "$QUERY")" || {
    echo "::error::grants-guard: la consulta a la base de datos falló."
    exit 1
  }
fi

# Una línea vacía no es una fila. Sin esto, la salida normal de psql sin
# resultados —una línea en blanco— se contaría como una tabla abierta y el
# guardián nacería rojo sin que nada estuviera mal.
sobrantes="$(printf '%s\n' "$filas" | sed '/^[[:space:]]*$/d')"

if [ -z "$sobrantes" ]; then
  echo "grants-guard: ninguna tabla de public da a «${ROL}» más de «${PERMITIDO}» — OK."
  exit 0
fi

echo "::error::grants-guard: hay tablas que dan a «${ROL}» más privilegios de los que el esquema declara."
echo ""
printf '  %s\n' "tabla | privilegios reales (el esquema declara: ${PERMITIDO})"
printf '  %s\n' "$sobrantes"
echo ""
echo "Cómo llegan aquí sin que nadie las abra a mano: este proyecto tiene DEFAULT"
echo "PRIVILEGES en «public» que conceden a «${ROL}» los siete privilegios sobre"
echo "TODA tabla nueva. Crear una tabla basta."
echo ""
echo "Qué hacer, y va en la misma migración que crea la tabla:"
echo "  REVOKE ALL ON public.<tabla> FROM ${ROL};"
echo "  GRANT ${PERMITIDO} ON public.<tabla> TO ${ROL};"
echo ""
echo "El patrón completo está en CLAUDE.md, sección de GRANTs. Conceder sin"
echo "recortar antes no basta: lo que sobra ya estaba puesto antes de tu GRANT."
exit 1
