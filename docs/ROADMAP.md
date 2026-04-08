# ROADMAP — AGLAYA Kanban Desk

**Última actualización:** 2026-04-08

---

## Phase 0 — MyBoard (origen)

**Estado:** ✅ Completada · Legacy

Aplicación Kanban personal, single-user, basada en JSON. Punto de partida del producto. Archivada como legacy; datos migrados a AGLAYA Kanban Desk en v1.1.1.

---

## Phase 1 — Multi-tenant y autenticación

**Estado:** ✅ Completada · 2026-03-19 → 2026-03-24

- Migración de almacenamiento: `tasks.json` → Supabase (PostgreSQL + RLS)
- Autenticación: Supabase Auth + JWT middleware + bcryptjs
- Jerarquía de datos: Organization → Board → Column → Card
- Roles: superadmin / admin / colaborador / cliente / guest
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

**Estado:** ✅ Completada · 2026-04-07/08 · **v1.1.0 + v1.1.1**

- Rebrand completo: LFi Kanban Desk → **AGLAYA Kanban Desk**
- Dominio: `kanban.aglaya.biz`
- Workspace types: `personal / interno / externo`
- Acceso por rol: colaborador (todo) vs cliente (solo externo)
- UI diferenciada en WorkspaceDashboard según rol de usuario
- Migración de datos desde MyBoard legacy: 7 boards, 62 cards, 10 categorías
- Fix: `'urgent'` añadido a `VALID_PRIORITIES` (bug preexistente)
- Documentación: movilidad de objetos diseñada y documentada en backlog

---

## Phase 4 — Calidad de producto y UX completa

**Estado:** 🔵 Próxima fase

### Workspace settings
- [ ] Página de ajustes de workspace: editar nombre, emoji, tipo, descripción, portada
- [ ] Cambio de tipo de workspace desde la UI (sin SQL) — documentado en backlog

### Seguridad y UX de destrucción
- [ ] Confirmación doble al borrar tarjetas (diálogo de confirmación)
- [ ] Confirmación al borrar tableros y columnas

### Email
- [ ] User digest: email diario personal con tarjetas urgentes/vencidas del usuario, segmentado por tipo de workspace (personal / interno / clientes)
- [ ] Verificación end-to-end del flujo de invitación (email → registro → acceso a workspace)

### Movilidad de objetos *(diseñado, pendiente de implementar)*
- [ ] Mover tablero entre workspaces
- [ ] Mover tarjeta entre tableros (cross-board desde el modal)

### Tests
- [ ] Actualizar suite `auth.test.js` para cubrir nuevo sistema sin restricción de dominio
- [ ] Tests para rutas de workspaces con tipos `personal/interno/externo`

---

## Phase 5 — Escala y colaboración

**Estado:** 📋 Por definir

- Notificaciones in-app (cambios en tarjetas asignadas)
- Actividad / audit log por workspace
- Límites freemium (máx. boards/cards en plan free)
- Búsqueda global unificada (cross-workspace)
- Operaciones en lote sobre tarjetas
- Deprecación definitiva de MyBoard (apagar servidor, archivar repo)
