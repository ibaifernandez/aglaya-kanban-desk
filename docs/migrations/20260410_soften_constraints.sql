-- ============================================================
-- MyBoardLFi — Migración: Hardening de integridad referencial
-- Ejecutar en Supabase → SQL Editor
-- Propósito: Evitar borrado en cascada de workspaces y tableros
-- ============================================================

-- 1. Modificar workspaces para que no se borren en cascada al eliminar al creador
ALTER TABLE public.workspaces 
  DROP CONSTRAINT IF EXISTS workspaces_created_by_fkey,
  ADD CONSTRAINT workspaces_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;

-- 2. Modificar boards para que no se borren en cascada al eliminar al dueño
ALTER TABLE public.boards 
  DROP CONSTRAINT IF EXISTS boards_owner_id_fkey,
  ADD CONSTRAINT boards_owner_id_fkey 
    FOREIGN KEY (owner_id) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL;

-- 3. Nota: Las membresías (workspace_members) SÍ mantienen el CASCADE
-- porque si un usuario no existe, no tiene sentido que sea miembro. 
-- Pero el recurso base (workspace) ahora es seguro.
