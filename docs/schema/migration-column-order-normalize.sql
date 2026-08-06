-- Migration: normalizar el orden de las columnas de cada tablero
-- Tarjeta: «Las columnas no se pueden renombrar ni borrar, y al insertarlas
--          chocan los números»
-- Created: 2026-08-06
--
-- QUÉ ARREGLA. `PUT /api/columns/:id` escribía el número pedido a pelo, sin
-- mirar quién lo ocupaba ni reordenar al resto. Montando el protocolo de obra en
-- el tablero de Operaciones se pidieron las posiciones 4, 5 y 6 sobre un tablero
-- que ya tenía 4 y 5, y quedaron **dos columnas compartiendo número**. A partir
-- de ahí el orden visual lo decide el desempate de la interfaz, no lo que se
-- pidió.
--
-- Medido antes de escribir esto: en toda la base hay **un solo** par repetido, y
-- está en el tablero de Operaciones (`order = 5`, dos veces). No es un arreglo
-- masivo: es cerrar el agujero y dejar los números contiguos.
--
-- CÓMO DESEMPATA, y por qué así. Renumera 1..N por `("order", created_at)`, que
-- es el mismo criterio con el que se lee hoy el tablero. **Preserva el orden
-- visual actual**: cambia los números, no la secuencia.
--
-- Lo que esto NO hace, a propósito: no pone las columnas en el orden que el
-- protocolo de obra describe. Hoy «✅ Hecho» va ANTES que «🔍 Por revisar», y
-- según el protocolo debería ser al revés. Cambiarlo es una decisión sobre el
-- flujo de trabajo de la flota, no un efecto secundario de una migración de
-- integridad. Queda anotado en el parte para que lo decida quien deba.
--
-- POR QUÉ NO HAY RESTRICCIÓN UNIQUE. Sería lo natural — y no se puede sostener
-- hoy con esta arquitectura. Reordenar exige desplazar varias filas, y con un
-- UNIQUE no diferible cualquier desplazamiento choca a medio camino; para que no
-- chocara haría falta una función transaccional en la base con la restricción
-- DEFERRABLE. Eso es exactamente el mismo cambio que la tarjeta «Tres formas de
-- aterrizar mal» dejó ABIERTO para el orden de las TARJETAS, y por el mismo
-- motivo. Ponerla a medias —restricción sin transacción— rompería el reordenado
-- legítimo, que es peor que el defecto. La unicidad la sostiene por ahora la
-- ruta, que renumera el tablero entero en cada cambio; queda dicho en voz alta
-- que una escritura directa a la base puede volver a romperla.
--
-- Idempotente: correrla dos veces deja lo mismo.

WITH numerada AS (
  SELECT id,
         row_number() OVER (PARTITION BY board_id ORDER BY "order", created_at, id) AS nuevo
    FROM public.columns
)
UPDATE public.columns c
   SET "order" = n.nuevo
  FROM numerada n
 WHERE c.id = n.id
   AND c."order" IS DISTINCT FROM n.nuevo;
