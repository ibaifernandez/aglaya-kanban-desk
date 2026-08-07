-- Migration: recortar `anon` y `authenticated` a lo que el esquema declara
-- Tarjeta: «authenticated recibe TRUNCATE en todas las tablas, y TRUNCATE salta RLS» (eeaebd9f)
-- Created: 2026-08-06
-- APLICADA EN PRODUCCIÓN el 2026-08-06 por Ibai desde el SQL Editor.
--
-- QUÉ CIERRA. Medido contra la base real ese día, no leído:
--
--   anon          → SELECT, MAINTAIN                     (el esquema declara SELECT)
--   authenticated → SELECT, INSERT, UPDATE, DELETE,
--                   MAINTAIN, REFERENCES, TRIGGER, TRUNCATE
--                                                        (el esquema declara los cuatro primeros)
--
-- El grave es `TRUNCATE`: **salta RLS**. Toda la separación entre organizaciones
-- de esta nave vive en RLS, así que un TRUNCATE alcanzable por un usuario
-- autenticado vacía la tabla entera saltándose el único muro que hay.
--
-- POR QUÉ NADIE LO VIO, y es la mitad interesante. `MAINTAIN` es un privilegio
-- NUEVO de PostgreSQL 17 (esta base corre 17.6). `information_schema` solo
-- expone los siete del estándar SQL, así que `MAINTAIN` no aparece ahí — y
-- `scripts/grants-guard.sh` consulta justamente `information_schema`. El
-- guardián llevaba días en verde sobre una tabla que tenía un privilegio de más.
-- No mentía: miraba por una ventana que no da a ese lado. Se ve con
-- `aclexplode(relacl)`, que lee la ACL de verdad.
--
-- RADIO DEL CAMBIO: cero para esta aplicación, y esto también está medido. Ningún
-- camino lee ni escribe tablas como `anon` o `authenticated`: todo el acceso a
-- datos pasa por Express con `service_role`, y la única llave anónima del cliente
-- se usa en `LoginPage` y `ResetPasswordPage`, o sea para autenticarse, no para
-- leer tablas.
--
-- Idempotente: se puede aplicar dos veces.

-- 1. Lo existente.
REVOKE MAINTAIN ON ALL TABLES IN SCHEMA public FROM anon;

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE
  ON ALL TABLES IN SCHEMA public FROM authenticated;

-- 2. Que no vuelva con la próxima tabla. Toda tabla nueva en `public` nacía con
--    los OCHO privilegios para los dos roles, por DEFAULT PRIVILEGES del
--    proyecto — que es la avería que `CLAUDE.md` ya documentaba, con siete.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE MAINTAIN, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE
  ON TABLES FROM authenticated;

-- LO QUE ESTO **NO** CIERRA, y no se puede cerrar desde aquí:
--
-- `ALTER DEFAULT PRIVILEGES` solo toca los defaults creados por el rol que lo
-- ejecuta. Medido: en `public` hay DOS concesionarios, `postgres` y
-- `supabase_admin`, y los de `supabase_admin` siguen dando los ocho a los dos
-- roles. No se tocan a propósito: son configuración de Supabase, pueden volver
-- solos y romper sus herramientas.
--
-- Así que **media puerta queda cerrada y media no**, y la que no la tiene que
-- vigilar el guardián cuando aparezca una tabla nueva. Para eso
-- `scripts/grants-guard.sh` tiene que dejar de leer `information_schema` y leer
-- `aclexplode` — hoy no lo hace, y por eso esta migración no se da por cerrada
-- con su aplicación.
