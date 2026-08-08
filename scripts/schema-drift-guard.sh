#!/usr/bin/env bash
# schema-drift-guard.sh — que el esquema documentado y la base real no se
# separen sin que nadie se entere.
#
# QUÉ HUECO CIERRA. `docs/schema/supabase-schema.sql` es la fuente de verdad
# **declarada**. `scripts/schema-guard.sh` la compara con las migraciones y lo
# hace bien, pero **compara documento contra documento**: nunca le pregunta al
# servidor. Y aplicar una migración **es un paso humano**, así que nada notaba si
# no se daba.
#
# No es hipotético. El PR #28 traía `migration-card-caller.sql` y el esquema
# actualizado: `schema-guard` habría dado verde y **la columna no estaba aplicada
# en la base**. Mergearlo rompía la puerta externa. Se evitó partiéndolo en dos,
# y eso **lo arregló una persona acordándose** — que es justo lo que un guardián
# existe para no necesitar.
#
# ─────────────────────────────────────────────────────────────────────────────
# POR QUÉ SOLO MIRA SI LA COLUMNA ESTÁ, Y NO DE QUÉ TIPO ES
#
# Ésta es la limitación importante, y es una decisión, no un olvido.
#
# `information_schema.columns` da nombre, tipo y nulabilidad. Comparar el nombre
# es exacto: o está o no está. Comparar el **tipo** exige normalizar dos
# dialectos —el documento dice `TEXT`, `UUID`, `TIMESTAMPTZ`; el servidor
# contesta `text`, `uuid`, `timestamp with time zone`— y **la normalización es
# donde se cuelan los falsos verdes**: cada equivalencia que se añade es una
# regla escrita a mano que puede tapar una diferencia real.
#
# Un guardián que compara presencia y **lo dice** vale más que uno que promete el
# esquema entero y compara aproximaciones. La presencia es donde está el daño que
# esta casa ya pagó: una columna que falta rompe la puerta; una columna del tipo
# equivocado es otro problema, más raro y menos silencioso.
#
# LO QUE **NO** COMPARA, entonces, y hay que leerlo entero antes de fiarse de su
# verde:
#
#   · **Tipos, nulabilidad y valores por defecto.** Por lo de arriba.
#   · **Restricciones y claves foráneas.** Viven repartidas entre
#     `table_constraints`, `key_column_usage` y `referential_constraints`, y
#     reconstruir de ahí lo que un `ALTER TABLE` escribió en una línea no es una
#     consulta, es un ejercicio.
#   · **Índices.** No salen en `information_schema`. Hay que bajar a
#     `pg_indexes`, que devuelve el SQL **normalizado por Postgres**: comparar eso
#     contra el texto del documento es comparar dos dialectos otra vez.
#   · **Políticas RLS, triggers y comentarios.** Fuera del estándar
#     (`pg_policies`, `pg_trigger`, `obj_description`).
#   · **Vistas, secuencias y funciones.** Solo mira tablas base.
#
# Un verde suyo significa **«las columnas declaradas están, y no hay ninguna de
# más»**. No significa «la base es el documento».
#
# ─────────────────────────────────────────────────────────────────────────────
# POR QUÉ CORRE POR RELOJ SOBRE `main` Y NUNCA SOBRE UN PR
#
# Sobre el PR que trae una migración **nacería rojo con razón**: en ese momento
# la migración todavía no está aplicada, y ése es el estado correcto. Un guardián
# que nace rojo se normaliza hasta que deja de mirarse, y esta casa ya lo pagó.
#
# Lo que mide es **deriva de lo que hay puesto**, no propuestas.
#
#
# ⏱ QUÉ SIGNIFICA SU VERDE, Y QUÉ NO — 8-ago-2026 (tarjeta `3afe754d`)
#
# Este guardián **pregunta fuera del repositorio**. Consecuencia que hay que
# tener delante al leerlo: **su verde caduca sin que cambie una línea de código**.
#
# Medido el 8-ago-2026 sobre el MISMO commit y el mismo esquema, con el guardián
# hermano que consulta la misma base:
#
#     10:15:10Z → verde
#     10:23:09Z → rojo
#
# Lo único que cambió en esos ocho minutos fue la base de datos.
#
# Por eso su verde se imprime **fechado**, y hay que leerlo así:
#
#     «a tal hora, contra la base real, lo declarado y lo que hay coincidían»
#
# y **no** como «este commit está bien». Los invariantes de la casa —«la
# aprobación pertenece al commit», «el verde tiene que ser del commit que se va a
# mergear»— valen mientras lo medido esté DENTRO del commit. Aquí no lo está.
#
# QUIEN MERGEA es quien tiene que volver a mirarlo, porque el guardián no puede:
# no sabe cuándo se mergea. Lo único que puede hacer es no dejar que su verde se
# confunda con una propiedad del commit, y eso es lo que hace la línea fechada.
#
# LA VENTANA DE «APLICAR ANTES DE MERGEAR», declarada aquí para que no se
# descubra en cada rojo: este repo aplica las migraciones ANTES de mergear su PR
# —para no desplegar código contra una columna que no está—, así que existe un
# intervalo en el que **la base va por delante del documento** y este guardián
# está rojo con razón. Ese rojo se cierra mergeando el PR, no arreglando nada.
#
# Y aquí ese intervalo es LA REGLA, no la excepción: este guardián existe
# justamente para medir esa diferencia. Su rojo durante la ventana no es un
# defecto suyo — es su trabajo hecho.
# Uso:  bash scripts/schema-drift-guard.sh
#       DATABASE_URL=postgres://…  (o SUPABASE_URL + SUPABASE_DATABASE_PASSWORD)
#       SCHEMA_DRIFT_ROWS=$'tabla|columna\n…'   (el sello, sin tocar la base)
#       SCHEMA_DRIFT_SCHEMA=/otro/esquema.sql   (el sello)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ESQUEMA="${SCHEMA_DRIFT_SCHEMA:-$REPO_ROOT/docs/schema/supabase-schema.sql}"

if [ ! -f "$ESQUEMA" ]; then
  echo "::error::schema-drift-guard: no existe $ESQUEMA"
  exit 2
fi

# La pregunta, entera, en un sitio. Solo tablas base: las vistas no las declara
# el documento y contarlas daría deriva de mentira.
read -r -d '' QUERY <<'SQL'
SELECT c.table_name, c.column_name
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema
   AND t.table_name   = c.table_name
 WHERE c.table_schema = 'public'
   AND t.table_type   = 'BASE TABLE'
 ORDER BY c.table_name, c.column_name;
SQL

# --- de dónde salen las filas -----------------------------------------------
# El sello inyecta por SCHEMA_DRIFT_ROWS. En CI y en local, se pregunta.
# Mismo patrón que grants-guard.sh y rail-blindspot.sh, a propósito: un guardián
# que consulta la base solo se puede probar teniendo la base delante, y lo que no
# corre en CI es decoración.
filas=""
if [ -n "${SCHEMA_DRIFT_ROWS+x}" ]; then
  filas="$SCHEMA_DRIFT_ROWS"
else
  conn="${DATABASE_URL:-}"
  if [ -z "$conn" ] && [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_DATABASE_PASSWORD:-}" ]; then
    # El host NO se teclea: se deriva. El custodio es Supabase.
    host="db.$(printf '%s' "$SUPABASE_URL" | sed -E 's#https?://([^.]+)\..*#\1#').supabase.co"
    # La contraseña va por PGPASSWORD y no dentro de la URI: la real lleva
    # caracteres que en una URI son sintaxis, y una URI con credenciales acaba
    # entera en la lista de procesos. Mismo criterio que grants-guard.sh.
    conn="postgresql://postgres@${host}:5432/postgres"
    export PGPASSWORD="$SUPABASE_DATABASE_PASSWORD"
  fi
  if [ -z "$conn" ]; then
    echo "::error::schema-drift-guard: sin credenciales de base de datos."
    echo "  En CI:    secret DATABASE_URL (el mismo que usa db-backup.yml)."
    echo "  En local: SUPABASE_URL + SUPABASE_DATABASE_PASSWORD en el entorno."
    echo ""
    echo "  Esto NO se salta en verde a propósito: un guardián que se omite"
    echo "  cuando no puede mirar es el falso negativo silencioso que perseguimos."
    exit 2
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "::error::schema-drift-guard: falta psql y no hay otra forma de preguntarle a la base."
    exit 2
  fi
  filas="$(psql "$conn" -t -A -F'|' -v ON_ERROR_STOP=1 -c "$QUERY")" || {
    echo "::error::schema-drift-guard: la consulta a la base de datos falló."
    exit 2
  }
fi

SCHEMA_DRIFT_FILAS="$filas" python3 - "$ESQUEMA" <<'PY'
import os, re, sys

ruta = sys.argv[1]
lineas = open(ruta, encoding="utf-8").read().split("\n")

# Palabras que abren una línea de RESTRICCIÓN de tabla, no de columna.
NO_COLUMNA = {"UNIQUE", "PRIMARY", "CONSTRAINT", "CHECK", "FOREIGN", "EXCLUDE", "LIKE"}

# ── lo DECLARADO ─────────────────────────────────────────────────────────────
declarado = {}          # tabla -> set(columnas)
i = 0
while i < len(lineas):
    m = re.match(r"^CREATE TABLE IF NOT EXISTS public\.(\w+)\s*\($", lineas[i])
    if not m:
        i += 1
        continue
    tabla, cols = m.group(1), set()
    i += 1
    while i < len(lineas) and not lineas[i].startswith(");"):
        l = lineas[i].strip()
        if l and not l.startswith("--"):
            tok = l.split()[0].strip('",')
            if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", tok) and tok.upper() not in NO_COLUMNA:
                cols.add(tok)
        i += 1
    declarado[tabla] = cols

if not declarado:
    print(f"::error file={ruta}::schema-drift-guard: no se reconoció ninguna "
          f"`CREATE TABLE IF NOT EXISTS public.<nombre> (` en el esquema")
    print("")
    print("O el fichero cambió de forma, o se está leyendo el fichero equivocado.")
    print("En los dos casos este guardián dejó de ver, y dejar de ver no es estar")
    print("en verde.")
    raise SystemExit(2)

# ── lo QUE HAY ───────────────────────────────────────────────────────────────
real = {}
for linea in os.environ.get("SCHEMA_DRIFT_FILAS", "").split("\n"):
    linea = linea.strip()
    if not linea:
        continue
    if "|" not in linea:
        print(f"::error::schema-drift-guard: fila sin separador «|»: «{linea}»")
        raise SystemExit(2)
    tabla, columna = linea.split("|", 1)
    real.setdefault(tabla.strip(), set()).add(columna.strip())

if not real:
    print("::error::schema-drift-guard: la base no devolvió ninguna columna de `public`.")
    print("")
    print("Una base vacía y una consulta que falló en silencio se ven igual desde")
    print("aquí, y ninguna de las dos es un verde.")
    raise SystemExit(2)

# ── comparar, en las dos direcciones ─────────────────────────────────────────
faltan, sobran, tablas_sin_aplicar, tablas_sin_declarar = [], [], [], []

for tabla, cols in sorted(declarado.items()):
    if tabla not in real:
        tablas_sin_aplicar.append(tabla)
        continue
    for c in sorted(cols - real[tabla]):
        faltan.append((tabla, c))

for tabla, cols in sorted(real.items()):
    if tabla not in declarado:
        tablas_sin_declarar.append(tabla)
        continue
    for c in sorted(cols - declarado[tabla]):
        sobran.append((tabla, c))

hay_deriva = bool(faltan or sobran or tablas_sin_aplicar or tablas_sin_declarar)

if not hay_deriva:
    n = sum(len(c) for c in declarado.values())
    from datetime import datetime, timezone
    ahora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"schema-drift-guard: {len(declarado)} tablas y {n} columnas declaradas, "
          f"todas presentes en la base y ninguna de más — OK.")
    # ⏱ EL VERDE VA FECHADO. Ver la cabecera de este fichero.
    print(f"[medido {ahora} contra la base real — este verde es de ese instante, "
          f"no una propiedad del commit]")
    raise SystemExit(0)

for t in tablas_sin_aplicar:
    print(f"::error file={ruta}::schema-drift-guard: la tabla «{t}» está declarada "
          f"y NO existe en la base — hay una migración sin aplicar")
for t, c in faltan:
    print(f"::error file={ruta}::schema-drift-guard: «{t}.{c}» está declarada y "
          f"NO existe en la base — hay una migración sin aplicar")
for t in tablas_sin_declarar:
    print(f"::error file={ruta}::schema-drift-guard: la tabla «{t}» existe en la "
          f"base y el esquema NO la declara")
for t, c in sobran:
    print(f"::error file={ruta}::schema-drift-guard: «{t}.{c}» existe en la base y "
          f"el esquema NO la declara")

print("")
print("Las dos direcciones significan cosas distintas y se arreglan distinto:")
print("")
print("  · DECLARADA Y AUSENTE  → la migración está escrita y no se aplicó.")
print("    Aplicarla es del Operador. El documento tiene razón.")
print("  · PRESENTE Y NO DECLARADA → alguien tocó la base a mano, o una")
print("    migración cambió más de lo que su documento dice. La base tiene razón")
print("    sobre lo que HAY; lo que falta es dejarlo escrito.")
print("")
print("Este guardián NO decide cuál de las dos es la correcta: dice que no")
print("coinciden. Quien lo arregle tiene que mirar qué pasó, no cuál es más")
print("cómoda de tocar.")
raise SystemExit(1)
PY

code=$?
case "$code" in
  0|1|2) exit "$code" ;;
  *) echo "::error::schema-drift-guard: comprobación fallida con código $code"; exit "$code" ;;
esac
