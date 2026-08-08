#!/usr/bin/env bash
# grants-guard.sh — una tabla de `public` que da a `anon` o a `authenticated`
# más privilegios de los que el esquema le declara pone esto rojo.
#
# QUÉ PROBLEMA CIERRA, en una frase: en este proyecto **toda tabla nueva de
# `public` nace con los siete privilegios concedidos a los dos roles**, por las
# DEFAULT PRIVILEGES del propio proyecto (`pg_default_acl`). El esquema fuente de
# verdad declara otra cosa, y nadie cruzaba las dos.
#
# Y lo peor no es la tabla que ya está: es que **se repite cada vez**. El patrón
# que `CLAUDE.md` declara obligatorio para crear tablas CONCEDE y no recorta, así
# que una tabla creada siguiendo la instrucción al pie de la letra queda más
# abierta de lo que el documento dice.
#
# Encontrado el 6-ago-2026 por un obrero creando una tabla, sin que nadie lo
# pidiera: la suya nació con siete y sus hermanas tenían uno.
#
# ─────────────────────────────────────────────────────────────────────────────
# DOS ROLES DESDE EL 8-ago-2026, Y POR QUÉ NO LOS TENÍA ANTES
#
# Este guardián vigilaba **un solo rol, siempre `anon`**, y estaba escrito por
# qué: meter `authenticated` lo habría hecho **nacer rojo**, porque entonces
# recibía siete privilegios en todas las tablas y el esquema le declaraba cuatro.
#
# Eso se arregló el 6-ago (`eeaebd9f`): se le recortaron `MAINTAIN`,
# `REFERENCES`, `TRIGGER` y `TRUNCATE`. **Desde entonces `authenticated` ya podía
# entrar aquí, y no entró** — así que el rol del que se acababa de recortar era
# justo el que nadie miraba.
#
# Y cierra un segundo hueco: `eeaebd9f` no podía certificarse porque la única
# medición que existe **la ejecutó quien aplicó el recorte**, y quien ejecuta no
# certifica su propio resultado. Este job **sí** puede: tiene credenciales
# propias y su verde queda en el registro en vez de en la palabra de nadie.
#
# ─────────────────────────────────────────────────────────────────────────────
# LO PERMITIDO NO ES UNA VARIABLE: SE DERIVA DEL ESQUEMA
#
# Cada rol tiene su conjunto —`anon` solo `SELECT`, `authenticated` los cuatro de
# escritura— y **hay excepciones por TABLA**: una tabla-historial no puede dar
# `UPDATE` ni `DELETE` a quien genera lo que guarda.
#
# Esas excepciones **se declaran donde se declara el esquema**, no aquí dentro.
# Una lista escrita a mano en un script es completa el día que se escribe: es la
# avería que el #35 cerró para `contract-guard`. Quien las lee y las convierte en
# expectativa es `scripts/grants-expectativa.py`, que **parsea el esquema**.
#
# Consecuencia buena: declarar una excepción nueva en `supabase-schema.sql`
# **no exige tocar este guardián**. Comprobado contra las dos versiones del
# esquema que existían el 8-ago.
#
# ⚠️ CONSECUENCIA QUE HAY QUE SABER ANTES DE QUE PASE: si el esquema declara una
# excepción y **la migración que la aplica todavía no se ha ejecutado**, este
# guardián se pondrá **rojo con razón** sobre esa tabla — la base da más de lo
# que el documento dice. No es un falso positivo: es el hueco entre declarar y
# aplicar, que es de otro guardián (`schema-drift-guard.sh`). Quien mergee una
# excepción y no la aplique verá este rojo, y el rojo tendrá razón.
#
# ─────────────────────────────────────────────────────────────────────────────
# LO QUE ESTE GUARDIÁN NO PUEDE HACER: mira los GRANT, no la RLS. Una tabla con
# `anon` a SELECT y sin política que le aplique no le da nada — y está bien.
# Esto es la segunda capa, la que sigue en pie el día que alguien escriba una
# política pensando en `authenticated` y se le olvide acotar el rol.
#
# Y sigue **ciego a `MAINTAIN`**: consulta `information_schema`, que solo expone
# los siete privilegios del estándar SQL. `MAINTAIN` es de PostgreSQL 17 y no
# aparece ahí. Tiene tarjeta propia (`11f1be5b`); esto **no** la cierra.
#
# Sellado por `scripts/grants-guard.test.sh`, que le inyecta filas de mentira por
# `GRANTS_GUARD_ROWS` y exige rojo. Sin ese sello, un guardián que consulta la DB
# solo se puede probar teniendo la DB delante — y lo que no corre en CI es
# decoración.
#
# Uso:  bash scripts/grants-guard.sh
#       DATABASE_URL=postgres://…  (o SUPABASE_URL + SUPABASE_DATABASE_PASSWORD)
#       GRANTS_GUARD_ROWS=$'rol|tabla|PRIVS\n…'      (el sello)
#       GRANTS_GUARD_SCHEMA=/otro/esquema.sql        (el sello)
#       GRANTS_GUARD_ROLES='anon authenticated'      (por defecto, los dos)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ESQUEMA="${GRANTS_GUARD_SCHEMA:-$REPO_ROOT/docs/schema/supabase-schema.sql}"
# LOS DOS, y `anon` el primero. Que `anon` siga vigilado es lo que el sello
# comprueba desde que se cerró `8eb39541`: nadie puede desviar este guardián a
# otro rol y dejar sin mirar el que motivó su existencia. Ahora exige los dos.
ROLES="${GRANTS_GUARD_ROLES:-anon authenticated}"

if [ ! -f "$ESQUEMA" ]; then
  echo "::error::grants-guard: no existe el esquema $ESQUEMA"
  exit 1
fi

# --- qué le toca a cada (rol, tabla), derivado del esquema -------------------
expectativa="$(python3 "$REPO_ROOT/scripts/grants-expectativa.py" "$ESQUEMA" $ROLES)" || {
  echo "::error::grants-guard: no se pudo derivar del esquema qué le toca a cada rol."
  echo "  Sin eso no hay contra qué comparar, y comparar contra nada sería verde."
  exit 1
}

read -r -d '' QUERY <<SQL
SELECT grantee,
       table_name,
       string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND grantee IN ($(printf "'%s'," $ROLES | sed 's/,$//'))
 GROUP BY grantee, table_name
 ORDER BY grantee, table_name;
SQL

# --- de dónde salen las filas -----------------------------------------------
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

GRANTS_GUARD_FILAS="$filas" GRANTS_GUARD_EXPECT="$expectativa" \
GRANTS_GUARD_ROLES_EFECTIVOS="$ROLES" python3 <<'PY'
import os, sys

roles = os.environ["GRANTS_GUARD_ROLES_EFECTIVOS"].split()

# ── lo declarado ─────────────────────────────────────────────────────────────
default, excepcion = {}, {}
for linea in os.environ["GRANTS_GUARD_EXPECT"].split("\n"):
    if not linea.strip():
        continue
    rol, tabla, privs = linea.split("|", 2)
    if tabla == "*":
        default[rol] = privs
    else:
        excepcion[(rol, tabla)] = privs

def toca(rol, tabla):
    return excepcion.get((rol, tabla), default.get(rol))

# ── lo que hay ───────────────────────────────────────────────────────────────
# Una línea vacía NO es una fila. Sin esto, la salida normal de psql sin
# resultados —una línea en blanco— se contaría como una tabla y el guardián
# se pondría rojo sin que nada estuviera mal.
reales = []
for linea in os.environ["GRANTS_GUARD_FILAS"].split("\n"):
    linea = linea.strip()
    if not linea:
        continue
    partes = linea.split("|")
    if len(partes) != 3:
        print(f"::error::grants-guard: fila con forma inesperada: «{linea}»")
        raise SystemExit(1)
    rol, tabla, privs = (p.strip() for p in partes)
    reales.append((rol, tabla, ",".join(sorted(p for p in privs.split(",") if p))))

if not reales:
    # ANTES esto era VERDE, y con razón: la comparación la hacía un HAVING en
    # SQL, así que «sin filas» significaba «ninguna se sale». Ahora la consulta
    # trae TODAS las filas y compara aquí, de modo que «sin filas» significa
    # «no se midió nada» — y eso no es un verde.
    print("::error::grants-guard: la base no devolvió ningún privilegio para "
          f"{', '.join(roles)} en `public`.")
    print("")
    print("Una base sin conceder nada y una consulta que falló en silencio se ven")
    print("igual desde aquí, y ninguna de las dos es un verde.")
    raise SystemExit(1)

# ── comparar ─────────────────────────────────────────────────────────────────
sobrantes = []
for rol, tabla, privs in reales:
    esperado = toca(rol, tabla)
    if esperado is None:
        print(f"::error::grants-guard: nadie declara qué le toca a «{rol}» — "
              f"no se puede juzgar «{tabla}»")
        raise SystemExit(1)
    if privs != esperado:
        sobrantes.append((rol, tabla, privs, esperado))

if not sobrantes:
    n_exc = len(excepcion)
    extra = f", {n_exc} excepción(es) por tabla declarada(s)" if n_exc else ""
    print(f"grants-guard: {len(reales)} pares (rol, tabla) mirados para "
          f"{', '.join(roles)}{extra} — todos coinciden con el esquema. OK.")
    raise SystemExit(0)

print("::error::grants-guard: hay tablas cuyos privilegios no son los que el "
      "esquema declara.")
print("")
print(f"  {'rol':<15} {'tabla':<28} {'tiene':<34} declara")
for rol, tabla, privs, esperado in sobrantes:
    print(f"  {rol:<15} {tabla:<28} {privs:<34} {esperado}")
print("")
print("Cómo llegan aquí sin que nadie las abra a mano: este proyecto tiene")
print("DEFAULT PRIVILEGES en `public` que conceden los siete privilegios sobre")
print("TODA tabla nueva. Crear una tabla basta.")
print("")
print("Qué hacer, y va en la misma migración que crea la tabla:")
print("  REVOKE ALL ON public.<tabla> FROM <rol>;")
print("  GRANT <lo que declara el esquema> ON public.<tabla> TO <rol>;")
print("")
print("El patrón completo está en CLAUDE.md, sección de GRANTs. Conceder sin")
print("recortar antes no basta: lo que sobra ya estaba puesto antes de tu GRANT.")
print("")
print("Y si lo que falla es una tabla que DEBE ser distinta a sus hermanas, la")
print("excepción se declara en `docs/schema/supabase-schema.sql` —no aquí—, y")
print("este guardián la recoge solo.")
raise SystemExit(1)
PY

code=$?
case "$code" in
  0|1) exit "$code" ;;
  *) echo "::error::grants-guard: comprobación fallida con código $code"; exit "$code" ;;
esac
