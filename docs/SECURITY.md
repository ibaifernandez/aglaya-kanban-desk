# SECURITY — AGLAYA Kanban Desk

Estado real de seguridad y superficie de ataque. Este documento se sincroniza con cada audit/cambio relevante.

**Última actualización:** 2026-05-27 (post audit Mariana Trench — `docs/audits/2026-05-27-mariana/`)
**Versión actual:** v1.3.1 (fuente única: raíz `package.json`). README badge sincronizado a este valor (2026-07-12).

> **Nota importante:** versiones anteriores de este documento contenían afirmaciones inexactas detectadas durante audit Mariana (D-05). Esta versión refleja el estado real post-mitigaciones.

---

## Estado general post-audit Mariana

| Área | Estado | Detalle (verificado 2026-05-27) |
|---|---|---|
| Autenticación | ✅ | Supabase Auth + JWT firmado por servidor (HS256, `JWT_SECRET`) |
| Autorización middleware | ✅ | `requireAuth` y `requireWorkspaceMember` aplicados en rutas de datos |
| Restricción de dominio | ✅ | `POST /api/auth/register` filtra dominios corporativos |
| **JWT expiración** | 🟠 ALTO abierto | `expiresIn: '7d'` sin refresh token ni rotación (B-02). Si JWT leaks → 7 días de acceso atacante |
| **JWT claims (role, organizationId)** | 🟠 ALTO abierto | No re-validados contra DB en cada request (B-07). Cambio de role queda obsoleto 7d |
| **Persistencia de sesión** | 🟡 MEDIO | JWT en **`localStorage`** (no sessionStorage como decía versión previa de este doc). Riesgo XSS amplificado. Ver C-10 transparencia |
| Security headers HTTP (API) | ✅ | helmet activo en respuestas Railway (CSP/HSTS/X-Frame/X-Content/Referrer) |
| **Security headers HTTP (HTML)** | 🟠 ALTO abierto | Netlify NO añade CSP/X-Frame/X-Content/Referrer/Permissions-Policy en HTML servido (B-05). Solo HSTS de Cloudflare |
| Exposición de claves | ✅ | `SUPABASE_SERVICE_ROLE_KEY` solo backend; `VITE_*` prefix correcto en cliente |
| CORS | ✅ | Origins estrictos (`localhost:5175` dev / `kanban.aglaya.biz` prod) |
| **Rate limiting** | 🟠 ALTO abierto | Aplicado **SOLO en `/api/auth`** (B-06). Resto de endpoints (boards/cards/workspaces/admin/digest/notifications/media/uploads/internal) **sin rate limit** |
| **Internal route `/api/internal/*`** | 🟡 MEDIO abierto | Auth por `x-task-secret` sin rate limit ni logging de intentos (B-09) |
| **Row Level Security (RLS)** | ✅ post-audit | 9/9 tablas con RLS habilitada (organizations habilitada en migración `migration-organizations-rls.sql` durante audit). 8 tablas con políticas SELECT explícitas; WRITE policies parciales (B-12, MEDIO) |
| Aislamiento Supabase clients | ✅ | `auth` y `admin` usan clientes frescos por request |
| **Railway URL pública** | 🟠 ALTO abierto | `web-production-099a0.up.railway.app/api/*` accesible sin gateway (B-03). Bypass de proxy Netlify posible con JWT robado |
| **Uploads XSS** | ✅ MITIGADO | Hallazgo B-CRIT-01 (CVSS 8.0) detectado y resuelto durante audit. SHA fix `402b0d7`. 4-layer defense: ext blocklist + MIME blocklist + allowlist + magic-bytes |
| **Backup strategy** | ✅ MITIGADO quick-win | B-CRIT-02 resuelto: GitHub Actions cron daily → Cloudflare R2. SHA `3ae6541`. Pendiente upgrade Supabase Pro estructural |
| **npm audit** | 🟡 MEDIO abierto | 0 critical, 2 HIGH (lodash code-injection, path-to-regexp ReDoS — transitivas), 11 MODERATE (B-08) |

### Resumen estado

- **Verde:** auth flow, autorización middleware, helmet API, CORS, RLS (post-audit), service_role aislado, uploads XSS resuelto, backup resuelto
- **Amarillo abierto:** JWT 7d + claims stale, localStorage JWT, Railway URL pública, CSP HTML Netlify ausente, rate limit incompleto, npm audit pendientes
- **Mitigado durante audit:** B-CRIT-01 (XSS uploads), B-CRIT-02 (backup), B-04/B-11 (organizations RLS)

---

## Hallazgos abiertos referenciados

Ver `docs/audits/2026-05-27-mariana/audit-B.md` para detalle completo. IDs activos:

| ID | Severidad | Acción |
|---|---|---|
| B-02 | ALTO | JWT refresh token + access token corto |
| B-03 | ALTO | Railway custom domain `api.kanban.aglaya.biz` o Cloudflare WAF |
| B-05 | ALTO | `netlify.toml` `[[headers]]` con CSP + X-Frame-Options + X-Content-Type-Options + Referrer-Policy + Permissions-Policy |
| B-06 | ALTO | Global rate limit (300 req/15min) + estricto sobre `/api/internal` |
| B-07 | ALTO | Re-validación JWT claims contra DB en middleware |
| B-08 | MEDIO | `npm audit fix` non-breaking + evaluar major bumps |
| B-09 | MEDIO | Rate limit + logging en internal route |
| B-12 | MEDIO | Policies WRITE explícitas en boards/columns/cards/categories/workspaces |

---

## Claves y secretos

### Variables de entorno críticas

| Variable | Vive en | Criticidad |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Solo `.env` server | 🔴 CRÍTICO — bypass de RLS |
| `JWT_SECRET` | Solo `.env` server | 🔴 CRÍTICO — firma de tokens |
| `SUPABASE_DATABASE_PASSWORD` | Solo `.env` server | 🔴 CRÍTICO — DDL directo (CLAUDE.md) |
| `RESEND_API_KEY` | Solo `.env` server | 🟠 ALTO — envío emails |
| `TASK_SECRET` | Solo `.env` server (Railway env) | 🟠 ALTO — auth de `/api/internal/*` |
| `DIGEST_CRON_SECRET` | GitHub Secrets + Railway env | 🟠 ALTO — auth cron GitHub Actions |
| `SUPABASE_PAT` | Solo `.env` server | 🟠 ALTO — Supabase Management API |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Server + Cliente (público por diseño) | 🟡 MEDIO — limitada por RLS |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT` / `R2_BUCKET` | GitHub Secrets (workflow backup) | 🟠 ALTO — escritura R2 bucket backups |
| `DATABASE_URL` | GitHub Secrets (workflow backup) | 🔴 CRÍTICO — connection string completa |
| `CF_ACCOUNT_ID` | GitHub Secrets | 🟡 MEDIO — Cloudflare account identifier |
| `ACCOUNT_ID` / `S3_API` | `.env` local | 🟡 MEDIO — Cloudflare account + R2 endpoint |

### Reglas de manejo

- ✅ `.env` bajo `.gitignore`. Verificado: NUNCA committeado al historial git (solo `.env.example` removido `b8294b7`).
- ✅ `VITE_` prefix asegura que solo claves necesarias lleguen al bundle cliente.
- ✅ Service role NUNCA expuesta al cliente (verificado `grep` en client/).
- ⚠️ **Rotación de keys pendiente runbook** (D-18). Bootstrap Cloudflare token `aglaya-kanban-r2-bootstrap` **expira Jun 2 2026** — sin runbook, riesgo silencioso.

---

## Autenticación y autorización

### Flujo actual

1. **Rate limiting** en `/api/auth/*` (20 req / 15 min por IP). Resto endpoints sin rate limit (B-06 abierto).
2. **Domain guard** en `POST /api/auth/register` (`@aglaya.biz`, `@ibaifernandez.com`).
3. **Sign-in** valida contra Supabase Auth (`signInWithPassword`).
4. **JWT issuance** firmado por server (HS256, `JWT_SECRET`), `expiresIn: '7d'` con claims `{id, email, name, role, organizationId}`.
5. **Clientes Supabase separados** (`createAdminClient` vs `createPublicClient`) por request.
6. **Multi-layer auth** en rutas de datos: `requireAuth` + `requireWorkspaceMember`.

### Superficie de ataque

#### Públicos sin auth 🔓

- `POST /api/auth/login` — rate-limited
- `POST /api/auth/register` — rate-limited + domain guard
- `POST /api/auth/forgot-password` — rate-limited
- `GET /api/health` — anónimo (superficial — D-16 abierto)
- `GET /uploads/<filename>` — público sin auth (servidor express.static + proxy Netlify). **Mitigación XSS aplicada** en `POST /api/uploads` con fileFilter + magic-bytes (B-CRIT-01 resuelto)

#### Protegidos por `requireAuth` 🛡️

- `GET /api/auth/me`
- `PATCH /api/auth/me/preferences`
- `/api/digest/*` (algunos con `requireRole('admin', 'superadmin')`)
- `/api/admin/*`
- `/api/categories/*`
- `/api/notifications/*`
- `/api/media/*`
- `POST /api/uploads` + `DELETE /api/uploads/:filename`

#### Protegidos por `requireWorkspaceMember` 🏰

- `/api/workspaces/*`
- `/api/boards/*`
- `/api/columns/*`
- `/api/cards/*`

#### Protegidos por secret header 🔑

- `/api/internal/*` — `x-task-secret` (B-09 abierto: sin rate limit + sin log)
- `/api/digest/cron-trigger` — `x-cron-secret` (GitHub Actions)

---

## CORS y Headers

### API (Railway)

- Helmet con `contentSecurityPolicy: isProd` activo → headers verificados:
  - `content-security-policy: default-src 'self'; ... script-src 'self'; ...`
  - `strict-transport-security: max-age=31536000; includeSubDomains`
  - `x-content-type-options: nosniff`
  - `x-frame-options: SAMEORIGIN`
  - `referrer-policy: no-referrer`

### HTML (Netlify)

🟠 **B-05 abierto.** Netlify NO añade headers de seguridad al HTML servido. Solo `strict-transport-security` (vía Cloudflare). Sin CSP en HTML, defensa browser contra XSS limitada al server-side filter.

**Pendiente:** añadir `netlify.toml [[headers]]` con CSP equivalente al API.

### CORS

- **Local:** `http://localhost:5175`
- **Prod:** `https://kanban.aglaya.biz`

> **Nota:** CORS solo enforce browser-side. Atacante con JWT puede llamar API vía curl directo a Railway URL (B-03 abierto).

---

## Supabase Row Level Security (RLS)

Capa de datos (post-audit Mariana):

| Tabla | RLS | Policies |
|---|---|---|
| `organizations` | ✅ (habilitada audit Mariana) | `Users see their own organization` (SELECT por auth.uid()) |
| `users` | ✅ | Propio perfil + admins de la org |
| `workspaces` | ✅ | Miembros ven sus workspaces |
| `workspace_members` | ✅ | Miembros ven otros miembros |
| `boards` | ✅ | Ver boards del workspace |
| `columns` | ✅ | Ver columnas del board |
| `cards` | ✅ | Ver cards del board |
| `categories` | ✅ | Ver categorías de la organización |
| `notifications` | ✅ | `notifications_owner` (FOR ALL por user_id) |
| `digest_logs` | ✅ | Admin read + service insert/update |

> **Patrón actual:** servidor usa `service_role` (bypass RLS) para todas las queries. RLS funciona como defense-in-depth ante futuros usos directos con anon key desde cliente. Cliente actual NO consulta tablas directamente (verificado audit).
>
> **B-12 abierto:** policies WRITE incompletas en 5 tablas. Si futuro cliente intenta write via anon key, falla silenciosamente. Documentar modelo (service-role-only writes) o añadir policies WRITE explícitas.

---

## Uploads (post B-CRIT-01)

**Endpoint:** `POST /api/uploads` (`requireAuth`)

**Defensa 4 capas:**

1. **Extension blocklist:** `svg|html?|xhtml|js|mjs|swf|exe|bat|cmd|sh|ps1|vbs`
2. **MIME blocklist:** `image/svg+xml`, `text/html`, `application/xhtml+xml`, `application/javascript`, `text/javascript`, `application/x-shockwave-flash`, `application/x-msdownload`
3. **MIME allowlist:** `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`, `text/csv`, `text/plain`
4. **Magic-bytes validation** via `file-type@16.5.4` (excepto text/csv + text/plain, sin magic bytes detectables)

**Error handler:** `FILE_TYPE_FORBIDDEN` (400), `FILE_TYPE_NOT_ALLOWED` (400), `FILE_MAGIC_MISMATCH` (400), `FILE_TOO_LARGE` (413).

**Tests:** `server/tests/uploads.test.js` con 5 casos (SVG, HTML, JS-spoofed, PNG legítimo, sin auth).

**Endpoint público de servido:** `GET /uploads/<uuid>.<ext>` — sin auth. Proxiado vía Netlify `/uploads/*` → Railway. Filenames son UUID v4 (no enumerable). Files solo accesibles para quien tenga la URL.

**Hardening pendiente (Fase E backlog):** subdominio sandbox `uploads.kanban.aglaya.biz` (origen distinto). Estándar industria (GitHub `githubusercontent.com`, Discord `cdn.discordapp.com`).

---

## Backup + Restore (post B-CRIT-02)

**Workflow:** `.github/workflows/db-backup.yml` cron `17 3 * * *` UTC daily.
**Storage:** Cloudflare R2 bucket `aglaya-kanban-backups-prod` (WEUR region).
**Upload protocol:** Cloudflare R2 **native API** (token Bearer auth).
**Retention:** 30 días automática.
**Runbook restore:** `docs/runbooks/db-restore.md`.

**Estructural pendiente:** upgrade Supabase Pro $25/mo (PITR 7d + daily gestionados) — reemplaza workflow custom.

---

## Reporting de vulnerabilidades

Si descubres una vulnerabilidad:

- **Email:** info@aglaya.biz (asunto: `[SECURITY] vulnerability report — aglaya-kanban-desk`)
- **Response SLA:** acuse recibo 48h, primer assessment 5 días hábiles
- **Disclosure:** coordinada según gravedad

> Pendiente formalizar `.github/SECURITY.md` (D-10 audit Mariana).

---

## Logros de seguridad recientes

1. **Audit Mariana Trench (2026-05-27):** 79 hallazgos formales documentados. 2 críticos mitigados durante audit (B-CRIT-01 XSS uploads, B-CRIT-02 backup ausente).
2. **RLS habilitada en organizations** (B-04/B-11) — defense-in-depth completo.
3. **Backup operativo** cierra ventana RPO previa (era ∞ → ahora 24h).
4. **Aislamiento clients Supabase** entre auth interactiva y operaciones privilegiadas.
5. **`.env` jamás committeado** al historial git (verificado).
6. **Service role nunca expuesta al cliente** (verificado).

---

## Referencias

- `docs/audits/2026-05-27-mariana/REPORT.md` — síntesis audit completa
- `docs/audits/2026-05-27-mariana/findings.json` — hallazgos queryables
- `docs/audits/2026-05-27-mariana/audit-B.md` — detalle seguridad/DB/arquitectura
- `docs/runbooks/db-restore.md` — procedimiento restore backup
- `docs/ADR-025-state-management.md` — decisión state management cliente
