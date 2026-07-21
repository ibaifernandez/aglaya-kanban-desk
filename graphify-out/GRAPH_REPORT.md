# Graph Report - aglaya-kanban-desk  (2026-07-21)

## Corpus Check
- 125 files · ~119,252 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1291 nodes · 1718 edges · 176 communities (100 shown, 76 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a2750bae`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Card & Board API
- React & UI Dependencies
- Backend & Server Dependencies
- Architecture & Design Decisions
- Authentication & Authorization
- Board UI Components
- Workspace Access Control
- Express App & Routers
- Modal & Sidebar Components
- Email Digest Generation
- Client Auth Utilities
- Card & Column Components
- Workspace Management UI
- User Digest Formatting
- Internal Routes & Logging
- Database Schema
- User Settings UI
- App Core & Contexts
- Phase 1 — Multi-tenant y autenticación *(En curso)*
- Database Seeding
- Card Management API
- File Upload Handling
- App Initialization & Config
- MyBoard Data Migration
- Board Management API
- Digest Email Route
- Supabase Seeding
- Auth Tests
- Notification Tests
- Workspace Tests
- Category Management
- Admin Tests
- Digest Tests
- Upload Tests
- Column Management
- Self-Service Auth Tests
- Token Refresh Tests
- Card Validation Tests
- 🔐 3. Seguridad y Multi-tenancy
- Security Tests
- Permission Matrix
- Health Check Tests
- Digest Hour Migration
- Organizations Migration
- Digest Logs Schema
- Client Entry Point
- AGLAYA Logo White
- AGLAYA Logo Black
- AGLAYA Logotype White
- AGLAYA Logotype Black
- Kanban MCP
- Accessibility Standard
- Audit Mariana Trench — Reporte Consolidado
- ADR (Architecture Decision Records)
- Runbook — Rotación de claves y secretos
- Operator Checklist — Acciones post audit Mariana
- INCIDENTS.md — Registro de Incidencias y Correctivos
- SECURITY — AGLAYA Kanban Desk
- App.jsx
- Runbook — Restore DB Supabase desde backup R2
- client.js
- api
- PRD (Product Requirements Document) — AGLAYA Kanban Desk
- 🚀 2. Despliegue en Producción
- AdminPage.jsx
- Audit B — Backend + Datos
- Pasos
- auth.js
- CHANGELOG — AGLAYA Kanban Desk
- auth.js
- Audit Mariana — Roadmap Backlog
- [0.8.0] — 2026-03-27 — Sesión 7: Sub-fase 2.1 + bug sweep + performance
- Sidebar.jsx
- Audit A — Addendum
- Audit C — Cumplimiento Legal
- media.js
- kanban-mcp — el riel del capitán
- Audit D — DevOps + Observabilidad + Documentación + Mantenibilidad
- [0.2.0] — 2026-03-19 — Sesión 1: Phase 1 — Autenticación, Supabase y email
- package.json
- devDependencies
- Phase 4 — Calidad de producto y UX completa
- scripts
- Audit A — Producto cara al usuario
- internal-create-card.test.js
- [0.1.0] — 2026-03-18 — Sesión 0: Limpieza y documentación inicial
- [0.4.0] — 2026-03-23 — Sesión 3: Fix login + deploy Netlify + migración schema
- [0.5.0] — 2026-03-24 — Sesión 4: Producción completa + Resend + seguridad RLS
- [1.1.0] — 2026-04-07 — Rebrand AGLAYA + Workspace Types + Acceso por Rol
- [1.3.0] - 2026-04-28
- 🔍 3. Diagnóstico y Mantenimiento
- [0.3.0] — 2026-03-18 — Sesión 2: Admin Digest + correcciones de flujo auth
- [0.6.0] — 2026-03-24 — Sesión 5: Phase 2 — Workspaces completa en producción
- [1.2.2] - 2026-04-28
- [1.3.1] - 2026-04-29
- [1.4.0] - 2026-07-13
- [Unreleased]
- docs-guard.test.sh
- Versiones heredadas de MyBoard (referencia)
- dotenv
- [0.9.0.0] — 2026-04-11 — Estabilización AGLAYA · Fix Avatar · Jest Downgrade
- [1.1.5] - 2026-04-13/14
- [1.2.0] — 2026-04-10 — Workspace UX · Movilidad de tableros · Digest personal
- Sub-fase 2.1: Supabase Storage + Identidad visual *(Completada — 2026-03-27)*
- docs-guard.sh
- docs-guard.mutation.sh
- 2026-05-27 — Audit Mariana Trench: 2 críticos detectados y mitigados
- Supabase Email Invite Template
- express-rate-limit
- file-type
- Digest Cron Workflow — Hourly Dispatch
- jsonwebtoken
- multer
- resend
- @sentry/node
- ADR-012 — Jest Downgrade for Stability
- ADR-014 — Permission Alignment & Session Migration
- ADR-015 — Admin Invite Resilience
- ADR-016 — Supabase Client Isolation
- ADR-017 — Explicit Workspace Context for Cards
- ADR-018 — Consistent Overlay & Destructive Action UX
- ADR-019 — Contextual Digest per Workspace
- ADR-020 — Single-Tenant by Design, Multi-Org Deferred
- ADR-021 — Category FK Migration (TEXT → UUID)
- ADR-022 — Performance Indexes on Hot Columns
- ADR-023 — Global Error Handler & 404 JSON
- ADR-024 — Separation app.js / index.js
- ADR-025 — Client State Management (Flat API Coupling)
- ADR-026 — Riel MCP for Programmatic Kanban Operation
- Audit Mariana — Security & Compliance Review
- Audit Phase A — UX/A11y/Performance/SEO
- Audit Phase A Addendum — A11y Gap Corrections
- Audit Phase B — Backend Security + Database
- Audit Phase C — Legal Compliance RGPD/LGPD
- Audit Phase D — DevOps/Observability/Docs
- Audit Mariana Trench — Full Consolidated Report
- Cloudflare R2 — Object Storage for Backups
- GitHub Actions — Daily DB Backup to R2
- Runbook — DB Restore from R2 Backup
- Bloque C — Features producto (no security)
- Runbook — Railway Custom Domain Setup
- DPA Registry — Data Processing Agreements Archive
- Finding B-CRIT-01 — XSS via SVG Upload (RESOLVED)
- Finding B-CRIT-02 — Backup Absent (RESOLVED)
- C-01: No Privacy Policy for kanban.aglaya.biz
- C-03: docs/legal/ Missing — No DPA Registry
- D-01: Zero Error Tracking (No Sentry)
- D-03: No CI Tests Workflow
- D-05: docs/SECURITY.md False Claims
- GitHub Actions — CI/CD Workflows
- Phase 2 — Workspaces *(Completada — 2026-03-24/25)*
- kanban-mcp — MCP Server for Kanban Operations
- Ley 21.719 — Chile Data Privacy Law
- LGPD — Brazil General Data Protection Law
- Netlify — CDN/Static Hosting
- Higiene documental — estado copiado *(2026-07-21)*
- Phase 0 — Prototype (Legacy)
- Phase 1 — Multi-tenant & Auth (Completed)
- Phase 2 — Workspaces (Completed)
- Phase 3 — Rebrand AGLAYA (Completed)
- Phase 4 — Quality & UX (Completed)
- Phase 5 — Scale & Collaboration (Planned)
- Railway — Server Hosting Platform
- media.js
- RGPD — EU General Data Protection Regulation
- Row Level Security — Data Isolation
- User Roles (Macro) — superadmin / admin / colaborador / cliente
- Workspace Roles (Micro) — owner / admin / member / guest
- Workspace Types — personal / interno / externo
- [1.1.5] - 2026-04-13/14

## God Nodes (most connected - your core abstractions)
1. `CHANGELOG — AGLAYA Kanban Desk` - 25 edges
2. `_request()` - 23 edges
3. `useEscapeKey()` - 23 edges
4. `supabaseAdmin` - 21 edges
5. `api` - 19 edges
6. `AGLAYA Kanban Desk` - 16 edges
7. `useFocusTrap()` - 16 edges
8. `ADR (Architecture Decision Records)` - 16 edges
9. `INCIDENTS.md — Registro de Incidencias y Correctivos` - 16 edges
10. `Audit Mariana Trench — Reporte Consolidado` - 14 edges

## Surprising Connections (you probably didn't know these)
- `AGLAYA Logo — Red SVG` --represents--> `AGLAYA Kanban Desk`  [EXTRACTED]
  client/src/assets/aglaya-favicon-rojo.svg → README.md
- `AGLAYA Logotype — Color` --represents--> `AGLAYA Kanban Desk`  [EXTRACTED]
  client/src/assets/aglaya-logo-color.svg → README.md
- `Privacy Policy — Multi-Jurisdiction` --documents--> `AGLAYA Kanban Desk`  [EXTRACTED]
  client/public/privacidad.html → README.md
- `CI Workflow — Jest + Vite Build` --implements--> `AGLAYA Kanban Desk`  [EXTRACTED]
  .github/workflows/ci.yml → README.md
- `useCategories()` --indirect_call--> `createCategory()`  [INFERRED]
  client/src/hooks/useCategories.js → server/routes/categories.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Architecture Decision Records (ADR-011 through ADR-026)** — adr_011, adr_012, adr_014, adr_015, adr_016, adr_017, adr_018, adr_019, adr_020, adr_021, adr_022, adr_023, adr_024, adr_025, adr_026 [EXTRACTED 1.00]
- **Roadmap Phases (Phase 0-5 Progression)** — phase_0, phase_1, phase_2, phase_3, phase_4, phase_5 [EXTRACTED 1.00]
- **Multi-Tenant Auth & Access Control System** — multi_tenant_architecture, row_level_security, user_roles_macro, workspace_roles_micro, workspace_types [INFERRED 0.95]
- **GitHub Actions CI/CD Workflows** — github_ci_yml, github_db_backup_yml, github_digest_cron_yml, github_schema_guard_yml [EXTRACTED 1.00]
- **Mariana Audit Phases A-D Framework** — audit_mariana_a, audit_mariana_b, audit_mariana_c, audit_mariana_d, audit_mariana_report [EXTRACTED 1.00]
- **Legal Compliance Frameworks — RGPD/LGPD/Ley 21.719** — rgpd, lgpd, ley_21_719, audit_mariana_c [EXTRACTED 1.00]
- **Backup & Disaster Recovery System — B-CRIT-02 Mitigation** — db_backup_workflow, docs_runbooks_db_restore_runbook, cloudflare_r2, supabase, github_actions [EXTRACTED 1.00]
- **Infrastructure & Platform Ecosystem** — supabase, railway, cloudflare_r2, netlify, resend, github_actions [INFERRED 0.80]

## Communities (176 total, 76 thin omitted)

### Community 0 - "Card & Board API"
Cohesion: 0.09
Nodes (48): Any, _api_base(), assign_card(), assign_checklist_item(), _board_of_column(), _cfg(), clear_workspace(), create_board() (+40 more)

### Community 1 - "React & UI Dependencies"
Cohesion: 0.04
Nodes (48): autoprefixer, dependencies, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, lucide-react, react, react-dom (+40 more)

### Community 2 - "Backend & Server Dependencies"
Cohesion: 0.13
Nodes (15): cookie-parser, cors, express, helmet, node-cron, dependencies, cookie-parser, cors (+7 more)

### Community 4 - "Authentication & Authorization"
Cohesion: 0.13
Nodes (9): ALLOWED_ROLES, { createAdminClient }, express, fs, INVITE_TEMPLATE_PATH, path, { requireAuth, requireRole, invalidateUserCache }, router (+1 more)

### Community 6 - "Board UI Components"
Cohesion: 0.14
Nodes (15): Board(), PRIORITY_SORT_ORDER, CardModal(), EMPTY, fileIcon(), normalizeAttachments(), CategoryRow(), CategorySettings() (+7 more)

### Community 7 - "Workspace Access Control"
Cohesion: 0.15
Nodes (8): { createClient }, express, MANAGEABLE_MEMBER_ROLES, { requireAuth }, { requireWorkspaceMember, requireWorkspaceRole }, router, { supabaseAdmin }, VALID_TYPES

### Community 8 - "Express App & Routers"
Cohesion: 0.07
Nodes (25): adminRouter, app, authLimiter, authRouter, cookieParser, cors, digestRouter, express (+17 more)

### Community 9 - "Modal & Sidebar Components"
Cohesion: 0.30
Nodes (10): Card(), Badge(), COLOR_OPTIONS, colorById(), PRIORITIES, PRIORITY_LIST, daysUntil(), formatDate() (+2 more)

### Community 10 - "Email Digest Generation"
Cohesion: 0.07
Nodes (46): buildHtml(), buildStats(), buildSubject(), DIGEST_HOUR, DIGEST_MINUTE, { escHtml, dateLabel, todayStr, DONE_COLUMN_RE }, { logDigestAttempt }, priorityRow() (+38 more)

### Community 12 - "Card & Column Components"
Cohesion: 0.18
Nodes (11): getUserFromDb(), invalidateUserCache(), jwt, requireAuth(), requireRole(), { supabaseAdmin }, userCache, express (+3 more)

### Community 13 - "Workspace Management UI"
Cohesion: 0.14
Nodes (14): useWorkspaces(), canDeleteWorkspace(), canManageWorkspace(), COLUMN_COLORS, DeleteConfirmModal(), EMOJIS, MiniKanban(), ROLE_LABELS (+6 more)

### Community 14 - "User Digest Formatting"
Cohesion: 0.50
Nodes (4): Backlog — Sub-fase 2.2: Alertas automáticas (sugerencia Bani #4), Bloqueantes, Componentes necesarios, Decisiones de diseño pendientes

### Community 15 - "Internal Routes & Logging"
Cohesion: 0.15
Nodes (13): express, router, { supabaseAdmin }, VALID_PRIORITIES, { logDigestAttempt, queryDigestLogs }, { supabaseAdmin }, logDigestAttempt(), queryDigestLogs() (+5 more)

### Community 16 - "Database Schema"
Cohesion: 0.31
Nodes (14): public.boards, public.cards, public.categories, public.columns, public.digest_logs, public.get_my_org_id(), public.get_my_role(), public.get_workspace_role() (+6 more)

### Community 17 - "User Settings UI"
Cohesion: 0.08
Nodes (25): Privacy Policy — Multi-Jurisdiction, AGLAYA Logo — Red SVG, AGLAYA Logotype — Color, CI Workflow — Jest + Vite Build, AGLAYA Kanban Desk, Arquitectura, Características, Documentación (+17 more)

### Community 19 - "Phase 1 — Multi-tenant y autenticación *(En curso)*"
Cohesion: 0.17
Nodes (12): BACKLOG — AGLAYA Kanban Desk, Backlog — Features futuras (sin fase asignada), 🔴 Bug vivo — `internalRoute.js:34`, Doctrina — conteos en mensajes de commit *(2026-07-21)*, Hecho, Higiene documental — estado copiado *(2026-07-21)*, Infraestructura soberana *(Pendiente)*, Las lecciones (+4 more)

### Community 20 - "Database Seeding"
Cohesion: 0.19
Nodes (12): COLUMNS, CONTENIDO_CARDS, createBoard(), createCards(), { createClient }, createColumns(), main(), OPERACIONES_CARDS (+4 more)

### Community 21 - "Card Management API"
Cohesion: 0.26
Nodes (12): createAssigneeNotification(), createCard(), createChecklistNotifications(), deleteCard(), getCardsByBoard(), getCardsByColumn(), moveCard(), searchCards() (+4 more)

### Community 22 - "File Upload Handling"
Cohesion: 0.15
Nodes (11): ALLOWED_MIME, FileType, FORBIDDEN_MIME, fs, multer, path, storage, upload (+3 more)

### Community 23 - "App Initialization & Config"
Cohesion: 0.33
Nodes (7): app, { Sentry, enabled: sentryEnabled }, { validateCoreConfig, validateSmtpConfig, validateDigestSchedules }, { validateSmtpConfig, validateDigestSchedules }, validateCoreConfig(), validateDigestSchedules(), validateSmtpConfig()

### Community 24 - "MyBoard Data Migration"
Cohesion: 0.18
Nodes (9): boardIdMap, categoryIdMap, columnIdMap, { createClient }, fs, MYBOARD_PATH, path, supabase (+1 more)

### Community 25 - "Board Management API"
Cohesion: 0.33
Nodes (8): createBoard(), DEFAULT_COLUMNS, deleteBoard(), getBoards(), reorderBoards(), { supabaseAdmin }, toBoard(), updateBoard()

### Community 26 - "Digest Email Route"
Cohesion: 0.20
Nodes (9): { buildUserCards, sendUserDigest, sendAllUserDigests }, { createAdminClient, supabaseAdmin }, express, { getSyncedUserProfile }, { queryDigestLogs }, { requireAuth, requireRole }, router, { sendDigest } (+1 more)

### Community 27 - "Supabase Seeding"
Cohesion: 0.22
Nodes (7): boardIdMap, columnIdMap, { createClient }, fs, path, supabase, tasks

### Community 28 - "Auth Tests"
Cohesion: 0.18
Nodes (11): Autenticación ✅, Base de datos ✅, Branding ✅, Email ✅ (parcial), Freemium, Frontend — Autenticación ✅, Multi-tenancy, Phase 1 — Multi-tenant y autenticación *(En curso)* (+3 more)

### Community 29 - "Notification Tests"
Cohesion: 0.22
Nodes (6): app, jwt, mockFrom, request, SAMPLE_NOTIFS, TOKEN

### Community 30 - "Workspace Tests"
Cohesion: 0.25
Nodes (7): app, configureMocks(), jwt, makeChain(), mockFreshAdmin, request, { supabaseAdmin }

### Community 31 - "Category Management"
Cohesion: 0.36
Nodes (7): useCategories(), createCategory(), deleteCategory(), getCategories(), { supabaseAdmin }, toCat(), updateCategory()

### Community 32 - "Admin Tests"
Cohesion: 0.25
Nodes (5): app, jwt, request, { supabaseAdmin, createAdminClient }, createAdminClient()

### Community 33 - "Digest Tests"
Cohesion: 0.18
Nodes (11): 🛠️ 1. Desarrollo Local, 🚀 2. Despliegue en Producción, Arrancar la Aplicación, Estado actual (real): Railway + Netlify, Estructura en Servidor (`/opt/aglaya/`), Instalación Inicial, Objetivo futuro: infraestructura soberana (Docker/Nginx), ⚠️ Reglas Críticas de Operación (+3 more)

### Community 34 - "Upload Tests"
Cohesion: 0.25
Nodes (6): app, fs, jwt, path, PNG_SIGNATURE, request

### Community 35 - "Column Management"
Cohesion: 0.43
Nodes (6): createColumn(), deleteColumn(), getColumns(), { supabaseAdmin }, toColumn(), updateColumn()

### Community 36 - "Self-Service Auth Tests"
Cohesion: 0.29
Nodes (4): app, jwt, mockUserProfile, request

### Community 37 - "Token Refresh Tests"
Cohesion: 0.33
Nodes (4): app, jwt, mockProfile, request

### Community 38 - "Card Validation Tests"
Cohesion: 0.40
Nodes (3): app, jwt, request

### Community 39 - "🔐 3. Seguridad y Multi-tenancy"
Cohesion: 0.33
Nodes (6): A.1 — A11y completar (~15-20h), A.2 — Seguridad/DB residual (~10h), A.3 — Legales medios (~10h), A.4 — Ops/Docs/Mantenibilidad (~15h), A.5 — Tests preexistentes (~3h), Bloque A — Atajar deuda medio/bajo del audit (~40-60h)

### Community 40 - "Security Tests"
Cohesion: 0.50
Nodes (3): app, PROTECTED_ROUTES, request

### Community 41 - "Permission Matrix"
Cohesion: 0.18
Nodes (10): 🏗️ 1. Capa **macro**: roles globales (a nivel de la aplicación), 📁 2. Capa **micro**: roles de workspace (a nivel de espacio), 🛡️ 3. Reglas de seguridad **hardened**, 🛡️ Admins, 👥 Cliente, 👤 Colaboradores, 📍 La regla del propietario, Modelos de Roles y Permisos — AGLAYA Kanban Desk (+2 more)

### Community 58 - "Audit Mariana Trench — Reporte Consolidado"
Cohesion: 0.06
Nodes (34): 0. Resumen Ejecutivo, 10. Lecciones aprendidas del proceso audit, 11. SHAs commits del audit (orden cronológico), 12. Cierre formal — 2026-05-28, 1. Conteo total, 2. Hallazgos críticos abiertos (16), 3. Hallazgos críticos mitigados durante audit, 4. Roadmap por sprints (2 semanas cada uno) (+26 more)

### Community 59 - "ADR (Architecture Decision Records)"
Cohesion: 0.12
Nodes (16): ADR-011: Consolidación de Marca e Identidad, ADR-012: Estabilización del Entorno de Tests (Jest Downgrade), ADR-014: Alineación Estricta de Permisos GUI/API y Sesión Efímera, ADR-015: Invitación Admin Resiliente ante Sesiones y Estados Parciales, ADR-016: Aislamiento Estricto de Clientes Supabase en Backend, ADR-017: Contexto de Workspace Explícito para Operaciones de Tarjeta, ADR-018: Contrato Único para Overlays, Confirmaciones y Navegación Compacta, ADR-019: Digest Contextual por Workspace y Email Derivado de Auth (+8 more)

### Community 60 - "Runbook — Rotación de claves y secretos"
Cohesion: 0.07
Nodes (27): 1. Rotar Cloudflare R2 token, 2. Rotar `JWT_SECRET`, 3. Rotar `SUPABASE_SERVICE_ROLE_KEY`, 4. Rotar `SUPABASE_DATABASE_PASSWORD`, 5. Rotar `RESEND_API_KEY`, 6. Rotar `TASK_SECRET`, 7. Rotar `DIGEST_CRON_SECRET`, 8. Rotar `SUPABASE_PAT` (Personal Access Token) (+19 more)

### Community 61 - "Operator Checklist — Acciones post audit Mariana"
Cohesion: 0.08
Nodes (25): 10. Considerar UptimeRobot (free, 5 min), 11. Setup retention cron (workflow para aplicar plazos política), 1. ✅ Rotar/extender token Cloudflare `aglaya-kanban-r2-bootstrap`, 2.1 Supabase (5 min), 2.2 Resend (5 min), 2.3 Railway (5 min), 2.4 Netlify (5 min), 2.5 Cloudflare (5 min — **más urgente** post-B-CRIT-02) (+17 more)

### Community 62 - "INCIDENTS.md — Registro de Incidencias y Correctivos"
Cohesion: 0.08
Nodes (25): 2026-04-13 — Acciones destructivas sin confirmación consistente, 2026-04-13 — Borrado de tarjetas devolvía `400 Contexto de workspace no encontrado`, 2026-04-13 — Botón de digest en workspace apuntando al flujo equivocado, 2026-04-13 — Invitaciones admin con `500` desde la GUI, 2026-04-13 — Invitaciones admin fallaban con JWT desfasado o perfil parcial, 2026-04-13 — Modal de categorías sin cierre por `Escape`, 2026-04-13 — Navegación interior del workspace demasiado cargada en resoluciones pequeñas, 2026-04-27 — Cron jobs de digest no ejecutan en Railway (UTC vs. Brasil) (+17 more)

### Community 63 - "SECURITY — AGLAYA Kanban Desk"
Cohesion: 0.08
Nodes (25): API (Railway), Autenticación y autorización, Backup + Restore (post B-CRIT-02), Claves y secretos, CORS, CORS y Headers, Cuentas privilegiadas (superadmin), Estado general post-audit Mariana (+17 more)

### Community 64 - "App.jsx"
Cohesion: 0.16
Nodes (13): App(), AuthenticatedApp(), restoreSession(), SIZE_CLASSES, Spinner(), useAuth(), CategoriesContext, useBoardData() (+5 more)

### Community 65 - "Runbook — Restore DB Supabase desde backup R2"
Cohesion: 0.10
Nodes (20): Backup file > 1 GB, Backup workflow falló con `pg_dump: FATAL: password authentication failed`, Contexto, Inventario de backups, Mejoras pendientes (backlog), Opción A: GitHub UI, Opción B: gh CLI, Pasos (+12 more)

### Community 66 - "client.js"
Cohesion: 0.26
Nodes (17): fetchWithAuth(), getToken(), refreshAccessToken(), request(), AuthContext, AuthProvider(), clearAuthSession(), clearAuthToken() (+9 more)

### Community 67 - "api"
Cohesion: 0.18
Nodes (11): api, BoardMoveModal(), ColumnPickerModal(), AddMemberModal(), ROLE_LABELS, WorkspaceMembers(), WS_ROLES, EMOJIS (+3 more)

### Community 68 - "PRD (Product Requirements Document) — AGLAYA Kanban Desk"
Cohesion: 0.12
Nodes (16): 1. Visión Estratégica, 2. Stack Técnico, 3. Estructura de Datos (Core), 4. Usuarios Objetivo, 5. Modelo de Negocio (Freemium), 6. Funcionalidades Core, 7. Criterios de Aceptación, Board (+8 more)

### Community 69 - "🚀 2. Despliegue en Producción"
Cohesion: 0.40
Nodes (5): 🔍 3. Diagnóstico y Mantenimiento, Consultar Historial de Incidencias, Ejecutar Tareas Manuales, Limpieza de Caché y Reinstalación, Verificar Salud del Sistema

### Community 70 - "AdminPage.jsx"
Cohesion: 0.17
Nodes (9): AvatarCropModal(), DigestPreferences(), formatLocalHour(), utcHourToLocal(), UserMenu(), AdminPage(), ASSIGNABLE_ROLES, InviteModal() (+1 more)

### Community 71 - "Audit B — Backend + Datos"
Cohesion: 0.14
Nodes (13): Arquitectura + deuda (5 hallazgos), Audit B — Backend + Datos, B-CRIT-01 — XSS explotable vía upload SVG (MITIGADO), B-CRIT-02 — Backup ausente + Supabase Free (MITIGADO quick-win), Bases de datos (5 hallazgos), Conclusión Fase B (post-mitigaciones), ⚠️ Hallazgos críticos durante el audit, Hallazgos detallados (+5 more)

### Community 72 - "Pasos"
Cohesion: 0.14
Nodes (13): 1. Railway — añadir custom domain, 2. Cloudflare — crear CNAME, 3. Verificar propagación DNS (~5 min), 4. Cloudflare — Firewall Rules (Free plan), 5. Update netlify.toml (yo lo hago tras verificación operador), 6. Update server CORS (yo tras tu confirmación), 7. Deshabilitar URL pública Railway (opcional, requiere Pro), Contexto (+5 more)

### Community 73 - "auth.js"
Cohesion: 0.18
Nodes (8): { createAdminClient, createPublicClient }, express, { getSyncedUserProfile }, jwt, refreshSecret(), { requireAuth, invalidateUserCache }, router, signRefreshToken()

### Community 74 - "CHANGELOG — AGLAYA Kanban Desk"
Cohesion: 0.12
Nodes (16): [0.8.1] — 2026-03-27 — Hotfix: categoría hardcodeada en tarjetas, [1.0.0.0] — 2026-04-11 — Lanzamiento Oficial GitHub, [1.1.0.0] — 2026-04-11 — Certificación "Kosher" · Nutrición Atlas · v1.1.0 Global Sync, [1.1.1] — 2026-04-08 — Fixes post-migración + herramientas de migración, [1.1.1] - 2026-04-12, [1.2.1] — 2026-04-10 — Tests · Mover tarjetas cross-workspace · Settings de workspace, [1.3.0] - 2026-04-28, Added (+8 more)

### Community 75 - "auth.js"
Cohesion: 0.20
Nodes (10): 🏗️ 1. Descripción General, 📁 2. Jerarquía de Datos, 💾 4. Esquema de Base de Datos (Core), 🚀 5. Flujo de Despliegue, 📝 6. Referencias, 📖 7. Registro de Decisiones Arquitectónicas (ADR), ARCHITECTURE.md — Arquitectura Técnica AGLAYA Kanban Desk, Historial de Decisiones Clave: (+2 more)

### Community 76 - "Audit Mariana — Roadmap Backlog"
Cohesion: 0.20
Nodes (8): Audit Mariana — Roadmap Backlog, B.1 — Stack quality, B.2 — Observabilidad avanzada, B.3 — Infraestructura, Bloque B — Hardening avanzado (fuera audit), Cómo retomar el backlog en sesiones futuras, Priorización sugerida cuando se retome backlog, Referencias cross-document

### Community 77 - "[0.8.0] — 2026-03-27 — Sesión 7: Sub-fase 2.1 + bug sweep + performance"
Cohesion: 0.17
Nodes (12): [0.8.0] — 2026-03-27 — Sesión 7: Sub-fase 2.1 + bug sweep + performance, Asignación y filtros en tarjetas (Bani #1 y #3), Bug sweep, Categorías por tablero, Espacios de trabajo — identidad visual, Foto de perfil, Infraestructura, Performance (+4 more)

### Community 78 - "Sidebar.jsx"
Cohesion: 0.22
Nodes (5): app, request, { supabaseAdmin, createAdminClient, createPublicClient }, TEST_PROFILE, createPublicClient()

### Community 79 - "Audit A — Addendum"
Cohesion: 0.20
Nodes (9): Aclaración 1: A-01 (labels sin asociación), Aclaración 2: A-11 (lucide-react 29 MB), Aclaración 3: A-08 (prefers-reduced-motion), Audit A — Addendum, Parte 1 — Aclaraciones a hallazgos previos, Parte 2 — 8 hallazgos nuevos, Parte 3 — Tabla completa Fase A (16 originales + 8 addendum + 3 ajustes severidad), Recuento final Fase A actualizado (+1 more)

### Community 80 - "Audit C — Cumplimiento Legal"
Cohesion: 0.20
Nodes (9): Audit C — Cumplimiento Legal, Conclusión Fase C, Contexto legal aplicable, Hallazgos, Marco descubierto durante audit, `[NO VERIFICABLE]` registrados, Procesadores y estado DPA, Recuento por severidad (+1 more)

### Community 82 - "kanban-mcp — el riel del capitán"
Cohesion: 0.22
Nodes (8): Credenciales (server-side; el capitán nunca las ve), Cómo funciona (auth = opción A), Instalación, kanban-mcp — el riel del capitán, Notificaciones, Registro en Claude (`.mcp.json`), Seguridad, Tools

### Community 83 - "Audit D — DevOps + Observabilidad + Documentación + Mantenibilidad"
Cohesion: 0.25
Nodes (7): Audit D — DevOps + Observabilidad + Documentación + Mantenibilidad, Conclusión Fase D, Hallazgos, Hallazgos sorpresa durante audit Fase D, `[NO VERIFICABLE]` registrados, Recuento por dimensión, Resumen Fase D

### Community 84 - "[0.2.0] — 2026-03-19 — Sesión 1: Phase 1 — Autenticación, Supabase y email"
Cohesion: 0.25
Nodes (8): [0.2.0] — 2026-03-19 — Sesión 1: Phase 1 — Autenticación, Supabase y email, Autenticación, Branding, Email — Digest bajo demanda, Frontend — Autenticación, Infraestructura, Seguridad, SMTP / Email

### Community 85 - "package.json"
Cohesion: 0.25
Nodes (7): description, jest, testEnvironment, testTimeout, name, private, version

### Community 86 - "devDependencies"
Cohesion: 0.29
Nodes (7): concurrently, jest, devDependencies, concurrently, jest, supertest, supertest

### Community 87 - "Phase 4 — Calidad de producto y UX completa"
Cohesion: 0.14
Nodes (13): Email y notificaciones, Ingeniería y calidad de código, Movilidad de objetos, Phase 0 — AGLAYA Prototipo (origen), Phase 1 — Multi-tenant y autenticación, Phase 2 — Workspaces (multi-tenant avanzado), Phase 3 — Rebrand AGLAYA + Migración de datos, Phase 4 — Calidad de producto y UX completa (+5 more)

### Community 88 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build:legal, client, dev, server, test, test:watch

### Community 89 - "Audit A — Producto cara al usuario"
Cohesion: 0.33
Nodes (5): Audit A — Producto cara al usuario, Conclusión Fase A, Hallazgos, Notas de método, Resumen de Fase A

### Community 90 - "internal-create-card.test.js"
Cohesion: 0.67
Nodes (3): app, post(), request

### Community 91 - "[0.1.0] — 2026-03-18 — Sesión 0: Limpieza y documentación inicial"
Cohesion: 0.33
Nodes (6): [0.1.0] — 2026-03-18 — Sesión 0: Limpieza y documentación inicial, Añadido, Documentación reescrita, Eliminado, Fork, Modificado

### Community 92 - "[0.4.0] — 2026-03-23 — Sesión 3: Fix login + deploy Netlify + migración schema"
Cohesion: 0.33
Nodes (6): [0.4.0] — 2026-03-23 — Sesión 3: Fix login + deploy Netlify + migración schema, Bug crítico resuelto: login bloqueado por RLS recursiva, Cuenta corporativa de acceso, Deploy frontend — Netlify, Migración de schema — alineación camelCase frontend/backend, Seguridad — limpieza de secretos en repositorio

### Community 93 - "[0.5.0] — 2026-03-24 — Sesión 4: Producción completa + Resend + seguridad RLS"
Cohesion: 0.33
Nodes (6): [0.5.0] — 2026-03-24 — Sesión 4: Producción completa + Resend + seguridad RLS, Deploy Netlify — resolución de bloqueo por escáner de secretos, Email transaccional — migración a Resend completada, Seguridad — RLS restaurada correctamente en public.users, UI — mejoras menores, Verificado en producción

### Community 94 - "[1.1.0] — 2026-04-07 — Rebrand AGLAYA + Workspace Types + Acceso por Rol"
Cohesion: 0.33
Nodes (6): [1.1.0] — 2026-04-07 — Rebrand AGLAYA + Workspace Types + Acceso por Rol, Fase A — Rebrand visual y de dominio, Fase B — Workspace types, Fase C — Control de acceso por tipo de usuario, Fase D — UI diferenciada por rol, Infraestructura y deploy

### Community 95 - "[1.3.0] - 2026-04-28"
Cohesion: 0.17
Nodes (10): Acceso a Supabase desde Claude (DDL y queries directas), AGLAYA · Flota — el capitán, CLAUDE.md — AGLAYA Kanban Desk, Cómo entra trabajo desde otras naves de la flota, Dónde vive el estado del proyecto, Endpoint interno: cómo crear cards sin UI, graphify, Identidad del proyecto (+2 more)

### Community 96 - "🔍 3. Diagnóstico y Mantenimiento"
Cohesion: 0.50
Nodes (4): 🔐 3. Seguridad y Multi-tenancy, Aislamiento por Middleware, Modo Dios (Superadmin), Roles Micro

### Community 97 - "[0.3.0] — 2026-03-18 — Sesión 2: Admin Digest + correcciones de flujo auth"
Cohesion: 0.40
Nodes (5): [0.3.0] — 2026-03-18 — Sesión 2: Admin Digest + correcciones de flujo auth, Admin Digest (reescritura completa), Conocido / Limitaciones, Correcciones auth, Supabase — fixes operativos

### Community 98 - "[0.6.0] — 2026-03-24 — Sesión 5: Phase 2 — Workspaces completa en producción"
Cohesion: 0.40
Nodes (5): [0.6.0] — 2026-03-24 — Sesión 5: Phase 2 — Workspaces completa en producción, Backend — Workspaces, Base de datos (Supabase), Conocido, Frontend — Workspaces

### Community 99 - "[1.2.2] - 2026-04-28"
Cohesion: 0.40
Nodes (5): [1.2.2] - 2026-04-28, Added, Fixed, Improved, Verified

### Community 100 - "[1.3.1] - 2026-04-29"
Cohesion: 0.40
Nodes (5): [1.3.1] - 2026-04-29, Added, Fixed, Performance, Refactor

### Community 101 - "[1.4.0] - 2026-07-13"
Cohesion: 0.40
Nodes (5): [1.4.0] - 2026-07-13, Added, Changed, Fixed, Governance

### Community 102 - "[Unreleased]"
Cohesion: 0.22
Nodes (9): Added, Added, Changed, Fixed, Fixed, Removed, Security, Security (+1 more)

### Community 103 - "docs-guard.test.sh"
Cohesion: 0.48
Nodes (5): expect_green(), expect_red(), links_case(), ports_case(), docs-guard.test.sh script

### Community 104 - "Versiones heredadas de MyBoard (referencia)"
Cohesion: 0.50
Nodes (4): [0.1.0] — 2026-03-01 (MyBoard personal), [0.2.0] — 2026-03-02 (MyBoard personal), [0.3.0] — 2026-03-03 (MyBoard personal), Versiones heredadas de MyBoard (referencia)

### Community 105 - "dotenv"
Cohesion: 0.25
Nodes (5): SortableCard(), Column(), SortableColumn(), Sidebar(), IconButton()

### Community 106 - "[0.9.0.0] — 2026-04-11 — Estabilización AGLAYA · Fix Avatar · Jest Downgrade"
Cohesion: 0.50
Nodes (4): [0.9.0.0] — 2026-04-11 — Estabilización AGLAYA · Fix Avatar · Jest Downgrade, Fixed, Infrastructure, Known Issues

### Community 107 - "[1.1.5] - 2026-04-13/14"
Cohesion: 0.40
Nodes (5): Backlog — Movilidad de objetos *(Visión a largo plazo — no implementar sin diseño previo)*, Nivel board — Mover entre workspaces, Nivel card — Mover entre tableros (y por tanto entre workspaces), Nivel workspace — Cambio de tipo, Principio de diseño

### Community 108 - "[1.2.0] — 2026-04-10 — Workspace UX · Movilidad de tableros · Digest personal"
Cohesion: 0.50
Nodes (4): [1.2.0] — 2026-04-10 — Workspace UX · Movilidad de tableros · Digest personal, Added, Chore, Fixed

### Community 109 - "Sub-fase 2.1: Supabase Storage + Identidad visual *(Completada — 2026-03-27)*"
Cohesion: 0.40
Nodes (5): Foto de perfil ✅, Portada visual de espacios de trabajo ✅, Sub-fase 2.1: Supabase Storage + Identidad visual *(Completada — 2026-03-27)*, Supabase Storage ✅, Tipo de espacio de trabajo ✅

### Community 112 - "2026-05-27 — Audit Mariana Trench: 2 críticos detectados y mitigados"
Cohesion: 0.50
Nodes (4): [0.7.0] — 2026-03-25 — Sesión 6: UI Polish — display name, logo, mini-kanban, espacios de trabajo, Identidad visual, Lenguaje, WorkspaceDashboard

### Community 145 - "Bloque C — Features producto (no security)"
Cohesion: 0.50
Nodes (4): Bloque C — Features producto (no security), C.1 — UX críticas, C.2 — Colaboración, C.3 — Integraciones

### Community 156 - "Phase 2 — Workspaces *(Completada — 2026-03-24/25)*"
Cohesion: 0.50
Nodes (4): Backend ✅, Frontend ✅, Phase 2 — Workspaces *(Completada — 2026-03-24/25)*, UX/Branding ✅

### Community 169 - "media.js"
Cohesion: 0.18
Nodes (14): requireWorkspaceMember(), requireWorkspaceRole(), resolveWorkspaceIdFromBoard(), resolveWorkspaceIdFromCard(), resolveWorkspaceIdFromColumn(), { supabaseAdmin }, express, multer (+6 more)

### Community 179 - "[1.1.5] - 2026-04-13/14"
Cohesion: 0.50
Nodes (4): [1.1.5] - 2026-04-13/14, Added, Docs, Fixed

## Knowledge Gaps
- **741 isolated node(s):** `Added`, `Security`, `Fixed`, `Added`, `Changed` (+736 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **76 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCategories()` connect `Category Management` to `App.jsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `createCategory()` connect `Category Management` to `Express App & Routers`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `updateCategory()` connect `Category Management` to `Express App & Routers`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `Added`, `Security`, `Fixed` to the rest of the system?**
  _741 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Card & Board API` be split into smaller, more focused modules?**
  _Cohesion score 0.09098639455782313 - nodes in this community are weakly interconnected._
- **Should `React & UI Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `Backend & Server Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._