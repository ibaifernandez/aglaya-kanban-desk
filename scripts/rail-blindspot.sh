#!/usr/bin/env bash
# rail-blindspot.sh — un espacio al que el riel no puede llegar y que nadie ha
# justificado pone esto rojo.
#
# QUÉ PROBLEMA CIERRA, en una frase: la cuenta `kanban-rail@aglaya.biz` es
# superadmin POR ROL, pero `GET /workspaces` filtra por MEMBRESÍA y no mira el
# rol (`server/routes/workspaces.js`). Si se crea un espacio y no se mete al
# riel dentro, el riel se queda ciego a él EN SILENCIO: no da «no eres miembro»,
# simplemente ese espacio no sale en la lista y ninguna nave puede dejar cards
# ahí. Es la forma de fallo que esta nave existe para hacer imposible — trabajo
# que deja de existir para Ibai sin que nadie se entere.
#
# POR QUÉ NO PUEDE CONTESTARLO EL RIEL. Sus puntos ciegos no salen en su propia
# lista, por definición: `list_workspaces` devuelve aquello de lo que ES miembro.
# Preguntarle a él si falta algo es preguntarle al custodio equivocado — el mismo
# error que costó un diagnóstico entero el 2026-07-21. Contesta la DB.
#
# QUÉ ES CADA COSA:
#   · qué espacios EXISTEN         → la base de datos. No se copia aquí.
#   · si estar ciego está BIEN     → `rail-blindspot.allowed`, escrito a mano.
#   · los `personal`               → REGLA, no lista: intocables por decisión
#     dura, el riel no debe escribir ahí jamás. Una regla cubre también los que
#     se creen mañana; una lista de UUIDs solo cubre los de hoy.
#
# Sellado por `scripts/rail-blindspot.test.sh`, que le mete filas de mentira por
# `RAIL_BLINDSPOT_ROWS` y exige rojo. Sin ese sello, un guardián que consulta la
# DB solo se puede probar teniendo la DB delante — y lo que no corre en CI es
# decoración.
#
# Uso:  bash scripts/rail-blindspot.sh
#       DATABASE_URL=postgres://…  (o SUPABASE_URL + SUPABASE_DATABASE_PASSWORD)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALLOWED="${RAIL_BLINDSPOT_ALLOWED:-$REPO_ROOT/scripts/rail-blindspot.allowed}"
RAIL_EMAIL="${RAIL_EMAIL:-kanban-rail@aglaya.biz}"

# La pregunta, entera, en un sitio. Excluye `personal` por regla (ver cabecera).
read -r -d '' QUERY <<SQL
SELECT w.id, w.name, w.type
  FROM workspaces w
 WHERE w.type <> 'personal'
   AND NOT EXISTS (
       SELECT 1 FROM workspace_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.workspace_id = w.id
          AND u.email = '${RAIL_EMAIL}')
 ORDER BY w.name;
SQL

# --- de dónde salen las filas ----------------------------------------------
# El sello inyecta por RAIL_BLINDSPOT_ROWS. En CI y en local, se pregunta.
rows=""
if [ -n "${RAIL_BLINDSPOT_ROWS+x}" ]; then
  rows="$RAIL_BLINDSPOT_ROWS"
else
  conn="${DATABASE_URL:-}"
  if [ -z "$conn" ]; then
    # Local: se deriva de lo que ya hay en el entorno. El host NO se teclea —
    # el custodio es Supabase, vía SUPABASE_URL.
    if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_DATABASE_PASSWORD:-}" ]; then
      host="db.$(printf '%s' "$SUPABASE_URL" | sed -E 's#https?://([^.]+)\..*#\1#').supabase.co"
      # La contraseña va por PGPASSWORD, NO dentro de la URI. Dos razones: la
      # real lleva `%`, `#` y `!`, que en una URI son sintaxis y la rompen
      # («invalid percent-encoded token»); y una URI con credenciales acaba
      # entera en la lista de procesos, donde la ve cualquiera.
      conn="postgresql://postgres@${host}:5432/postgres"
      export PGPASSWORD="$SUPABASE_DATABASE_PASSWORD"
    fi
  fi
  if [ -z "$conn" ]; then
    echo "::error::rail-blindspot: sin credenciales de base de datos."
    echo "  En CI:    secret DATABASE_URL (el mismo que usa db-backup.yml)."
    echo "  En local: SUPABASE_URL + SUPABASE_DATABASE_PASSWORD en el entorno."
    echo "  Esto NO se salta en verde a propósito: un guardián que se omite"
    echo "  cuando no puede mirar es exactamente el falso negativo silencioso"
    echo "  que perseguimos."
    exit 1
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "::error::rail-blindspot: falta psql y no hay otra forma de preguntarle a la DB."
    exit 1
  fi
  rows="$(psql "$conn" -t -A -F'|' -v ON_ERROR_STOP=1 -c "$QUERY")" || {
    echo "::error::rail-blindspot: la consulta a la base de datos falló."
    exit 1
  }
fi

# --- decisiones escritas a mano --------------------------------------------
# El comentario se quita ANTES de extraer: un UUID citado dentro del «por qué»
# es prosa, no una decisión, y no debe conceder permiso a nadie.
#
# Y no se usa `tr -d '[:space:]'` para limpiar: borra también los saltos de
# línea, así que pegaba todos los UUID en una sola cadena y ninguno volvía a
# encontrarse. El guardián se ponía rojo sobre espacios que SÍ estaban
# justificados — un falso positivo, que al menos avisa, pero por un motivo que
# no era el suyo.
allowed_uuids=""
if [ -f "$ALLOWED" ]; then
  allowed_uuids="$(sed -E 's/#.*$//' "$ALLOWED" \
                   | grep -oE '[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}' \
                   | tr 'A-F' 'a-f' | tr '\n' ' ')"
fi

FAIL=0
seen=0

while IFS='|' read -r id name type; do
  [ -n "${id:-}" ] || continue
  seen=$((seen + 1))
  key="$(printf '%s' "$id" | tr -d '[:space:]' | tr 'A-F' 'a-f')"
  case " $allowed_uuids " in
    *" $key "*) echo "rail-blindspot: ciego a sabiendas — «${name}» (${type}). Justificado en scripts/rail-blindspot.allowed." ;;
    *)
      echo "::error file=scripts/rail-blindspot.allowed::rail-blindspot: «${name}» (${type}) existe y el riel NO lo ve."
      echo "  id: ${id}"
      echo "  Ninguna nave de la flota puede dejar cards ahí, y no dará error al intentarlo:"
      echo "  el espacio simplemente no aparece en list_workspaces."
      echo "    → si debe recibir comandas: añade ${RAIL_EMAIL} como miembro del espacio."
      echo "    → si NO debe: escribe su id en scripts/rail-blindspot.allowed con el porqué."
      FAIL=1 ;;
  esac
done <<< "$rows"

if [ "$FAIL" != "0" ]; then
  echo
  echo "rail-blindspot: hay trabajo que no puede llegar a su sitio y no avisaría."
  exit 1
fi

echo "rail-blindspot: OK — ${seen} espacio(s) ciego(s), todos con decisión escrita."
