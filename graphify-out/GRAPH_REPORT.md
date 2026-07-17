# Graph Report - aglaya-kanban-desk  (2026-07-13)

## Corpus Check
- 122 files · ~111,134 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 760 nodes · 1275 edges · 59 communities (46 shown, 13 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `58122334`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Card & Board API
- React & UI Dependencies
- Backend & Server Dependencies
- Architecture & Design Decisions
- Authentication & Authorization
- Security & Compliance Audit
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
- Login & Auth UI
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
- Digest Filtering Tests
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
- Sidebar.jsx

## God Nodes (most connected - your core abstractions)
1. `useEscapeKey()` - 23 edges
2. `_request()` - 23 edges
3. `supabaseAdmin` - 21 edges
4. `api` - 19 edges
5. `ARCHITECTURE.md — Technical Design & ADRs` - 19 edges
6. `useFocusTrap()` - 16 edges
7. `AGLAYA Kanban Desk` - 14 edges
8. `useCategoriesCtx()` - 12 edges
9. `public.users` - 10 edges
10. `Spinner()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Supabase — Database/Auth/Storage Platform` --conceptually_related_to--> `resend`  [INFERRED]
  docs/audits/2026-05-27-mariana/audit-B.md → package.json
- `AGLAYA Logo — Red SVG` --represents--> `AGLAYA Kanban Desk`  [EXTRACTED]
  client/src/assets/aglaya-favicon-rojo.svg → README.md
- `AGLAYA Logotype — Color` --represents--> `AGLAYA Kanban Desk`  [EXTRACTED]
  client/src/assets/aglaya-logo-color.svg → README.md
- `Runbook — Key & Secret Rotation` --references--> `resend`  [EXTRACTED]
  docs/runbooks/key-rotation.md → package.json
- `useCategories()` --indirect_call--> `createCategory()`  [INFERRED]
  client/src/hooks/useCategories.js → server/routes/categories.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Architecture Decision Records (ADR-011 through ADR-026)** — adr_011, adr_012, adr_014, adr_015, adr_016, adr_017, adr_018, adr_019, adr_020, adr_021, adr_022, adr_023, adr_024, adr_025, adr_026 [EXTRACTED 1.00]
- **Roadmap Phases (Phase 0-5 Progression)** — phase_0, phase_1, phase_2, phase_3, phase_4, phase_5 [EXTRACTED 1.00]
- **Multi-Tenant Auth & Access Control System** — multi_tenant_architecture, row_level_security, user_roles_macro, workspace_roles_micro, workspace_types [INFERRED 0.95]
- **Project Documentation Suite** — claude, agents, docs_architecture, docs_changelog, docs_permissions, docs_security, docs_prd, docs_roadmap, docs_runbook [EXTRACTED 1.00]
- **Production Deployment Stack** — supabase_service, railway_service, netlify_service, resend_service, cloudflare_service [EXTRACTED 1.00]
- **GitHub Actions CI/CD Workflows** — github_ci_yml, github_db_backup_yml, github_digest_cron_yml, github_schema_guard_yml [EXTRACTED 1.00]
- **Mariana Audit Phases A-D Framework** — audit_mariana_a, audit_mariana_b, audit_mariana_c, audit_mariana_d, audit_mariana_report [EXTRACTED 1.00]
- **Legal Compliance Frameworks — RGPD/LGPD/Ley 21.719** — rgpd, lgpd, ley_21_719, audit_mariana_c [EXTRACTED 1.00]
- **Backup & Disaster Recovery System — B-CRIT-02 Mitigation** — db_backup_workflow, docs_runbooks_db_restore_runbook, cloudflare_r2, supabase, github_actions [EXTRACTED 1.00]
- **Security & Operations Procedures** — docs_runbooks_key_rotation_runbook, docs_runbooks_db_restore_runbook, docs_runbooks_railway_custom_domain_runbook, docs_operator_checklist [INFERRED 0.85]
- **Infrastructure & Platform Ecosystem** — supabase, railway, cloudflare_r2, netlify, resend, github_actions [INFERRED 0.80]

## Communities (59 total, 13 thin omitted)

### Community 0 - "Card & Board API"
Cohesion: 0.09
Nodes (48): Any, _api_base(), assign_card(), assign_checklist_item(), _board_of_column(), _cfg(), clear_workspace(), create_board() (+40 more)

### Community 1 - "React & UI Dependencies"
Cohesion: 0.04
Nodes (48): autoprefixer, dependencies, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, lucide-react, react, react-dom (+40 more)

### Community 2 - "Backend & Server Dependencies"
Cohesion: 0.04
Nodes (48): concurrently, cookie-parser, cors, dotenv, express, express-rate-limit, file-type, helmet (+40 more)

### Community 3 - "Architecture & Design Decisions"
Cohesion: 0.05
Nodes (46): ADR-011 — Brand Consolidation, ADR-012 — Jest Downgrade for Stability, ADR-014 — Permission Alignment & Session Migration, ADR-015 — Admin Invite Resilience, ADR-016 — Supabase Client Isolation, ADR-017 — Explicit Workspace Context for Cards, ADR-018 — Consistent Overlay & Destructive Action UX, ADR-019 — Contextual Digest per Workspace (+38 more)

### Community 4 - "Authentication & Authorization"
Cohesion: 0.06
Nodes (29): getUserFromDb(), invalidateUserCache(), jwt, requireAuth(), requireRole(), { supabaseAdmin }, userCache, ALLOWED_ROLES (+21 more)

### Community 5 - "Security & Compliance Audit"
Cohesion: 0.08
Nodes (36): Audit Mariana — Security & Compliance Review, Audit Phase A — UX/A11y/Performance/SEO, Audit Phase A Addendum — A11y Gap Corrections, Audit Phase B — Backend Security + Database, Audit Phase C — Legal Compliance RGPD/LGPD, Audit Phase D — DevOps/Observability/Docs, Audit Mariana Trench — Full Consolidated Report, Cloudflare R2 — Object Storage for Backups (+28 more)

### Community 6 - "Board UI Components"
Cohesion: 0.14
Nodes (15): Board(), PRIORITY_SORT_ORDER, CardModal(), EMPTY, fileIcon(), normalizeAttachments(), CategoryRow(), CategorySettings() (+7 more)

### Community 7 - "Workspace Access Control"
Cohesion: 0.09
Nodes (22): requireWorkspaceMember(), requireWorkspaceRole(), resolveWorkspaceIdFromBoard(), resolveWorkspaceIdFromCard(), resolveWorkspaceIdFromColumn(), { supabaseAdmin }, express, multer (+14 more)

### Community 8 - "Express App & Routers"
Cohesion: 0.08
Nodes (25): adminRouter, app, authLimiter, authRouter, cookieParser, cors, digestRouter, express (+17 more)

### Community 9 - "Modal & Sidebar Components"
Cohesion: 0.17
Nodes (10): BoardMoveModal(), ColumnPickerModal(), AddMemberModal(), ROLE_LABELS, WorkspaceMembers(), WS_ROLES, EMOJIS, TYPE_OPTS (+2 more)

### Community 10 - "Email Digest Generation"
Cohesion: 0.16
Nodes (19): buildHtml(), buildStats(), buildSubject(), DIGEST_HOUR, DIGEST_MINUTE, { escHtml, dateLabel, todayStr, DONE_COLUMN_RE }, { logDigestAttempt }, priorityRow() (+11 more)

### Community 11 - "Client Auth Utilities"
Cohesion: 0.27
Nodes (15): fetchWithAuth(), getToken(), refreshAccessToken(), request(), AuthContext, AuthProvider(), clearAuthSession(), clearAuthToken() (+7 more)

### Community 12 - "Card & Column Components"
Cohesion: 0.19
Nodes (13): Card(), SortableCard(), Column(), SortableColumn(), Badge(), COLOR_OPTIONS, colorById(), PRIORITIES (+5 more)

### Community 13 - "Workspace Management UI"
Cohesion: 0.14
Nodes (14): useWorkspaces(), canDeleteWorkspace(), canManageWorkspace(), COLUMN_COLORS, DeleteConfirmModal(), EMOJIS, MiniKanban(), ROLE_LABELS (+6 more)

### Community 14 - "User Digest Formatting"
Cohesion: 0.15
Nodes (19): isOverdue(), buildSection(), buildSubject(), buildUserCards(), checklistBadge(), dueBadge(), { escHtml, dateLabel, todayStr, isOverdue, DONE_COLUMN_RE }, formatDueDate() (+11 more)

### Community 15 - "Internal Routes & Logging"
Cohesion: 0.15
Nodes (13): express, router, { supabaseAdmin }, VALID_PRIORITIES, { logDigestAttempt, queryDigestLogs }, { supabaseAdmin }, logDigestAttempt(), queryDigestLogs() (+5 more)

### Community 16 - "Database Schema"
Cohesion: 0.31
Nodes (14): public.boards, public.cards, public.categories, public.columns, public.digest_logs, public.get_my_org_id(), public.get_my_role(), public.get_workspace_role() (+6 more)

### Community 17 - "User Settings UI"
Cohesion: 0.17
Nodes (9): AvatarCropModal(), DigestPreferences(), formatLocalHour(), utcHourToLocal(), UserMenu(), AdminPage(), ASSIGNABLE_ROLES, InviteModal() (+1 more)

### Community 18 - "App Core & Contexts"
Cohesion: 0.27
Nodes (10): api, App(), AuthenticatedApp(), restoreSession(), CategoriesContext, useBoardData(), useBoards(), clearUiState() (+2 more)

### Community 19 - "Login & Auth UI"
Cohesion: 0.24
Nodes (6): SIZE_CLASSES, Spinner(), useAuth(), LoginPage(), ResetPasswordPage(), supabase

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
Cohesion: 0.25
Nodes (6): app, { Sentry, enabled: sentryEnabled }, { validateSmtpConfig, validateDigestSchedules }, { validateSmtpConfig, validateDigestSchedules }, validateDigestSchedules(), validateSmtpConfig()

### Community 24 - "MyBoard Data Migration"
Cohesion: 0.18
Nodes (9): boardIdMap, categoryIdMap, columnIdMap, { createClient }, fs, MYBOARD_PATH, path, supabase (+1 more)

### Community 25 - "Board Management API"
Cohesion: 0.33
Nodes (8): createBoard(), DEFAULT_COLUMNS, deleteBoard(), getBoards(), reorderBoards(), { supabaseAdmin }, toBoard(), updateBoard()

### Community 26 - "Digest Email Route"
Cohesion: 0.22
Nodes (8): { buildUserCards, sendUserDigest, sendAllUserDigests }, { createAdminClient, supabaseAdmin }, express, { getSyncedUserProfile }, { queryDigestLogs }, { requireAuth, requireRole }, router, { sendDigest }

### Community 27 - "Supabase Seeding"
Cohesion: 0.22
Nodes (7): boardIdMap, columnIdMap, { createClient }, fs, path, supabase, tasks

### Community 28 - "Auth Tests"
Cohesion: 0.22
Nodes (5): app, request, { supabaseAdmin, createAdminClient, createPublicClient }, TEST_PROFILE, createPublicClient()

### Community 29 - "Notification Tests"
Cohesion: 0.22
Nodes (6): app, jwt, mockFrom, request, SAMPLE_NOTIFS, TOKEN

### Community 30 - "Workspace Tests"
Cohesion: 0.25
Nodes (7): app, configureMocks(), jwt, makeChain(), mockFreshAdmin, request, { supabaseAdmin }

### Community 31 - "Category Management"
Cohesion: 0.43
Nodes (7): useCategories(), createCategory(), deleteCategory(), getCategories(), { supabaseAdmin }, toCat(), updateCategory()

### Community 32 - "Admin Tests"
Cohesion: 0.25
Nodes (5): app, jwt, request, { supabaseAdmin, createAdminClient }, createAdminClient()

### Community 33 - "Digest Tests"
Cohesion: 0.25
Nodes (6): app, { buildUserCards, sendUserDigest }, { createAdminClient, supabaseAdmin }, jwt, request, workspaceState

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

### Community 40 - "Security Tests"
Cohesion: 0.50
Nodes (3): app, PROTECTED_ROUTES, request

### Community 41 - "Permission Matrix"
Cohesion: 0.67
Nodes (3): PERMISSIONS.md — Role & Access Matrix, User Roles (Macro) — superadmin / admin / colaborador / cliente, Workspace Roles (Micro) — owner / admin / member / guest

## Knowledge Gaps
- **310 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+305 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCategories()` connect `Category Management` to `App Core & Contexts`?**
  _High betweenness centrality (0.164) - this node is a cross-community bridge._
- **Why does `createCategory()` connect `Category Management` to `Express App & Routers`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `updateCategory()` connect `Category Management` to `Express App & Routers`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _310 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Card & Board API` be split into smaller, more focused modules?**
  _Cohesion score 0.09098639455782313 - nodes in this community are weakly interconnected._
- **Should `React & UI Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `Backend & Server Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._