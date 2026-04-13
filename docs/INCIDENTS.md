# INCIDENTS.md — Registro de Incidencias y Correctivos

**Última actualización:** 2026-04-13

Este documento resume los fallos relevantes encontrados durante la estabilización de AGLAYA Kanban Desk, su causa raíz, la solución aplicada y cualquier nota operativa pendiente.

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

## Incidencia operativa pendiente — Plantillas de Supabase Auth con branding legado

**Síntoma**
- Correos de reset/invitación todavía muestran la marca `MyBoardLFi`.

**Estado**
- **Pendiente operativo**, no bloqueado por código.

**Acción requerida**
- Actualizar las plantillas en Supabase Dashboard → `Authentication -> Email Templates`.
- Versiones correctas disponibles en:
  - `docs/mails/supabase-email-reset-password.html`
  - `docs/mails/supabase-email-invite.html`

**Nota**
- Hasta que no se apliquen estas plantillas en el panel de Supabase, el branding del correo seguirá mostrando texto heredado aunque la aplicación ya esté corregida.
