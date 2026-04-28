# Handoff: Menciones en checklist + Notificaciones in-app + Tests Phase 4

## Session Metadata
- Created: 2026-04-28 12:09:55
- Project: /Users/AGLAYA/Local Sites/aglaya-kanban-desk
- Branch: main
- Session duration: ~6 horas (estabilización + flujo invite + cross-board)

### Recent Commits (for context)
  - 86d7e0d docs: actualizar CHANGELOG con toast cross-board y verificaciones completadas
  - 95ee2a8 feat: toast de confirmación al mover tarjeta cross-board desde CardModal
  - d10bc73 docs: verificación flujo invite completada — SPF/DKIM/DMARC PASS
  - 98e9e74 fix: flujo invite usa inviteUserByEmail + Resend SMTP de Supabase
  - 18a0066 fix: flujo de invitación usa generateLink + Resend en lugar de resetPasswordForEmail

## Handoff Chain

- **Continues from**: None (esta sesión cubre estabilización, invite, cross-board)
- **Supersedes**: None

## Current State Summary

La sesión completó tres grandes bloques: (1) estabilización del sistema de digest con Resend, (2) corrección definitiva del flujo de invitación (inviteUserByEmail + SMTP Supabase → Resend, SPF/DKIM/DMARC PASS verificados), y (3) confirmación y mejora UX del mover tarjetas cross-board/cross-workspace desde CardModal (el feature ya estaba implementado — se añadió toast de confirmación). Al final de la sesión se diseñó el siguiente feature a implementar: asignaciones por ítem de checklist con sistema de notificaciones in-app, pendiente de ejecutar en un hilo dedicado.

## Codebase Understanding

### Architecture Overview

- **Stack**: Express (puerto 3003) + React/Vite (puerto 5175). Railway (server) + Netlify (client) en producción.
- **Auth**: JWT propio generado por el backend al hacer login con Supabase. Almacenado en `sessionStorage` como `aglaya_kanban_token`. El JWT incluye `id`, `email`, `role`, `organizationId`.
- **Email**: Resend SDK (`server/utils/mailer.js`). Supabase Auth también envía via Resend (SMTP configurado: smtp.resend.com:465, usuario: resend, sender: info@aglaya.biz).
- **Multi-tenant**: organización → workspaces → tableros → columnas → tarjetas. Roles: superadmin / admin / colaborador / cliente (global). owner / admin / member / guest (workspace-level).
- **Digest**: node-cron dispara a la hora configurada por `DIGEST_HOUR/DIGEST_MINUTE` (admin digest) y `USER_DIGEST_HOUR/USER_DIGEST_MINUTE` (user digest). Todo en `server/routes/digest.js`.

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `server/routes/cards.js` | CRUD y move de tarjetas | Aquí se añadirá la lógica de crear notificaciones al guardar |
| `server/routes/digestRoute.js` | Digest admin y user | Añadir sección de asignaciones pendientes en checklist |
| `server/utils/mailer.js` | Envío de email via Resend | Ya funciona, no modificar |
| `server/utils/supabase.js` | Clientes Supabase (public + admin) | `createAdminClient()` para operaciones privilegiadas |
| `server/middleware/auth.js` | `requireAuth`, `requireRole`, `requireWorkspaceMember` | Middleware de auth para rutas nuevas |
| `client/src/components/CardModal/CardModal.jsx` | Modal de edición de tarjetas | Añadir multi-select de asignados por ítem checklist |
| `client/src/components/Toolbar/Toolbar.jsx` | Barra de navegación superior | Añadir campana de notificaciones |
| `client/src/api/client.js` | Capa API del frontend | Añadir endpoints de notificaciones |
| `client/src/hooks/useBoardData.js` | Hook de datos del tablero | `moveCard` ya maneja cross-board correctamente |
| `docs/schema/supabase-schema.sql` | Schema de la BD | Referencia para crear tabla `notifications` |
| `docs/CHANGELOG.md` | Historial de cambios | Actualizar al terminar |
| `docs/INCIDENTS.md` | Registro de incidencias | Actualizar si hay bugs relevantes |
| `CLAUDE.md` | Instrucciones de sesión | Leer siempre al inicio; actualizar checklist Phase 4 al terminar |

### Key Patterns Discovered

- **Supabase admin client**: usar siempre `createAdminClient()` (fresh per-request) para operaciones privilegiadas. NUNCA el singleton global para escrituras.
- **API responses**: `request()` en `client.js` extrae `json.data` automáticamente. Todas las rutas deben responder `{ data: ... }` o `{ error: ... }`.
- **toCard mapper**: `server/routes/cards.js` tiene `toCard(row)` que mapea columnas snake_case a camelCase. Cualquier campo nuevo en la tabla `cards` debe añadirse aquí.
- **Checklist items**: actualmente `{ id, text, done }` almacenados como JSONB en `cards.checklist`. Extensión: `{ id, text, done, assignees: [] }`.
- **Idioma**: código en inglés, commits y documentación en español.
- **Puertos**: 3003 (server) y 5175 (client). No cambiar nunca.

## Work Completed

### Tasks Finished

- [x] Estabilización digest: `validateSmtpConfig()` actualizado para Resend, `validateDigestSchedules()` corregido (hora Y minuto)
- [x] Iteraciones 1 y 2 del digest completadas y verificadas
- [x] Flujo invite corregido: `inviteUserByEmail` atómico + SMTP Supabase → Resend
- [x] Email de invitación verificado end-to-end: SPF/DKIM/DMARC PASS, sender correcto, `type=invite` en URL
- [x] Cross-board card move desde CardModal: feature ya implementado, añadido toast de confirmación
- [x] CLAUDE.md actualizado (items Phase 4 marcados)
- [x] CHANGELOG y INCIDENTS actualizados

### Files Modified (esta sesión)

| File | Changes | Rationale |
|------|---------|-----------|
| `server/utils/smtpConfig.js` | Validación Resend en lugar de SMTP clásico | Variables SMTP eliminadas en Railway |
| `server/routes/admin.js` | `inviteUserByEmail` en lugar de `resetPasswordForEmail` | Invite atómico y correcto |
| `client/src/App.jsx` | Detección `type=invite` en hash | Mostrar pantalla correcta al activar cuenta |
| `client/src/pages/ResetPasswordPage.jsx` | Prop `isInvite`, eventos Supabase diferenciados | UX correcta post-invite |
| `client/src/components/Board/Board.jsx` | Toast cross-board, estado `crossBoardMsg` | Feedback visual al mover tarjeta |
| `client/src/components/CardModal/CardModal.jsx` | `targetBoardTitle` en payload de onSave | Alimenta el toast con nombre real |
| `client/src/index.css` | Keyframe `fade-in-up` | Animación del toast |
| `CLAUDE.md` | Checkboxes Phase 4 actualizados | Documentación de estado real |
| `docs/CHANGELOG.md` | Secciones [Unreleased] completas | Registro de cambios |
| `docs/INCIDENTS.md` | Nuevas incidencias 2026-04-28 | Registro histórico |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Asignaciones en checklist: campo explícito `assignees[]` | Textual @mention en texto del ítem | Más robusto, no requiere parseo, encaja con patrón `assigneeId` existente. Se puede pivotar a textual si el usuario no lo adopta. |
| `"__all__"` como token especial para "todos" | Expandir a IDs en el momento de guardar | Si entran nuevos miembros, también les llega |
| Notificaciones: in-app (campana) + digest | Email inmediato | Email inmediato genera demasiados envíos. In-app cubre la urgencia, digest cubre el seguimiento |
| Sin sistema de comentarios por ahora | — | Deferido a versión futura; documentar en ROADMAP |

## Pending Work — EL TRABAJO DEL PRÓXIMO HILO

## Immediate Next Steps

1. **Schema Supabase** — crear tabla `notifications`:
   ```sql
   CREATE TABLE notifications (
     id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     type        TEXT NOT NULL,  -- 'checklist_mention'
     payload     JSONB NOT NULL, -- { cardId, cardTitle, boardId, workspaceId, checklistText, mentionedBy }
     read        BOOLEAN NOT NULL DEFAULT false,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   -- RLS: cada usuario solo ve sus propias notificaciones
   ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "notifications_owner" ON notifications FOR ALL USING (user_id = auth.uid());
   ```

2. **Backend — rutas de notificaciones** (crear `server/routes/notifications.js`, nuevo archivo):
   - `GET /api/notifications` — lista no leídas del usuario autenticado
   - `PATCH /api/notifications/:id/read` — marcar leída
   - `PATCH /api/notifications/read-all` — marcar todas leídas
   - Registrar en `server/index.js`

3. **Backend — crear notificaciones al guardar tarjeta** (`server/routes/cards.js`, `updateCard`):
   - Comparar `checklist` anterior con nuevo para detectar `assignees` recién añadidos
   - Para cada usuario nuevo en `assignees` (resolviendo `"__all__"` al listado de workspace members), insertar en `notifications`

4. **CardModal** — UI de asignación por ítem:
   - Cada ítem del checklist muestra avatares/iniciales de sus asignados
   - Click en ítem → aparece mini-dropdown con workspace members + opción "Todos"
   - Estado gestionado en `form.checklist[].assignees`

5. **Toolbar** — campana de notificaciones:
   - Icono `Bell` (lucide-react) con badge de count no leídas
   - Polling cada 45 s con `api.getNotifications()`
   - Click → dropdown con lista de notificaciones; click en cada una navega a la tarjeta (si hay routing directo) o cierra el dropdown
   - "Marcar todas como leídas" en el footer del dropdown

6. **Digest** — sección de asignaciones pendientes:
   - En `server/routes/digestRoute.js`, función de user digest: añadir query de checklist items con `assignees @> [userId]` OR `assignees @> ["__all__"]`
   - Sección "Tus asignaciones pendientes" antes de "Tarjetas urgentes/vencidas"

7. **Tests Phase 4** (cierre):
   - `server/tests/auth.test.js` — restricción de dominio en registro, sin restricción en login
   - `server/tests/workspaces.test.js` — tipos personal/interno/externo, coerción por rol

### Blockers/Open Questions

- [ ] La tabla `notifications` requiere aplicar la migración en Supabase Dashboard (no hay sistema de migraciones automáticas en este proyecto — se aplican manualmente como SQL en el editor de Supabase)
- [ ] ¿Routing directo a tarjeta desde notificación? Actualmente no hay rutas URL por tarjeta. La notificación puede llevar al workspace/board y dejar el modal cerrado. Discutir con el usuario.
- [ ] ¿Qué pasa con asignaciones cuando se borra un miembro del workspace? Decidir si limpiar `assignees` o dejar huérfano (recomendado: dejar huérfano y filtrar al mostrar).

### Deferred Items

- Sistema de comentarios/actividad en tarjeta → documentar en ROADMAP como Phase 6
- Menciones textuales `@nombre` en descripción → posible pivot si el usuario no adopta la UI explícita
- Email inmediato al ser mencionado → posible en Phase 6 con estrategia de debounce/batch
- Auto-login tras invite (el usuario va al login en lugar del dashboard tras configurar contraseña) → spawned como background task en sesión anterior, bajo prioridad

## Context for Resuming Agent

## Important Context

- **LEER SIEMPRE** `docs/ARCHITECTURE.md` antes de implementar cualquier feature
- **Puertos**: server=3003, client=5175. Nunca cambiar.
- **El usuario es Ibai Fernández** (info@ibaifernandez.com), director de AGLAYA. Idioma de comunicación: español.
- La funcionalidad de **mover tarjeta cross-board ya existe** y funciona correctamente. El feature nuevo de este hilo es completamente distinto.
- El proyecto ya tiene **Supabase Realtime disponible** (se usa via `@supabase/supabase-js` en el cliente). Para notificaciones se puede usar polling (más simple) o Realtime subscriptions. Empezar con polling, pivotar a Realtime si el usuario lo pide.
- **No hay migraciones automáticas**: el schema de Supabase se aplica manualmente en el Dashboard → SQL Editor. Proporcionar el SQL exacto al usuario para que lo ejecute.
- El campo `checklist` en la tabla `cards` es JSONB. La extensión de `assignees` por ítem NO requiere cambio de schema en `cards`, solo en el código que lee/escribe el JSONB.
- **Workspace members** se obtienen via `GET /api/workspaces/:id/members` que devuelve `{ data: [{ user: { id, name, email }, role }] }`. En el CardModal ya se reciben como prop `workspaceMembers`.

### Assumptions Made

- El usuario acepta la UX explícita (multi-select) para asignaciones en checklist. Si no le gusta, pivotar a menciones textuales.
- Polling cada 45 s es suficiente para notificaciones in-app (no se necesita push real-time de inmediato).
- Un usuario puede tener notificaciones de múltiples workspaces en la misma campana.

### Potential Gotchas

- El `updateCard` en backend (`server/routes/cards.js`) actualmente NO persiste `attachments` (hay un campo JSONB en la tabla pero el handler no lo lee/escribe). Bug pre-existente, no tocar en este hilo.
- El client-side `useBoardData.updateCard` actualiza el estado local con la respuesta del backend. Si el backend devuelve el checklist sin `assignees`, el estado local perderá las asignaciones. Asegurarse de que `toCard()` incluya el nuevo campo y que el backend lo devuelva.
- `"__all__"` debe resolverse en el backend al momento de crear notificaciones, consultando `workspace_members` para el workspace del board. No almacenar la expansión en el campo `assignees`.
- El dropdown de la campana debe cerrar con `Escape` (ya hay un hook `useEscapeKey` en `client/src/hooks/useEscapeKey.js`).

## Environment State

### Tools/Services Used

- **Railway**: servidor Express en producción (kanban.aglaya.biz apunta a Netlify, que sirve el cliente; la API está en railway)
- **Netlify**: cliente React/Vite en producción
- **Supabase**: base de datos + auth + storage. Proyecto: "AGLAYA Kanban Desk"
- **Resend**: envío de emails desde info@aglaya.biz (dominio aglaya.biz verificado)

### Active Processes

- Server local: puerto 3003 (arrancar con preview_start "AGLAYA Kanban Desk Server")
- Client local: puerto 5175 (arrancar con preview_start "AGLAYA Kanban Desk Client")

### Environment Variables (nombres, sin valores)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `SMTP_FROM`, `JWT_SECRET`, `SITE_URL`, `TZ`, `DIGEST_HOUR`, `DIGEST_MINUTE`, `USER_DIGEST_HOUR`, `USER_DIGEST_MINUTE`, `USER`, `PASS`

## Related Resources

- `docs/ARCHITECTURE.md` — leer antes de implementar
- `docs/ROADMAP.md` — estado de fases y backlog
- `docs/CHANGELOG.md` — añadir entradas al terminar
- `docs/INCIDENTS.md` — registrar bugs relevantes
- `docs/schema/supabase-schema.sql` — schema de referencia
- `CLAUDE.md` — instrucciones de sesión (puertos, reglas, backlog)

---

## BRIEFING DEL USUARIO (añadido al handoff)

El usuario (Ibai, director de AGLAYA) ha descrito el feature así:

> La jerarquía es: la tarjeta tiene un **responsable** (un único propietario, ya existe como `assigneeId`). Las tareas de la checklist son las que pueden tener asignaciones específicas. Ejemplo:
>
> ```
> Ley 21.719
>   1. Repaso del copy de la página de inicio — @Mavi
>   2. Testeo completo de la UX — @Món @Mavi
>   3. Conseguir 20 empresas que quieran probar de gratis — @todos
> ```
>
> El responsable de la tarjeta sigue siendo Ibai. Cada ítem del checklist puede tener cero, uno, varios o todos los miembros del workspace.

**Notificaciones decididas:**
- ✅ In-app (campana) — prioritario
- ✅ Digest diario — integrar en sección "Tus asignaciones pendientes"
- ❌ Email inmediato — descartado (demasiados envíos; posible en Phase futura con debounce)
- ❌ Sistema de comentarios — deferido a versión futura

**UX de asignación:** campo explícito (multi-select) en cada ítem del checklist, NO menciones textuales en el texto. Si el usuario no lo adopta, pivotar a textual (tipo Trello `@nombre`).

**Cierre del hilo:** tras implementar el feature completo, cerrar Phase 4 con los tests pendientes (`auth.test.js` y `workspaces.test.js`).

---

**Security Reminder**: documento revisado — no contiene secretos ni valores de variables de entorno.
