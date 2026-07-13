# Graph Report - .  (2026-07-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 712 nodes · 1162 edges · 67 communities (49 shown, 18 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.54)
- Token cost: 43,027 input · 2,423 output

## Graph Freshness
- Built from commit: `00d1bb07`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Authentication & Authorization
- Kanban UI Components
- Project Architecture
- Accessibility & Compliance
- Server Dependencies
- Express Route Handlers
- JWT Token Management
- Testing & Build Config
- Sidebar & Navigation
- Digest HTML Utilities
- Client Session Management
- Workspace Components
- Frontend Dependencies
- Database Schema
- Notifications & Logging
- Email Digest System
- Modal & Settings UI
- App & Data Hooks
- Digest API Endpoint
- Build Tool Dependencies
- Database Seeding
- Card Operations
- File Upload & Storage
- Login & Auth UI
- Server Init & Monitoring
- Data Migration Scripts
- User Preferences
- Categories Management
- Board Operations
- Supabase Seeding
- Notification Tests
- Workspace Tests
- Frontend Framework
- Admin Route Tests
- Digest Route Tests
- Upload Tests
- Column Operations
- Self-Service Auth Tests
- Build Scripts
- Internal API Routes
- Token Refresh Tests
- Project Metadata
- Card Validation Tests
- Security Tests
- Health Check Tests
- Developer Documentation
- HTML & Assets
- React Framework
- Digest Hour Migration
- Organizations RLS
- Email Templates
- Digest Logs Schema
- Privacy Policy
- Data Deletion (RGPD)
- Data Export (RGPD)
- Digest API Router
- Operations Runbook
- Bundle Performance
- JWT Security Issue
- Public URL Exposure
- High Severity Issues
- Database Backup

## God Nodes (most connected - your core abstractions)
1. `useEscapeKey()` - 23 edges
2. `supabaseAdmin` - 20 edges
3. `api` - 19 edges
4. `useFocusTrap()` - 16 edges
5. `Supabase Schema (PostgreSQL)` - 16 edges
6. `useCategoriesCtx()` - 12 edges
7. `public.users` - 10 edges
8. `Spinner()` - 9 edges
9. `readAuthSession()` - 9 edges
10. `requireAuth()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `React 18` --uses--> `lucide-react`  [EXTRACTED]
  README.md → client/package.json
- `React 18` --uses--> `tailwindcss`  [EXTRACTED]
  README.md → client/package.json
- `React 18` --uses--> `vite`  [EXTRACTED]
  README.md → client/package.json
- `Schema Guard — Migration ↔ Schema Sync` --validates--> `Supabase Schema (PostgreSQL)`  [EXTRACTED]
  .github/workflows/schema-guard.yml → docs/schema/supabase-schema.sql
- `useCategories()` --indirect_call--> `createCategory()`  [INFERRED]
  client/src/hooks/useCategories.js → server/routes/categories.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Project Phase Lifecycle** — phase_1, phase_2, phase_3, phase_4 [EXTRACTED 1.00]
- **Frontend Technology Stack** — react_18, vite, tailwind_css, lucide_react, dnd_kit [EXTRACTED 1.00]
- **Deployment & Infra Stack** — railway, netlify, supabase, cloudflare [EXTRACTED 1.00]
- **Security & Defense Mechanisms** — row_level_security, jwt_auth, helmet_security, rate_limiting, cors_config [EXTRACTED 1.00]
- **Project Documentation Suite** — claude, agents, readme, docs_architecture, docs_roadmap, docs_backlog, docs_changelog [EXTRACTED 1.00]
- **CRITICAL findings requiring immediate mitigation** — finding_b_crit_01_xss, finding_b_crit_02_backup, finding_c_01_privacy_policy, finding_d_01_sentry, finding_d_03_ci_tests, finding_d_05_security_md [EXTRACTED 1.00]
- **RGPD/LGPD/Ley21719 compliance requirements cascade** — finding_c_01_privacy_policy, compliance_rgpd_art_13, compliance_rgpd_art_17, compliance_rgpd_art_20, framework_rgpd, framework_lgpd, framework_ley_21_719 [EXTRACTED 1.00]
- **Stored XSS attack vector (B-CRIT-01) full chain** — finding_b_crit_01_xss, security_issue_xss_vector, framework_owasp_top_10, framework_cvss_3_1, mitigation_402b0d7_xss [EXTRACTED 1.00]
- **Backup/disaster-recovery architecture (B-CRIT-02 mitigation)** — finding_b_crit_02_backup, mitigation_3ae6541_backup, workflow_db_backup, service_cloudflare_r2, service_supabase, runbook_db_restore [EXTRACTED 0.95]
- **Production observability gap (D-01/D-02/D-08 cluster)** — finding_d_01_sentry, finding_d_02_sentry, finding_d_08_alerts [INFERRED 0.80]

## Communities (67 total, 18 thin omitted)

### Community 0 - "Authentication & Authorization"
Cohesion: 0.05
Nodes (38): getUserFromDb(), invalidateUserCache(), jwt, requireAuth(), requireRole(), { supabaseAdmin }, userCache, requireWorkspaceMember() (+30 more)

### Community 1 - "Kanban UI Components"
Cohesion: 0.09
Nodes (25): Board(), PRIORITY_SORT_ORDER, Card(), SortableCard(), CardModal(), EMPTY, fileIcon(), normalizeAttachments() (+17 more)

### Community 2 - "Project Architecture"
Cohesion: 0.06
Nodes (39): ADR-011: Brand Consolidation (AGLAYA), ADR-020: Single-Tenant Model (Intentional), ADR-021: Category FK Migration (UUID), ADR-022: Performance Indexes, ADR-023: Global Error Handler & 404 JSON, ADR-024: app.js / index.js Separation, AGLAYA Kanban Desk, Cloudflare — DNS & R2 Storage (+31 more)

### Community 3 - "Accessibility & Compliance"
Cohesion: 0.07
Nodes (37): A11y — WCAG 1.3.1 Info and Relationships (Level A), ADR-025: Flat API State Management, Audit Mariana Trench — 2026-05-27, Backlog roadmap — 49 medium/low findings across 3 blocks, RGPD Art. 13/14 — Information to data subject, CardModal component — 937 LOC god component, DPA with Supabase — Data Processing Agreement, A-01 CRÍTICO — Labels not associated with inputs (+29 more)

### Community 4 - "Server Dependencies"
Cohesion: 0.07
Nodes (29): cookie-parser, cors, dotenv, express, express-rate-limit, file-type, helmet, jsonwebtoken (+21 more)

### Community 5 - "Express Route Handlers"
Cohesion: 0.08
Nodes (25): adminRouter, app, authLimiter, authRouter, cookieParser, cors, digestRouter, express (+17 more)

### Community 6 - "JWT Token Management"
Cohesion: 0.09
Nodes (14): { createAdminClient, createPublicClient }, express, { getSyncedUserProfile }, jwt, refreshSecret(), { requireAuth, invalidateUserCache }, router, signRefreshToken() (+6 more)

### Community 7 - "Testing & Build Config"
Cohesion: 0.09
Nodes (21): concurrently, jest, description, devDependencies, concurrently, jest, supertest, jest (+13 more)

### Community 8 - "Sidebar & Navigation"
Cohesion: 0.15
Nodes (11): Sidebar(), IconButton(), formatNotification(), NotificationBell(), AddMemberModal(), ROLE_LABELS, WorkspaceMembers(), WS_ROLES (+3 more)

### Community 9 - "Digest HTML Utilities"
Cohesion: 0.18
Nodes (18): dateLabel(), escHtml(), isOverdue(), buildAssignedSection(), buildHtml(), buildSection(), checklistBadge(), dueBadge() (+10 more)

### Community 10 - "Client Session Management"
Cohesion: 0.27
Nodes (15): fetchWithAuth(), getToken(), refreshAccessToken(), request(), AuthContext, AuthProvider(), clearAuthSession(), clearAuthToken() (+7 more)

### Community 11 - "Workspace Components"
Cohesion: 0.16
Nodes (12): useWorkspaces(), canDeleteWorkspace(), canManageWorkspace(), COLUMN_COLORS, EMOJIS, MiniKanban(), ROLE_LABELS, seededRand() (+4 more)

### Community 12 - "Frontend Dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, react-dom, react-easy-crop, react-markdown, remark-gfm (+9 more)

### Community 13 - "Database Schema"
Cohesion: 0.28
Nodes (16): Supabase Schema (PostgreSQL), public.boards, public.cards, public.categories, public.columns, public.digest_logs, public.get_my_org_id(), public.get_my_role() (+8 more)

### Community 14 - "Notifications & Logging"
Cohesion: 0.16
Nodes (13): express, { requireAuth }, router, { supabaseAdmin }, { logDigestAttempt, queryDigestLogs }, { supabaseAdmin }, logDigestAttempt(), queryDigestLogs() (+5 more)

### Community 15 - "Email Digest System"
Cohesion: 0.18
Nodes (15): buildHtml(), buildStats(), buildSubject(), DIGEST_HOUR, DIGEST_MINUTE, { escHtml, dateLabel, todayStr, DONE_COLUMN_RE }, { logDigestAttempt }, priorityRow() (+7 more)

### Community 16 - "Modal & Settings UI"
Cohesion: 0.19
Nodes (10): BoardMoveModal(), ColumnPickerModal(), EMOJIS, TYPE_OPTS, WorkspaceSettings(), useFocusTrap(), AdminPage(), ASSIGNABLE_ROLES (+2 more)

### Community 17 - "App & Data Hooks"
Cohesion: 0.26
Nodes (12): api, App(), AuthenticatedApp(), restoreSession(), useAuth(), CategoriesContext, useBoardData(), useBoards() (+4 more)

### Community 18 - "Digest API Endpoint"
Cohesion: 0.16
Nodes (13): { buildUserCards, sendUserDigest, sendAllUserDigests }, { createAdminClient, supabaseAdmin }, express, { getSyncedUserProfile }, { queryDigestLogs }, { requireAuth, requireRole }, router, { sendDigest } (+5 more)

### Community 19 - "Build Tool Dependencies"
Cohesion: 0.15
Nodes (13): autoprefixer, devDependencies, autoprefixer, marked, postcss, @types/react, @types/react-dom, @vitejs/plugin-react (+5 more)

### Community 20 - "Database Seeding"
Cohesion: 0.19
Nodes (12): COLUMNS, CONTENIDO_CARDS, createBoard(), createCards(), { createClient }, createColumns(), main(), OPERACIONES_CARDS (+4 more)

### Community 21 - "Card Operations"
Cohesion: 0.26
Nodes (12): createAssigneeNotification(), createCard(), createChecklistNotifications(), deleteCard(), getCardsByBoard(), getCardsByColumn(), moveCard(), searchCards() (+4 more)

### Community 22 - "File Upload & Storage"
Cohesion: 0.15
Nodes (11): ALLOWED_MIME, FileType, FORBIDDEN_MIME, fs, multer, path, storage, upload (+3 more)

### Community 23 - "Login & Auth UI"
Cohesion: 0.29
Nodes (4): SIZE_CLASSES, Spinner(), ResetPasswordPage(), supabase

### Community 24 - "Server Init & Monitoring"
Cohesion: 0.25
Nodes (6): app, { Sentry, enabled: sentryEnabled }, { validateSmtpConfig, validateDigestSchedules }, { validateSmtpConfig, validateDigestSchedules }, validateDigestSchedules(), validateSmtpConfig()

### Community 25 - "Data Migration Scripts"
Cohesion: 0.18
Nodes (9): boardIdMap, categoryIdMap, columnIdMap, { createClient }, fs, MYBOARD_PATH, path, supabase (+1 more)

### Community 26 - "User Preferences"
Cohesion: 0.31
Nodes (5): AvatarCropModal(), DigestPreferences(), formatLocalHour(), utcHourToLocal(), UserMenu()

### Community 27 - "Categories Management"
Cohesion: 0.36
Nodes (7): useCategories(), createCategory(), deleteCategory(), getCategories(), { supabaseAdmin }, toCat(), updateCategory()

### Community 28 - "Board Operations"
Cohesion: 0.33
Nodes (8): createBoard(), DEFAULT_COLUMNS, deleteBoard(), getBoards(), reorderBoards(), { supabaseAdmin }, toBoard(), updateBoard()

### Community 29 - "Supabase Seeding"
Cohesion: 0.22
Nodes (7): boardIdMap, columnIdMap, { createClient }, fs, path, supabase, tasks

### Community 30 - "Notification Tests"
Cohesion: 0.22
Nodes (6): app, jwt, mockFrom, request, SAMPLE_NOTIFS, TOKEN

### Community 31 - "Workspace Tests"
Cohesion: 0.25
Nodes (7): app, configureMocks(), jwt, makeChain(), mockFreshAdmin, request, { supabaseAdmin }

### Community 32 - "Frontend Framework"
Cohesion: 0.25
Nodes (8): lucide-react, tailwindcss, vite, @dnd-kit — Drag & Drop, lucide-react, React 18, tailwindcss, vite

### Community 33 - "Admin Route Tests"
Cohesion: 0.25
Nodes (5): app, jwt, request, { supabaseAdmin, createAdminClient }, createAdminClient()

### Community 34 - "Digest Route Tests"
Cohesion: 0.25
Nodes (6): app, { buildUserCards, sendUserDigest }, { createAdminClient, supabaseAdmin }, jwt, request, workspaceState

### Community 35 - "Upload Tests"
Cohesion: 0.25
Nodes (6): app, fs, jwt, path, PNG_SIGNATURE, request

### Community 36 - "Column Operations"
Cohesion: 0.43
Nodes (6): createColumn(), deleteColumn(), getColumns(), { supabaseAdmin }, toColumn(), updateColumn()

### Community 37 - "Self-Service Auth Tests"
Cohesion: 0.29
Nodes (4): app, jwt, mockUserProfile, request

### Community 38 - "Build Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, build:legal, dev, prebuild, preview

### Community 39 - "Internal API Routes"
Cohesion: 0.33
Nodes (4): express, router, { supabaseAdmin }, VALID_PRIORITIES

### Community 40 - "Token Refresh Tests"
Cohesion: 0.33
Nodes (4): app, jwt, mockProfile, request

### Community 41 - "Project Metadata"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 42 - "Card Validation Tests"
Cohesion: 0.40
Nodes (3): app, jwt, request

### Community 43 - "Security Tests"
Cohesion: 0.50
Nodes (3): app, PROTECTED_ROUTES, request

## Knowledge Gaps
- **304 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+299 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCategories()` connect `Categories Management` to `App & Data Hooks`?**
  _High betweenness centrality (0.184) - this node is a cross-community bridge._
- **Why does `createCategory()` connect `Categories Management` to `Express Route Handlers`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `updateCategory()` connect `Categories Management` to `Express Route Handlers`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _304 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Authentication & Authorization` be split into smaller, more focused modules?**
  _Cohesion score 0.05052790346907994 - nodes in this community are weakly interconnected._
- **Should `Kanban UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.09292929292929293 - nodes in this community are weakly interconnected._
- **Should `Project Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.06477732793522267 - nodes in this community are weakly interconnected._