# Medidas Técnicas y Organizativas (TOMs)

**Marco legal:** RGPD Art. 32 (Seguridad del tratamiento) + Ley 21.719 Chile (Deber de seguridad) + LGPD Art. 46
**Última actualización:** 2026-05-27 (post audit Mariana Trench)

> RGPD Art. 32 obliga al responsable y al encargado a aplicar medidas técnicas y organizativas apropiadas para garantizar un nivel de seguridad adecuado al riesgo. Este documento enumera las TOMs aplicadas y las pendientes.

---

## Medidas técnicas aplicadas

### Autenticación y control de acceso

- **Multi-layer auth:** middleware `requireAuth` valida JWT firmado HS256 con `JWT_SECRET`. Middleware `requireWorkspaceMember` valida membresía a workspace específico antes de acceder a datos.
- **Aislamiento Supabase clients:** `createAdminClient()` y `createPublicClient()` se invocan fresh por request para evitar contaminación de session.
- **Service role aislada:** `SUPABASE_SERVICE_ROLE_KEY` nunca expuesta al cliente. Solo Railway env vars (server-side).
- **Domain guard registro:** `POST /api/auth/register` filtra dominios corporativos (`@aglaya.biz`, `@ibaifernandez.com`).
- **Internal route protegida:** `/api/internal/*` requiere header `x-task-secret`.

### Cifrado y transporte

- **HTTPS obligatorio en producción** (Netlify + Railway).
- **HSTS** activo: `Strict-Transport-Security: max-age=31536000; includeSubDomains` (Railway response).
- **TLS 1.2+ enforced** por proveedores (Netlify, Railway, Cloudflare, Supabase).
- **Passwords:** Supabase Auth hashea con bcrypt internamente (no almacenamos passwords plain).
- **Storage at rest:** Supabase Postgres encrypted at rest (AWS RDS standard). Cloudflare R2 encrypted at rest por defecto.

### Headers de seguridad (HTTP API — Railway)

Verificados en respuestas `/api/*`:

- `content-security-policy: default-src 'self'; base-uri 'self'; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' https: 'unsafe-inline'; upgrade-insecure-requests`
- `strict-transport-security: max-age=31536000; includeSubDomains`
- `x-content-type-options: nosniff`
- `x-frame-options: SAMEORIGIN`
- `referrer-policy: no-referrer`
- `cross-origin-embedder-policy: require-corp`
- `cross-origin-opener-policy: same-origin`
- `cross-origin-resource-policy: same-origin`

### Headers de seguridad (HTTP HTML — Netlify) — **🟠 PENDIENTE B-05**

Netlify HTML sirve solo `strict-transport-security` (vía Cloudflare). Sin CSP en HTML — defensa browser contra XSS limitada al server-side filter (B-CRIT-01 mitigado pero defensa adicional ausente).

### Row Level Security (RLS) Supabase

- 9/9 tablas con RLS habilitada (organizations habilitada en audit Mariana — `migration-organizations-rls.sql`).
- Server usa `service_role` (bypass RLS) para todas las operaciones — RLS es defense-in-depth ante futuros usos directos con anon key.
- Cliente NUNCA consulta tablas Supabase directamente (verificado audit — solo usa `supabase.auth.*`).

### Validación de entradas

- **Uploads:** 4-layer defense (extension blocklist + MIME blocklist + MIME allowlist + magic-bytes via `file-type@16`) — mitigación B-CRIT-01 audit Mariana.
- **Card priorities:** validación whitelist (`urgent|high|medium|low|none`).
- **dueDate:** validación ISO 8601.
- **Búsqueda cards:** cap 100 chars (`cards.js:314`) anti-abuse.
- **Path traversal:** `deleteFile` rechaza `/`, `..`, `\` en filename.

### Rate limiting

- **`/api/auth/*`:** 20 req / 15 min por IP (`express-rate-limit`).
- **Resto endpoints:** 🟠 **PENDIENTE B-06** — sin rate limit. Riesgo DoS + brute force `x-task-secret`.

### Backups

- **Daily backup** via GitHub Actions cron `17 3 * * *` UTC → Cloudflare R2 (WEUR region).
- **Retention:** 30 días automática.
- **Restore runbook:** `docs/runbooks/db-restore.md`.
- **RPO actual:** 24h (mejorable con Supabase Pro $25/mo PITR 7d).

### Monitorización y logging

- **Health endpoint:** `GET /api/health` retorna `{status:'ok', timestamp}` — 🟡 **PENDIENTE D-16** deep healthcheck (verificar Supabase + Resend).
- **Logs:** Railway captura stdout/stderr. 🟠 **PENDIENTE D-02** structured logging con redaction PII.
- **Error tracking:** 🔴 **PENDIENTE D-01** — sin Sentry. Próximo batch.
- **Audit trail:** `digest_logs` table para envíos de email.

### Aislamiento de entornos

- **Local dev:** puertos 3003 (server) + 5175 (client). `.env` local, `.env` NUNCA committeado al git.
- **Producción:** Railway (server) + Netlify (client) + Supabase (DB). Env vars en dashboards respectivos.
- **Secrets en GitHub Actions:** GitHub Secrets para `DATABASE_URL`, `R2_ACCESS_KEY_ID`, etc.

---

## Medidas organizativas

### Roles y responsabilidades

- **Responsable del tratamiento:** Antonio Ibai Fernández (info@aglaya.biz).
- **DPO designado:** 🟠 **PENDIENTE C-15** — sin DPO formal. Sugerido: Ibai inicialmente + email dedicado `dpo@aglaya.biz` o `privacidad@aglaya.biz`.
- **Acceso a producción:** restringido a developers AGLAYA con SUPABASE_SERVICE_ROLE_KEY + Railway login.

### Documentación

- Política privacidad aglaya.biz pública (trilingüe ES/EN/PT-BR).
- 🟠 Política privacidad kanban.aglaya.biz dedicada — **borrador en `docs/legal/privacy-policy-kanban.draft.md`** pendiente revisión legal externa.
- Runbooks: `docs/runbooks/db-restore.md`, `docs/runbooks/key-rotation.md`.
- ADRs documentando decisiones grandes.

### Procedimientos

- **Backup diario automático:** workflow GH Actions.
- **Key rotation:** runbook `docs/runbooks/key-rotation.md`. Próxima ventana hard: bootstrap Cloudflare token Jun 2 2026.
- **Incident response:** 🟠 **PENDIENTE C-08** — sin runbook breach notification 72h. Borrador en `breach-notification-procedure.md`.

### Onboarding / offboarding

- **Onboarding:** 🟠 **PENDIENTE D-12** — sin doc onboarding formal. README + AGENTS.md + CLAUDE.md fragmentado.
- **Offboarding:** sin procedimiento documentado. Rotación de secrets recomendada tras cualquier dev offboarding (ver `key-rotation.md`).

### Auditorías

- **Audit Mariana 2026-05-27** completa documentada en `docs/audits/2026-05-27-mariana/`.
- **Cadencia recomendada:** cada 6 meses + tras cambios mayores arquitectura.

### Training

- 🔴 Sin training formal en privacy/security para el equipo. Recomendable cuando equipo crezca >3 devs.

---

## Cifrado/clasificación de datos en reposo

| Dato | Storage | Cifrado |
|---|---|---|
| `auth.users` (passwords, emails) | Supabase Postgres (sa-east-1) | AES-256 at rest (AWS RDS) + bcrypt password hash |
| `public.*` tables | Supabase Postgres (sa-east-1) | AES-256 at rest |
| Card attachments | Supabase Storage (auth-walled) o `server/uploads/` (Railway disk) | Encryption at rest según provider |
| Backups | Cloudflare R2 WEUR | Encrypted at rest por defecto Cloudflare |
| Logs Railway | Railway internal | Standard cloud encryption |

---

## Hallazgos abiertos audit que afectan TOMs

| ID | Severidad | Impacto en TOMs |
|---|---|---|
| B-02 | ALTO | JWT 7d sin refresh — ventana de abuso amplia ante leak |
| B-03 | ALTO | Railway URL pública — bypass logging proxy |
| B-05 | ALTO | CSP HTML Netlify ausente |
| B-06 | ALTO | Rate limit incompleto |
| B-07 | ALTO | JWT claims stale |
| B-12 | MEDIO | Policies WRITE incompletas RLS |
| D-01 | CRÍTICO | Sin error tracking — ceguera operativa |
| D-02 | ALTO | Sin structured logging — leak risk PII en stdout |

Resolución completa: ver `docs/audits/2026-05-27-mariana/REPORT.md` roadmap sprints.
