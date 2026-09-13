-- Migration: quien ha invitado a alguien puede eliminar su cuenta
-- Tarjeta: «Quien ha invitado a alguien no puede eliminar su cuenta» (ab86481d)
-- Created: 2026-09-13
-- ⏳ NO APLICADA. La ejecuta el Operador desde el SQL Editor de Supabase; esta
--    cabecera se cambia a «APLICADA» en el mismo commit que declara el cambio en
--    `docs/schema/supabase-schema.sql`, y no antes.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ DEFECTO CIERRA
--
-- `DELETE /api/auth/me` borra la cuenta en Auth, y `public.users.id` cae en
-- cascada. Pero `workspace_members.invited_by` apunta a `users` **sin
-- `ON DELETE`** — o sea `NO ACTION`. Si esa cuenta invitó a alguien, la cascada
-- choca con la clave, Auth devuelve error, y la ruta contesta
-- `500 «Error al eliminar cuenta»`. **La cuenta sigue viva.**
--
-- La política publicada y `docs/legal/retention-policy.md` describen la
-- eliminación como algo que termina. Para quien invita, no terminaba.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ `ON DELETE SET NULL` Y NO VACIAR `invited_by` EN LA RUTA
--
--   · **Es el patrón de las otras cuatro claves hacia `users`** —`created_by`,
--     `owner_id`, `assignee_id`, `changed_by`—: se conserva la fila y se pierde
--     solo quién la hizo.
--   · **Arregla cualquier borrado, no solo este.** Vaciar el campo en la ruta
--     dejaría igual de frágil el borrado desde el panel de admin, desde Auth
--     directamente, o desde cualquier ruta futura.
--   · **Lo que se pierde, dicho:** la membresía de la persona invitada SE
--     CONSERVA; lo que desaparece es el dato de quién la invitó.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ POR QUÉ LA CLAVE SE BUSCA POR COLUMNA Y NO POR NOMBRE
--
-- Lo natural era `DROP CONSTRAINT IF EXISTS workspace_members_invited_by_fkey`.
-- Si en la base viva la restricción se llama de otra forma, ese `DROP` no hace
-- nada **en silencio**, el `ADD` crea una SEGUNDA clave, y la de `NO ACTION`
-- sigue ahí: la migración «funciona» y el defecto no se va. Por eso el bloque de
-- abajo busca en `pg_constraint` cualquier clave foránea sobre esa columna y la
-- quita, sea cual sea su nombre. Medido con Postgres real y un nombre raro.
--
-- Idempotente: aplicarla dos veces deja exactamente una clave, con SET NULL.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  restriccion RECORD;
BEGIN
  FOR restriccion IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'public.workspace_members'::regclass
       AND c.contype  = 'f'
       AND a.attname  = 'invited_by'
  LOOP
    EXECUTE format('ALTER TABLE public.workspace_members DROP CONSTRAINT %I', restriccion.conname);
  END LOOP;
END
$$;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPROBACIÓN — pegar su salida en la tarjeta `ab86481d`.
--
-- Lista TODAS las claves foráneas que apuntan a `public.users`, con su acción
-- al borrar. No solo `invited_by`: el esquema documentado solo tiene esa en
-- NO ACTION, pero `schema-drift` compara columnas, no acciones de clave, así que
-- la base viva podría tener otra y la eliminación seguiría rompiéndose.
--
-- Esperado: **ninguna fila con `al_borrar` = 'NO ACTION' o 'RESTRICT'**.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT c.conrelid::regclass AS tabla,
       c.conname           AS restriccion,
       CASE c.confdeltype
         WHEN 'a' THEN 'NO ACTION'
         WHEN 'r' THEN 'RESTRICT'
         WHEN 'c' THEN 'CASCADE'
         WHEN 'n' THEN 'SET NULL'
         WHEN 'd' THEN 'SET DEFAULT'
       END                 AS al_borrar
  FROM pg_constraint c
 WHERE c.contype   = 'f'
   AND c.confrelid = 'public.users'::regclass
 ORDER BY al_borrar, tabla;
