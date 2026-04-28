# INCIDENTS.md — Registro de Incidencias y Correctivos

**Última actualización:** 2026-04-28

Este documento resume los fallos relevantes encontrados durante la estabilización de AGLAYA Kanban Desk, su causa raíz, la solución aplicada y cualquier nota operativa pendiente.

---

## 2026-04-27 — Cron jobs de digest no ejecutan en Railway (UTC vs. Brasil)

**Síntoma**
- Los cron jobs registraban horarios correctos en los logs de startup pero los emails nunca llegaban a la hora esperada (07:00/08:00 Brasil).

**Causa raíz**
- Railway ejecuta en UTC. `DIGEST_HOUR=7` dispara a las 07:00 UTC = 04:00 hora Brasil.
- El servidor local (Mac, GMT-3) sí enviaba a las 7 AM correctamente, ocultando el problema hasta el primer test en producción.

**Solución aplicada**
- Añadida variable `TZ=America/Sao_Paulo` en Railway. Los schedulers ahora interpretan las horas en timezone Brasil.

---

## 2026-04-27 — SMTP falla en Railway con ENETUNREACH (IPv6)

**Síntoma**
- `connect ENETUNREACH 2001:41d0:203:375:::465` al intentar enviar emails desde Railway.
- En local (Mac) funcionaba sin problemas.

**Causa raíz**
- Railway resuelve `smtp.migadu.com` a su dirección IPv6 (OVH). La red de Railway no tiene ruta IPv6 hacia ese servidor.
- `family: 4` en nodemailer no fue suficiente para forzar IPv4 en este entorno.

**Solución aplicada**
- Migración completa de nodemailer/SMTP a **Resend** (SDK oficial). Resend usa HTTPS puro, eliminando cualquier dependencia de resolución DNS IPv4/IPv6.
- Centralizado en `server/utils/mailer.js`.

---

## 2026-04-27 — Resend rechaza envío por dominio no verificado

**Síntoma**
- `The ibaifernandez.com domain is not verified` al intentar enviar desde `info@ibaifernandez.com`.

**Causa raíz**
- Resend exige verificación del dominio remitente. `ibaifernandez.com` no estaba verificado en la cuenta de Resend.

**Solución aplicada**
- Cambiado `SMTP_FROM` a `AGLAYA Kanban Desk <info@aglaya.biz>`. El dominio `aglaya.biz` ya estaba verificado en Resend (región São Paulo).

---

## 2026-04-13 — Invitaciones admin con `500` desde la GUI

**Síntoma**
- `POST /api/admin/users/invite` devolvía `500 Internal Server Error` en producción.
- Railway mostraba violaciones RLS sobre `public.users`.

**Causa raíz**
- El backend reutilizaba un singleton de Supabase para login interactivo y operaciones `service_role`.
- Tras un `signInWithPassword`, el cliente podía quedar contaminado con sesión de usuario y ejecutar escrituras privilegiadas bajo identidad autenticada.

**Solución aplicada**
- Introducción de clientes frescos por request en backend (`auth` y `admin`).
- Separación explícita entre cliente público y cliente admin.
- Endurecimiento del flujo de invitación admin para recuperar la organización efectiva desde base de datos y reconciliar estados parciales entre `auth.users` y `public.users`.

**Verificación**
- Invitación real probada desde GUI y por API.
- Desaparece el error RLS `42501` observado en Railway.

---

## 2026-04-13 — Invitaciones admin fallaban con JWT desfasado o perfil parcial

**Síntoma**
- La invitación podía fallar aunque el usuario invitador fuera superadmin válido.
- En algunos casos el correo existía en Auth pero no en `public.users`.

**Causa raíz**
- El flujo confiaba en el `organizationId` del JWT.
- No existía autocuración para usuarios presentes en Auth pero ausentes en la tabla pública.

**Solución aplicada**
- La organización del invitador se resuelve siempre desde `public.users`.
- El backend recupera usuarios parciales y degrada conflictos de unicidad a `409`.

**Verificación**
- Tests específicos para JWT obsoleto, usuarios parciales y conflicto de email.

---

## 2026-04-13 — Borrado de tarjetas devolvía `400 Contexto de workspace no encontrado`

**Síntoma**
- `DELETE /api/cards/:id` podía fallar desde la GUI aunque la tarjeta fuera visible y editable.

**Causa raíz**
- El middleware intentaba inferir el `workspaceId` mediante joins implícitos y pistas frágiles de ruta.
- El contrato entre frontend y backend no era suficientemente explícito para operaciones destructivas.

**Solución aplicada**
- El frontend envía `boardId` al borrar tarjetas.
- El backend resuelve el contexto en dos pasos deterministas (`card -> board -> workspace`).

**Verificación**
- Smoke real contra la base remota: creación de tarjeta temporal, borrado con `200 OK` y comprobación posterior de inexistencia.

---

## 2026-04-13 — Acciones destructivas sin confirmación consistente

**Síntoma**
- Eliminar columnas, tableros y workspaces no seguía un patrón uniforme de confirmación.
- Algunas acciones destructivas dependían de clic derecho o ejecutaban el borrado directamente.

**Causa raíz**
- La capa de UX creció de forma incremental y dejó comportamientos distintos según el componente.

**Solución aplicada**
- Confirmación explícita para eliminar columnas y tableros.
- Acceso directo por icono de papelera en tarjetas de workspace para owners.
- Cierre por `Escape` en overlays principales (workspace create/edit, card modal, invite modal, confirmaciones y panel de ajustes).

**Verificación**
- Build del cliente y revisión manual de overlays principales.

---

## 2026-04-13 — Botón de digest en workspace apuntando al flujo equivocado

**Síntoma**
- El icono de correo en la navbar interior del workspace disparaba un digest administrativo global.
- El feedback podía mostrar un destinatario legado (`ibai@lfi.la`) en vez del usuario autenticado actual.

**Causa raíz**
- El botón de la toolbar seguía conectado a `POST /api/digest/send-me`, pensado para el admin digest de plataforma.
- El texto de confirmación no existía y el mensaje usaba un email procedente de `public.users`, susceptible a drift respecto a Supabase Auth.

**Solución aplicada**
- La acción del icono pasa a usar el digest personal contextualizado por `workspaceId`.
- Se añade confirmación explícita antes del envío.
- El backend sincroniza el email efectivo desde Supabase Auth cuando detecta divergencia con `public.users`.

**Verificación**
- Build del cliente correcto y carga válida de módulos backend con `.env`.

---

## 2026-04-13 — Navegación interior del workspace demasiado cargada en resoluciones pequeñas

**Síntoma**
- El botón de volver atrás quedaba visualmente ahogado por la densidad de controles.

**Causa raíz**
- La toolbar mantenía visible el filtro local `Filtrar tablero…` incluso cuando el espacio horizontal era insuficiente.

**Solución aplicada**
- Ocultación del filtro local de tablero en resoluciones estrechas para priorizar la navegación y el contexto.

---

## 2026-04-13 — Modal de categorías sin cierre por `Escape`

**Síntoma**
- El diálogo de categorías no respetaba el patrón de cierre por teclado aplicado al resto de overlays.

**Causa raíz**
- El componente no estaba registrado en el contrato común de `Escape`.

**Solución aplicada**
- Integración del modal con el hook común de cierre por `Escape`.
- Los inputs inline de edición interceptan `Escape` solo para revertir la edición local sin cerrar el diálogo completo por accidente.

---

## 2026-04-28 — Invitaciones enviaban email de "restablece contraseña" en vez de invitación

**Síntoma**
- El email de invitación llegaba con asunto "Restablece tu contraseña" y `type=recovery` en el link.
- El remitente mostraba "MyBoardLFi" en vez de "AGLAYA Kanban Desk".
- El cliente no detectaba `type=invite` → mostraba el login, no la pantalla de configurar contraseña.

**Causa raíz**
- El backend usaba `resetPasswordForEmail()` para el flujo de invitación (decisión legada).
- Supabase enviaba su plantilla de "reset password" en lugar de la de "invite user".
- El nombre del proyecto Supabase era `MyBoardLFi` (legacy).
- `App.jsx` solo detectaba `type=recovery`, ignoraba `type=invite`.

**Solución aplicada**
- Backend (`server/routes/admin.js`): sustituido `resetPasswordForEmail` por `generateLink({ type: 'invite' })` + envío vía Resend con la plantilla `docs/mails/supabase-email-invite.html`.
- `App.jsx`: detecta `type=invite` en hash → muestra `ResetPasswordPage(isInvite=true)`.
- `ResetPasswordPage`: escucha `SIGNED_IN` (invite) o `PASSWORD_RECOVERY` (reset) según `isInvite`.
- Supabase Dashboard → Project Settings → General: nombre cambiado a `AGLAYA Kanban Desk`.
- Supabase Authentication → Email → SMTP Settings: configurado `smtp.resend.com:465` con `resend`/apikey y sender `info@aglaya.biz` — todos los emails de Supabase pasan ahora por Resend con SPF/DKIM/DMARC PASS.

**Verificación** (2026-04-28)
- Email recibido en ibai600@gmail.com con asunto "Bienvenid@ a AGLAYA Kanban Desk", remitente "AGLAYA Kanban Desk <info@aglaya.biz>", SPF/DKIM/DMARC PASS, botón "Activar mi cuenta", `type=invite` en URL.

---

## Incidencia operativa resuelta — Plantillas de Supabase Auth con branding legado

**Síntoma**
- Correos de reset/invitación mostraban la marca `MyBoardLFi`.

**Estado**
- ✅ **Resuelto** (2026-04-28).

**Acciones aplicadas**
- Plantilla "Invite user" aplicada en Supabase Dashboard → Authentication → Email Templates.
- Plantilla "Reset password" disponible en `docs/mails/supabase-email-reset-password.html` (pendiente aplicar si aún no está).
- Nombre del proyecto cambiado a `AGLAYA Kanban Desk` en Supabase → Project Settings → General.
- Las invitaciones ya no dependen de Supabase email — se envían vía Resend con plantilla propia.
