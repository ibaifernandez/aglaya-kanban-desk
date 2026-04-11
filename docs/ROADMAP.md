# ROADMAP — AGLAYA Kanban Desk

**Última actualización:** 2026-04-11

---

## Phase 0 — AGLAYA Prototipo (origen)

**Estado:** ✅ Completada · Legacy

Aplicación Kanban personal, single-user, basada en JSON. Punto de partida del producto. Archivada como legacy; datos migrados a AGLAYA Kanban Desk en v0.9.0.0 (Rama Estabilización).

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
- Roles por workspace: owner / admin / colaborador / cliente
- RLS con funciones `SECURITY DEFINER` para evitar recursión
- WorkspaceDashboard: grid de tarjetas, mini-kanban generativo, counts reales
- WorkspaceMembers: panel lateral de gestión de roles
- Navegación: breadcrumb, History API, sessionStorage persistente
- Asignación de responsable por tarjeta + filtros
- Foto de perfil y portada de workspace (Supabase Storage)

---

## Phase 3 — Rebrand AGLAYA + Migración de datos

**Estado:** ✅ Completada · 2026-04-07/11 · **v0.9.0.0 (Rama AGLAYA)**

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

**Estado:** 🔵 En curso · v1.0.0 (Lanzamiento)

### Workspace settings
- [x] Botón editar visible al hover + preservación del tipo real al editar — `bbd0b8a`
- [x] Aviso al cambiar workspace a tipo `externo` (visibilidad para clientes) — `bbd0b8a`
- [ ] Página de ajustes de workspace: editar nombre, emoji, tipo, descripción, portada
- [ ] Cambio de tipo de workspace desde la UI (sin SQL) — documentado en backlog

### Seguridad y UX de destrucción
- [x] Confirmación al borrar tarjetas (diálogo inline en CardModal) — `7a4e504`
- [x] Confirmación al borrar columnas (modal en Board) — `7a4e504`

### Email
- [x] User digest: email diario personal con tarjetas urgentes/vencidas, segmentado por workspace — `a6d45ee`
- [ ] Verificación end-to-end del flujo de invitación (email → registro → acceso a workspace)

### Movilidad de objetos
- [x] Mover tablero entre workspaces (BoardMoveModal + backend) — `90f4c4f`
- [ ] Mover tarjeta entre tableros (cross-board desde el modal)

### Tests
- [x] Reimplementar restricción de dominio corporativo en backend (`v0.9.0.0`)
- [ ] Actualizar suite `auth.test.js` para cubrir sistema de dominios autorizados
- [ ] Tests para rutas de workspaces con tipos `personal/interno/externo`

---

## Phase 5 — Escala y colaboración

**Estado:** 📋 Por definir

- Notificaciones in-app (cambios en tarjetas asignadas)
- Actividad / audit log por workspace
- Límites freemium (máx. boards/cards en plan free)
- Búsqueda global unificada (cross-workspace)
- Operaciones en lote sobre tarjetas
- Deprecación definitiva del prototipo legacy (apagar servidor, archivar repo)
