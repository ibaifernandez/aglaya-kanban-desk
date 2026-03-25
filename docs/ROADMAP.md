# LFi Kanban Desk — Roadmap de desarrollo

**Última actualización:** 2026-03-25

---

## Phase 0 — Limpieza y preparación

**Estado:** ✅ Completada
**Semana:** 18/03/2026

### Objetivos
- Eliminar todos los datos personales de Ibai del repositorio
- Cargar dummy data corporativa verosímil para LFi
- Actualizar puertos a 3003 (server) y 5175 (client)
- Reescribir toda la documentación con contexto corporativo
- Establecer las bases para el desarrollo de Phase 1

### Entregables
- [x] Backup de `tasks.json` original
- [x] Dummy data corporativa en `tasks.json` (5 tableros, 30+ tarjetas)
- [x] Archivos personales eliminados (uploads, estrategia.md, .env)
- [x] Puertos actualizados (3003/5175)
- [x] CLAUDE.md, AGENTS.md, README.md reescritos
- [x] ROADMAP.md, BACKLOG.md, ARCHITECTURE.md, DECISIONS.md, PRODUCT.md reescritos

---

## Phase 1 — Multi-tenant y autenticación

**Estado:** ✅ Completada (2026-03-19 → 2026-03-24)

### Objetivos
- Convertir la aplicación de single-user a multi-tenant
- Implementar autenticación segura con JWT
- Migrar el almacenamiento de JSON a base de datos real
- Establecer sistema de roles y permisos

### Funcionalidades
- Sistema de login y registro con Supabase Auth
- Endpoints `/api/auth/login` y `/api/auth/register`
- Middleware de autenticación JWT en todas las rutas protegidas
- Campo `organizationId` en boards y cards (aislamiento por tenant)
- Roles: superadmin / admin / colaborador / cliente / guest
- Permisos por tablero: owner / editor / viewer
- Panel de administración: gestión de usuarios y roles
- Límites freemium: Free (3 tableros, 50 tarjetas, sin colaboradores) vs. Pro (sin límites)
- Migración completa de `tasks.json` a Supabase

### Tablas de base de datos (Supabase/PostgreSQL)
- `organizations` — tenants
- `users` — vinculados a Supabase Auth
- `memberships` — relación usuarios ↔ organizaciones + rol
- `boards` — con `organization_id`
- `columns` — con `board_id`
- `cards` — con `column_id` y `board_id`
- `categories` — con `organization_id`

---

## Phase 2 — Workspaces (multi-tenant avanzado)

**Estado:** ✅ Completada (2026-03-24/25)
**Producción:** https://myboardlfi.ibaifernandez.com

### Objetivos
- Dockerizar la aplicación completa
- Hacer el deploy inicial en infraestructura de PRONODO
- Configurar dominio y HTTPS
- Documentar el proceso de deploy para el equipo técnico

### Entregables completados
- [x] Jerarquía Organization → Workspace → Board → Column → Card
- [x] Roles por workspace: owner / admin / member / guest
- [x] RLS en Supabase con funciones SECURITY DEFINER
- [x] WorkspaceDashboard, WorkspaceMembers, breadcrumb, mini-kanban
- [x] Display name «LFi Kanban Desk» en toda la UI
- [ ] ⚠️ Email de invitación (KNOWN-02 — pendiente)

---

## Phase 3 — Pitch interno a LFi

**Estado:** 📋 Por definir
**Audiencia:** Héctor Vera, Iván Colodro, Daniel, Marco

### Objetivos
- Presentar MyBoardLFi como solución interna de gestión de proyectos
- Proponer modelo de compensación o adquisición del software
- Establecer términos de uso y propiedad intelectual

### Entregables
- Demo funcional en `myboard.pronodo.com`
- Deck de 5–6 slides: problema → solución → demo → roadmap → propuesta
- Propuesta comercial: reconocimiento de autoría + compensación o revenue sharing

---

## Phase 4 — Deploy en PRONODO + Protección de IP

**Estado:** 📋 Pendiente de Phase 3

### Acciones permanentes
- Código fuente en repositorio privado de Ibai (GitHub personal)
- Deploy vía build compilado — nunca compartir código fuente con LFi/PRONODO
- Copyright en footer de la aplicación: "MyBoardLFi · © 2026 Ibai Fernández"
- Registro de propiedad intelectual si las negociaciones avanzan
- Versionado semántico documentado en `docs/CHANGELOG.md`
