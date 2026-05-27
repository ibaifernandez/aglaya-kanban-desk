-- Migration: enable RLS on public.organizations
-- Hallazgo audit Mariana 2026-05-27 B-04 / B-11 (ALTO latente).
--
-- Razón: organizations sin RLS habilitada → defense-in-depth violado.
-- Currently no client-side direct query (verificado en audit),
-- pero si futuro código añade query con anon key contra esta tabla,
-- expone TODAS las orgs cross-tenant.
--
-- Server usa service_role que bypasses RLS — comportamiento existente
-- queda intacto. Cliente nunca debería leer organizations directo
-- (solo via /api/* → adminClient en backend).
--
-- Idempotente: usa IF NOT EXISTS pattern donde aplica.

-- Habilitar RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios autenticados ven SOLO su propia organización
-- (la que tienen en public.users.organization_id).
-- Service_role bypassa esta policy (admin endpoints sin restricción).
DROP POLICY IF EXISTS "Users see their own organization" ON public.organizations;
CREATE POLICY "Users see their own organization"
  ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- Verificación post-migration:
--   psql ... -c "\dp public.organizations"
--   Debe mostrar 'rowsecurity' = true
--   Debe listar policy "Users see their own organization"
