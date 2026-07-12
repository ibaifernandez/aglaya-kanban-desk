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
-- ⚠️  INCONSISTENCIAS CONOCIDAS (reflejadas tal cual; corrección pendiente
--     de migración — ver docs/INCIDENTS.md):
--
--   1. workspaces.type  DEFAULT 'general'  contradice su propio CHECK
--      (personal|interno|externo). Un INSERT que omita `type` falla. Hoy no
--      dispara porque la app siempre envía type explícito. Fix recomendado:
--      ALTER COLUMN type SET DEFAULT 'personal'.
--
--   2. GRANTs: el rol `anon` tiene TODOS los privilegios (incl. DELETE/
--      TRUNCATE) sobre TODAS las tablas (default histórico de Supabase).
--      Lo mitiga RLS, pero es superficie más ancha que la política del
--      proyecto. Fix recomendado: REVOKE de escritura a `anon`.
--
--   3. Seed: la organización real es 'LFi Agency' / slug 'lfi' — resto del
--      rebrand AGLAYA sin migrar (contradice ADR-011). Fix recomendado:
--      UPDATE organizations SET name='AGLAYA', slug='aglaya' WHERE id=...0001.
--
--   4. RLS de cards / columns / categories filtra por ORGANIZACIÓN
--      (get_my_org_id()), no por membresía de workspace. Es más ancho de lo
--      que sugería la doc anterior. El aislamiento por workspace lo impone la
--      capa API (requireWorkspaceMember); el servidor usa service_role, que
--      bypasa RLS. RLS es defensa secundaria.
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
  -- ⚠️ DEFAULT 'general' contradice el CHECK de abajo (ver cabecera, inconsistencia #1)
  type            TEXT DEFAULT 'general'
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
  -- ⚠️ boards.workspace_id NO tiene ON DELETE (NO ACTION), pese a que ADR-013
  --    documenta SET NULL. Ver inconsistencia FK en docs/INCIDENTS.md.
  workspace_id    UUID REFERENCES public.workspaces(id),
  "order"         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  "order"         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
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


-- ── 9. GRANTs ───────────────────────────────────────────────
-- ⚠️ ESTADO REAL en producción: los tres roles (anon, authenticated,
--    service_role) tienen TODOS los privilegios sobre TODAS las tablas
--    (default histórico de Supabase). Se documenta tal cual (inconsistencia
--    #2). RLS es el guard efectivo. Corrección recomendada: revocar escritura
--    a `anon`. El patrón mínimo prescrito por CLAUDE.md para tablas nuevas es:
--      GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabla> TO authenticated;
--      GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabla> TO service_role;
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role;', t);
  END LOOP;
END $$;


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

-- columns (⚠️ scope: ORGANIZACIÓN, no workspace — ver inconsistencia #4)
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

-- cards (⚠️ scope: ORGANIZACIÓN vía join columns→boards — ver inconsistencia #4)
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
-- ⚠️ ESTADO REAL: la fila de producción es 'LFi Agency' / 'lfi' — resto del
--    rebrand AGLAYA sin migrar (inconsistencia #3, contradice ADR-011).
--    Se documenta el estado real; la corrección a 'AGLAYA'/'aglaya' está
--    pendiente de decisión (ver docs/INCIDENTS.md).
INSERT INTO public.organizations (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'LFi Agency', 'lfi', 'pro')
ON CONFLICT (id) DO NOTHING;
