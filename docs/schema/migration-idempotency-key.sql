-- Migration: clave de idempotencia en la puerta externa
-- Tarjeta: «Repetir una comanda crea otra tarjeta: no hay clave de idempotencia»
-- Created: 2026-08-10
--
-- QUÉ CIERRA. Dos `POST` idénticos a `/api/internal/create-card` creaban dos
-- tarjetas y devolvían `201` las dos veces. Un humano ve el duplicado y lo
-- borra; **una nave que reintenta al vencer el tiempo de espera, no** — y no
-- tiene forma de distinguir «se creó y perdí la respuesta» de «no se creó».
--
-- POR QUÉ EL ÍNDICE ÚNICO Y NO UN `SELECT` ANTES DE INSERTAR. Comprobar y luego
-- insertar deja una ventana entre las dos consultas, y es justo la ventana que
-- este defecto tiene: dos reintentos simultáneos pasan los dos la comprobación.
-- **Lo que cierra la ventana es la base, no la ruta.** La ruta mira antes por
-- comodidad —para no gastar un insert fallido en el caso normal— pero quien
-- garantiza que no haya dos es este índice, y la ruta trata el `23505` como
-- repetición, no como error.
--
-- POR QUÉ PARCIAL. La inmensa mayoría de las tarjetas —todas las de la UI, las
-- del riel, y las de la puerta externa que no manden clave— tienen NULL aquí.
-- Un único total sobre NULL no colisiona en PostgreSQL, pero indexarlas todas
-- es peso sin pregunta que responda.
--
-- POR QUÉ EL ESPACIO DE NOMBRES ES GLOBAL, y qué precio tiene. Dos naves que
-- eligieran la misma clave se pisarían: la segunda recibiría la tarjeta de la
-- primera con un `200`. **No se acota por llamante a propósito**: el nombre del
-- llamante lo declara quien tiene el secreto, así que acotar por él daría una
-- separación que la puerta no puede verificar — seguridad de adorno. Lo que sí
-- se puede verificar es la FORMA de la clave, y por eso la puerta exige un UUID
-- (`server/routes/internalRoute.js`): con UUID la colisión entre naves deja de
-- ser un problema de coordinación y pasa a ser improbable por construcción.
--
-- NULL en todo lo anterior a esta migración, y se queda NULL: no hay clave que
-- inventarles y una inventada haría creer que aquellas comandas eran repetibles.
--
-- Sin GRANTs ni RLS nuevos a propósito: es una columna sobre una tabla que ya
-- los tiene. El patrón obligatorio de CLAUDE.md aplica a tablas NUEVAS — y
-- concederlos otra vez aquí daría a entender que hacía falta.
--
-- Idempotente: se puede aplicar dos veces. (Sí, la migración de la idempotencia
-- también lo es. No es un chiste: es la misma razón.)

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

COMMENT ON COLUMN public.cards.idempotency_key IS
  'Clave que el llamante manda en POST /api/internal/create-card para que un '
  'reintento devuelva la tarjeta que ya existe en vez de crear otra. UUID, '
  'exigido por la puerta. Espacio de nombres GLOBAL: no se acota por llamante '
  'porque el llamante se autodeclara. NULL en la UI, en el riel, y en todo lo '
  'anterior a 2026-08-10.';

-- ESTE índice es la garantía. Si alguien lo quita, la ruta sigue pareciendo
-- idempotente en el caso normal y deja de serlo justo en el caso que importa:
-- dos reintentos a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_idempotency_key
  ON public.cards(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
