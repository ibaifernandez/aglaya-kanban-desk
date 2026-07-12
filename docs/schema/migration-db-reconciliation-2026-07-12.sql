-- ============================================================
-- Migración: reconciliación DB ↔ documentación (2026-07-12)
-- Cierra hallazgos DOC-02, DOC-03, DOC-04 de docs/INCIDENTS.md.
-- Idempotente. Atómica (BEGIN/COMMIT). Aplicar en Supabase → SQL Editor
-- o vía psql con creds admin del .env.
--
-- NO incluye DOC-05 (ON DELETE de boards.workspace_id): el NO ACTION actual
-- es preferible al SET NULL del ADR-013 (SET NULL huérfanaría tableros →
-- invisibles por RLS). Se resuelve documentando el comportamiento real.
-- ============================================================

BEGIN;

-- ── DOC-02 — workspaces.type: default coherente con su CHECK ──
-- Antes: DEFAULT 'general' (violaba CHECK personal|interno|externo).
ALTER TABLE public.workspaces ALTER COLUMN type SET DEFAULT 'personal';

-- ── DOC-03 — revocar ESCRITURA al rol anon ───────────────────
-- El cliente solo usa la anon key para auth (nunca escribe en tablas,
-- verificado). Se mantiene SELECT; se revoca escritura. service_role y
-- authenticated quedan intactos. RLS sigue siendo el guard efectivo.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon;

-- ── DOC-04 — rebrand de la organización (ADR-011) ────────────
-- La fila de producción seguía como 'LFi Agency'/'lfi' (rebrand sin migrar).
UPDATE public.organizations
  SET name = 'AGLAYA', slug = 'aglaya'
  WHERE id = '00000000-0000-0000-0000-000000000001'
    AND slug = 'lfi';

COMMIT;
