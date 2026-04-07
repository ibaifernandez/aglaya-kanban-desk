-- Migration 002: Rename workspace types for AGLAYA platform
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (CASE WHEN is idempotent for already-migrated rows)
--
-- general      → personal  (espacio personal del colaborador)
-- departamento → interno   (espacios internos de la organización)
-- cliente      → externo   (espacios compartidos con clientes)

UPDATE workspaces
SET type = CASE
  WHEN type = 'general'      THEN 'personal'
  WHEN type = 'departamento' THEN 'interno'
  WHEN type = 'cliente'      THEN 'externo'
  ELSE type
END
WHERE type IN ('general', 'departamento', 'cliente');

-- Verify
SELECT type, COUNT(*) FROM workspaces GROUP BY type ORDER BY type;
