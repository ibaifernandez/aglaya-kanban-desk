-- Migration: retirar las dos políticas RLS que dicen sí a todo
-- Tarjeta: «Dos políticas RLS `WITH CHECK (true)` anulan a las restrictivas» (22ecfa81)
-- Created: 2026-09-24
-- ⏳ PENDIENTE DE APLICAR por el Operador. Hasta que se aplique, esta declaración NO
--    se mergea: el esquema documentado diría una cosa y la base otra.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ DEFECTO CIERRA
--
-- `workspaces` y `workspace_members` tienen, cada una, una política de INSERT
-- restrictiva y otra permisiva:
--
--   workspaces         «Crear workspaces en mi org»            WITH CHECK (organization_id = get_my_org_id())
--   workspaces         «Permitir crear workspaces a usuarios autenticados»  WITH CHECK (true)   ← se retira
--   workspace_members  «Insertar miembros si admin/owner»      WITH CHECK (get_workspace_role(...) IN ('owner','admin'))
--   workspace_members  «Permitir unirse a workspaces creados»  WITH CHECK (true)   ← se retira
--
-- **Las políticas PERMISIVAS de Postgres se combinan con OR.** Basta que una diga sí
-- para que la fila entre: la de `true` no «añade un caso», anula a la de al lado.
--
-- Por qué importa justo en `workspace_members`: es la tabla con la que el servidor
-- decide la pertenencia a un espacio (`requireWorkspaceMember`). Quien pueda
-- insertarse una fila ahí se hace miembro de cualquier espacio de trabajo.
--
-- ⚠️ ALCANCE HONESTO DE ESTA MIGRACIÓN. Hoy nadie explota esto por esa vía: el
-- servidor consulta con `service_role`, que se salta RLS, y el cliente web solo usa
-- Supabase para autenticarse. Lo que se cierra es la SEGUNDA capa, que estaba
-- abierta — y la primera resultó abierta el mismo día (tarjeta `6df9d529`, el alta
-- pública de superadmin). Una segunda capa que dice sí a todo no es una capa.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIDO ANTES DE ESCRIBIRLA
--
-- `pg_policies` de producción (proyecto `jowtasxhnluqqcgkeoll`), leído el 24-sep-2026:
-- las dos políticas existen tal cual, para el rol `authenticated`, con
-- `with_check = true`. No es solo el esquema documentado.
--
-- Y en Postgres 15 real, con el montaje de `docs/schema/pruebas/rls-sin-permisivas.sh`:
-- con la permisiva puesta, un usuario que no es admin del espacio inserta su fila en
-- `workspace_members`; sin ella, la base lo rechaza.
--
-- Idempotente: `IF EXISTS`. Aplicarla dos veces sale con 0 y no cambia nada.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP POLICY IF EXISTS "Permitir crear workspaces a usuarios autenticados" ON public.workspaces;
DROP POLICY IF EXISTS "Permitir unirse a workspaces creados" ON public.workspace_members;

COMMIT;

-- ── COMPROBACIÓN (ejecutar después; el resultado se transcribe en la tarjeta) ──
--
-- 1. Ninguna política de INSERT de esas dos tablas dice sí a todo.
--    Esperado: CERO filas.
SELECT tablename, policyname, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('workspaces', 'workspace_members')
   AND with_check = 'true';

-- 2. Las restrictivas siguen ahí. Esperado: DOS filas, una por tabla.
SELECT tablename, policyname, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('workspaces', 'workspace_members')
   AND cmd = 'INSERT'
 ORDER BY tablename;
