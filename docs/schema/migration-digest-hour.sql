-- Migration: per-user digest hour & enable flag
-- Date: 2026-05-14
-- Apply via Supabase SQL editor or psql against the project DB.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS digest_hour SMALLINT NOT NULL DEFAULT 7
    CHECK (digest_hour BETWEEN 0 AND 23);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN NOT NULL DEFAULT true;

-- Verify
SELECT id, email, digest_hour, digest_enabled FROM public.users LIMIT 5;
