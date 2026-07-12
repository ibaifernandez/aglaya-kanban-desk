# INCIDENTS.md — Registro de Incidencias y Correctivos

**Última actualización:** 2026-07-12

Este documento resume los fallos relevantes encontrados durante la estabilización de AGLAYA Kanban Desk, su causa raíz, la solución aplicada y cualquier nota operativa pendiente.

---

## 2026-07-12 — Reconciliación documentación ↔ DB real: 5 divergencias detectadas

**Contexto:** barrida documental que introspeccionó la DB de producción real. El `docs/schema/supabase-schema.sql` se regeneró como mirror fiel. Estos 5 hallazgos quedan **documentados** (no corregidos en DB — requieren migración/decisión del operador, fuera del alcance docs-only).

### DOC-01 (causa raíz) — El "master schema" llevaba desincronizado desde ~v1.2.0

**Síntoma:** `supabase-schema.sql` documentaba `name`/`position` para boards/columns cuando la DB real usa `title`/`order`; omitía 6 columnas reales (`columns.default_sort`, `cards.tags`, `cards.checklist_title`, `cards.assignee_id`, `categories.board_id`, `users.avatar_url`) y la tabla `digest_logs` entera.

**Causa raíz:** la regla de CLAUDE.md *"tras migración, actualizar el schema doc"* no se cumplió al añadir features de Phase 2/4. El doc quedó congelado mientras la DB evolucionó.

**Solución aplicada:** schema regenerado por introspección directa (2026-07-12). **Prevención recomendada:** finding **B-10** del backlog (CI lint que rechace PRs con migración sin actualizar schema + GRANT).

### DOC-02 (🟡 bug latente) — `workspaces.type` DEFAULT contradice su CHECK

- **default real** = `'general'`; **CHECK** = `personal|interno|externo`.
- Un INSERT que omita `type` rellena `'general'` → **viola el CHECK → falla**. No dispara hoy porque la app siempre envía `type` explícito (datos reales: personal 5, interno 6, externo 1, cero 'general').
- **Fix recomendado (migración):** `ALTER TABLE public.workspaces ALTER COLUMN type SET DEFAULT 'personal';`

### DOC-03 (🟡 seguridad) — El rol `anon` tiene TODOS los privilegios en todas las tablas

- GRANTs reales: `anon`, `authenticated` y `service_role` tienen `ALL` (incl. DELETE/TRUNCATE) sobre las 10 tablas.
- Mitigado por RLS (anon no pasa las policies que exigen `auth.uid()`), pero es superficie más ancha que la política del proyecto y que lo que CLAUDE.md prescribe.
- **Fix recomendado (migración):** revocar escritura a `anon` (`REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;`) tras verificar que nada legítimo dependa de ello.

### DOC-04 (🟡 marca) — La organización de producción sigue siendo "LFi Agency"

- Fila real: `id ...0001 · name 'LFi Agency' · slug 'lfi' · plan 'pro'`.
- Contradice **ADR-011** (rebrand AGLAYA: "eliminar toda referencia a marcas anteriores"). El rebrand nunca migró la fila de la DB.
- **Fix recomendado (migración):** `UPDATE public.organizations SET name='AGLAYA', slug='aglaya' WHERE id='00000000-0000-0000-0000-000000000001';` (verificar antes que ningún cliente Supabase cachee el slug).

### DOC-05 (🟢 menor) — Divergencias de `ON DELETE` y scope RLS vs documentación previa

- `boards.workspace_id` y `workspace_members.invited_by` son **NO ACTION** en la DB real, pese a que ADR-013 documenta `SET NULL`.
- Las policies RLS de `cards`/`columns`/`categories` filtran por **organización** (`get_my_org_id()`), no por membresía de workspace. El aislamiento por workspace lo impone la capa API (`requireWorkspaceMember`; el servidor usa `service_role` que bypasa RLS).
- Documentado tal cual en `supabase-schema.sql`. Decisión de si alinear DB↔ADR o ADR↔DB queda al operador.

---

## 2026-05-27 — Audit Mariana Trench: 2 críticos detectados y mitigados

### B-CRIT-01: XSS explotable vía upload SVG (CVSS 8.0 HIGH)

**Síntoma**
- No reportado externamente — descubierto durante audit Fase B.

**Causa raíz**
- `server/routes/uploads.js`: multer aceptaba cualquier MIME (sin `fileFilter`).
- `server/app.js:77`: `app.use('/uploads', express.static(...))` público sin auth.
- `netlify.toml`: proxy `/uploads/*` → Railway desde origen `kanban.aglaya.biz`.
- Resultado: SVG con `<script>` embebido se ejecutaba same-origin al navegarse directo, exfiltrando JWT desde localStorage (vigente 7 días).

**Cadena de explotación**
- Authed user sube `evil.svg` → URL `/uploads/<uuid>.svg` → pega en card description → víctima abre en pestaña nueva → script ejecuta same-origin → JWT robado → atacante usa sesión 7 días.

**Solución aplicada (`402b0d7`)**
- 4 capas de defensa en `server/routes/uploads.js`:
  1. Extension blocklist (`svg|html?|js|mjs|swf|exe|bat|cmd|sh|ps1|vbs`)
  2. MIME blocklist (`image/svg+xml`, `text/html`, `application/xhtml+xml`, `application/javascript`, etc.)
  3. MIME allowlist (png/jpeg/webp/gif/pdf/csv/txt)
  4. Magic-bytes validation via `file-type@16.5.4`
- Error middleware en `app.js` con códigos `FILE_TYPE_FORBIDDEN` (400) + `FILE_MAGIC_MISMATCH` (400) + `FILE_TOO_LARGE` (413)
- Tests regresión `server/tests/uploads.test.js` (5 casos verde)

**Nota operativa**
- Hardening futuro pendiente (Sprint backlog): mover uploads a subdominio sandbox `uploads.kanban.aglaya.biz` (origen distinto). Estándar industria (GitHub `githubusercontent.com`).

---

### B-CRIT-02: Backup ausente + Supabase plan Free (sin PITR ni daily backups)

**Síntoma**
- No reportado externamente — descubierto durante audit Fase B + confirmación plan = Free por operador.

**Causa raíz**
- Plan Supabase Free no incluye backups gestionados ni PITR.
- 0 documentación interna de procedimiento backup en `docs/RUNBOOK.md`, `docs/SECURITY.md`, `docs/INCIDENTS.md`.
- RPO = ∞: cualquier DROP TABLE accidental, migration buggy o corruption = pérdida total no recuperable.

**Solución aplicada (`3ae6541` final tras 7 commits incrementales)**
- Workflow `.github/workflows/db-backup.yml` con cron `17 3 * * *` UTC daily + `workflow_dispatch`.
- pg_dump 17 client (server PG 17.6) via Session Pooler IPv4 (`aws-1-sa-east-1.pooler.supabase.com:5432`) — GH runners no soportan IPv6.
- Upload a Cloudflare R2 bucket `aglaya-kanban-backups-prod` (WEUR) via R2 **native API** (cfut_ Bearer token).
- Retention 30 días automática.
- Runbook `docs/runbooks/db-restore.md` con procedimientos local + prod.

**Smoke test verde**
- 10/10 tablas core preservadas, 561 filas, 37 RLS policies, 43 FK constraints.

**Notas operativas**
- 🔴 Token `aglaya-kanban-r2-bootstrap` **expira Jun 2 2026** — rotación documentada en `docs/runbooks/key-rotation.md` (D-18).
- 🟡 Sin notificación push on failure (D-08 abierto). Solo `::error::` en GH Actions log.
- 📋 Estructural pendiente: upgrade Supabase Pro $25/mo (PITR 7d + daily gestionados).

**Lecciones aprendidas**
- Cloudflare R2 tiene 2 APIs distintas:
  - **Native API:** `/accounts/{id}/r2/buckets/{b}/objects/{key}` con Bearer auth — acepta tokens `cfut_*`/`cfat_*`.
  - **S3-compatible API:** `https://<account>.r2.cloudflarestorage.com/...` con AWS Signature V4 — requiere 32-char access key. **Rechaza tokens cfut_/cfat_** con error literal "Credential access key has length 53, should be 32".
- Audit pivotó de rclone → aws-cli → boto3 → R2 native API por esta incompatibilidad.

---

### B-04 / B-11: RLS faltante en organizations table

**Síntoma**
- Latente. No explotable hoy (cliente NUNCA toca tablas Supabase directamente, verificado en audit).

**Causa raíz**
- `docs/schema/supabase-schema.sql` creaba tabla `public.organizations` sin `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Defense-in-depth violado.

**Solución aplicada**
- Migration `docs/schema/migration-organizations-rls.sql` aplicada en prod via psql:
  ```sql
  ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users see their own organization"
    ON public.organizations FOR SELECT
    USING (id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));
  ```
- `supabase-schema.sql` sincronizado como fuente de verdad.

---

### D-05: SECURITY.md documentaba estado FALSO (descubierto en Fase D)

**Síntoma**
- Versiones previas de `docs/SECURITY.md` afirmaban:
  - "Rate limiting ✅ activo" (realidad: solo en `/api/auth` — B-06).
  - "RLS activo en DB ✅" (realidad: `organizations` sin RLS — B-04).
  - "Persistencia de sesión... sessionStorage" (realidad: localStorage).

**Causa raíz**
- Documento creado 2026-04-14 cuando estado era diferente, sin sync periódica contra realidad.

**Solución aplicada**
- `docs/SECURITY.md` reescrito post-audit Mariana con marcadores explícitos por hallazgo + IDs cross-ref a `audit-B.md`.
- Sección "Hallazgos abiertos referenciados" añadida con IDs y acciones pendientes.

**Lecciones aprendidas**
- Documentación verde sobre estado amarillo es PEOR que ausencia. Induce falsa confianza.
- Process improvement: validar `SECURITY.md` cada Q + tras cualquier audit/refactor.

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
