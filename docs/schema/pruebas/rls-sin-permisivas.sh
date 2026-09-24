#!/usr/bin/env bash
# rls-sin-permisivas.sh — mide con Postgres REAL que la política `WITH CHECK (true)`
# anula a la restrictiva, y que retirarla cierra la puerta. Tarjeta `22ecfa81`.
#
# ⚠️ NO ES UN GUARDIÁN Y NO CORRE EN CI. Necesita Docker y la imagen `postgres:15`,
# que el corredor no tiene. Es la medición que respalda
# `docs/schema/migration-rls-sin-permisivas.sql`, guardada para que otra persona la
# reproduzca en vez de fiarse del parte. Las pruebas de la API simulan el cliente de
# Supabase y NO pueden ver una política: esto sí.
#
# Qué mide, en tres pasos, con un usuario que NO es admin del espacio:
#   1. CONTRAPRUEBA — con la permisiva puesta, ese usuario INSERTA su fila en
#      `workspace_members` aunque la restrictiva exija owner/admin. Si aquí no
#      inserta, el montaje está mal y lo demás no vale.
#   2. Con la migración — el mismo INSERT es RECHAZADO por la política.
#   3. Idempotencia — aplicarla dos veces sale con 0 y deja el mismo estado.
#
# El montaje imita lo justo de la nave: las dos tablas, las dos funciones que usan las
# políticas (`get_workspace_role`, `get_my_org_id`) y el rol `authenticated`. El `auth.uid()`
# se simula con un GUC, que es lo que hace Supabase por debajo.
#
# Uso:  bash docs/schema/pruebas/rls-sin-permisivas.sh
#       MIG=<otra migración> bash …
#
# NO MEDIR NO ES VERDE: sin contenedor o sin conexión, sale con 2.
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MIG="${MIG:-$RAIZ/docs/schema/migration-rls-sin-permisivas.sql}"
NOMBRE="pg-rls-$$"

docker run -d --rm --name "$NOMBRE" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:15 >/dev/null \
  || { echo "ERROR: el contenedor no arrancó — no se ha medido nada"; exit 2; }
trap 'docker stop "$NOMBRE" >/dev/null 2>&1' EXIT
for i in $(seq 1 40); do docker exec "$NOMBRE" psql -U postgres -qAt -c 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done
docker exec "$NOMBRE" psql -U postgres -qAt -c 'SELECT 1' >/dev/null 2>&1 \
  || { echo "ERROR: no conecta — no se ha medido nada"; exit 2; }

P() { docker exec -i "$NOMBRE" psql -U postgres -d postgres -qAt "$@"; }

P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || { echo "ERROR: el montaje falló — no se ha medido nada"; exit 2; }
CREATE ROLE authenticated;
CREATE SCHEMA auth;
-- Supabase resuelve auth.uid() del JWT; aquí, de un GUC, que es el mismo mecanismo.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_id uuid
);
CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE FUNCTION public.get_workspace_role(ws uuid) RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS
  $$ SELECT role FROM public.workspace_members WHERE workspace_id = ws AND user_id = auth.uid() $$;
CREATE FUNCTION public.get_my_org_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS
  $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.workspaces, public.workspace_members TO authenticated;

-- Las cuatro políticas de INSERT tal como están en producción (leídas de pg_policies
-- el 24-sep-2026), incluidas las dos permisivas que la migración retira.
CREATE POLICY "Crear workspaces en mi org" ON public.workspaces
  FOR INSERT WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "Permitir crear workspaces a usuarios autenticados" ON public.workspaces
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Insertar miembros si admin/owner" ON public.workspace_members
  FOR INSERT WITH CHECK (get_workspace_role(workspace_id) = ANY (ARRAY['owner','admin']));
CREATE POLICY "Permitir unirse a workspaces creados" ON public.workspace_members
  FOR INSERT TO authenticated WITH CHECK (true);

-- Un espacio ajeno, con su dueña dentro. Quien intenta colarse NO está.
INSERT INTO public.workspaces (id, name, organization_id)
  VALUES ('00000000-0000-0000-0000-0000000000ee', 'Espacio ajeno', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.workspace_members VALUES
  ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-00000000000a', 'owner');
SQL

# El intruso: autenticado, pero sin ningún papel en ese espacio.
INTRUSO="00000000-0000-0000-0000-00000000000b"
colarse() {
  P -v ON_ERROR_STOP=1 <<SQL 2>&1
SET ROLE authenticated;
SET request.jwt.claim.sub = '$INTRUSO';
INSERT INTO public.workspace_members VALUES
  ('00000000-0000-0000-0000-0000000000ee', '$INTRUSO', 'admin');
SQL
}
miembros() { P -c "SELECT count(*) FROM public.workspace_members;"; }

FALLOS=0
ok()  { echo "  ok    $1"; }
mal() { echo "  FALLA $1"; FALLOS=1; }

echo "CONTRAPRUEBA — con la política permisiva puesta:"
salida="$(colarse)"; r=$?
if [ "$r" = 0 ] && [ "$(miembros)" = 2 ]; then
  ok "un usuario sin papel en el espacio SE HACE MIEMBRO: la de «true» anula a la restrictiva"
else
  mal "no se colaba (exit $r): el montaje no reproduce el defecto — $salida"; echo "[no se ha medido nada útil]"; exit 1
fi

P -c "DELETE FROM public.workspace_members WHERE user_id = '$INTRUSO';" >/dev/null

echo
echo "Con la migración aplicada:"
P -v ON_ERROR_STOP=1 < "$MIG" >/dev/null 2>&1 || { echo "ERROR: la migración falló — no se ha medido"; exit 2; }
salida="$(colarse)"; r=$?
if [ "$r" != 0 ] && [ "$(miembros)" = 1 ] && printf '%s' "$salida" | grep -qi "row-level security"; then
  ok "el mismo INSERT lo RECHAZA la política, y no queda fila"
else
  mal "el intruso siguió entrando (exit $r, miembros $(miembros)) — $salida"
fi

restrictivas="$(P -c "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('workspaces','workspace_members') AND cmd='INSERT';")"
[ "$restrictivas" = 2 ] && ok "quedan las dos restrictivas, una por tabla" || mal "quedan $restrictivas políticas de INSERT, esperaba 2"
permisivas="$(P -c "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('workspaces','workspace_members') AND with_check='true';")"
[ "$permisivas" = 0 ] && ok "ninguna política dice sí a todo" || mal "quedan $permisivas políticas con «true»"

echo
echo "Aplicada dos veces:"
if P -v ON_ERROR_STOP=1 < "$MIG" >/dev/null 2>&1 && [ "$(P -c "SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('workspaces','workspace_members') AND cmd='INSERT';")" = 2 ]; then
  ok "idempotente: sale con 0 y deja el mismo estado"
else
  mal "la segunda aplicación cambió algo o falló"
fi

echo
echo "[medido contra un Postgres 15 desechable, no contra producción]"
exit "$FALLOS"
