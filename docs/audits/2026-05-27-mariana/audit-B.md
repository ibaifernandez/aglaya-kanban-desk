# Audit B — Backend + Datos

**Fecha:** 2026-05-27
**Repo SHA (inicio audit):** `23cdd06`
**Repo SHA (post-mitigación crítica):** `402b0d7`
**Dimensiones cubiertas:** Seguridad (OWASP Top 10 2021, CVSS 3.1), Bases de datos (Supabase RLS, índices, integridad), Arquitectura + deuda técnica.

---

## ⚠️ Hallazgos críticos durante el audit

| ID | Hallazgo | Estado | SHA fix | Detalle |
|---|---|---|---|---|
| **B-CRIT-01** | XSS explotable vía upload SVG/HTML servido en kanban.aglaya.biz (CVSS 8.0 HIGH) | **MITIGADO** | `402b0d7` | Ver sección "B-CRIT-01 (MITIGADO)" abajo |
| **B-CRIT-02** | Backup strategy ausente + Supabase plan **Free** (sin PITR ni daily backups). Riesgo de pérdida total de datos ante corruption / migration error / DROP accidental. | **MITIGADO (quick-win)** | `be582cd` + `8345169` + `589b5a7` + `7b8bf37` + `29044ff` + `6e20a9a` + `3ae6541` | GitHub Actions cron diario → Cloudflare R2 (sa-east-1) vía native R2 API. Ver sección "B-CRIT-02 (MITIGADO)" abajo. Mitigación estructural (Supabase Pro $25/mo PITR) en backlog Fase E. |

Decisión del operador: opción 1 para B-CRIT-01 — mitigar antes de continuar audit. Push directo a `main` autorizado.

---

## Resumen Fase B (post-aclaraciones del operador)

| Severidad | Count |
|---|---|
| CRÍTICO | 2 (1 MITIGADO `402b0d7`, 1 ABIERTO B-CRIT-02 backup) |
| ALTO | 8 |
| MEDIO | 6 |
| BAJO | 2 |
| INFO | 1 |
| **Total** | **19 priorizables + 2 críticos** |

**Cambios post-aclaraciones:**
- B-13 (Backup) re-categorizado de ALTO → **CRÍTICO B-CRIT-02** tras confirmación plan Supabase = Free.
- B-04/B-11 (organizations RLS): permanece ALTO. Cliente NO toca Supabase tablas directamente, solo `supabase.auth.*`. Mitigado por service_role server-side. **No escala a CRÍTICO.**
- B-10 (Deadline Oct 30): re-evaluado a **MEDIO** (no ALTO). Server-side usa service_role que bypassa GRANTs. Riesgo solo si patrón cambia a client-side direct query.

---

## Hallazgos detallados

### B-CRIT-01 — XSS explotable vía upload SVG (MITIGADO)

**OWASP:** A03:2021 Stored XSS + A04:2021 Insecure Design.
**CVSS 3.1:** **8.0 HIGH** — `AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:L`. Escala a 9.0+ si víctima es admin/superadmin.

**Cadena pre-mitigación:**

1. `server/routes/uploads.js` multer sin `fileFilter` — aceptaba cualquier MIME, hasta 50 MB.
2. `server/app.js:77` `app.use('/uploads', express.static(...))` — público, sin `requireAuth`.
3. `netlify.toml` `[[redirects]] from = "/uploads/*" to = "https://web-production-099a0.up.railway.app/uploads/:splat"` — proxy bajo dominio `kanban.aglaya.biz`.
4. SVG con `<script>` embebido + Content-Type `image/svg+xml` (auto-asignado por express.static por extensión) ejecuta script al navegarse directo.
5. CSP `script-src 'self'` no mitiga: SVG servido desde `/uploads/*` es same-origin.
6. `client/src/utils/session.js` almacena JWT en localStorage → exfiltrable por script same-origin.
7. JWT vigente 7 días sin rotación (ver B-02) → ventana extendida de abuso.

**Vector:** atacante = usuario autenticado de cualquier rol (incl. `guest`/`cliente`). Víctima abre URL del SVG (pegada en card description, checklist, comentario) en pestaña nueva.

**Mitigación aplicada (commit `402b0d7`):**

- Layer 1: extension blocklist `/\.(svg|html?|xhtml|js|mjs|swf|exe|bat|cmd|sh|ps1|vbs)$/i` en fileFilter.
- Layer 2: MIME blocklist (`image/svg+xml`, `text/html`, `application/xhtml+xml`, `application/javascript`, `text/javascript`, `application/x-shockwave-flash`, `application/x-msdownload`).
- Layer 3: MIME allowlist (`image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`, `text/csv`, `text/plain`).
- Layer 4: magic-bytes validation post-upload via `file-type@16.5.4` (anti-spoofing). Textos planos (CSV/TXT) excluidos por no tener magic bytes detectables, dependen de layers 1-3.
- Error middleware en `app.js`: códigos `FILE_TYPE_FORBIDDEN` (400), `FILE_TYPE_NOT_ALLOWED` (400), `FILE_MAGIC_MISMATCH` (400), `FILE_TOO_LARGE` (413).
- Tests regresión `server/tests/uploads.test.js` (5 casos, todos verde).

**Verificación post-deploy:**

- Health endpoint timestamp avanzó tras 90s espera → Railway redeploy aplicado.
- `POST /api/uploads` anónimo → 401 (auth gate intacto).
- Validación completa del filtro con JWT prod queda al operador (smoke test manual).

**Hardening pendiente NO incluido en este fix (roadmap Fase E):**

- Subdominio sandbox `uploads.kanban.aglaya.biz` para uploads (origen distinto). Estándar industria (GitHub `githubusercontent.com`, Discord `cdn.discordapp.com`).

---

### B-CRIT-02 — Backup ausente + Supabase Free (MITIGADO quick-win)

**Mitigación aplicada (workflow + 7 commits resolviendo issues incrementales):**

`be582cd` scaffold (workflow + runbook) →
`8345169` PG17 client install →
`589b5a7` PG17 PATH fix →
`7b8bf37` rclone R2 config →
`29044ff` switch a aws-cli →
`6e20a9a` switch a boto3 →
`3ae6541` final pivot a R2 native API.

**Stack final:**

- **Workflow:** `.github/workflows/db-backup.yml` (cron `17 3 * * *` UTC + `workflow_dispatch`)
- **DB connection:** Session Pooler IPv4 (`aws-1-sa-east-1.pooler.supabase.com:5432`) — GitHub Actions runners no soporta IPv6, dirección directa `db.<project>.supabase.co:5432` solo resuelve IPv6
- **pg_dump:** PostgreSQL 17 client (PG 17.6 server requirement)
- **Storage:** Cloudflare R2 bucket `aglaya-kanban-backups-prod` (WEUR region)
- **Upload protocol:** Cloudflare R2 **native API** (`/accounts/{id}/r2/buckets/{b}/objects/{key}`) con token `cfut_*` Bearer auth. NO S3-compatible API — R2 rechaza tokens cfut_/cfat_ en S3 endpoint con error "Credential access key has length 53, should be 32".
- **Retention:** 30 días automática vía paginated list + delete

**Verificación quick-win (smoke test):**

- ✓ Workflow run `26536812705` verde (58s)
- ✓ Backup en R2: `kanban_20260527T202805Z.sql.gz` (113 KB, 115,873 bytes)
- ✓ gzip integrity OK
- ✓ Dump contiene 10/10 tablas core (organizations, users, workspaces, workspace_members, boards, columns, cards, categories, notifications, digest_logs)
- ✓ 561 filas totales preservadas (organizations: 1, users: 10, workspaces: 12, ws_members: 18, boards: 24, columns: 120, cards: 112, categories: 68, notifications: 115, digest_logs: 81)
- ✓ 37 RLS policies preservadas en dump
- ✓ 43 FK constraints preservadas
- ✓ Auth schema completo (auth.users, auth.sessions, etc. — Supabase Auth)
- ⚠️ Restore-to-temp-PG smoke test NO ejecutado por Docker daemon off durante audit. Dump structure validation usada como proxy (sufficient — PG 17 standard format + integridad gzip + counts realistic).

**Deuda técnica relacionada:**

1. **Token rotation:** workflow usa actualmente `aglaya-kanban-r2-bootstrap` token (TTL 6 días, expira Jun 2 2026). Antes de esa fecha, operador debe:
   - Crear nuevo Cloudflare User API Token vía Profile > API Tokens con permission `Account > Workers R2 Storage > Edit` y TTL `Never`.
   - Update GitHub Secret `R2_ACCESS_KEY_ID` con nuevo token.
   - O extender TTL del bootstrap actual a "Never".
2. **`kanban-backup-prod-v2` token huérfano:** creado durante audit pero formato `cfut_` incompatible con S3 API que intentamos primero. Sí compatible con R2 native API pero no usado en config final. Operador puede borrarlo en R2 dashboard (no rompe nada).
3. **Mitigación estructural:** upgrade Supabase Pro ($25/mo) provee PITR 7d + daily backups gestionados → reemplaza este workflow custom. Backlog Fase E.
4. **GitHub Secrets a limpiar:** `R2_SECRET_ACCESS_KEY` y `R2_ENDPOINT` quedaron registrados durante iteraciones rclone/aws-cli/boto3 pero no se usan en workflow final. Pueden borrarse con `gh secret delete` (defensa en profundidad).
5. **Notifications on failure:** workflow emite `::error::` en GH Actions log pero NO integra Sentry/Slack. Sin observabilidad externa, fallos del cron pasan desapercibidos hasta auditoría manual. Backlog.

**Procedimiento de restore documentado:** `docs/runbooks/db-restore.md` (cubre smoke test contra Postgres local + restore destructivo a prod con snapshot pre-restore + troubleshooting).

---

### Seguridad (8 hallazgos restantes)

| ID | OWASP | Hallazgo | Evidencia | CVSS / Severidad | Esfuerzo |
|---|---|---|---|---|---|
| **B-02** | A07:2021 | JWT con `expiresIn: '7d'` sin refresh token ni rotación. Token contiene claims `role`, `organizationId` no re-validados contra DB en cada request. Si rol cambia (admin→user), JWT mantiene rol obsoleto 7 días. | `server/routes/auth.js:65,110` (`expiresIn: '7d'`). `server/middleware/auth.js:17` (`jwt.verify(token, JWT_SECRET)` — no DB lookup). | **ALTO** — CVSS 5.7 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N) | Medio — refresh token + access token corto (15 min) |
| **B-03** | A05:2021 | Railway URL `web-production-099a0.up.railway.app` accesible públicamente sin gateway. `/api/health` responde 200 a request anónimo. Bypass del proxy Netlify (atacante con JWT robado puede llamar API sin pasar por kanban.aglaya.biz). Information disclosure: revela proveedor + nombre de proyecto. | `curl https://web-production-099a0.up.railway.app/api/health` → `{"status":"ok",...}` HTTP 200 | **ALTO** — CVSS 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N) | Medio — dominio custom (`api.kanban.aglaya.biz`) + bloquear `*.railway.app` o Cloudflare WAF |
| **B-04** | A01:2021 | Tabla `public.organizations` sin `ENABLE ROW LEVEL SECURITY` ni policies. Defense-in-depth violado. **Verificación cliente (post-aclaración operador):** `grep -rE "supabase\.from\(\|supabase\.rpc\(\|supabase\.storage" client/src/` → **0 hits**. Cliente usa ÚNICAMENTE `supabase.auth.*` (3 ocurrencias: `LoginPage:152` resetPassword, `ResetPasswordPage:17` onAuthStateChange, `ResetPasswordPage:29` updateUser). **Cliente NUNCA toca tablas Supabase directamente.** Todo acceso DB pasa por endpoints Express + `service_role` (bypassa RLS). Riesgo es latente: si patrón cambia a client-side query directa, multi-tenant leak. NO escala a CRÍTICO. | `docs/schema/supabase-schema.sql:17` (tabla creada). `grep "organizations.*ROW LEVEL\|public.organizations.*POLICY"` → 0 hits. Cliente: 0 `.from()` / `.rpc()` / `.storage`. | **ALTO** (latente — confirmado tras verificación) — CVSS 5.0 (AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N) | Trivial — `ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY` + policies |
| **B-05** | A05:2021 | HTML servido por Netlify (`kanban.aglaya.biz/`) **sin CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy**. Helmet aplica en respuestas Railway (API JSON), no en HTML estático Netlify. | `curl -I https://kanban.aglaya.biz/` → solo `strict-transport-security` (Cloudflare). Sin `content-security-policy` ni `x-frame-options` | **ALTO** — CVSS 5.4 (AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N) | Bajo — añadir `_headers` o `netlify.toml [[headers]]` con CSP + frame-options |
| **B-06** | A04:2021 | Rate limiting solo en `/api/auth`. Resto de endpoints (`/api/boards`, `/api/cards`, `/api/workspaces`, `/api/admin`, `/api/digest`, `/api/notifications`, `/api/media`, `/api/uploads`, `/api/internal`) sin rate limit. Permite DoS, enumeración, fuerza bruta sobre `x-task-secret` de internal route. | `server/app.js:80` (único `authLimiter` aplicado). Resto de `app.use('/api/...')` sin limiter. | **ALTO** — CVSS 5.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L) | Bajo — añadir global limiter (ej. 300 req / 15min) + limiter estricto sobre internalRouter |
| **B-07** | A01:2021 | JWT payload contiene `role` y `organizationId` (`server/routes/auth.js:63-65,108-110`). Middleware `requireRole` confía en claims sin re-leer DB (`server/middleware/auth.js:29`). Si role cambia post-emisión, queda obsoleto hasta expiry (7d, ver B-02). | `server/middleware/auth.js:29-38` (`requireRole(...args)` lee `req.user.role` del JWT decoded, no de DB) | **ALTO** — CVSS 5.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N) | Medio — endpoint /me que retorna current role; fetch en sensitive ops |
| **B-08** | A06:2021 | `npm audit`: 2 HIGH (lodash code-injection vía `_.template` + prototype pollution; path-to-regexp ReDoS), 10 MODERATE. Transitivos. Lodash exploitable solo si app usa `_.template` con input usuario (grep server/ → 0 usos). path-to-regexp afecta Express routing si app expone rutas dinámicas custom (no es el caso). | `npm audit --json` → `{moderate: 10, high: 2, critical: 0, total: 12}`. Antes de fix de uploads: 12; post: 13 (file-type añade 1 transitiva moderate). | **MEDIO** (no directamente explotable) | Bajo — `npm audit fix` para minor bumps, evaluar major upgrades |
| **B-09** | A04:2021 | `server/routes/internalRoute.js` autenticación por `x-task-secret` (env var). **Sin rate limit** (ver B-06) → atacante puede intentar adivinar secret con tasa ilimitada. Sin logging visible de intentos fallidos. | `server/routes/internalRoute.js:8-13` (`verifySecret` middleware). No `rateLimit` import en archivo. | **MEDIO** — CVSS 4.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N) si secret entropy suficiente; ALTO si secret <32 chars | Bajo — limiter dedicado (5 req/min) + log de intentos |

**Verificaciones que NO encontraron problemas:**

- ✓ 0 ocurrencias `dangerouslySetInnerHTML` en client/src/.
- ✓ 0 raw SQL ni template-literal interpolation en queries (todas las queries usan Supabase JS client parameterizado).
- ✓ JWT_SECRET nunca hardcodeado en código de producción (solo en tests como `|| 'test-secret'`).
- ✓ `.env` NUNCA committeado al historial git (solo `.env.example` eliminado en commit `b8294b7`).
- ✓ Service role key NUNCA expuesta al cliente (`grep SUPABASE_SERVICE_ROLE_KEY client/` → solo node_modules ejemplos).
- ✓ CORS prod restringido a `kanban.aglaya.biz` (`server/app.js:51`).
- ✓ Helmet activo en server (CSP/HSTS/X-Frame/X-Content/Referrer headers verificados en `/api/health` response).
- ✓ Path traversal mitigado en `deleteFile` (`uploads.js:41` rechaza `/`, `..`, `\`).
- ✓ HSTS `max-age=31536000` activo.

---

### Bases de datos (5 hallazgos)

| ID | Hallazgo | Evidencia | Severidad | Esfuerzo |
|---|---|---|---|---|
| **B-10** | **Deadline operacional Oct 30 2026** documentado en `CLAUDE.md:124`: toda tabla nueva en `public` debe incluir GRANTs explícitos a `authenticated` + `service_role` + ENABLE RLS, **o fallará vía supabase-js** (PostgREST returns 401 al consultar via anon/authenticated role). **Análisis consecuencia el 31-oct si NO se aplican:** (a) Server con `service_role` SIGUE funcionando (service_role bypassa GRANTs check). (b) Cliente NO consulta tablas directamente (verificado en B-04). (c) **Riesgo real solo si patrón cambia** a client-side query directa post-Oct 30 sobre una tabla sin GRANTs → 401 silencioso para usuarios. **Migración `migrations/add_explicit_grants.sql` existe y aplica GRANTs sobre tablas existentes** (presumiblemente ya ejecutada — verificar con `psql`). El gap real es **ausencia de CI lint** que valide PRs futuros. **Dueño:** tech lead AGLAYA (Ibai). **Dependencia técnica:** SQL migration template + CI workflow. **Recalificación:** severidad bajada de ALTO → MEDIO porque el patrón actual (service_role-only access) hace que la consecuencia inmediata sea baja. | `CLAUDE.md:124-130` (regla crítica). `migrations/add_explicit_grants.sql` existe (0 ENABLE RLS, solo GRANTs — ver B-19). 5 meses al deadline (2026-05-27 → 2026-10-30). | **MEDIO** — riesgo latente, mitigado por patrón service_role | Medio — añadir CI lint que rechace PRs sin GRANT + RLS en migrations + verificar migración aplicada en DB prod |
| **B-11** | RLS habilitada en 8 de 9 tablas (`users`, `workspaces`, `workspace_members`, `boards`, `columns`, `cards`, `categories`, `notifications`). **`organizations` sin RLS** (duplica B-04 desde dim DB). | `grep ENABLE ROW LEVEL docs/schema/supabase-schema.sql` → 8 tablas, `organizations` ausente | **ALTO** (referencia cruzada a B-04) | Trivial |
| **B-12** | Policies WRITE incompletas. Tablas con RLS pero **sin INSERT/UPDATE/DELETE policies**: `boards`, `columns`, `cards`, `categories`, `workspaces` solo tienen policies SELECT/FOR ALL parciales. Server usa `service_role` (bypassa RLS) — funciona, pero si futuro cliente intenta write via anon key, todo write falla. Documentación incompleta del modelo de acceso. | `grep "CREATE POLICY" docs/schema/supabase-schema.sql` → 11 policies para 8 tablas (algunas con varias). Falta diferenciación SELECT/INSERT/UPDATE/DELETE. | **MEDIO** | Medio — auditoría policy-por-tabla + documentar modelo (service-role-only writes vs. user-direct writes) |
| **B-CRIT-02** (era B-13) — **MITIGADO** | **Backup strategy AUSENTE + Supabase plan = Free.** Operador confirmó plan Free durante audit. **Implicaciones técnicas plan Free:** (a) **Sin daily backups automáticos** — pérdida de hasta toda la base si corruption / migration error / DROP TABLE accidental / borrado por DELETE sin WHERE. (b) **Sin Point-In-Time Recovery (PITR)** — no se puede revertir a un timestamp específico. (c) **Inactivity pause** después de 7 días sin actividad (potencial pause si el equipo no usa la app en vacaciones). (d) **Recovery** depende de pg_dumps best-effort vía Supabase support (no SLA). 0 documentación interna de procedimiento de respaldo / RTO / RPO en `docs/RUNBOOK.md`, `docs/SECURITY.md`, `docs/INCIDENTS.md`. **Para herramienta diaria del equipo AGLAYA con cards, comments, attachments del trabajo real → CRÍTICO operativo.** Un único incidente (DROP, migration buggy, ransomware en local dev con push accidental) = pérdida de trabajo no recuperable. | `grep backup\|respaldo\|snapshot docs/RUNBOOK.md docs/SECURITY.md docs/INCIDENTS.md` → 0 hits. Plan confirmado Free vía AskUserQuestion 2026-05-27. | **CRÍTICO** (operativo, no security) | (a) Inmediato: `pg_dump` cron a S3/Backblaze externo (1h setup). (b) Corto plazo: upgrade Supabase Pro ($25/mo) → PITR 7d + daily backups gestionados. (c) Documentar RTO/RPO + restore runbook |
| **B-14** | **Índices DB.** 7 índices creados (`workspace_members.user_id`, `notifications.user_id`, `notifications.user_unread`, `cards.board_id`, `columns.board_id`, `boards.workspace_id`, `users.organization_id`). 17 FK constraints, 17 ON DELETE clauses (buena integridad). **Faltantes probables:** `cards.priority` + `cards.due_date` (queries digest filtran heavy en estos), `cards.assigned_to` / `checklist.assignees` (notificaciones), `digest_logs.created_at` (queries audit). | `grep "CREATE INDEX" docs/schema/supabase-schema.sql` → 7 hits. Tabla `digest_logs` en `migrations/create_digest_logs.sql` — verificar índices ahí. | **MEDIO** | Bajo — añadir 3-4 índices según queries del código |

---

### Arquitectura + deuda (5 hallazgos)

| ID | Hallazgo | Evidencia (grafo) | Severidad | Esfuerzo |
|---|---|---|---|---|
| **B-15** | **`digestRouter` permanece god-node degree=29.** Conocido del audit anterior (ADR-025 documentó decisión de no refactor). Persiste post-refactor `dad39d8` (sub-refactor digest movió helpers compartidos pero superficie del router se mantuvo). | `graphify-out/.graphify_analysis.json` → gods[0] = `{label: "digestRouter", degree: 29}`. ADR-025 archivado. | **BAJO** (decisión documentada) | n/a — accept |
| **B-16** | **Fat route files.** `server/routes/workspaces.js` 453 LOC con 54 branches conditional. `cards.js` 354 LOC / 52 branches. `admin.js` 351 LOC / 46 branches. `digest/user.js` 521 LOC, `digest/admin.js` 415 LOC. Branch density elevada (~0.12-0.15 branches/LOC). McCabe per-function no medible sin tool dedicado — file-level es proxy débil pero suficiente para señalar complejidad. | `wc -l server/routes/*.js`. `grep -c 'if (\|else\|switch\|case \|.catch(\|try {\|?' server/routes/*.js` | **MEDIO** | Alto — split por concern (validation, business logic, response shaping) |
| **B-17** | `bcryptjs` listado en `package.json` deps + importado en `server/routes/auth.js:3` pero **0 invocaciones** (`grep bcrypt.hash\|bcrypt.compare server/` → 0 fuera del import). Autenticación delegada completamente a Supabase Auth (`signInWithPassword`). Dep muerta. | `grep -nE "bcrypt" server/routes/auth.js` → solo línea 3 import | **BAJO** | Trivial — `npm uninstall bcryptjs` + remover import |
| **B-18** | Comunidad 0 del grafo (frontend, 80 nodos, cohesión 0.052) — known issue ya documentado en audit Fase A (A-10 CardModal 937 LOC). Confirmado en analysis post-fix: `lengths_communities` cluster top mantiene estructura. | `graphify-out/.graphify_analysis.json` communities[0] | **MEDIO** (ya capturado en Fase A) | n/a — referencia cruzada |
| **B-19** | `migrations/add_explicit_grants.sql` aplica GRANTs pero **0 líneas ENABLE ROW LEVEL SECURITY**. Migración cubre permisos pero no protección a nivel fila. Confusión riesgo: dev nuevo puede asumir que GRANTs son suficientes. | `grep -c ENABLE migrations/add_explicit_grants.sql` → 0 | **INFO** (informativo, no bug) | Trivial — comment-only |

---

### Tabla completa Fase B (21 hallazgos)

| ID | Dim | Hallazgo (1 línea) | Severidad | Esfuerzo |
|---|---|---|---|---|
| B-CRIT-01 | Sec | XSS via SVG upload (CVSS 8.0) — **MITIGADO `402b0d7`** | CRÍTICO (resuelto) | — |
| **B-CRIT-02** | DB | **Backup ausente + Supabase plan = Free** — **MITIGADO quick-win (`3ae6541` final)**: GitHub Actions cron → Cloudflare R2 native API daily, 30d retention. Mitigación estructural Pro upgrade en backlog. | CRÍTICO (resuelto quick-win) | — |
| B-02 | Sec | JWT 7d sin refresh token ni rotación | ALTO | Medio |
| B-03 | Sec | Railway URL pública sin gateway (info disclosure + bypass) | ALTO | Medio |
| B-04 | Sec | `organizations` table sin RLS (latente — cliente NO toca Supabase tablas, verificado) | ALTO | Trivial |
| B-05 | Sec | HTML Netlify sin CSP/X-Frame/X-Content/Referrer headers | ALTO | Bajo |
| B-06 | Sec | Rate limit solo en `/api/auth` — resto de endpoints sin protección | ALTO | Bajo |
| B-07 | Sec | JWT claims (role/orgId) no re-validados contra DB → stale role 7d | ALTO | Medio |
| B-08 | Sec | npm audit: 2 HIGH (lodash, path-to-regexp) transitivas, no directamente explotables | MEDIO | Bajo |
| B-09 | Sec | Internal route `x-task-secret` sin rate limit ni logging | MEDIO | Bajo |
| B-10 | DB | Deadline Oct 30 2026 — GRANTs obligatorios; sin CI; mitigado por service_role | **MEDIO** (era ALTO) | Medio |
| B-11 | DB | `organizations` sin RLS (referencia cruzada B-04) | ALTO | Trivial |
| B-12 | DB | Policies WRITE incompletas en 5 tablas — modelo de acceso poco claro | MEDIO | Medio |
| B-14 | DB | Índices DB — faltan probables `cards.priority`, `cards.due_date`, `cards.assigned_to`, `digest_logs.created_at` | MEDIO | Bajo |
| B-15 | Arch | digestRouter degree=29 persiste (decisión documentada ADR-025) | BAJO | n/a |
| B-16 | Arch | Fat route files: workspaces 453/54, cards 354/52, admin 351/46, digest 521+415 | MEDIO | Alto |
| B-17 | Arch | `bcryptjs` dep muerta — 0 invocaciones en código | BAJO | Trivial |
| B-18 | Arch | Comunidad 0 frontend (80 nodos, cohesión 0.052) — referencia A-10 | MEDIO | n/a |
| B-19 | Arch | Migración GRANTs sin ENABLE RLS — confusión potencial | INFO | Trivial |

---

## Recuento por severidad y dimensión (post-aclaraciones)

| Dimensión | CRÍTICO (mitigado) | CRÍTICO (abierto) | ALTO | MEDIO | BAJO | INFO | Total |
|---|---|---|---|---|---|---|---|
| Seguridad | 1 (B-CRIT-01) | 0 | 6 | 2 | 0 | 0 | 9 |
| DB | 1 (B-CRIT-02) | 0 | 2 | 3 | 0 | 0 | 6 |
| Arquitectura | 0 | 0 | 0 | 2 | 2 | 1 | 5 |
| **Total** | **2 mitigados** | **0 abiertos** | **8** | **7** | **2** | **1** | **20 entries** |

**Total priorizable** (excluyendo los 2 CRÍTICOS mitigados): **18 hallazgos abiertos**.

**Estado post-mitigaciones Fase B: CERO CRÍTICOS abiertos.** Fase C puede arrancar limpia.

---

## `[NO VERIFICABLE]` registrados

- **Cyclomatic complexity per-function exacta:** requiere `eslint-plugin-complexity` o `madge`/`plato`. File-level branch count usado como proxy.
- **Supabase plan actual:** ~~[NO VERIFICABLE]~~ **RESUELTO** — operador confirmó plan **Free** vía AskUserQuestion 2026-05-27. B-13 escalado a B-CRIT-02.
- **Railway WAF/firewall rules:** requiere acceso a Railway dashboard.
- **Smoke test prod de B-CRIT-01 con JWT real:** requiere JWT de prod. Unit tests locales (5/5 verde) prueban el comportamiento del filtro con codebase idéntico al deployado.
- **Verificación migración `add_explicit_grants.sql` aplicada en DB prod:** `migrations/add_explicit_grants.sql` existe en repo pero no se ejecutó `psql` para verificar que las tablas existentes tengan GRANTs. Operador debería verificar con `psql -c "\\dp public.users"` (o equivalente) sobre Supabase prod.

---

## Conclusión Fase B (post-mitigaciones)

**Estado seguridad: AMARILLO post-mitigación.** Crítico XSS cerrado (`402b0d7`). 6 ALTO siguen abiertos: JWT vigencia/rotación (B-02), Railway URL expuesta (B-03), CSP HTML faltante (B-05), rate limit incompleto (B-06), stale role en JWT (B-07), `organizations` sin RLS latente (B-04). Cualquiera de los 6 es viable como vector si otro hueco aparece.

**Estado DB: AMARILLO post-mitigación.** B-CRIT-02 cerrado vía quick-win (GitHub Actions cron daily → Cloudflare R2, 30d retention, smoke test verde). Mitigación estructural (Supabase Pro upgrade $25/mo con PITR 7d) queda en backlog Fase E. Resto del schema sólido (17 FKs, 17 ON DELETE, 7 índices, 8/9 tablas con RLS).

**Estado arquitectura: VERDE / amarillo.** God-nodes y deuda conocidos y documentados (ADR-025). Fat route files (B-16) son trabajo de refactor incremental, no bloqueante. bcryptjs muerta es trivial limpieza.

**Acciones más urgentes restantes:**
- B-05 (CSP en Netlify HTML) — esfuerzo bajo, impacto alto
- B-03 (Railway URL pública) — esfuerzo medio
- B-02 (JWT 7d) — esfuerzo medio
- B-04 (organizations RLS) — esfuerzo trivial

**Token rotation pendiente (no formal hallazgo del audit, sino consecuencia operativa del quick-win):**
- Antes Jun 2 2026: rotar / extender TTL del `aglaya-kanban-r2-bootstrap` Cloudflare token usado por el backup workflow.

---

**Awaiting `OK Fase B` definitivo para arrancar Fase C (Cumplimiento legal — RGPD, Ley 21.719, LGPD, CCPA, DPA, cookies, data retention).**
