-- ============================================================
-- AGLAYA Kanban Desk — Master Schema (v1.3.1)
-- ============================================================
-- FUENTE DE VERDAD del esquema. Ejecutar en Supabase → SQL Editor.
--
-- PROVENIENCIA: este fichero es un MIRROR FIEL de la base de datos de
-- producción, introspeccionada directamente el 2026-07-12
-- (proyecto Supabase db.jowtasxhnluqqcgkeoll, PostgreSQL 17.6).
-- Refleja columnas, tipos, defaults, FKs, CHECKs, índices, GRANTs, RLS y
-- funciones REALES — no una versión idealizada.
--
-- REGLA DE MANTENIMIENTO (CLAUDE.md): toda migración que altere el esquema
-- DEBE actualizar este fichero en el mismo commit. Si diverge de la DB real,
-- deja de ser fuente de verdad. Ver finding en docs/INCIDENTS.md.
--
-- ─────────────────────────────────────────────────────────────
-- NOTAS DE MODELO (ver docs/INCIDENTS.md):
--
--   • RLS de cards / columns / categories filtra por ORGANIZACIÓN
--     (get_my_org_id()), no por membresía de workspace. El aislamiento por
--     workspace lo impone la capa API (requireWorkspaceMember); el servidor
--     usa service_role, que bypasa RLS. RLS es defensa secundaria. (DOC-05)
--
--   • boards.workspace_id usa NO ACTION (no SET NULL): impide borrar un
--     workspace con tableros, evitando tableros huérfanos. (DOC-05)
--
-- HISTÓRICO: las inconsistencias DOC-02 (default type 'general'), DOC-03
-- (anon con escritura) y DOC-04 (org 'LFi Agency') se corrigieron en la
-- migración 2026-07-12 (migration-db-reconciliation-2026-07-12.sql). Este
-- fichero ya refleja el estado post-migración.
-- ─────────────────────────────────────────────────────────────
-- ============================================================


-- ── 1. Extensiones ──────────────────────────────────────────
-- Instaladas en producción: uuid-ossp, pgcrypto, pg_stat_statements,
-- supabase_vault, hypopg, index_advisor. Las relevantes para el modelo:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- provee gen_random_uuid()


-- ── 2. Funciones de seguridad (SECURITY DEFINER) ────────────
-- Usadas por las políticas RLS. SECURITY DEFINER + STABLE para evitar
-- recursión de políticas y permitir su evaluación en cada request.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(ws_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = ws_id AND user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

-- Event trigger utilitario: auto-habilita RLS en cualquier tabla nueva
-- creada en el esquema `public`. Presente en producción.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog' AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
    IF cmd.schema_name = 'public' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'rls_auto_enable: failed on %', cmd.object_identity;
      END;
    END IF;
  END LOOP;
END;
$$;


-- ── 3. Organización y Usuarios (Macro) ──────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',          -- 'free' | 'pro'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'colaborador',
  -- roles macro: superadmin | admin | colaborador | cliente
  -- ('guest' queda reservado al ámbito micro en workspace_members.role)
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  avatar_url      TEXT,
  digest_hour     SMALLINT NOT NULL DEFAULT 7 CHECK (digest_hour BETWEEN 0 AND 23),
  digest_enabled  BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotencia para entornos ya inicializados:
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS digest_hour SMALLINT NOT NULL DEFAULT 7
  CHECK (digest_hour BETWEEN 0 AND 23);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN NOT NULL DEFAULT true;


-- ── 4. Workspaces (Micro) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  emoji           TEXT NOT NULL DEFAULT '📋',
  description     TEXT,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cover_url       TEXT,
  type            TEXT DEFAULT 'personal'
                    CHECK (type = ANY (ARRAY['personal','interno','externo'])),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member'
                 CHECK (role = ANY (ARRAY['owner','admin','member','guest'])),
  invited_by   UUID REFERENCES public.users(id),   -- NO ON DELETE (NO ACTION)
  invited_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);


-- ── 5. Estructura Kanban ────────────────────────────────────
-- NOTA: las columnas de título usan `title` (NO `name`) y las de orden usan
-- `order` (NO `position`). `order` es palabra reservada → siempre entre
-- comillas dobles en DDL/DML.

CREATE TABLE IF NOT EXISTS public.boards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  color           TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- boards.workspace_id usa NO ACTION (impide borrar un workspace con tableros;
  -- preferido sobre el SET NULL del ADR-013, que huérfanaría tableros). Ver DOC-05.
  workspace_id    UUID REFERENCES public.workspaces(id),
  "order"         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ⚠️ `columns."order"` NO tiene restricción UNIQUE por (board_id, "order"), y la
-- ausencia es deliberada: reordenar exige desplazar varias filas, y con un UNIQUE
-- no diferible cualquier desplazamiento choca a medio camino. Sostenerlo de
-- verdad pide una función transaccional con la restricción DEFERRABLE — el mismo
-- cambio que sigue abierto para el orden de las TARJETAS.
--
-- Mientras tanto lo sostiene la RUTA (`server/routes/columns.js`): después de
-- crear, mover o borrar, renumera el tablero entero a 1..N contiguo. Una
-- escritura DIRECTA a la base puede volver a duplicar números — pasó, y la
-- migración `migration-column-order-normalize.sql` lo limpió.
CREATE TABLE IF NOT EXISTS public.columns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id     UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  "order"      INTEGER NOT NULL DEFAULT 0,
  color        TEXT,
  default_sort TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ⚠️ CASCADE: borrar una columna se lleva sus tarjetas. Lo que impide que eso
  -- pase en silencio NO es la base — es la ruta, que devuelve 409 si la columna
  -- tiene tarjetas dentro (`server/routes/columns.js`). Quien borre saltándose
  -- la API se las lleva igual.
  column_id       UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  board_id        UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT DEFAULT 'none',   -- none | low | medium | high | urgent (sin CHECK en DB)
  due_date        DATE,
  category        UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  checklist       JSONB DEFAULT '[]'::jsonb,   -- ítems: { text, done, assignees[] }
  checklist_title TEXT DEFAULT ''::text,
  attachments     JSONB DEFAULT '[]'::jsonb,
  tags            JSONB DEFAULT '[]'::jsonb,
  assignee_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Nave declarada que la creó por POST /api/internal/create-card. NO es
  -- autenticación: quien tiene TASK_SECRET declara el nombre que quiera. NULL en
  -- las creadas por la UI, por el riel, o antes del 2026-08-06.
  created_by_caller TEXT,
  "order"         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cards_created_by_caller
  ON public.cards(created_by_caller, created_at DESC)
  WHERE created_by_caller IS NOT NULL;

-- Historial de la descripción de una tarjeta (migration-card-description-history.sql).
-- Guarda la versión ANTERIOR cada vez que `cards.description` cambia por
-- `PUT /api/cards/:id`. Existe porque esa puerta reemplaza la descripción entera
-- y no había rastro: un llamante que no leyera antes de escribir destruía lo que
-- había y recibía éxito.
-- ⚠️ EL NOMBRE SE QUEDÓ CORTO Y SE DICE AQUÍ: desde
-- migration-historial-todos-los-campos.sql esta tabla guarda el valor anterior
-- de CUALQUIER campo, no solo de la descripción. Renombrarla es incompatible
-- —arrastra su política RLS, su índice, `server/routes/cards.js` y la tool
-- `card_history` del contrato— y tiene que decidirse aparte.
--
-- ⏳ Hasta que el Operador aplique esa migración, este bloque declara TRES cosas
-- que la base todavía no tiene: `field`, `old_value`, y `description` nullable.
CREATE TABLE IF NOT EXISTS public.card_description_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  -- Qué campo de la tarjeta guarda esta fila. `description` por defecto para que
  -- las filas anteriores a la migración digan la verdad sin tocarlas.
  field           TEXT NOT NULL DEFAULT 'description',
  -- El valor anterior, como texto. NULLABLE a propósito: hay campos cuyo valor
  -- anterior legítimo es NULL —`assignee_id` sin asignar, `due_date` sin fecha—
  -- y guardarlos como cadena vacía sería inventarse un dato.
  old_value       TEXT,
  -- Se conserva por compatibilidad con `card_history`, que todavía la lee.
  -- Dejó de ser NOT NULL: una fila de `priority` no tiene descripción que poner.
  description     TEXT,                 -- como estaba ANTES del cambio
  changed_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_id        UUID REFERENCES public.boards(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  color_id        TEXT NOT NULL DEFAULT 'blue',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotencia para columnas añadidas tras el esquema inicial (Phase 2/4):
ALTER TABLE public.columns ADD COLUMN IF NOT EXISTS default_sort TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS checklist_title TEXT DEFAULT ''::text;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE;


-- ── 6. Notificaciones ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                 -- 'checklist_mention' | 'card_assignment'
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── 7. Digest logs (audit de envíos de email) ───────────────
-- Originalmente en migrations/create_digest_logs.sql; consolidada aquí para
-- que el master schema sea completo.

CREATE TABLE IF NOT EXISTS public.digest_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type = ANY (ARRAY['admin','user'])),
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient   TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status = ANY (ARRAY['sent','failed','pending'])),
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── 8. Índices de rendimiento ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_boards_workspace_id       ON public.boards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_columns_board_id          ON public.columns(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_board_id            ON public.cards(board_id);
CREATE INDEX IF NOT EXISTS idx_users_organization_id     ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE (read = false);
CREATE INDEX IF NOT EXISTS idx_digest_logs_user_id       ON public.digest_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_logs_recipient     ON public.digest_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_digest_logs_type_status   ON public.digest_logs(type, status);
CREATE INDEX IF NOT EXISTS idx_digest_logs_created_at    ON public.digest_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_description_history_card
  ON public.card_description_history(card_id, changed_at DESC);
-- «Dame las versiones de ESTE campo de ESTA tarjeta». El de arriba sigue
-- sirviendo para «todo el historial de la tarjeta» y por eso no se sustituye.
CREATE INDEX IF NOT EXISTS idx_card_description_history_card_field
  ON public.card_description_history(card_id, field, changed_at DESC);


-- ── 9. GRANTs ───────────────────────────────────────────────
-- ESTADO REAL, verificado contra la base el 2026-08-06 con `aclexplode`:
-- `anon` solo SELECT; `authenticated` y `service_role` con escritura completa.
-- RLS es el guard efectivo.
--
-- ⚠️ CON UNA EXCEPCIÓN DESDE EL 2026-08-08, y hasta que el Operador la aplique
-- este fichero y la base NO coinciden en ella: `card_description_history` deja
-- de dar `UPDATE` y `DELETE` a `authenticated`. Lo declara este fichero; en la
-- base sigue como estaba hasta que se ejecute
-- `docs/schema/migration-historial-append-only.sql`. Tarjeta `2c034471`.
--
-- ESTE BLOQUE RECORTA ANTES DE CONCEDER, y no es simetría. Hasta el 2026-08-06
-- solo concedía, y un GRANT no quita nada: la base llevaba `MAINTAIN` de más en
-- los dos roles —y `TRUNCATE`, `REFERENCES` y `TRIGGER` en `authenticated`—
-- mientras este mismo fichero declaraba lo contrario. Correr el esquema no lo
-- arreglaba; lo dejaba igual.
--
-- `MAINTAIN` es de PostgreSQL 17 y NO aparece en `information_schema`, que solo
-- expone los siete del estándar SQL. Por eso nadie lo vio: el guardián de
-- privilegios consulta `information_schema`. Se ve con `aclexplode(relacl)`.
-- Detalle y medición: docs/schema/migration-recorte-privilegios-anon-authenticated.sql
-- UNA TABLA SE SALE DEL BUCLE, y la excepción es el punto entero:
-- `card_description_history` existe para guardar lo que otro sobrescribió, así
-- que **no puede dar a ese mismo actor permiso para borrarlo**. Un historial que
-- el mismo actor puede reescribir no es un historial: es una copia más, con la
-- ceremonia de un historial. Sus GRANT van después del bucle, a mano.
--
-- Va con `<>` dentro del bucle y no como un REVOKE detrás **a propósito**. Un
-- REVOKE detrás dejaría el privilegio concedido y retirado en el mismo fichero,
-- y bastaría reordenar dos bloques para reabrirlo sin que nadie lo note. Aquí no
-- se llega a conceder.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename <> 'card_description_history'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated;', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role;', t);
  END LOOP;
END $$;

-- La excepción, explícita. `authenticated` se queda SIN `UPDATE` ni `DELETE`.
--
-- `INSERT` se conserva, y conviene decir por qué se conserva en vez de dejarlo
-- pasar en silencio: la tarjeta que manda este recorte (`2c034471`) nombra
-- `UPDATE` y `DELETE`, no `INSERT`. El mismo argumento vale para `INSERT` —lo
-- escribe el servidor con `service_role`, y la propia migración de la tabla dice
-- que no se abre a `authenticated` a conciencia— pero **ampliarlo aquí sería
-- decidir por encima de quien acotó la tarjeta**. Queda dicho, no hecho.
--
-- Hoy `INSERT` tampoco alcanza nada: la RLS de esta tabla solo tiene política de
-- SELECT, y sin política no se inserta. El privilegio es pólvora seca, no una
-- puerta abierta — y es exactamente por eso que se recorta antes de que alguien
-- escriba una política de escritura pensando en otra cosa.
REVOKE ALL ON public.card_description_history FROM anon;
REVOKE ALL ON public.card_description_history FROM authenticated;
GRANT SELECT                          ON public.card_description_history TO anon;
GRANT SELECT, INSERT                  ON public.card_description_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.card_description_history TO service_role;

-- Y los DEFAULT PRIVILEGES, para que una tabla nueva no nazca con los ocho.
-- Cierra la mitad de `postgres`; la de `supabase_admin` NO se toca a propósito
-- —es configuración de Supabase— y queda a cargo del guardián.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE MAINTAIN, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE
  ON TABLES FROM authenticated;


-- ── 10. Row Level Security ──────────────────────────────────
ALTER TABLE public.organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digest_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_description_history ENABLE ROW LEVEL SECURITY;

-- organizations
CREATE POLICY "Users see their own organization" ON public.organizations
  FOR SELECT USING (id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

-- users
CREATE POLICY "Los usuarios ven su propio perfil" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins ven usuarios de su org" ON public.users
  FOR SELECT USING (get_my_role() = ANY (ARRAY['admin','superadmin']) OR id = auth.uid());

-- workspaces
CREATE POLICY "Ver workspaces propios" ON public.workspaces
  FOR SELECT USING (is_workspace_member(id));
CREATE POLICY "Crear workspaces en mi org" ON public.workspaces
  FOR INSERT WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "Permitir crear workspaces a usuarios autenticados" ON public.workspaces
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Editar workspace si admin/owner" ON public.workspaces
  FOR UPDATE USING (get_workspace_role(id) = ANY (ARRAY['owner','admin']));
CREATE POLICY "Eliminar workspace si owner" ON public.workspaces
  FOR DELETE USING (get_workspace_role(id) = 'owner');

-- workspace_members
CREATE POLICY "Ver miembros de mis workspaces" ON public.workspace_members
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Insertar miembros si admin/owner" ON public.workspace_members
  FOR INSERT WITH CHECK (get_workspace_role(workspace_id) = ANY (ARRAY['owner','admin']));
CREATE POLICY "Permitir unirse a workspaces creados" ON public.workspace_members
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Actualizar miembros si admin/owner" ON public.workspace_members
  FOR UPDATE USING (get_workspace_role(workspace_id) = ANY (ARRAY['owner','admin']));
CREATE POLICY "Eliminar miembros si admin/owner" ON public.workspace_members
  FOR DELETE USING (get_workspace_role(workspace_id) = ANY (ARRAY['owner','admin']));

-- boards (scope: membresía de workspace)
CREATE POLICY "Ver tableros de mis workspaces" ON public.boards
  FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Crear tableros en mis workspaces" ON public.boards
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "Editar tableros de mis workspaces" ON public.boards
  FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "Borrar tableros de mis workspaces" ON public.boards
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = boards.workspace_id AND wm.user_id = auth.uid()
      AND wm.role = ANY (ARRAY['owner','admin'])));

-- columns (⚠️ scope: ORGANIZACIÓN, no workspace — ver NOTAS DE MODELO / DOC-05)
CREATE POLICY "Usuarios ven columnas de su org" ON public.columns
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = columns.board_id AND b.organization_id = get_my_org_id()));
CREATE POLICY "Usuarios ven columnas de sus tableros" ON public.columns
  FOR SELECT USING (board_id IN (
    SELECT b.id FROM public.boards b JOIN public.users u ON u.organization_id = b.organization_id
    WHERE u.id = auth.uid()));
CREATE POLICY "Usuarios crean columnas en su org" ON public.columns
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = columns.board_id AND b.organization_id = get_my_org_id()));
CREATE POLICY "Usuarios editan columnas de su org" ON public.columns
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = columns.board_id AND b.organization_id = get_my_org_id()));
CREATE POLICY "Usuarios borran columnas de su org" ON public.columns
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = columns.board_id AND b.organization_id = get_my_org_id()));

-- cards (⚠️ scope: ORGANIZACIÓN vía join columns→boards — ver NOTAS DE MODELO / DOC-05)
CREATE POLICY "Usuarios ven tarjetas de su org" ON public.cards
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.columns col JOIN public.boards b ON b.id = col.board_id
    WHERE col.id = cards.column_id AND b.organization_id = get_my_org_id()));
CREATE POLICY "Usuarios crean tarjetas en su org" ON public.cards
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.columns col JOIN public.boards b ON b.id = col.board_id
    WHERE col.id = cards.column_id AND b.organization_id = get_my_org_id()));
CREATE POLICY "Usuarios editan tarjetas de su org" ON public.cards
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.columns col JOIN public.boards b ON b.id = col.board_id
    WHERE col.id = cards.column_id AND b.organization_id = get_my_org_id()));
CREATE POLICY "Usuarios borran tarjetas de su org" ON public.cards
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.columns col JOIN public.boards b ON b.id = col.board_id
    WHERE col.id = cards.column_id AND b.organization_id = get_my_org_id()));

-- card_description_history (⚠️ scope: el MISMO que la tarjeta de la que cuelga)
-- Sin política de INSERT/UPDATE/DELETE a propósito: escribe el servidor con
-- `service_role`, que salta RLS. Un historial que el usuario puede reescribir no
-- prueba nada.
CREATE POLICY "Usuarios ven el historial de las tarjetas de su org" ON public.card_description_history
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.cards c
      JOIN public.columns col ON col.id = c.column_id
      JOIN public.boards  b   ON b.id   = col.board_id
    WHERE c.id = card_description_history.card_id AND b.organization_id = get_my_org_id()));

-- categories (scope: organización)
CREATE POLICY "Usuarios ven categorías de su org" ON public.categories
  FOR SELECT USING (organization_id = get_my_org_id());
CREATE POLICY "Usuarios crean categorías en su org" ON public.categories
  FOR INSERT WITH CHECK (organization_id = get_my_org_id());
CREATE POLICY "Usuarios editan categorías de su org" ON public.categories
  FOR UPDATE USING (organization_id = get_my_org_id());
CREATE POLICY "Usuarios borran categorías de su org" ON public.categories
  FOR DELETE USING (organization_id = get_my_org_id());

-- notifications (owner-only, todas las operaciones)
CREATE POLICY "notifications_owner" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- digest_logs (lectura admin/superadmin vía claim JWT; escritura service_role)
CREATE POLICY "digest_logs_admin_read" ON public.digest_logs
  FOR SELECT USING ((auth.jwt() ->> 'role') = ANY (ARRAY['admin','superadmin']));
CREATE POLICY "digest_logs_superadmin_read" ON public.digest_logs
  FOR SELECT USING ((auth.jwt() ->> 'role') = 'superadmin');
CREATE POLICY "digest_logs_service_insert" ON public.digest_logs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "digest_logs_service_update" ON public.digest_logs
  FOR UPDATE USING (true) WITH CHECK (true);


-- ── 11. Seed de organización ────────────────────────────────
-- Organización única (single-tenant, ADR-020). Rebrand AGLAYA aplicado a la
-- fila real en la migración 2026-07-12 (DOC-04).
INSERT INTO public.organizations (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'AGLAYA', 'aglaya', 'pro')
ON CONFLICT (id) DO NOTHING;
