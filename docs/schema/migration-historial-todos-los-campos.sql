-- Migration: el historial deja de ser solo de la descripción
-- Tarjeta: «El historial solo guarda la descripción: cualquier otro campo se pierde sin rastro» (cfeccbc4)
-- Created: 2026-08-08
-- ⏳ PENDIENTE DE APLICAR. Requiere al Operador (SQL Editor de Supabase).
--
-- ⚠️ Y ES LA MITAD QUE VA PRIMERA. El código que escribe el historial de los
--    demás campos **no puede entrar hasta que esto esté aplicado**, y no es
--    preferencia: `PUT /api/cards/:id` **aborta el update con `500` si no
--    consigue escribir la fila del historial** (contrato `riel` v2.1.0). Código
--    escribiendo en una columna que todavía no existe = todas las ediciones de
--    tarjeta caídas. Y este repo despliega al empujar a `main`.
--
--    Es exactamente la factura del PR #28, que trajo migración y código juntos:
--    el documento decía que la columna estaba y la base no la tenía. Se salvó
--    partiéndolo en dos (#34 la migración sola), y lo salvó una persona
--    acordándose.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ CIERRA
--
-- El historial cubre **un** campo. Prioridad, responsable, columna, título,
-- fechas y etiquetas se sobrescriben **sin rastro**.
--
-- Y no es hipotético: el 6-ago-2026 una regla —hoy retirada— puso a `none` la
-- prioridad de **once tarjetas**, y el dato no estaba en ninguna parte de la
-- base. Se recuperaron por dos casualidades: unos volcados que el capitán había
-- hecho esa mañana **para contar tarjetas**, y los acuses `201` que quedaron en
-- la transcripción de una sesión. **Ninguno de los dos registros existía para
-- eso. Una casualidad no es un mecanismo.**
--
-- El que muerde más fuerte no es la prioridad —ese hueco ya se cerró por otra
-- vía— sino **el responsable**: reasignar por error vuelve la tarjeta invisible
-- para su obrero, y sin historial nadie puede decir a quién estaba asignada.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ SE ENSANCHA LA TABLA QUE HAY, Y NO SE HACE UNA NUEVA
--
--   · **Una tabla nueva** dejaría dos tablas para un solo concepto, y esta casa
--     ya sabe cómo acaban las dos listas: divergen en un campo y quien lea una
--     creerá que conoce las dos.
--   · **Renombrar la que hay** rompe más de lo que arregla: el nombre de su
--     política RLS, su índice, `server/routes/cards.js` y la tool `card_history`
--     del contrato. Y renombrar no es aditivo: no hay vuelta atrás barata.
--
-- Así que se ensancha **añadiendo**, que es lo único reversible.
--
-- EL NOMBRE DE LA TABLA SE QUEDA MINTIENDO UN POCO, y se dice aquí en vez de
-- taparlo: `card_description_history` pasa a guardar más que descripciones.
-- Renombrarla es un cambio incompatible con su propia tarjeta; hoy no toca.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE ESTA MIGRACIÓN **NO** HACE
--
--   · **No escribe ninguna fila nueva.** Eso es del código, y va después.
--   · **No cambia lo que devuelve `card_history`.** Sigue leyendo `description`
--     y sigue viendo exactamente las mismas filas que hoy, porque todas quedan
--     con `field = 'description'`. **Cuando el código empiece a escribir otros
--     campos, esa tool devolverá filas con `description` a NULL** — y eso sí es
--     un cambio de la forma de una puerta, así que va con su nota en
--     `docs/contracts/CONTRACT.md` **en el PR del código, no en éste**.
--   · **No quita `description`.** Se queda por compatibilidad. Quitarla es
--     incompatible y merece su propia decisión.
--   · **No decide la poda.** La tarjeta `244c554e` la custodia, y dice algo que
--     hay que leer el mismo día que esto: *«si `cfeccbc4` entra antes, el ritmo
--     de crecimiento que hoy nadie ha medido cambia de orden de magnitud»*.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA DECISIÓN DE CRECIMIENTO, QUE LA TARJETA PEDÍA MEDIR ANTES
--
-- «Una fila por edición y por campo» **no significa once filas por edición**.
-- `PUT /api/cards/:id` acepta once campos, pero el código que venga detrás tiene
-- que escribir fila **solo para los que de verdad cambiaron de valor** — que es
-- justo lo que ya hace hoy con la descripción (`server/routes/cards.js`, la
-- comprobación `prevDescription !== description`).
--
-- Con esa regla el crecimiento es proporcional a **campos-que-cambian**, no a
-- campos-aceptados. Una edición típica toca uno o dos. **Esto no es una
-- medición del volumen real** —no la he podido hacer— sino la restricción de
-- diseño que evita que el volumen sea el que la tarjeta temía.
--
-- Idempotente: se puede aplicar dos veces.

-- 1. Qué campo guarda esta fila. `description` por defecto para que las filas
--    que ya existen digan la verdad sin tocarlas.
ALTER TABLE public.card_description_history
  ADD COLUMN IF NOT EXISTS field TEXT NOT NULL DEFAULT 'description';

-- 2. El valor anterior, como texto. **Nullable a propósito**: hay campos cuyo
--    valor anterior legítimo es NULL —`assignee_id` sin asignar, `due_date` sin
--    fecha— y guardarlos como cadena vacía sería inventarse un dato. La
--    diferencia entre «no tenía responsable» y «tenía uno que era la cadena
--    vacía» es justo la que un historial existe para conservar.
ALTER TABLE public.card_description_history
  ADD COLUMN IF NOT EXISTS old_value TEXT;

-- 3. Las filas que ya hay pasan a tener su valor en el sitio nuevo, sin perder
--    el viejo. `WHERE old_value IS NULL` hace que reaplicar no pise nada.
UPDATE public.card_description_history
   SET old_value = description
 WHERE old_value IS NULL;

-- 4. `description` deja de ser obligatoria. **Sin esto, la tabla no puede
--    guardar el historial de ningún otro campo**: una fila de `priority` no
--    tiene descripción que poner, y un NOT NULL la rechazaría.
--    Aflojar una restricción no rompe a ningún lector.
ALTER TABLE public.card_description_history
  ALTER COLUMN description DROP NOT NULL;

-- 5. La consulta que hará útil esta tabla cuando guarde varios campos es «dame
--    las versiones de ESTE campo de ESTA tarjeta, la más reciente primero». El
--    índice de hoy (card_id, changed_at DESC) sigue sirviendo para «todo el
--    historial de la tarjeta» y no se toca.
CREATE INDEX IF NOT EXISTS idx_card_description_history_card_field
  ON public.card_description_history(card_id, field, changed_at DESC);

-- 6. Comprobación posterior. La ejecuta quien NO la aplicó.
--    Tiene que devolver las dos columnas nuevas, y `description` ya nullable:
--
--      column_name | is_nullable
--      ------------+------------
--      description | YES
--      field       | NO
--      old_value   | YES
--
--   SELECT column_name, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name   = 'card_description_history'
--      AND column_name IN ('description', 'field', 'old_value')
--    ORDER BY column_name;
--
--    Y que ninguna fila vieja se quedó sin trasladar — tiene que devolver 0:
--
--   SELECT count(*) FROM public.card_description_history
--    WHERE old_value IS NULL AND description IS NOT NULL;
