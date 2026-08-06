-- Migration: historial de la descripción de una tarjeta
-- Tarjeta: «Actualizar una tarjeta borra lo que había, y no queda rastro»
-- Created: 2026-08-06
--
-- QUÉ CIERRA. La puerta de actualizar recibe la descripción COMPLETA y la
-- reemplaza. No hay forma de añadir sin arriesgarse a borrar, y no había
-- historial: un llamante que no leyera antes de escribir destruía lo que había
-- — y recibía éxito. Pagado el 6-ago-2026: un obrero automático sustituyó la
-- descripción de una tarjeta por el texto de otra, y se recuperó por casualidad
-- porque alguien tenía el original en su contexto.
--
-- Esta tabla guarda la versión ANTERIOR cada vez que la descripción cambia. Es
-- lo único que convierte «se perdió» en «se recupera».
--
-- POR QUÉ NO ES UN TRIGGER, que sería lo primero que uno piensa. Se midió por
-- dónde se escribe de verdad: TODAS las escrituras de descripción pasan por
-- `PUT /api/cards/:id` (server/routes/cards.js → updateCard). El riel escribe
-- solo por la API; sus lecturas directas por PostgREST son de solo lectura. Un
-- trigger cubriría además el `psql` a mano de un humano, pero **no se puede
-- sellar en CI sin escribir filas de prueba en el tablero vivo**, que es la cola
-- de la que tira toda la flota. Se elige la capa que se puede probar. Lo que
-- esto NO cubre queda dicho en voz alta, aquí y en el PR: una escritura directa
-- a la base salta este historial.
--
-- Idempotente: se puede aplicar dos veces.

CREATE TABLE IF NOT EXISTS public.card_description_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  -- La descripción tal como estaba ANTES del cambio que generó esta fila.
  description TEXT NOT NULL,
  -- Quién la sustituyó. NULL si esa cuenta se borró después: se pierde el quién,
  -- nunca el qué — que es lo que hace falta para recuperar.
  changed_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La consulta que hace esta tabla útil es siempre la misma: «dame las versiones
-- de ESTA tarjeta, la más reciente primero».
CREATE INDEX IF NOT EXISTS idx_card_description_history_card
  ON public.card_description_history(card_id, changed_at DESC);

-- GRANTs explícitos (deadline Data API, oct-2026): una tabla nueva en `public`
-- sin GRANT falla vía supabase-js aunque la RLS la permita.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_description_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_description_history TO service_role;

-- Y `anon` se recorta a SELECT, que es el estado que el schema fuente de verdad
-- declara para TODAS las tablas («`anon` solo SELECT; RLS es el guard efectivo»).
--
-- Hace falta decirlo explícitamente porque este proyecto tiene DEFAULT PRIVILEGES
-- en `public` que conceden a `anon` los SIETE privilegios sobre toda tabla nueva
-- (`pg_default_acl`). Medido al aplicar esto: las tablas hermanas tienen uno y
-- esta nacía con siete. O sea que una tabla nueva **nace más abierta de lo que el
-- schema dice**, y sigue así hasta que alguien vuelva a correr el bucle de la
-- sección 9. El patrón de CLAUDE.md concede y no recorta, así que no lo cubre.
--
-- No se recorta MÁS que a las hermanas a propósito: un REVOKE ALL aquí quedaría
-- deshecho por ese bucle sin que nadie se entere, y una protección que un bloque
-- documentado retira es una protección que no está pero lo parece.
REVOKE ALL ON public.card_description_history FROM anon;
GRANT SELECT ON public.card_description_history TO anon;

ALTER TABLE public.card_description_history ENABLE ROW LEVEL SECURITY;

-- Alcance: el MISMO que el de la tarjeta de la que cuelga. Un historial más
-- ancho que su tarjeta sería una fuga de contenido entre organizaciones por la
-- puerta de atrás — el texto de una tarjeta ajena, legible sin ver la tarjeta.
DROP POLICY IF EXISTS "Usuarios ven el historial de las tarjetas de su org"
  ON public.card_description_history;
CREATE POLICY "Usuarios ven el historial de las tarjetas de su org"
  ON public.card_description_history
  FOR SELECT USING (EXISTS (
    SELECT 1
      FROM public.cards c
      JOIN public.columns col ON col.id = c.column_id
      JOIN public.boards  b   ON b.id   = col.board_id
     WHERE c.id = card_description_history.card_id
       AND b.organization_id = get_my_org_id()));

-- Escribe el servidor con `service_role`, que salta RLS. No se abre INSERT a
-- `authenticated` a propósito: un historial que el propio usuario puede escribir
-- a mano no es un historial, es otro campo editable. Y no hay política de UPDATE
-- ni de DELETE por el mismo motivo — lo que se puede reescribir no prueba nada.
