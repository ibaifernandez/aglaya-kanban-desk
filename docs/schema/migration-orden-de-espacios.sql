-- Migration: los espacios de trabajo se pueden ordenar
-- Tarjeta: «Los espacios de trabajo no se pueden ordenar» (d0954969)
-- Created: 2026-09-03
-- ⏳ PENDIENTE DE APLICAR. Requiere al Operador (SQL Editor de Supabase).
--
-- ⚠️ NO SE CREA ESTA CABECERA: se mira el guardián. `scripts/schema-drift-guard.sh`
--    compara el esquema documentado contra la base y corre con credencial propia.
--    Una cabecera de esta casa dijo «PENDIENTE» **diecisiete días después de
--    aplicarse**, y una tarjeta entera se planificó sobre esa línea.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ AÑADE
--
-- `public.workspaces` no tenía dónde guardar un orden. `public.boards` sí
-- —`"order" INTEGER NOT NULL DEFAULT 0`— y por eso los tableros ya se
-- reordenaban arrastrando y los espacios no.
--
-- DOS DECISIONES DE IBAI, 03-sep-2026, y las dos cambian el esquema:
--
--   · **El orden es POR SECCIÓN**, no global. La vista agrupa por `type`
--     (personal / interno / externo) y se arrastra dentro del grupo. Un orden
--     global con secciones que lo parten hace que arrastrar a la posición 2
--     coloque la tarjeta en otro sitio, porque el 1 y el 3 están en otra
--     sección. Por eso el relleno inicial numera **dentro de cada tipo**.
--   · **El orden es COMPARTIDO**, no por persona. Vive en `workspaces`, así que
--     si alguien reordena, lo ven los demás. Con las cuentas de hoy es la
--     respuesta barata, y refleja prioridad del negocio y no gusto personal. Si
--     algún día se quiere por persona, **no es esta columna**: es una tabla de
--     preferencias por usuario, con su RLS.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ LA TRAMPA QUE ESTA CASA YA PAGÓ DOS VECES, Y POR QUÉ AQUÍ HAY UNA FUNCIÓN
--
-- El molde natural era `reorderBoards` (`server/routes/boards.js:153`), que
-- renumera **fila a fila y sin transacción**: un `Promise.all` de `UPDATE`
-- sueltos. Si el proceso muere a mitad —o falla uno de los `UPDATE`, que además
-- no se comprueban— el orden queda **medio aplicado**: dos espacios con el mismo
-- número, o un hueco. Medido en `c1efd488` para los tableros.
--
-- Copiar ese molde aquí habría copiado el defecto. Por eso el reorden es **una
-- sola sentencia** dentro de una función: `UPDATE … FROM unnest(...) WITH
-- ORDINALITY`. Una sentencia es atómica por definición — o se aplica entera o no
-- se aplica nada. No hay estado a medias que reparar.
--
-- Y la función **valida el alcance dentro**: solo toca filas de la organización
-- que se le pasa. Un identificador ajeno no se ordena mal: no se toca.
--
-- Idempotente: `IF NOT EXISTS` y `CREATE OR REPLACE`. Se puede aplicar dos veces.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. La columna. `DEFAULT 0` para que las filas existentes no violen el NOT NULL
--    antes del relleno del paso 2.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- 2. Relleno inicial: numera DENTRO DE CADA TIPO, por nombre.
--
--    Se numera por `name` y no por `created_at` a propósito: el orden inicial lo
--    va a ver una persona, y alfabético es predecible. Por fecha de creación
--    parecería aleatorio y la primera reacción sería reordenarlo entero.
--
--    Solo toca las filas que están a cero, para que aplicarla dos veces no
--    machaque un orden ya elegido por alguien.
WITH numeradas AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY organization_id, type ORDER BY name) AS pos
    FROM public.workspaces
)
UPDATE public.workspaces w
   SET "order" = n.pos
  FROM numeradas n
 WHERE w.id = n.id
   AND w."order" = 0;

-- 3. El reorden, en UNA sentencia.
--
--    `p_ids` llega en el orden deseado; `WITH ORDINALITY` da la posición de cada
--    identificador dentro del array, y esa posición es el nuevo `"order"`.
--
--    El filtro por `organization_id` es la comprobación de alcance, y vive aquí
--    dentro a propósito: si viviera solo en el servidor, cualquier otro llamante
--    —hoy no hay, mañana quién sabe— podría reordenar filas ajenas.
CREATE OR REPLACE FUNCTION public.reorder_workspaces(p_org UUID, p_ids UUID[])
RETURNS INTEGER
LANGUAGE sql
AS $$
  WITH nuevas AS (
    SELECT id, pos
      FROM unnest(p_ids) WITH ORDINALITY AS t(id, pos)
  ),
  aplicadas AS (
    UPDATE public.workspaces w
       SET "order" = n.pos
      FROM nuevas n
     WHERE w.id = n.id
       AND w.organization_id = p_org
    RETURNING w.id
  )
  SELECT COUNT(*)::INTEGER FROM aplicadas;
$$;

-- 4. Privilegios. RECORTAR PRIMERO Y CONCEDER DESPUÉS, como manda `CLAUDE.md`:
--    este proyecto tiene DEFAULT PRIVILEGES que conceden de más, y un `GRANT` no
--    quita nada.
--
--    Quien llama a esta función es el servidor con `service_role`. `anon` y
--    `authenticated` no la necesitan: la ruta HTTP ya está detrás de JWT.
REVOKE ALL ON FUNCTION public.reorder_workspaces(UUID, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_workspaces(UUID, UUID[]) FROM anon;
REVOKE ALL ON FUNCTION public.reorder_workspaces(UUID, UUID[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_workspaces(UUID, UUID[]) TO service_role;

-- 5. Comprobación posterior. **La ejecuta quien NO la aplicó.**
--
--    a) La columna existe y ninguna fila quedó a cero:
--
--   SELECT count(*) AS sin_orden
--     FROM public.workspaces
--    WHERE "order" = 0;                      -- tiene que devolver 0
--
--    b) El orden es correlativo DENTRO de cada tipo (sin huecos ni repetidos):
--
--   SELECT organization_id, type, count(*) AS filas,
--          count(DISTINCT "order") AS ordenes_distintos, max("order") AS maximo
--     FROM public.workspaces
--    GROUP BY organization_id, type;         -- filas = ordenes_distintos = maximo
--
--    c) La función existe y solo la puede ejecutar `service_role`:
--
--   SELECT grantee::regrole::text AS rol, privilege_type
--     FROM information_schema.routine_privileges
--    WHERE routine_name = 'reorder_workspaces';
--
-- 6. Y DESPUÉS de aplicar, en el mismo turno: declarar la columna y la función
--    en `docs/schema/supabase-schema.sql`, y poner «APLICADA» en la cabecera.
--    `server/tests/orden-de-espacios.test.js` se pone rojo si una cosa va sin la
--    otra — en las dos direcciones.
