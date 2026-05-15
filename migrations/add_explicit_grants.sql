-- Migration: Añadir GRANTs explícitos a todas las tablas existentes
-- Motivo: Supabase cambia default el 30 Oct 2026 — nuevas tablas en public
--         sin GRANT explícito no se exponen al Data API (supabase-js).
--         Tablas existentes están safe, pero documentar grants explícitamente
--         ahora evita sorpresas y sirve como fuente de verdad.
-- Ejecutar en: Supabase → SQL Editor
-- Fecha: 2026-05-13

-- ── organizations ──────────────────────────────────────────────────
GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO service_role;

-- ── users ──────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;

-- ── workspaces ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO service_role;

-- ── workspace_members ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO service_role;

-- ── boards ─────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO service_role;

-- ── columns ────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.columns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.columns TO service_role;

-- ── cards ──────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO service_role;

-- ── categories ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO service_role;

-- ── notifications ──────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

-- ── digest_logs (completar grants incompletos de migración anterior) ──
GRANT SELECT ON public.digest_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digest_logs TO service_role;
