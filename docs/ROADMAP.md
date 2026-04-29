# ROADMAP — AGLAYA Kanban Desk

**Última actualización:** 2026-04-29

---

## Phase 0 — AGLAYA Prototipo (origen)

**Estado:** ✅ Completada · Legacy

Aplicación Kanban personal, single-user, basada en JSON. Punto de partida del producto. Archivada como legacy; datos migrados a AGLAYA Kanban Desk en v1.1.0.0 (Rama Estabilización).

---

## Phase 1 — Multi-tenant y autenticación

**Estado:** ✅ Completada · 2026-03-19 → 2026-03-24

- Migración de almacenamiento: `tasks.json` → Supabase (PostgreSQL + RLS)
- Autenticación: Supabase Auth + JWT middleware + bcryptjs
- Jerarquía de datos: Organization → Board → Column → Card
- Roles: superadmin / admin / colaborador / cliente
- Email digest de administrador (estadísticas globales, node-cron)
- Seguridad: Helmet, rate limiting, CORS por entorno, RLS en todas las tablas
- Suite de tests: Jest + Supertest, 26 tests en 4 suites
- Deploy: Netlify (cliente) + Railway (servidor)

---

## Phase 2 — Workspaces (multi-tenant avanzado)

**Estado:** ✅ Completada · 2026-03-24/25

- Jerarquía ampliada: Organization → **Workspace** → Board → Column → Card
- Roles por workspace: owner / admin / member / guest
- RLS con funciones `SECURITY DEFINER` para evitar recursión
- WorkspaceDashboard: grid de tarjetas, mini-kanban generativo, counts reales
- WorkspaceMembers: panel lateral de gestión de roles
- Navegación: breadcrumb, History API, sessionStorage persistente
- Asignación de responsable por tarjeta + filtros
- Foto de perfil y portada de workspace (Supabase Storage)

---

## Phase 3 — Rebrand AGLAYA + Migración de datos

**Estado:** ✅ Completada · 2026-04-07/11 · **v1.1.0.0 (Rama AGLAYA)**

- Rebrand completo: Marca anterior -> **AGLAYA Kanban Desk**
- Dominio: `kanban.aglaya.biz`
- Workspace types: `personal / interno / externo`
- Acceso por rol: colaborador (todo) vs cliente (solo externo/asignado)
- UI diferenciada en WorkspaceDashboard según rol de usuario
- Migración de datos desde el prototipo legacy: 7 boards, 62 cards, 10 categorías
- Fix: `'urgent'` añadido a `VALID_PRIORITIES` (bug preexistente)
- Documentación: movilidad de objetos diseñada y documentada en backlog

---

## Phase 4 — Calidad de producto y UX completa

**Estado:** ✅ Completada · 2026-04-28/29 · **v1.3.x**

### Workspace settings
- [x] Botón editar visible al hover + preservación del tipo real al editar — `bbd0b8a`
- [x] Aviso al cambiar workspace a tipo `externo` (visibilidad para clientes) — `bbd0b8a`
- [x] Página de ajustes de workspace: editar nombre, emoji, tipo, descripción, portada — modal completo funcional
- [x] Cambio de tipo de workspace desde la UI (sin SQL) — selector de tipo en modal

### Seguridad y UX de destrucción
- [x] Confirmación al borrar tarjetas (diálogo inline en CardModal) — `7a4e504`
- [x] Confirmación al borrar columnas (modal en Board) — `7a4e504`
- [x] **Estabilización de RLS**: Blindaje de backend con `freshAdmin` para evitar colisiones de identidad en workspaces — `v1.1.5`

### Email y notificaciones
- [x] User digest: email diario personal con tarjetas urgentes/vencidas, segmentado por workspace — `a6d45ee`
- [x] Verificación end-to-end del flujo de invitación (email → registro → acceso a workspace)
- [x] Asignaciones por ítem de checklist con selector de miembros y opción "Todos"
- [x] Notificaciones in-app: tabla `notifications`, rutas GET/PATCH, campana con polling 45 s y badge
- [x] Campana global: visible en lista de workspaces y dentro de tableros (`NotificationBell` componente)
- [x] Sección "Tus asignaciones pendientes" en el user digest

### Movilidad de objetos
- [x] Mover tablero entre workspaces (BoardMoveModal + backend) — `90f4c4f`
- [x] Mover tarjeta entre tableros (cross-board desde el modal) — opción "Mover a tablero"

### Tests
- [x] Suite `auth.test.js`: restricción de dominio en registro, no restricción en login
- [x] Suite `workspaces.test.js`: tipos `personal/interno/externo` y permisos por rol
- [x] Suite `notifications.test.js`: 16 tests cubriendo los tres endpoints

### Ingeniería y calidad de código
- [x] `cards.category` migrada de TEXT a UUID FK con `ON DELETE SET NULL` (ADR-021)
- [x] 7 índices de BD en columnas de alta frecuencia (ADR-022)
- [x] Global error handler + 404 JSON en Express (ADR-023)
- [x] Separación `server/app.js` / `server/index.js` (ADR-024)
- [x] ADR-020: single-tenant intencional con roadmap de multi-org documentado

---

## Phase 5 — Escala y colaboración

**Estado:** 📋 Por definir

- Sandbox público de demostración — accesible desde `aglaya.biz/proof/kanban-desk/`
  - Auto-login como usuario demo (sin registro)
  - Datos precargados: workspace, tableros, tarjetas y checklists representativos
  - Sin persistencia: token en `sessionStorage` → cerrar pestaña = sesión muerta
  - Org/Supabase aislado exclusivamente para sandbox + cron de reset horario
  - Deploy independiente (Railway + Supabase separados de producción)
- Actividad / audit log por workspace
- Límites freemium (máx. boards/cards en plan free)
- Operaciones en lote sobre tarjetas
- Multi-organización: GUI de gestión de orgs para superadmin (fontanería en BD ya lista — ver ADR-020)
- Deprecación definitiva del prototipo legacy (apagar servidor, archivar repo)
