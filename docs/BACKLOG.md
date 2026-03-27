# BACKLOG — LFi Kanban Desk (MyBoardLFi)

Registro granular de tareas por fase. Actualizar al completar o añadir ítems.

---

## Phase 0 — Limpieza y preparación *(En curso)*

- [x] Backup de `tasks.json` original → `tasks.personal-backup.json`
- [x] Limpiar datos personales de `tasks.json`
- [x] Cargar dummy data corporativa (5 tableros, 30+ tarjetas, 8 categorías)
- [x] Borrar archivos en `server/uploads/` (adjuntos personales)
- [x] Borrar `estrategia.ibaifernandez.com.md` de la raíz
- [x] Limpiar `.env` — eliminar credenciales personales, añadir `PORT=3003`
- [x] Actualizar `.claude/launch.json` → puertos 3003/5175
- [x] Actualizar `client/vite.config.js` → puerto 5175, proxy a 3003
- [x] Actualizar `server/index.js` → `PORT = process.env.PORT || 3003`
- [x] Reescribir `CLAUDE.md` con contexto MyBoardLFi
- [x] Reescribir `AGENTS.md` con contexto MyBoardLFi
- [x] Reescribir `README.md` orientado a gerencia LFi + equipo técnico
- [x] Reescribir `docs/ROADMAP.md` con 4 fases corporativas
- [x] Reescribir `docs/BACKLOG.md`
- [x] Reescribir `docs/ARCHITECTURE.md` con visión Phase 1+
- [x] Reescribir `docs/DECISIONS.md` con decisiones LFi
- [x] Reescribir `docs/PRODUCT.md` orientado a stakeholders LFi
- [x] Añadir entrada en `docs/CHANGELOG.md` — Sesión 0

---

## Phase 1 — Multi-tenant y autenticación *(En curso)*

### Base de datos ✅
- [x] Diseño del esquema completo en Supabase: `organizations`, `users`, `boards`, `columns`, `cards`, `categories`
- [x] Crear proyecto en Supabase (`myboardlfi`, región São Paulo, plan free)
- [x] Ejecutar schema SQL inicial con RLS activado
- [x] Insertar organización LFi Agency como tenant base

### Autenticación ✅
- [x] Integrar Supabase Auth + cliente admin en servidor
- [x] Endpoint `POST /api/auth/register` (con validación de dominio corporativo)
- [x] Endpoint `POST /api/auth/login`
- [x] Endpoint `GET /api/auth/me`
- [x] Middleware `requireAuth` (JWT) para rutas protegidas
- [x] Middleware `requireRole(...roles)` para rutas por rol
- [x] Restricción de dominio: solo `@lfi.la` y `@lafabricaimaginaria.com`
- [x] Usuario superadmin creado: `ibai@lfi.la`

### Frontend — Autenticación ✅
- [x] `AuthContext` con token + user en localStorage
- [x] Pantalla de login con logo LFi y validación de dominio
- [x] Flujo "Olvidé mi contraseña" integrado (Supabase Auth)
- [x] Página `/reset-password` para restablecimiento de contraseña
- [x] Interceptor JWT en `api/client.js`
- [x] Gate de autenticación en `App.jsx`
- [x] Avatar + nombre de usuario + logout en Toolbar

### Branding ✅
- [x] Logo LFi en login, sidebar y reset de contraseña
- [x] Email digest rebrandeado a LFi Kanban Desk
- [x] Display name «LFi Kanban Desk» en toda la UI (sesión 6)

### Email ✅ (parcial)
- [x] Endpoint `POST /api/digest/send-me` (requiere auth)
- [x] Botón "Enviarme mis tareas" en Toolbar con feedback visual
- [x] SMTP funcional (Migadu provisional)
- [ ] ⚠️ Migrar SMTP a Resend (`lafabricaimaginaria.com`) — pendiente Fernando Murillo
- [ ] Templates de email Supabase personalizados (reset password, invite)

### Seguridad
- [x] Claves Supabase service_role solo en servidor
- [x] Validación de dominio en doble capa (frontend + servidor)
- [x] Security headers HTTP (helmet — activado en `server/index.js`)
- [ ] Auditoría completa de superficie de ataque

### Multi-tenancy
- [ ] Migrar rutas boards/columns/cards de `tasks.json` → Supabase
- [ ] Filtrar datos por `organizationId` en todas las queries
- [ ] Endpoint `POST /api/organizations`
- [ ] Endpoint `GET /api/organizations/:id/members`

### Roles y permisos
- [ ] Permisos por tablero: owner / editor / viewer
- [ ] Panel de administración (crear/gestionar usuarios)

### Freemium
- [ ] Middleware de límites: máx. 3 tableros y 50 tarjetas en plan free
- [ ] UI de aviso cuando se alcanza el límite

### QA y documentación
- [x] `docs/QA-DESKTOP.md` — checklist funcional desktop
- [x] `docs/QA-MOBILE.md` — checklist mobile
- [x] `docs/README-deploy.md` — instrucciones de deploy

---

## Phase 2 — Workspaces *(Completada — 2026-03-24/25)*

### Backend ✅
- [x] `server/routes/workspaces.js` — CRUD workspaces + gestión de miembros (9 endpoints)
- [x] `server/middleware/workspace.js` — requireWorkspaceMember + requireWorkspaceRole
- [x] RLS en Supabase con funciones SECURITY DEFINER (`get_workspace_role`, `is_workspace_member`)
- [x] Fix 504 en Railway: digest fire-and-forget
- [x] `GET /api/workspaces` enriquece con memberCount + boardCount reales

### Frontend ✅
- [x] WorkspaceDashboard con grid de tarjetas, mini-kanban abstracto, counts reales
- [x] WorkspaceMembers — panel lateral gestión de miembros + roles
- [x] Breadcrumb espacio de trabajo → tablero en Toolbar
- [x] Hooks useWorkspaces, useBoards (con workspaceId)
- [x] 10 métodos nuevos en api/client.js

### UX/Branding ✅
- [x] Renombrado workspace → espacio de trabajo en toda la UI
- [x] Logo LFi en header del WorkspaceDashboard
- [x] Botón Admin eliminado del WorkspaceDashboard
- [x] Mini-kanban abstracto decorativo en tarjetas (seed desde ws.id)

### Pendiente de Phase 2
- [x] KNOWN-02: Email de invitación — template LFi configurado en Supabase Auth + URL de redirección correcta (2026-03-27)

---

## Sub-fase 2.1: Supabase Storage + Identidad visual *(Completada — 2026-03-27)*

### Supabase Storage ✅
- [x] SQL migrations: `users.avatar_url`, `workspaces.cover_url`, `workspaces.type`
- [x] Bucket `media` (público, 5 MB), RLS policies para INSERT/UPDATE/SELECT
- [x] Endpoint `POST /api/media/users/me/avatar` — upload + actualiza `users.avatar_url`
- [x] Endpoint `POST /api/media/workspaces/:id/cover` — upload + actualiza `workspaces.cover_url`

### Foto de perfil ✅
- [x] Avatar con foto real en Toolbar (fallback a inicial)
- [x] Click en avatar → file picker → upload inmediato
- [x] `GET /api/auth/me` devuelve `avatarUrl` fresco desde DB

### Portada visual de espacios de trabajo ✅
- [x] WorkspaceDashboard: cover image si existe, mini-kanban si no
- [x] Botón cámara al hover sobre tarjeta (solo admins/owners)

### Tipo de espacio de trabajo ✅
- [x] Campo `type`: `'cliente'` | `'departamento'` | `'general'`
- [x] Selector en modal de creación (botones)
- [x] Badge TypeBadge en cada tarjeta de workspace
- [x] Filtro por tipo — tabs en WorkspaceDashboard

---

## Backlog — Sub-fase 2.2: Alertas automáticas (sugerencia Bani #4)

Cron job que envía email de alerta dos veces al día con tarjetas prioritarias / con vencimiento próximo.

### Decisiones de diseño pendientes
- ¿Destinatario? → El responsable de cada tarjeta (`assignee_id`), no el admin
- ¿Ventana de alerta? → Configurable, default 72h
- ¿Frecuencia? → 2 veces/día, horas configurables (ej. 09:00 y 17:00)
- ¿Scope? → Por workspace (cada workspace puede tener destinatarios distintos)

### Componentes necesarios
- [ ] Tabla `alert_subscriptions` (o configuración en `workspaces`): `alert_hours`, `alert_window_hours`, `alert_enabled`
- [ ] Endpoint `POST /api/alerts/send` (protegido, solo admin/superadmin o cron key)
- [ ] `server/digest-alerts.js` — construye y envía el email de alerta: filtra tarjetas con `due_date <= NOW() + alert_window_hours` y `assignee_id IS NOT NULL`
- [ ] Cron en Railway (o cron en Node con `node-cron`) que llama al endpoint dos veces al día
- [ ] Template de email: lista de tarjetas con responsable, fecha y prioridad

### Bloqueantes
- Requiere que `assignee_id` esté en uso (Sub-fase 2.1 completada)
- Requiere acordar scope exacto con Bani/Ibai antes de implementar

---

## Backlog — Features futuras (sin fase asignada)

- [ ] **Permisos por tablero**: owner / editor / viewer (dentro de un workspace, acceso diferenciado por tablero — Phase 1+, no bloquea v1.0)
- [ ] **Notificaciones in-app**: alertas de cambios en tarjetas asignadas
- [ ] **Migración multi-tenant completa**: boards/columns/cards filtrar por organizationId en todas las queries
- [ ] **Límites freemium**: middleware (máx. 3 tableros / 50 tarjetas en plan free)
- [ ] **KNOWN-02**: Email de invitación Supabase — template personalizado + redirect URL correcta

---

## Phase 3 — Pitch interno a LFi *(Por definir)*

- [ ] Demo funcional verificada en producción (myboardlfi.ibaifernandez.com)
- [ ] Deck de presentación (5–6 slides)
- [ ] Propuesta comercial redactada
- [ ] Reunión con Héctor Vera e Iván Colodro
- [ ] Reunión con Daniel y Marco

---

## Phase 4 — Deploy en PRONODO *(Pendiente de Phase 3)*

- [ ] `Dockerfile` para el server Express
- [ ] `Dockerfile` para el client (build Vite + nginx)
- [ ] `docker-compose.yml` (server + client + proxy)
- [ ] Acordar dominio con Fernando Murillo (PRONODO)
- [ ] Configurar HTTPS / SSL
- [ ] CI/CD básico (GitHub Actions)
