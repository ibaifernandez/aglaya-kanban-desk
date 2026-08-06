-- Migration: quién clavó cada tarjeta por la puerta externa
-- Tarjeta: «El riel no sabe quién le habla: una identidad de llamante en cada petición»
-- Created: 2026-08-06
--
-- QUÉ CIERRA. `POST /api/internal/create-card` se autentica con UN secreto
-- compartido. Con dos llamantes conocidos no molesta; con N naves, **todo lo
-- clavado dice lo mismo** y no se puede saber qué nave metió qué. No es un
-- problema de permisos —quien tiene el secreto puede escribir, y eso es el
-- diseño— sino de RASTRO: cuando algo aparece mal puesto, no hay a quién
-- preguntar.
--
-- POR QUÉ UNA COLUMNA Y NO UNA TABLA. La identidad del llamante es un hecho del
-- momento de crear, no una entidad con vida propia: no se edita, no se
-- relaciona, y muere con la tarjeta. Una tabla aparte obligaría a un JOIN para
-- contestar la única pregunta que se le va a hacer.
--
-- POR QUÉ TEXT Y NO UNA CLAVE FORÁNEA. Los llamantes son naves, no usuarios de
-- esta base: `aglaya.biz`, el Scanner, el capitán. No existen en `users` y no
-- deberían — darles fila aquí sería inventarles cuenta. Se guarda el nombre que
-- se declara, tal cual.
--
-- LO QUE ESTO **NO** ES, y conviene decirlo antes de que alguien lo lea al
-- revés: **no es autenticación**. Quien tiene el secreto puede declarar el
-- nombre que quiera, incluido el de otro. Sirve para saber quién dice ser, que
-- es exactamente lo que hace falta para cruzar «lo que las naves dieron por
-- entregado» contra «lo que hay en un tablero». Atarlo a credenciales por nave
-- es la otra mitad, vive en su propia tarjeta, y es de Ibai.
--
-- NULL en todo lo anterior a esta migración, y se queda NULL: rellenarlo con un
-- valor inventado convertiría «no lo sabemos» en «lo clavó fulano», que es peor
-- que el hueco. El hueco se lee; una atribución falsa, no.
--
-- Idempotente: se puede aplicar dos veces.

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS created_by_caller TEXT;

COMMENT ON COLUMN public.cards.created_by_caller IS
  'Nave declarada que creó la tarjeta por POST /api/internal/create-card. '
  'NO es autenticación: quien tiene TASK_SECRET declara el nombre que quiera. '
  'NULL en las anteriores a 2026-08-06 y en las creadas por la UI o por el riel.';

-- La consulta que hace útil esta columna es siempre la misma: «qué clavó tal
-- nave, lo más reciente primero». Parcial, porque la inmensa mayoría de las
-- tarjetas son NULL y no tiene sentido indexarlas.
CREATE INDEX IF NOT EXISTS idx_cards_created_by_caller
  ON public.cards(created_by_caller, created_at DESC)
  WHERE created_by_caller IS NOT NULL;

-- Sin GRANTs ni RLS nuevos a propósito: es una columna sobre una tabla que ya
-- los tiene. El patrón obligatorio de CLAUDE.md aplica a tablas NUEVAS — y
-- concederlos otra vez aquí daría a entender que hacía falta.
