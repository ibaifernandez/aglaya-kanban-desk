-- ============================================================
-- AGLAYA Kanban Desk — Master Schema (v1.2.0)
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ── 1. Extensiones y Funciones Auxiliares ───────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Función para obtener el rol global (macro) del usuario actual
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- ── 2. Organización y Usuarios (Macro) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'pro'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'colaborador',
  -- roles: superadmin | admin | colaborador | cliente | guest
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios ven su propio perfil"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins ven usuarios de su organización"
  ON public.users FOR SELECT
  USING (
    public.get_my_role() IN ('admin', 'superadmin')
    AND organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
  );

-- ── 3. Workspaces (Micro) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  emoji           TEXT DEFAULT '📋',
  description     TEXT,
  type            TEXT DEFAULT 'externo', -- 'personal' | 'interno' | 'externo'
  cover_url       TEXT,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member' | 'guest'
  invited_at   TIMESTAMPTZ DEFAULT now(),
  invited_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  PRIMARY KEY (workspace_id, user_id)
);

-- Funciones de Seguridad Micro (Aislamiento)
CREATE OR REPLACE FUNCTION public.get_workspace_role(ws_id UUID)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid());
$$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven sus workspaces"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id) OR public.get_my_role() = 'superadmin');

CREATE POLICY "Permitir crear workspaces a usuarios autenticados"
  ON public.workspaces FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Miembros ven otros miembros"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id) OR public.get_my_role() = 'superadmin');

CREATE POLICY "Permitir unirse a workspaces creados"
  ON public.workspace_members FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- ── 4. Estructura Kanban ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.boards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT,
  owner_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  position        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.columns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id       UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  board_id        UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT DEFAULT 'none',   -- none | low | medium | high
  due_date        DATE,
  category_id     TEXT,
  checklist       JSONB DEFAULT '[]',
  attachments     JSONB DEFAULT '[]',
  position        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  color_id        TEXT NOT NULL DEFAULT 'blue',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para Kanban (Aislamiento por Workspace)
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver boards del workspace"
  ON public.boards FOR SELECT
  USING (public.is_workspace_member(workspace_id) OR public.get_my_role() = 'superadmin');

CREATE POLICY "Ver columnas del board"
  ON public.columns FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.boards WHERE id = board_id AND (public.is_workspace_member(workspace_id) OR public.get_my_role() = 'superadmin'))
  );

CREATE POLICY "Ver cards del board"
  ON public.cards FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.boards WHERE id = board_id AND (public.is_workspace_member(workspace_id) OR public.get_my_role() = 'superadmin'))
  );

CREATE POLICY "Ver categorías de la organización"
  ON public.categories FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
  );

-- ── 5. Datos de Demo ───────────────────────────────────────────

INSERT INTO public.organizations (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'AGLAYA', 'aglaya', 'pro')
ON CONFLICT DO NOTHING;
