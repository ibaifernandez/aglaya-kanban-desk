# Runbook — Rotación de claves y secretos

**Última actualización:** 2026-05-27
**Mitigación de:** D-18 (audit Mariana 2026-05-27)
**Cadencia recomendada:** anual mínimo + ad-hoc tras incidente / dev offboarding / sospecha de leak.

---

## Inventario de claves y deadlines hard

| Clave | Vive en | Próxima rotación | Quién la usa |
|---|---|---|---|
| `aglaya-kanban-r2-bootstrap` (Cloudflare User API Token) | `.env` local + GitHub Secret `R2_ACCESS_KEY_ID` | **🔴 Jun 2 2026 (HARD — TTL 7d)** | Workflow `db-backup.yml` |
| `JWT_SECRET` | Railway env vars + `.env` local | Anual (próxima ~2027-05) | Server JWT signing/verifying |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway env vars + `.env` local | Anual o ad-hoc | Server admin operations |
| `SUPABASE_DATABASE_PASSWORD` | Railway env vars + `.env` local + GitHub Secret `DATABASE_URL` | Anual o ad-hoc | Server DDL via psql, GH backup workflow |
| `RESEND_API_KEY` | Railway env vars + `.env` local | Anual o ad-hoc | Server transactional emails |
| `TASK_SECRET` | Railway env vars + `.env` local | Anual | `/api/internal/*` endpoints |
| `DIGEST_CRON_SECRET` | GitHub Secret + Railway env | Anual | GH Actions digest-cron workflow |
| `SUPABASE_PAT` | `.env` local | Anual | Supabase Management API (local scripts) |
| `kanban-backup-prod-v2` (Cloudflare User R2 Token) | unused (creado durante audit, no consumido) | Borrar | n/a |

---

## Procedimiento general

### Pre-rotación

1. **Anuncia ventana de mantenimiento** (Slack/email) si la rotación implica downtime.
2. **Verifica backup reciente** (último kanban_*.sql.gz en R2 < 24h).
3. **Identifica todos los consumidores** de la clave (server, workflows, scripts locales).
4. **Prepara rollback plan:** mantén clave vieja activa hasta confirmar nueva funciona.

### Patrón de rotación zero-downtime

1. Genera nueva clave en provider.
2. Update GitHub Secrets + Railway env vars con nueva clave (Railway hace redeploy automático si env cambia).
3. Verifica nueva clave funciona (smoke test endpoint dependiente).
4. Espera período de gracia (deploys propagados, sessions activas terminadas para JWT).
5. Revoca clave vieja en provider.
6. Update `.env` local + `docs/SECURITY.md` con fecha rotación.

---

## 1. Rotar Cloudflare R2 token (deadline Jun 2 2026)

> **🔴 URGENTE — el bootstrap token actual expira Jun 2 2026.** Sin rotación, workflow `db-backup.yml` falla silenciosamente (`Notify on failure` solo emite `::error::` en GH Actions log, sin push notification — D-08 pendiente).

### Opción A — Extender TTL del token actual (recomendado quick-win)

1. Ir a https://dash.cloudflare.com/profile/api-tokens
2. Click en `aglaya-kanban-r2-bootstrap`
3. Click **Edit**
4. **End Date:** cambiar a fecha lejana (ej. 2027-05-27) o eliminar end date para "Never expires"
5. Click **Save**
6. Verificar nuevo TTL en dashboard

### Opción B — Crear nuevo token long-lived

1. Ir a https://dash.cloudflare.com/profile/api-tokens → **Create Token** → **Custom Token**
2. Config:
   - Token name: `kanban-backup-prod-2026-2027`
   - Permission: **Account** → **Workers R2 Storage** → **Edit**
   - Account Resources: Include → tu cuenta
   - TTL: Forever (o 365 días)
3. Click **Continue to summary** → **Create Token**
4. **Copiá el token** (única vez visible).
5. Update GitHub Secret:
   ```bash
   gh secret set R2_ACCESS_KEY_ID --body "<nuevo-token>" -R ibaifernandez/aglaya-kanban-desk
   ```
6. Trigger workflow para verificar:
   ```bash
   gh workflow run db-backup.yml --ref main -R ibaifernandez/aglaya-kanban-desk
   gh run watch --exit-status
   ```
7. Una vez verde, borrar token viejo en dashboard.

### Opción C — Migrar a S3-compat token (long-term)

Cloudflare R2 también ofrece tokens compatibles con S3 SDK (32-char access key + 64-char secret). Sin embargo, durante audit Mariana descubrimos que **los tokens generados por R2 Dashboard ("Account API Tokens" y "User API Tokens") usan formato `cfut_*`/`cfat_*` incompatible con S3 SDKs** que esperan 32-char keys. Si querés migrar a S3-compat, requiere coordinación con Cloudflare support o un patrón distinto (no documentado aquí — fuera de scope quick-win audit).

Por ahora, mantener native R2 API (cfut_ Bearer auth) en workflow `db-backup.yml`.

---

## 2. Rotar `JWT_SECRET`

**Impacto:** TODAS las sesiones activas se invalidan instantáneamente. Usuarios deben re-loguearse.

### Pasos

1. Generar nuevo secret:
   ```bash
   openssl rand -base64 64
   ```
2. Update Railway env var `JWT_SECRET` con el nuevo valor (dashboard Railway → Variables → Edit).
3. Railway redeploy automático.
4. Verificar:
   ```bash
   curl https://kanban.aglaya.biz/api/health
   # Login manual con cuenta de test — debería funcionar con JWT firmado por nuevo secret
   ```
5. Actualizar `.env` local con nuevo valor.
6. Notificar al equipo (todos deben re-login).

### Notas

- NO requiere transición — el secret viejo deja de servir desde el momento del cambio.
- JWTs emitidos con secret viejo fallan validación → 401 → cliente fuerza re-login.
- Si querés transición (raro), implementar middleware que acepte ambos secrets durante ventana de gracia.

---

## 3. Rotar `SUPABASE_SERVICE_ROLE_KEY`

**Impacto:** todas las operaciones admin del server fallan hasta update. Backup workflow (`DATABASE_URL`) NO afectado directamente (usa connection string con password, no service_role).

### Pasos

1. Ir a https://supabase.com/dashboard/project/jowtasxhnluqqcgkeoll/settings/api
2. Click **Reset** en `service_role` key (o **Reveal** para ver actual).
3. **⚠️ Cloudflare regenera la key inmediatamente.** No hay ventana de gracia.
4. Copiar nueva key.
5. Update Railway env var `SUPABASE_SERVICE_ROLE_KEY` (Railway redeploy automático).
6. Update `.env` local.
7. Verificar:
   ```bash
   curl -X POST https://kanban.aglaya.biz/api/admin/users -H "Authorization: Bearer <admin-jwt>"
   # Debería retornar lista (no 500)
   ```

---

## 4. Rotar `SUPABASE_DATABASE_PASSWORD`

**Impacto:** todos los componentes que usan connection string Postgres fallan (DDL local, GH Actions backup).

### Pasos

1. Ir a https://supabase.com/dashboard/project/jowtasxhnluqqcgkeoll/settings/database
2. **Database password** → **Generate a new password**
3. Copiar nueva password.
4. Update `.env` local con `SUPABASE_DATABASE_PASSWORD=<nuevo>`.
5. Update GitHub Secret `DATABASE_URL` con nueva connection string:
   ```bash
   set -a; source ./.env; set +a
   ENCODED_PASS=$(python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ['SUPABASE_DATABASE_PASSWORD'], safe=''))")
   PROJECT=$(echo "$SUPABASE_URL" | sed -E 's|https?://([^.]+)\.supabase\.co.*|\1|')
   DATABASE_URL="postgresql://postgres.${PROJECT}:${ENCODED_PASS}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
   gh secret set DATABASE_URL --body "$DATABASE_URL" -R ibaifernandez/aglaya-kanban-desk
   ```
6. Trigger backup workflow para verificar.

---

## 5. Rotar `RESEND_API_KEY`

**Impacto:** envío de emails (digest + notificaciones + welcome) falla hasta update.

### Pasos

1. Ir a https://resend.com/api-keys
2. Click **Create API Key** (nuevo, no rotate — Resend no rota in-place)
3. Permissions: `Sending access` + dominio (`aglaya.biz` o el configurado)
4. Copiar nueva key.
5. Update Railway env var `RESEND_API_KEY`.
6. Update `.env` local.
7. Smoke test: trigger digest manualmente vía `/api/digest/send-me` con cuenta admin.
8. Verificar email recibido.
9. Borrar key vieja en Resend dashboard.

---

## 6. Rotar `TASK_SECRET`

**Impacto:** scripts que llamen `/api/internal/*` con secret viejo fallan.

### Pasos

1. Generar nuevo secret: `openssl rand -hex 32`
2. Update Railway env var `TASK_SECRET`.
3. Update `.env` local.
4. Update cualquier script externo / cron / claude-mem que use el secret viejo.
5. Verificar:
   ```bash
   curl -X POST "$RAILWAY_SERVER_URL/api/internal/create-card" \
     -H "x-task-secret: $TASK_SECRET" -H "Content-Type: application/json" \
     -d '{"title":"rotation-test","boardName":"Backlog","priority":"low"}'
   ```

---

## 7. Rotar `DIGEST_CRON_SECRET`

**Impacto:** GH Actions `digest-cron.yml` falla hasta update.

### Pasos

1. Generar: `openssl rand -hex 32`
2. Update Railway env var `DIGEST_CRON_SECRET`.
3. Update GitHub Secret:
   ```bash
   gh secret set DIGEST_CRON_SECRET --body "<nuevo>" -R ibaifernandez/aglaya-kanban-desk
   ```
4. Trigger digest workflow para verificar:
   ```bash
   gh workflow run digest-cron.yml --ref main -R ibaifernandez/aglaya-kanban-desk
   ```

---

## 8. Rotar `SUPABASE_PAT` (Personal Access Token)

**Impacto:** scripts locales que usan Supabase Management API.

### Pasos

1. Ir a https://supabase.com/dashboard/account/tokens
2. Click **Generate new token**
3. Name: `aglaya-kanban-management-YYYY-MM`
4. Copiar.
5. Update `.env` local con `SUPABASE_PAT=<nuevo>`.
6. Verificar:
   ```bash
   curl -H "Authorization: Bearer $SUPABASE_PAT" https://api.supabase.com/v1/projects | jq '.[]|.name'
   ```
7. Revocar PAT viejo en dashboard.

---

## Checklist post-rotación

Tras cualquier rotación:

- [ ] Nueva clave verificada con smoke test endpoint específico
- [ ] Clave vieja revocada (no solo abandonada)
- [ ] `.env` local actualizado
- [ ] GitHub Secrets actualizados si aplica
- [ ] Railway env vars actualizados si aplica
- [ ] `docs/SECURITY.md` actualizado con fecha rotación + próxima fecha estimada
- [ ] Equipo notificado si la rotación implica re-login (caso `JWT_SECRET`)
- [ ] Si rotación fue ad-hoc por sospecha de leak: incident report en `docs/INCIDENTS.md`

---

## Calendario sugerido

| Cuándo | Acción |
|---|---|
| 2026-05-30 (3 días antes del deadline) | Rotar `aglaya-kanban-r2-bootstrap` (opción A o B) |
| Cada Q1 (enero) | Rotación anual: `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TASK_SECRET`, `DIGEST_CRON_SECRET`, `SUPABASE_PAT` |
| Tras incidente / sospecha leak | Rotación inmediata de la clave afectada + audit |
| Tras dev offboarding | Rotación de cualquier clave que tuvo acceso |

---

## Referencias

- Mitigación B-CRIT-02 (audit Mariana): `docs/audits/2026-05-27-mariana/audit-B.md`
- Workflow backup: `.github/workflows/db-backup.yml`
- Workflow digest: `.github/workflows/digest-cron.yml`
- CLAUDE.md sección "Acceso a Supabase desde Claude" — patrón de uso `SUPABASE_DATABASE_PASSWORD` + `SUPABASE_PAT`
