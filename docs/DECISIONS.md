# DECISIONS.md — Registro de Decisiones Arquitectónicas

Formato ADR (Architecture Decision Records). Cada entrada documenta una decisión no trivial: contexto, opciones consideradas, decisión tomada y consecuencias.

---

## ADR-001 — Base de datos: Supabase (PostgreSQL hosted)

**Fecha:** 2026-03-18
**Estado:** Aceptada

**Contexto:** La versión personal de MyBoard usa un archivo `tasks.json` como base de datos. Para la versión corporativa multi-tenant necesitamos un sistema de base de datos real con autenticación integrada.

**Opciones consideradas:**
- Supabase (PostgreSQL hosted + Auth integrado + API REST)
- PlanetScale (MySQL serverless)
- MongoDB Atlas
- PostgreSQL autohosteado en PRONODO

**Decisión:** Supabase.

**Razones:**
- Incluye sistema de autenticación integrado (Supabase Auth) — evita implementar auth desde cero
- API REST autogenerada — reduce código de backend
- Plan gratuito generoso para desarrollo y pruebas
- PostgreSQL estándar — sin vendor lock-in real; se puede migrar a PostgreSQL propio en PRONODO en el futuro
- SDK oficial para Node.js y React

**Consecuencias:** Dependencia de la nube de Supabase en Phase 1. En Phase 4 se puede migrar a PostgreSQL self-hosted si LFi lo requiere.

---

## ADR-002 — Autenticación: Supabase Auth con JWT

**Fecha:** 2026-03-18
**Estado:** Aceptada

**Contexto:** Phase 1 requiere autenticación de usuarios con soporte para múltiples roles (superadmin, admin, colaborador, cliente, guest).

**Opciones consideradas:**
- Implementación propia de auth con bcrypt + JWT manual
- Supabase Auth
- Auth0
- Clerk

**Decisión:** Supabase Auth.

**Razones:**
- Viene integrado con la base de datos elegida (ADR-001)
- Manejo seguro de passwords, sesiones y tokens sin implementación propia
- Soporte para OAuth (Google, etc.) si se necesita en el futuro
- Gratuito en el plan inicial

**Consecuencias:** Los tokens JWT de Supabase deben validarse en el middleware de Express. Requiere gestión de `SUPABASE_URL` y `SUPABASE_ANON_KEY` en variables de entorno.

---

## ADR-003 — Deploy: PRONODO

**Fecha:** 2026-03-18
**Estado:** Aceptada

**Contexto:** La aplicación necesita un servidor de producción accesible para el equipo de LFi.

**Opciones consideradas:**
- Vercel + Railway (frontend + backend por separado, SaaS)
- Render
- PRONODO (infraestructura propia de empresa hermana de LFi, gestionada por Fernando Murillo)

**Decisión:** PRONODO.

**Razones:**
- Control total de datos en infraestructura cercana a LFi
- Sin costes de SaaS externos
- Fernando Murillo (PRONODO) ya tiene relación de confianza con LFi
- Permite negociar como parte del pitch a LFi (infraestructura incluida)

**Consecuencias:** Necesario coordinar con Fernando Murillo para dominio, Docker y configuración de servidor. Documentar proceso en `docs/README-deploy.md`.

---

## ADR-004 — Estrategia freemium: control por campo `plan` en el tenant

**Fecha:** 2026-03-18
**Estado:** Aceptada

**Contexto:** Se quiere diferenciar entre un tier Free y un tier Pro para poder controlar el acceso y, eventualmente, monetizar.

**Opciones consideradas:**
- Stripe + lógica de suscripción completa
- Control manual por campo en base de datos
- Sin límites (todo gratuito por ahora)

**Decisión:** Campo `plan` (enum: `free` | `pro`) en la tabla `organizations`. Lógica de límites en middleware del server.

**Razones:**
- Simplicidad en fase inicial — sin pasarela de pago
- Fácil de cambiar manualmente para promover clientes a Pro
- Permite demostrar el modelo de negocio sin infraestructura de pago

**Consecuencias:** Los límites (3 tableros, 50 tarjetas en Free) se validan en el server. Cuando se decida monetizar, se conecta Stripe y se automatiza la actualización del campo `plan`.

---

## ADR-005 — Protección de IP: código fuente en repo privado de Ibai

**Fecha:** 2026-03-18
**Estado:** Aceptada

**Contexto:** MyBoardLFi es creado por Ibai Fernández para uso de LFi. Es fundamental preservar la propiedad intelectual antes de negociar con LFi la compensación o adquisición.

**Decisión:** El código fuente reside exclusivamente en el repositorio privado de GitHub de Ibai. Los deploys a PRONODO se realizan mediante build compilado (artefactos), nunca compartiendo el código fuente.

**Razones:**
- Preservar la propiedad intelectual como palanca de negociación
- Evitar que LFi pueda prescindir del autor una vez tenga el código
- Estándar habitual en proyectos de software para clientes (entrega del producto, no del fuente)

**Consecuencias:** Fernando Murillo (PRONODO) recibe un `docker-compose.yml` con imágenes precompiladas + variables de entorno. No accede al código fuente. Si la negociación incluye adquisición del software, el código fuente se entrega en ese momento.

---

## ADR-007 — Email transaccional: Migadu (provisional) → Resend (producción)

**Fecha:** 2026-03-19
**Estado:** ✅ Activa (2026-03-24)

**Contexto:** MyBoardLFi necesita enviar emails transaccionales: digest de tareas bajo demanda y restablecimiento de contraseña vía Supabase Auth.

**Opciones consideradas:**
- Migadu (SMTP personal de Ibai, `info@ibaifernandez.com`)
- Resend con cuenta personal de Ibai (`ibaifernandez.com`) — descartado por mezclar marca personal y corporativa
- Resend con cuenta LFi (`ibai.fernandez@lafabricaimaginaria.com`, dominio `lafabricaimaginaria.com`)
- Supabase built-in email — descartado por rate limits y falta de personalización

**Decisión:** Resend con cuenta LFi (`ibai.fernandez@lafabricaimaginaria.com`, dominio `lafabricaimaginaria.com`).

**Historial:**
- 2026-03-19: Cuenta Resend creada. Bloqueado por verificación DNS pendiente de Fernando Murillo (PRONODO/TI LFi). Se usó Migadu como provisional.
- 2026-03-24: Fernando Murillo verificó el dominio. Migrado a Resend en Railway y Supabase. Probado y confirmado en producción.

**Configuración activa en Railway:**
```
SMTP_HOST=smtp.resend.com
SMTP_USER=resend
SMTP_PASS=<api_key_resend — en poder de Ibai>
SMTP_FROM="MyBoardLFi <myboard@lafabricaimaginaria.com>"
DIGEST_TO=ibai@lfi.la
```
Y en Supabase → Authentication → Email → SMTP Settings: mismas credenciales.

**Consecuencias:** Email transaccional corporativo operativo. Si la API key de Resend se rota, actualizar en Railway → Variables → `SMTP_PASS`.

---

## ADR-008 — Restricción de acceso por dominio corporativo

**Fecha:** 2026-03-19
**Estado:** Aceptada

**Contexto:** MyBoardLFi es una herramienta interna corporativa. No debe ser accesible para cualquier dirección de email.

**Decisión:** Login y registro restringidos a dominios `@lfi.la` y `@lafabricaimaginaria.com`. Validación en dos capas: frontend (UX inmediato, sin petición al servidor) y servidor (fuente de verdad en `ALLOWED_DOMAINS`).

**Razones:**
- Evita accesos no autorizados sin necesidad de un sistema de invitaciones complejo en Phase 1
- La validación doble mejora UX (respuesta instantánea) sin sacrificar seguridad (el servidor siempre valida)
- Los dominios son configurables en `server/routes/auth.js` sin tocar la base de datos

**Consecuencias:** Si LFi incorpora colaboradores externos con otros dominios, se añade el dominio a `ALLOWED_DOMAINS` o se implementa un sistema de invitación por token (Phase 2+).

---

## ADR-009 — Eliminar policy RLS recursiva en public.users

**Fecha:** 2026-03-23
**Estado:** Aceptada

**Contexto:** Tras crear el usuario `ibai@lfi.la` en Supabase Auth e insertar su fila en `public.users`, el login seguía fallando con "Error al obtener el perfil de usuario". La fila existía, las credenciales eran correctas y el `SUPABASE_SERVICE_ROLE_KEY` estaba bien configurado en Railway.

**Causa raíz:** La policy RLS `"Admins ven todos los usuarios de su org"` realizaba una subconsulta a `public.users` para verificar el rol del usuario autenticado:
```sql
-- Política problemática (ya eliminada):
CREATE POLICY "Admins ven todos los usuarios de su org"
  ON public.users FOR SELECT
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'superadmin')
  );
```
Esta subconsulta crea una recursión infinita: para leer `public.users` hay que ejecutar una policy que lee `public.users`, que ejecuta la policy, etc. PostgreSQL corta la recursión y devuelve un error que Supabase traduce como fallo silencioso.

**Por qué afecta a service_role:** La `service_role` key normalmente bypasea RLS. Sin embargo, en este caso el cliente Supabase del servidor usaba `supabaseAdmin.auth.signInWithPassword()` que internamente puede operar con el contexto de sesión del usuario, no de servicio. Además, ciertas versiones del SDK no garantizan el bypass en todos los contextos de query encadenado.

**Opciones consideradas:**
1. Reescribir la policy usando una función `SECURITY DEFINER` que evite la recursión
2. Eliminar la policy completamente (ya que `service_role` debería tener acceso total de todos modos)
3. Añadir una tabla auxiliar de roles para evitar la autorreferencia

**Decisión:** Eliminar la policy recursiva y reemplazarla por una función `SECURITY DEFINER` que resuelve el rol del usuario actual sin releer la tabla bajo RLS.

```sql
-- 1. Eliminar la policy recursiva
DROP POLICY IF EXISTS "Admins ven todos los usuarios de su org" ON public.users;

-- 2. Función auxiliar que obtiene el rol sin disparar RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- 3. Policy correcta: admins ven todo, cualquier usuario ve su propia fila
CREATE POLICY "Admins ven usuarios de su org"
ON public.users FOR SELECT
USING (
  public.get_my_role() IN ('admin', 'superadmin')
  OR id = auth.uid()
);
```

**Consecuencias:** Las queries a `public.users` funcionan correctamente sin recursión. La tabla tiene RLS activo, lo que protege el acceso directo vía anon key desde el navegador. La anon key de Supabase (`VITE_SUPABASE_ANON_KEY`) puede incluirse en el bundle del cliente con seguridad — solo permite Auth operations y lectura de la propia fila.

---

## ADR-010 — Deploy provisional: Railway (backend) + Netlify (frontend)

**Fecha:** 2026-03-23
**Estado:** Aceptada (provisional — ver ADR-003)

**Contexto:** ADR-003 establecía PRONODO como destino de deploy. Sin embargo, PRONODO requiere coordinación con Fernando Murillo (configuración Docker, dominio, servidor), que no está disponible en el momento de la primera demo. Se necesita un deploy funcional inmediato.

**Decisión:** Deploy provisional en Railway (backend) + Netlify (frontend).

**Razones:**
- Railway: deploy en minutos desde GitHub, sin configuración de servidor, variables de entorno via UI, logs integrados
- Netlify: deploy automático en cada push a `main`, dominio personalizado gratuito, proxy inverso via `netlify.toml` (evita CORS y no requiere cambios en el cliente)
- Ambos tienen plan gratuito suficiente para demo y fase inicial
- No requieren coordinación externa

**Configuración de producción:**
- Backend: `https://web-production-aa41d.up.railway.app`
- Frontend: `https://myboardlfi.ibaifernandez.com` (dominio primario) / `https://myboardlfi.netlify.app`
- `netlify.toml` redirige `/api/*` y `/uploads/*` → Railway (proxy transparente)
- SMTP: Migadu vía `info@ibaifernandez.com` (provisional — ver ADR-007)

**Consecuencias:** Cuando PRONODO esté listo, migrar backend a PRONODO y actualizar `netlify.toml` con la nueva URL. El frontend puede mantenerse en Netlify indefinidamente o migrarse también a PRONODO según acuerdo con LFi.

---

## ADR-011 — Display name: «LFi Kanban Desk»

**Fecha:** 2026-03-25
**Estado:** Aceptada

**Contexto:** El nombre técnico «MyBoardLFi» es descriptivo pero genérico y poco atractivo como producto. Se buscaba un nombre que transmitiera más identidad de marca.

**Opciones consideradas:**
- MyBoardLFi (nombre técnico, sin cambio)
- LFiBoard
- Tablón
- LFiDesk
- LFi Kanban Desk

**Decisión:** «LFi Kanban Desk» — aplicado en toda la UI visible (title tag, LoginPage, ResetPasswordPage, Sidebar, WorkspaceDashboard, footer copyright). El nombre técnico del repositorio y código permanece «MyBoardLFi».

**Razones:**
- Incluye la marca LFi (reconocimiento inmediato)
- «Kanban» describe exactamente la metodología de la herramienta
- «Desk» connota espacio de trabajo personal/corporativo
- Separado en tres palabras, se lee de forma natural

**Consecuencias:** El copyright en footer dice «LFi Kanban Desk · © 2026 Ibai Fernández». El repo, CLAUDE.md y nombres de archivo técnicos permanecen como MyBoardLFi. Si LFi adquiere el producto, puede rebrandear libremente.

---

## ADR-012 — Arquitectura de workspaces: tabla dedicada + RLS con SECURITY DEFINER

**Fecha:** 2026-03-24
**Estado:** Aceptada

**Contexto:** Phase 2 requería un nivel de agrupación entre Organization y Board: los workspaces. Necesitaban RLS que permitiera aislar datos por workspace sin exponer información entre workspaces del mismo tenant.

**Problema:** Las policies RLS en `workspace_members` que consultaban la misma tabla para verificar permisos causaban recursión infinita (mismo patrón que ADR-009 con `public.users`).

**Decisión:** Funciones auxiliares con `SECURITY DEFINER` para resolver roles sin disparar RLS:
```sql
CREATE FUNCTION get_workspace_role(workspace_id uuid) RETURNS text SECURITY DEFINER ...
CREATE FUNCTION is_workspace_member(workspace_id uuid) RETURNS boolean SECURITY DEFINER ...
```

**Razones:**
- Rompe la recursión limpiamente sin eliminar RLS
- Las funciones SECURITY DEFINER ejecutan con privilegios del owner (superusuario de Supabase), no del usuario autenticado
- Patrón ya establecido en ADR-009 para `public.users`

**Consecuencias:** Toda policy RLS de workspaces debe usar estas funciones. Si se añaden nuevas tablas relacionadas con workspaces, crear funciones equivalentes. FK disambiguation obligatoria en PostgREST cuando hay múltiples FKs a la misma tabla.

---

## ADR-006 — Fork de MyBoard como base de MyBoardLFi

**Fecha:** 2026-03-18
**Estado:** Aceptada

**Contexto:** Ibai tiene una aplicación Kanban personal funcional (MyBoard, Phase 1 completa). MyBoardLFi necesita las mismas funcionalidades base más capacidades corporativas.

**Decisión:** MyBoardLFi es un fork directo de MyBoard. Se mantienen separados como proyectos independientes.

**Razones:**
- MyBoard ya tiene MVP completo y estable (tableros, columnas, tarjetas, categorías, uploads, búsqueda)
- Evita reescribir funcionalidad probada desde cero
- Los proyectos tienen objetivos distintos: MyBoard es personal, MyBoardLFi es corporativo

**Consecuencias:** Cambios en MyBoard no se propagan automáticamente a MyBoardLFi. Las mejoras corporativas de MyBoardLFi son exclusivas de este fork.
