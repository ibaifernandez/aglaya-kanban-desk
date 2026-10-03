-- migration-historial-solo-lo-anadido.sql — tarjeta `fc38e47f`.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ AÑADE, Y POR QUÉ HACEN FALTA DOS COLUMNAS Y NO UNA
--
-- El historial guarda el texto anterior ENTERO en cada edición. El 82,5 % de las
-- ediciones de esta casa son añadidos puros al final —se pega un bloque al pie de
-- un acta—, así que cada añadido reescribe todo lo anterior. Guardar solo el
-- trozo nuevo lleva el texto del historial de 43 MB a 18.
--
-- Pero un trozo suelto no se puede leer: hay que saber **a qué se le pega**. De
-- ahí las dos columnas:
--
--   · `base_id` — la fila del historial sobre la que se calculó este trozo.
--     Explícita y no implícita (no «la anterior por fecha»), porque lo implícito
--     se rompe en silencio: si alguien inserta una fila entre medias, o dos
--     ediciones comparten `changed_at`, «la anterior» deja de ser la misma y el
--     historial mentiría sin dar error.
--
--   · `es_sufijo` — si `old_value` es el texto completo o solo lo añadido. Se
--     guarda en vez de deducirse de `base_id IS NOT NULL`, porque un día querremos
--     romper una cadena materializando una fila completa SIN perder de qué venía.
--
-- ⚠️ NO HAY `ON DELETE CASCADE` EN `base_id`, Y ES LO MÁS IMPORTANTE DE ESTE
-- FICHERO. Con cascada, borrar un ancla se llevaría por delante toda su cadena
-- —justo las versiones que una poda quiere CONSERVAR—. Va `ON DELETE SET NULL`:
-- si el ancla desaparece, la fila queda huérfana y **se nota**, en vez de
-- desaparecer sin que nadie lo pida.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ NO HACE
--
-- No toca ninguna fila existente. Las 4.000 filas de historial que ya hay siguen
-- con su texto completo y `es_sufijo = false`, que es la verdad sobre ellas. Esto
-- solo cambia cómo se escriben las PRÓXIMAS.
--
-- Idempotente: se puede aplicar dos veces sin efecto.

ALTER TABLE public.card_description_history
  ADD COLUMN IF NOT EXISTS es_sufijo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.card_description_history
  ADD COLUMN IF NOT EXISTS base_id UUID;

-- La restricción se añade aparte y con guarda, porque `ADD CONSTRAINT` no acepta
-- `IF NOT EXISTS` y sin esto la migración no sería idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'card_description_history_base_id_fkey'
       AND conrelid = 'public.card_description_history'::regclass
  ) THEN
    ALTER TABLE public.card_description_history
      ADD CONSTRAINT card_description_history_base_id_fkey
      FOREIGN KEY (base_id) REFERENCES public.card_description_history(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Reconstruir una versión es seguir la cadena hacia atrás por `base_id` hasta el
-- ancla. Sin índice eso es un recorrido completo por eslabón.
--
-- Y hay una segunda razón, menos obvia y más cara: `ON DELETE SET NULL` obliga a
-- Postgres a buscar quién apunta a la fila que se borra. Sin índice, cada borrado
-- de una fila de historial recorrería la tabla entera — y la poda del Operador
-- borra miles de golpe. Ésta es exactamente la clase de clave foránea sin índice
-- que la tarjeta `6869ebc7` viene a arreglar: no se añade una nueva.
CREATE INDEX IF NOT EXISTS idx_card_description_history_base
  ON public.card_description_history(base_id)
  WHERE base_id IS NOT NULL;

COMMENT ON COLUMN public.card_description_history.es_sufijo IS
  'true = old_value guarda SOLO lo añadido al final respecto de base_id. false = texto completo (ancla).';
COMMENT ON COLUMN public.card_description_history.base_id IS
  'Fila sobre la que se calculó el sufijo. NULL en las anclas. ON DELETE SET NULL: perder el ancla deja la fila huérfana, visible, nunca borrada en cascada.';
