# Runbook — Restore DB Supabase desde backup R2

**Última actualización:** 2026-05-27
**Mitigación de:** B-CRIT-02 (audit Mariana 2026-05-27 — `docs/audits/2026-05-27-mariana/audit-B.md`)
**Frecuencia uso esperada:** **rara** — solo ante incidente real (corruption, DROP accidental, ransomware, error de migración)

---

## Contexto

Supabase plan = **Free** → sin daily backups gestionados ni PITR. Mitigación: `pg_dump` diario a las 03:17 UTC vía GitHub Actions (`.github/workflows/db-backup.yml`) sube backup gzipped a Cloudflare R2 bucket `aglaya-kanban-backups-prod`. Retención 30 días automática.

**Para PITR (point-in-time) o RPO <24h:** mitigación estructural pendiente (Supabase Pro $25/mo o backup hourly via cron).

---

## Inventario de backups

```bash
# Listar backups disponibles en R2
rclone ls r2:aglaya-kanban-backups-prod/

# Ejemplo output:
#  4523456 kanban_20260527T031700Z.sql.gz
#  4521234 kanban_20260526T031700Z.sql.gz
#  ...
```

Cada backup tiene formato `kanban_YYYYMMDDTHHMMSSZ.sql.gz` (UTC).

---

## Procedimiento 1: smoke test de un backup contra Postgres local (NO contra prod)

Usar para validar que un backup recién generado restaura correctamente, o como dry-run antes de un restore real.

### Pre-requisitos

- Docker instalado
- `rclone` configurado con credenciales R2 (o credenciales en variables de entorno)
- `psql` instalado (`postgresql-client`)

### Pasos

```bash
# 1. Descargá el backup más reciente desde R2
BACKUP_FILE=$(rclone lsf r2:aglaya-kanban-backups-prod/ | sort -r | head -1)
rclone copy "r2:aglaya-kanban-backups-prod/${BACKUP_FILE}" .

# 2. Spin up Postgres local temp (puerto 5433 para no chocar con dev local 5432/5433/5434)
docker run -d --name pg-restore-test \
  -e POSTGRES_PASSWORD=test \
  -p 5433:5432 \
  postgres:15
sleep 5

# 3. Restore
gunzip -c "${BACKUP_FILE}" | psql "postgresql://postgres:test@localhost:5433/postgres"

# 4. Verificar core tables
psql "postgresql://postgres:test@localhost:5433/postgres" -c "\dt public.*"

# Conteo de filas en tablas críticas
psql "postgresql://postgres:test@localhost:5433/postgres" -c "
  SELECT 'organizations' AS tabla, COUNT(*) FROM public.organizations
  UNION ALL SELECT 'users',           COUNT(*) FROM public.users
  UNION ALL SELECT 'workspaces',      COUNT(*) FROM public.workspaces
  UNION ALL SELECT 'boards',          COUNT(*) FROM public.boards
  UNION ALL SELECT 'columns',         COUNT(*) FROM public.columns
  UNION ALL SELECT 'cards',           COUNT(*) FROM public.cards
  UNION ALL SELECT 'notifications',   COUNT(*) FROM public.notifications;
"

# 5. Limpieza
docker rm -f pg-restore-test
rm "${BACKUP_FILE}"
```

**Esperado:** restore termina sin errores, todas las tablas core existen, conteos coherentes con tu último estado conocido de prod.

---

## Procedimiento 2: restore a Supabase prod (RECUPERACIÓN DE INCIDENTE)

> **⚠️ DESTRUCTIVO E IRREVERSIBLE.** Sobrescribe la DB prod con el contenido del backup. Cualquier dato generado DESPUÉS del backup se PIERDE. Usar solo si:
> - El operador (Ibai) ha autorizado explícitamente.
> - Smoke test de Procedimiento 1 con el mismo backup terminó verde.
> - Se ha exportado un dump del estado actual de prod ANTES (snapshot pre-restore) para forensics si hace falta.

### Pre-requisitos

- Acceso a `.env` con `SUPABASE_DATABASE_PASSWORD` (alternativamente, `DATABASE_URL` completa).
- Confirmar conectividad: `psql "${DATABASE_URL}" -c "SELECT version();"`.

### Pasos

```bash
# 0. SNAPSHOT pre-restore (forensics, NO destructivo)
set -a; source .env; set +a
TS_PRE=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump "${DATABASE_URL}" --no-owner --no-acl \
  | gzip -9 > "kanban_pre_restore_${TS_PRE}.sql.gz"

# 1. Descargar backup a restaurar
BACKUP_FILE=kanban_<TS>.sql.gz   # reemplazar con el target
rclone copy "r2:aglaya-kanban-backups-prod/${BACKUP_FILE}" .

# 2. Validar que NO está corrupto
gunzip -t "${BACKUP_FILE}"
echo "Backup integrity OK"

# 3. CONFIRMACIÓN MANUAL (escribir literalmente "YES RESTORE PROD")
read -p "Type 'YES RESTORE PROD' to proceed: " CONFIRM
[ "${CONFIRM}" = "YES RESTORE PROD" ] || { echo "Aborted"; exit 1; }

# 4. Restore (con flag --clean --if-exists ya en el dump)
gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"

# 5. Verificar
psql "${DATABASE_URL}" -c "\dt public.*"
psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM public.cards;"
```

### Post-restore checklist

- [ ] Healthcheck API responde 200: `curl https://kanban.aglaya.biz/api/health`
- [ ] Login de prueba funciona (con cuenta de test, no superadmin)
- [ ] Cards/boards visibles para usuarios conocidos
- [ ] Notificaciones del día siguiente se generan (verificar a próximo digest)
- [ ] Snapshot pre-restore (`kanban_pre_restore_${TS_PRE}.sql.gz`) subido a R2 a path `forensics/` para retención:
  ```bash
  rclone copy "kanban_pre_restore_${TS_PRE}.sql.gz" "r2:aglaya-kanban-backups-prod/forensics/"
  ```
- [ ] Incidente documentado en `docs/INCIDENTS.md` con timeline + causa raíz + restore SHA

---

## Procedimiento 3: trigger manual del backup workflow

Útil para forzar un backup fuera del schedule (antes de migración riesgosa, post-import de datos masivos, etc.).

### Opción A: GitHub UI
1. Ir a https://github.com/ibaifernandez/aglaya-kanban-desk/actions/workflows/db-backup.yml
2. Click "Run workflow" → branch `main` → "Run workflow"
3. Esperar verde (~2-3 min) + verificar en R2 que apareció nuevo archivo

### Opción B: gh CLI
```bash
gh workflow run db-backup.yml --ref main
# Ver últimas ejecuciones
gh run list --workflow=db-backup.yml --limit 5
# Ver logs del último run
gh run view --log
```

---

## Troubleshooting

### Backup workflow falló con `pg_dump: FATAL: password authentication failed`
- Verificar `DATABASE_URL` en GitHub Secrets — la password puede haber rotado.
- Connection string esperada: `postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres`
- Si Supabase rotó la password sin notificación, re-generar desde Supabase dashboard → Settings → Database.

### `rclone copy` falla con `403 Forbidden` en R2
- Token R2 expirado o sin permisos `Object Read & Write`. Regenerar en Cloudflare → R2 → API Tokens.
- Verificar `R2_ENDPOINT` formato: `https://<account-id>.r2.cloudflarestorage.com` (no incluir bucket name al final).

### Backup file > 1 GB
- Considerar pg_dump por schema o por table (especialmente si `cards` o `notifications` crecen). Patrón:
  ```bash
  pg_dump "${DATABASE_URL}" --table=public.cards --no-owner --no-acl
  ```
- Evaluar upgrade Supabase Pro para PITR + dump gestionado.

### Restore corrupto / parcial
- NO retry sobre la misma DB. Restaurar a una DB temp primero (Procedimiento 1), verificar, después decidir.
- Si todos los backups recientes están corruptos: contactar Supabase support para pg_dump del último snapshot interno (best-effort en plan Free).

---

## Mejoras pendientes (backlog)

- [ ] Notificación a Slack/Sentry on failure (actualmente solo `::error::` en GitHub Actions log)
- [ ] Backup hourly en vez de daily (reduce RPO de 24h a 1h)
- [ ] Cross-region replication R2 → otra región para disaster scenario
- [ ] **Evaluar upgrade Supabase Pro** ($25/mo) para PITR 7d + daily backups gestionados → reemplaza este workflow custom

---

## Trazabilidad

- Workflow: `.github/workflows/db-backup.yml`
- Origen del runbook: audit Mariana 2026-05-27, B-CRIT-02
- Commit de creación: [pendiente — se registra tras push]
