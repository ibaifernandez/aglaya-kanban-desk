#!/usr/bin/env bash
# invitador-puede-irse.sh — mide con Postgres REAL que quien invita puede eliminar
# su cuenta, antes y después de `migration-invitador-puede-irse.sql`. Tarjeta `ab86481d`.
#
# ⚠️ NO ES UN GUARDIÁN Y NO CORRE EN CI. Necesita Docker y la imagen `postgres:15`,
# que el corredor no tiene. Es la medición que respalda la migración, guardada para
# que otra persona la reproduzca en vez de fiarse del parte. Las pruebas de la API
# simulan el cliente de Supabase y no pueden ver una clave foránea: esto sí.
#
# Qué mide, en tres pasos:
#   1. CONTRAPRUEBA — con la clave en NO ACTION (y un nombre RARO), borrar la cuenta
#      que invitó FALLA. Si aquí no falla, el montaje está mal y lo demás no vale.
#   2. Con la migración real — el borrado TERMINA, la membresía de la persona
#      invitada SE CONSERVA con invited_by = NULL, y la comprobación final de la
#      migración no lista ninguna clave en NO ACTION.
#   3. Idempotencia — dos veces seguidas: salida 0 las dos, y UNA sola clave.
#
# Uso:  bash docs/schema/pruebas/invitador-puede-irse.sh
#       MIG=<otra migración> bash …   (para probar una variante)
#
# NO MEDIR NO ES VERDE: sin contenedor o sin conexión, sale con 2.
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MIG="${MIG:-$RAIZ/docs/schema/migration-invitador-puede-irse.sql}"
NOMBRE="pg-invitador-$$"

docker run -d --rm --name "$NOMBRE" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:15 >/dev/null \
  || { echo "ERROR: el contenedor no arrancó — no se ha medido nada"; exit 2; }
trap 'docker stop "$NOMBRE" >/dev/null 2>&1' EXIT
for i in $(seq 1 40); do docker exec "$NOMBRE" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$NOMBRE" pg_isready -U postgres >/dev/null 2>&1 || { echo "ERROR: no conecta — no se ha medido nada"; exit 2; }
# pg_isready responde antes de que termine el arranque inicial del contenedor: una consulta real.
for i in $(seq 1 40); do docker exec "$NOMBRE" psql -U postgres -qAt -c 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done

P() { docker exec -i "$NOMBRE" psql -U postgres -d postgres -v ON_ERROR_STOP=0 -qAt "$@"; }

montar() {
  P >/dev/null <<'SQL'
DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA auth; CREATE SCHEMA public;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.users (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE public.workspaces (id uuid PRIMARY KEY);
CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invited_by   uuid,
  PRIMARY KEY (workspace_id, user_id)
);
-- Nombre RARO a propósito: la migración tiene que encontrarla por columna.
ALTER TABLE public.workspace_members
  ADD CONSTRAINT fk_invitador_nombre_raro FOREIGN KEY (invited_by) REFERENCES public.users(id);
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
INSERT INTO public.users SELECT id FROM auth.users;
INSERT INTO public.workspaces VALUES ('00000000-0000-0000-0000-0000000000ee');
INSERT INTO public.workspace_members VALUES
  ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-00000000000a', NULL),
  ('00000000-0000-0000-0000-0000000000ee', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');
SQL
  [ "$(P -c "SELECT count(*) FROM public.workspace_members;")" = "2" ] || { echo "ERROR: el montaje no dejó 2 membresías — no se ha medido nada"; exit 2; }
}

borrar_a() {
  echo "   DELETE de A en auth.users → $(P -c "DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000000a';" 2>&1 | head -1 | cut -c1-110)"
  echo "   ¿A sigue existiendo?        → $(P -c "SELECT count(*) FROM auth.users WHERE id='00000000-0000-0000-0000-00000000000a';")"
  echo "   membresía de B              → $(P -c "SELECT count(*) FROM public.workspace_members WHERE user_id='00000000-0000-0000-0000-00000000000b';") · invited_by = $(P -c "SELECT coalesce(invited_by::text,'NULL') FROM public.workspace_members WHERE user_id='00000000-0000-0000-0000-00000000000b';")"
}

echo "── 1 · CONTRAPRUEBA: restricción en NO ACTION, con nombre raro"
montar; borrar_a

echo; echo "── 2 · MIGRACIÓN aplicada (el fichero real del repositorio)"
montar
docker exec -i "$NOMBRE" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt < "$MIG" 2>&1 | sed 's/^/   comprobación: /'
borrar_a

echo; echo "── 3 · IDEMPOTENCIA: la migración dos veces sobre la misma base"
montar
docker exec -i "$NOMBRE" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt < "$MIG" >/dev/null 2>&1; r1=$?
docker exec -i "$NOMBRE" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt < "$MIG" >/dev/null 2>&1; r2=$?
echo "   salida 1ª = $r1 · salida 2ª = $r2"
echo "   claves foráneas sobre invited_by: $(P -c "SELECT count(*) FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.conrelid='public.workspace_members'::regclass AND c.contype='f' AND a.attname='invited_by';") · acción: $(P -c "SELECT confdeltype FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.conrelid='public.workspace_members'::regclass AND c.contype='f' AND a.attname='invited_by';") (n = SET NULL)"
