# SECURITY — AGLAYA Kanban Desk

Estado real de seguridad y superficie de ataque. Este documento se sincroniza con cada audit/cambio relevante.

**Última actualización:** 2026-07-13 (fixes del audit aplicados + reconciliación DB + riel MCP)

> La versión ya no se escribe aquí. Estaba tecleada dentro de la propia frase que
> nombraba `package.json` como fuente única — la cita le prestaba credibilidad a
> la copia, y la copia acertaba, que es la forma más difícil de detectar. Si
> necesitas la versión, léela de `package.json`.

> **Nota importante:** versiones anteriores de este documento contenían afirmaciones inexactas detectadas durante audit Mariana (D-05). Esta versión refleja el estado real post-mitigaciones.

---

## Estado general post-audit Mariana

| Área | Estado | Detalle (verificado 2026-05-27) |
|---|---|---|
| Autenticación | ✅ | Supabase Auth + JWT firmado por servidor (HS256, `JWT_SECRET`) |
| Autorización middleware | ✅ | `requireAuth` y `requireWorkspaceMember` aplicados en rutas de datos |
| Restricción de dominio | ✅ | `POST /api/auth/register` filtra dominios corporativos |
| **JWT expiración + refresh** | ✅ RESUELTO (B-02) | Access token 15 min + refresh token en cookie HttpOnly (30d, secreto distinto). Interceptor de refresh en cliente. `dbb414f` |
| **JWT claims re-validados** | ✅ RESUELTO (B-07) | Claims re-validados contra DB en cada request (cache TTL 30s). `fe8a090` |
| **Persistencia de sesión** | ✅ | Access token en **`sessionStorage`** (`aglaya_session`); refresh en cookie HttpOnly. Migración suave desde localStorage legado. |
| Security headers HTTP (API) | ✅ | helmet activo en respuestas Railway (CSP/HSTS/X-Frame/X-Content/Referrer) |
| **Security headers HTTP (HTML)** | ✅ RESUELTO (B-05) | `netlify.toml` `[[headers]]` con CSP + X-Frame + X-Content + Referrer + Permissions-Policy. `f61a4d9` |
| Exposición de claves | ✅ | `SUPABASE_SERVICE_ROLE_KEY` solo backend; `VITE_*` prefix correcto en cliente |
| CORS | ✅ | Origins estrictos (`localhost:5175` dev / `kanban.aglaya.biz` prod) |
| **Rate limiting** | ✅ RESUELTO (B-06) | Global 300 req/15min en todo `/api/*` + estricto en `/api/auth` (20/15min) y `/api/internal` (10/min). `6c31670` |
| **Internal route `/api/internal/*`** | ✅ RESUELTO (B-09) | `x-task-secret` + rate limit dedicado (10/min) anti secret-guessing. `6c31670` |
| **Row Level Security (RLS)** | ✅ post-audit | RLS habilitada en todas las tablas de `public` (organizations se habilitó en `migration-organizations-rls.sql` durante el audit). Políticas SELECT explícitas; WRITE parciales (B-12, MEDIO). **Cuántas tablas hay y cuáles la tienen lo custodia la DB** (`pg_tables.rowsecurity`), no este documento: la cifra que había aquí decía 9/9 cuando ya eran 10/10, y el resumen de abajo decía 10/10 en la misma página |
| Aislamiento Supabase clients | ✅ | `auth` y `admin` usan clientes frescos por request |
| **Railway URL pública** | 🟠 ABIERTO (B-03) | **El monitor está INERTE a propósito desde el 01-sep-2026**, y decir que estaba «parcial» era la mitad del defecto: sin dominio propio no hay bypass que detectar, y la alarma se disparaba con el **100% del tráfico**, un evento de Sentry por petición. Se comió la cuota de la organización. Vuelve sola en cuanto exista el dominio (ver B-03 más abajo) |
| **Uploads XSS** | ✅ MITIGADO | Hallazgo B-CRIT-01 (CVSS 8.0) detectado y resuelto durante audit. SHA fix `402b0d7`. 4-layer defense: ext blocklist + MIME blocklist + allowlist + magic-bytes |
| **Backup strategy** | ✅ MITIGADO quick-win | B-CRIT-02 resuelto: GitHub Actions cron daily → Cloudflare R2. SHA `3ae6541`. Pendiente upgrade Supabase Pro estructural |
| **npm audit** | 🟡 residuales justificadas (B-08) | Remediación del 2026-07-12: la CRÍTICA y todas las HIGH de entonces, cerradas. Quedan residuales conocidas y argumentadas — server (`file-type` bloqueado por ESM, `uuid` no aplica) y client (`vite`/`esbuild`, solo dev, no llegan a producción). Ver INCIDENTS.md. **La cifra la da `npm audit`, no este documento:** la que había escrita decía cuatro y el runner decía cinco |

### Resumen estado

- **Verde:** auth flow + JWT refresh 15m (B-02), autorización middleware, re-validación de claims (B-07), helmet API + CSP HTML Netlify (B-05), CORS, rate limiting completo (B-06/B-09), RLS habilitada en `public` + GRANTs (anon sin escritura), sesión en sessionStorage, uploads XSS resuelto, backup resuelto.
- **Amarillo abierto:** Railway URL sin gateway (**B-03 abierto**, y su monitor inerte hasta que exista el dominio propio), vulnerabilidades residuales de dependencias (B-08), WRITE policies RLS parciales (B-12).
- **Mitigado durante audit + cierre:** B-CRIT-01 (XSS uploads), B-CRIT-02 (backup), B-04/B-11 (organizations RLS), y B-02/03/05/06/07/09.

---

## Hallazgos abiertos referenciados

La mayoría de los ALTOS del audit se cerraron en el cierre formal (ver `docs/audits/2026-05-27-mariana/REPORT.md` §12). IDs realmente abiertos hoy:

| ID | Severidad | Estado |
|---|---|---|
| B-03 | ALTO | **Abierto** — falta el dominio propio `api.kanban.aglaya.biz` + Cloudflare WAF. El monitor **no es mitigación mientras no exista ese dominio**: ver la nota de abajo |
| B-08 | MEDIO | **Remediado a residuales justificadas** (server: `file-type`, `uuid`; client: `vite`/`esbuild`, solo dev). La cifra viva la da `npm audit` |
| B-12 | MEDIO | Policies WRITE explícitas por tabla (hoy RLS por-organización) |

## Cuentas privilegiadas (superadmin)

El bypass "God Mode" es **por rol** (`role='superadmin'`), no por email. Cuentas superadmin actuales:

| Cuenta | Uso | Credencial |
|---|---|---|
| `info@ibaifernandez.com` | Operador humano (Ibai) | Login personal |
| `kanban-rail@aglaya.biz` | **Cuenta de servicio del riel MCP** (orquestador; escribe cards vía API) | Server-side en `~/.config/aglaya/kanban-rail.env` (chmod 600), nunca en código/logs. Revocable: borrar user o bajar rol |

El riel MCP (`kanban-mcp/`, ver ADR-026 en `ARCHITECTURE.md`) usa además `SUPABASE_SERVICE_ROLE_KEY` para lecturas puntuales vía PostgREST — misma custodia server-side.

---

## Claves y secretos

### Variables de entorno críticas

| Variable | Vive en | Criticidad |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Solo `.env` server | 🔴 CRÍTICO — bypass de RLS |
| `JWT_SECRET` | Solo `.env` server | 🔴 CRÍTICO — firma de tokens |
| `SUPABASE_DATABASE_PASSWORD` | Solo `.env` server | 🔴 CRÍTICO — DDL directo (CLAUDE.md) |
| `TASK_SECRET` | Solo `.env` server (Railway env) | 🟠 ALTO — auth de `/api/internal/*` |
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

**Ya no hay superficie de correo.** `/api/digest/*` —incluida su puerta por
`x-cron-secret`— y `PATCH /api/auth/me/preferences` se retiraron el 25-ago-2026
(«cero mails»). La tabla `digest_logs` de más abajo **sigue existiendo** y se
sigue exportando en `GET /api/auth/me/export`: es historia de envíos pasados,
sin nadie que escriba en ella.


### B-03: por qué el monitor estaba contando tráfico, no bypass

**Medido el 01-sep-2026 contra la API de Railway** (proyecto `aglaya-kanban-desk`,
servicio `web`, entorno `production`): `customDomains: []`, un único
`serviceDomains: web-production-099a0.up.railway.app`.

El monitor emitía un evento **por cada petición cuyo `Host` contuviera
`railway.app`** — o sea, por todas, porque no hay otra puerta. Tres meses.
No detectaba un bypass: **detectaba que existía tráfico**.

**El daño no fue de esta nave.** La cuota de Sentry es de la **organización**: se
agotó el segundo día del periodo de facturación con el **42% de los eventos
viniendo de este issue**, y Sentry empezó a descartar errores nuevos **de toda la
flota**, incluido el escáner de `legal-reg-tech` en producción.

**Qué se hizo:** el monitor pasa a exigir su precondición —un dominio propio
declarado en `PUBLIC_API_HOST`— y queda **inerte mientras no exista**, diciéndolo
por el registro al arrancar. Cuando el dominio se cree, se configura la variable
y la alarma vuelve **ya con agregación**: como mucho un evento por (host, ruta) y
hora, llevando dentro cuántas veces pasó.

⚠️ **Esto NO cierra B-03**, y por eso sube de «parcial» a «abierto»: seguir
llamándolo mitigación era contar como defensa algo que solo hacía ruido. Cerrarlo
es crear el dominio — `docs/runbooks/railway-custom-domain.md`— y eso es acción
del Operador.

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
> **B-12 abierto:** hay tablas sin policy WRITE explícita. Si un futuro cliente intenta escribir con la anon key, falla silenciosamente. Decidir entre documentar el modelo (escrituras solo por `service_role`) o añadir policies WRITE explícitas. **Cuáles y cuántas lo custodia la DB** (`pg_policies`): la cifra que había aquí no la comprobaba nadie.

---

## Uploads (post B-CRIT-01)

**Endpoint:** `POST /api/uploads` (`requireAuth`)

**Defensa 4 capas:**

1. **Extension blocklist:** `svg|html?|xhtml|js|mjs|swf|exe|bat|cmd|sh|ps1|vbs`
2. **MIME blocklist:** `image/svg+xml`, `text/html`, `application/xhtml+xml`, `application/javascript`, `text/javascript`, `application/x-shockwave-flash`, `application/x-msdownload`
3. **MIME allowlist:** `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`, `text/csv`, `text/plain`
4. **Magic-bytes validation** via `file-type` (excepto text/csv + text/plain, sin magic bytes detectables). La versión la custodia `package.json`

**Error handler:** `FILE_TYPE_FORBIDDEN` (400), `FILE_TYPE_NOT_ALLOWED` (400), `FILE_MAGIC_MISMATCH` (400), `FILE_TOO_LARGE` (413).

**Tests:** `server/tests/uploads.test.js` cubre SVG, HTML, JS con extensión falseada, PNG legítimo y petición sin auth. Cuántos casos hay lo dice el fichero.

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
- `docs/ARCHITECTURE.md` §7 (ADR-025) — decisión state management cliente
