#!/usr/bin/env bash
# cifras-catalogo.sh — mide con Postgres REAL que `scripts/cifras-catalogo.sql`
# cuenta lo que dice que cuenta. Tarjeta `fb44ba1a`.
#
# ⚠️ NO ES UN GUARDIÁN Y NO CORRE EN CI. Necesita Docker y la imagen `postgres:15`,
# que el corredor no tiene. Es la medición que respalda las cifras publicadas,
# guardada para que otra persona la reproduzca en vez de fiarse del parte.
#
# Monta un esquema con casos CONOCIDOS, cada uno puesto para romper una consulta
# ingenua, y exige el número exacto:
#   · una FK sin ON DELETE y otra con ON DELETE NO ACTION escrito → cuentan como
#     foreign_keys y NO como fk_con_accion_al_borrar (el catálogo no las distingue);
#   · CASCADE, SET NULL, SET DEFAULT y RESTRICT → sí cuentan;
#   · índices de PK, UNIQUE y EXCLUDE → NO son adicionales; un CREATE INDEX y un
#     CREATE UNIQUE INDEX suelto (sin restricción) → sí;
#   · una FK que apunta a un índice UNIQUE SUELTO rellena conindid con él: ese
#     índice sigue siendo adicional (lo que fija el filtro por contype);
#   · tablas, FKs, índices y políticas en OTRO esquema → no cuentan.
#
# Y una CONTRAPRUEBA: la consulta ingenua de «índices» (sin excluir restricciones)
# tiene que dar OTRO número. Si da el mismo, el montaje no discrimina.
#
# Uso:  bash docs/schema/pruebas/cifras-catalogo.sh
#
# NO MEDIR NO ES VERDE: sin contenedor o sin conexión, sale con 2.
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SQL="${CIFRAS_SQL:-$RAIZ/scripts/cifras-catalogo.sql}"
NOMBRE="pg-cifras-$$"

docker run -d --rm --name "$NOMBRE" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:15 >/dev/null \
  || { echo "ERROR: el contenedor no arrancó — no se ha medido nada"; exit 2; }
trap 'docker stop "$NOMBRE" >/dev/null 2>&1' EXIT
for i in $(seq 1 40); do docker exec "$NOMBRE" psql -U postgres -qAt -c 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done
docker exec "$NOMBRE" psql -U postgres -qAt -c 'SELECT 1' >/dev/null 2>&1 || { echo "ERROR: no conecta — no se ha medido nada"; exit 2; }

P() { docker exec -i "$NOMBRE" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

P >/dev/null <<'SQL' || { echo "ERROR: el montaje falló — no se ha medido nada"; exit 2; }
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE public.padre (id int PRIMARY KEY, codigo text UNIQUE);
CREATE TABLE public.hijo (
  id int PRIMARY KEY,
  sin_accion      int REFERENCES public.padre(id),                        -- 'a', omitido
  no_action       int REFERENCES public.padre(id) ON DELETE NO ACTION,    -- 'a', escrito
  en_cascada      int REFERENCES public.padre(id) ON DELETE CASCADE,
  a_nulo          int REFERENCES public.padre(id) ON DELETE SET NULL,
  a_defecto       int DEFAULT 0 REFERENCES public.padre(id) ON DELETE SET DEFAULT,
  restringido     int REFERENCES public.padre(id) ON DELETE RESTRICT,
  rango           int4range,
  EXCLUDE USING gist (rango WITH &&)
);
CREATE INDEX hijo_en_cascada_idx ON public.hijo (en_cascada);
CREATE UNIQUE INDEX hijo_a_nulo_unico_idx ON public.hijo (a_nulo);
-- Una FK puede apuntar a un índice UNIQUE suelto, y entonces rellena conindid con
-- él: sin el filtro por contype, ese índice dejaría de contar como adicional.
CREATE TABLE public.nieto (id int PRIMARY KEY, h int REFERENCES public.hijo(a_nulo));
ALTER TABLE public.padre ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hijo  ENABLE ROW LEVEL SECURITY;
CREATE POLICY p1 ON public.padre USING (true);
CREATE POLICY p2 ON public.hijo  USING (true);
CREATE POLICY p3 ON public.hijo  FOR INSERT WITH CHECK (true);
-- Ruido en otro esquema: nada de esto puede contar.
CREATE SCHEMA otro;
CREATE TABLE otro.t (id int PRIMARY KEY, p int REFERENCES public.padre(id) ON DELETE CASCADE);
CREATE INDEX otro_t_p_idx ON otro.t (p);
ALTER TABLE otro.t ENABLE ROW LEVEL SECURITY;
CREATE POLICY po ON otro.t USING (true);
SQL

# Esperado:
#   tablas_rls 2 (padre, hijo)          policies_rls 3
#   foreign_keys 7                       fk_con_accion_al_borrar 4 (cascade, set null, set default, restrict)
#   indices_adicionales 2 (hijo_en_cascada_idx, hijo_a_nulo_unico_idx)
#     — no cuentan: padre_pkey, padre_codigo_key, hijo_pkey, nieto_pkey, el de EXCLUDE.
# Por NOMBRE y ordenado: el orden de las filas de la SQL no importa (tarjeta `0ceaecac`).
ESPERADO="fk_con_accion_al_borrar=4 foreign_keys=7 indices_adicionales=2 policies_rls=3 tablas_rls=2"
salida="$(P -F '=' < "$SQL")" || { echo "ERROR: la consulta falló — no se ha medido nada"; exit 2; }
medido="$(printf '%s\n' "$salida" | sed '/^$/d' | sort | tr '\n' ' ' | sed 's/ $//')"

FALLOS=0
if [ "$medido" = "$ESPERADO" ]; then
  echo "  ok    cifras-catalogo.sql → «$medido»"
else
  echo "  FALLA cifras-catalogo.sql → «$medido», esperado «$ESPERADO»"; FALLOS=1
fi

# Contraprueba: la cuenta ingenua de índices tiene que diferir (7 en este montaje).
ingenuo="$(P -c "SELECT count(*) FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public';")"
if [ "$ingenuo" != "2" ]; then
  echo "  ok    contraprueba: contar todos los índices da $ingenuo — el montaje distingue"
else
  echo "  FALLA contraprueba: la cuenta ingenua coincide ($ingenuo) — el montaje no discrimina"; FALLOS=1
fi

echo "[medido contra un Postgres 15 desechable, no contra producción]"
exit "$FALLOS"
