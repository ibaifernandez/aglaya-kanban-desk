# Operator Checklist — Acciones pendientes post audit Mariana

**Última actualización:** 2026-05-27
**Owner:** Antonio Ibai Fernández (info@aglaya.biz)
**Origen:** audit Mariana Trench (`docs/audits/2026-05-27-mariana/REPORT.md`)

> Esta lista es paso a paso. Está priorizada por urgencia. Cero coste externo. Sin pagos a Supabase Pro ni a abogados externos (declinado).

---

## 🔴 URGENTE — antes Jun 2 2026 (4 días desde audit)

### 1. Rotar/extender token Cloudflare `aglaya-kanban-r2-bootstrap`

**Por qué:** workflow `db-backup.yml` usa este token. Expira **Jun 2 2026**. Si pasa, backup falla silenciosamente.

**Opción A (recomendada — 2 min):** extender TTL del token actual.

1. Ir a https://dash.cloudflare.com/profile/api-tokens
2. Click en token `aglaya-kanban-r2-bootstrap`
3. Click **Edit**
4. Borrar **End Date** (campo "Expires on") → "Never expires", o setear fecha lejana (2027-12-31)
5. Click **Save**

**Opción B (3 min):** crear token nuevo y reemplazar secret.

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token** → **Custom Token**
2. Name: `kanban-backup-prod-2027`
3. Permissions: `Account` → `Workers R2 Storage` → `Edit`
4. Account Resources: Include → tu cuenta
5. TTL: no expiry (o 365 días)
6. Continue → Create → **copia el token**
7. Update GitHub Secret (terminal):
   ```bash
   gh secret set R2_ACCESS_KEY_ID --body "<nuevo-token>" -R ibaifernandez/aglaya-kanban-desk
   ```
8. Triggear workflow manualmente para verificar:
   ```bash
   gh workflow run db-backup.yml --ref main -R ibaifernandez/aglaya-kanban-desk
   gh run watch --exit-status
   ```
9. Una vez verde, borrar token viejo en Cloudflare dashboard

**Verificación:** próximo run de `db-backup` (manual o esperar al cron 03:17 UTC) debe pasar verde.

---

## 🟠 ALTA — esta semana

### 2. Aceptar DPAs en dashboards procesadores (~25 min total)

Todos free / click-through. No requieren tarjeta de crédito.

#### 2.1 Supabase (5 min)

1. https://supabase.com/dashboard/org/_/settings (selecciona tu org)
2. Tab **Legal Documents** o **Privacy & Data Processing**
3. Buscar **Data Processing Addendum (DPA)** o **GDPR / Sub-processor Agreement**
4. Click **Accept** / **Sign**
5. Descargar PDF firmado o guardar el link permanente
6. Crear archivo `docs/legal/dpas/supabase-dpa-2026-05.pdf` (o link en el registry)
7. Actualizar `docs/legal/DPA-registry.md` línea Supabase: cambiar 🟠 PENDIENTE → ✅ Aceptado 2026-MM-DD

#### 2.2 Resend (5 min)

1. https://resend.com/settings/privacy o https://resend.com/legal/dpa
2. Si hay "Sign DPA" button: click → accept
3. Si solo es PDF descargable: descargar y guardar
4. Actualizar `DPA-registry.md`

#### 2.3 Railway (5 min)

1. https://railway.com/account/settings → **Legal & Compliance** tab
2. Si hay DPA self-serve: click accept
3. Si no aparece (Railway free tier no siempre lo expone): enviar email a `legal@railway.app` solicitando DPA y archivar respuesta
4. Actualizar `DPA-registry.md`

#### 2.4 Netlify (5 min)

1. https://app.netlify.com/teams/_/billing → **Privacy** o **Settings → Privacy**
2. Buscar **Data Processing Agreement** → Accept
3. Descargar copia
4. Actualizar `DPA-registry.md`

#### 2.5 Cloudflare (5 min — **más urgente** post-B-CRIT-02)

1. https://dash.cloudflare.com → tu account → **Legal** o **Compliance**
2. Self-serve DPA: https://www.cloudflare.com/cloudflare-customer-dpa/
3. Algunos planes free requieren contactar `dpa@cloudflare.com` — enviar email solicitando DPA para R2 storage uso
4. Actualizar `DPA-registry.md`

#### 2.6 GitHub (verificar — 5 min)

GitHub está cubierto por **Microsoft Online Services DPA** (heredado por la adquisición). Si tu cuenta es:
- **Free / Personal:** DPA Microsoft aplica por defecto
- **Business / Enterprise:** verificar en https://github.com/account/billing → Privacy

Confirmar tipo cuenta + archivar referencia al Microsoft DPA en `DPA-registry.md`.

---

### 3. Crear proyecto Sentry + setear `SENTRY_DSN` (10 min)

**Por qué:** Sentry está instalado (`@sentry/node` ya en `package.json`), pero inactivo sin DSN. Cierra D-01 (vuelo a ciegas operativo).

**Free tier:** 5K errores/mes, 30 días retention. Suficiente para uso interno.

1. https://sentry.io/signup/ → crear cuenta (Google/GitHub login OK)
2. Crear org: `aglaya` (o lo que prefieras)
3. Create New Project → Platform: **Node.js**
4. Project name: `aglaya-kanban-desk-server`
5. Sentry muestra el DSN (formato: `https://abc123@o12345.ingest.us.sentry.io/67890`). Copialo.
6. Setear en Railway env vars:
   - Railway dashboard → tu proyecto → Variables → **New Variable**
   - Name: `SENTRY_DSN`
   - Value: el DSN copiado
   - (Opcional) `SENTRY_ENVIRONMENT=production` y `SENTRY_RELEASE=<git-sha>` (autopopula con Railway si configurado)
7. Railway redeploy automático tras setear env var.
8. Verificar en logs Railway: `[sentry] enabled — env=production release=...`
9. (Opcional) Setear alertas en Sentry: Settings → Alerts → "Notify on first event" → email a `info@aglaya.biz`

---

### 4. Publicar política de privacidad en `kanban.aglaya.biz/privacidad` (1-2h)

**Por qué:** RGPD Art. 13/14 obliga a que la política sea accesible al titular. Hoy `kanban.aglaya.biz/privacidad` retorna SPA shell sin contenido.

**Opción simple (recomendada — 30 min):**

1. Copiar `docs/legal/privacy-policy-kanban.md` como contenido renderizable.
2. Crear `client/src/pages/PrivacyPolicy.jsx`:
   ```jsx
   import ReactMarkdown from 'react-markdown';
   import remarkGfm from 'remark-gfm';
   import policyMarkdown from '../../../docs/legal/privacy-policy-kanban.md?raw';

   export default function PrivacyPolicy() {
     return (
       <div className="min-h-screen bg-[#0f1117] py-12 px-4">
         <article className="max-w-2xl mx-auto bg-[#1a1d26] rounded-2xl p-8 prose prose-invert prose-sm">
           <ReactMarkdown remarkPlugins={[remarkGfm]}>{policyMarkdown}</ReactMarkdown>
         </article>
       </div>
     );
   }
   ```
3. Añadir ruta en `client/src/App.jsx`:
   ```jsx
   if (window.location.pathname === '/privacidad' || window.location.pathname === '/privacy') {
     return <PrivacyPolicy />;
   }
   ```
4. Build + deploy: `cd client && npm run build` + push.
5. Verificar `https://kanban.aglaya.biz/privacidad` carga.

**Opción simple alternativa (5 min):**

Generar HTML estático a mano + colocar en `client/public/privacidad.html`. Netlify lo sirve directo sin pasar por SPA.

---

## 🟡 MEDIA — próximas 2 semanas

### 5. Borrar token Cloudflare huérfano `kanban-backup-prod-v2`

Creado durante audit en R2 Manage tokens (formato cfut_) pero no usado en workflow final (workflow usa native API token del bootstrap).

1. https://dash.cloudflare.com → R2 → Manage R2 API Tokens
2. Sección **User API Tokens** → `kanban-backup-prod-v2` → menú `…` → **Delete**

### 6. Limpiar GitHub Secrets no usados

Secrets registrados durante iteraciones audit pero no usados en workflow final:

```bash
gh secret delete R2_SECRET_ACCESS_KEY -R ibaifernandez/aglaya-kanban-desk
gh secret delete R2_ENDPOINT -R ibaifernandez/aglaya-kanban-desk
```

(Mantén `R2_ACCESS_KEY_ID`, `R2_BUCKET`, `CF_ACCOUNT_ID`, `DATABASE_URL` — esos sí se usan.)

### 7. Actualizar version badge README

README dice `version-1.3.1` pero `package.json` dice `1.1.5`. Decidir cuál es la verdad:

- Si `1.1.5` es correcto: editar `README.md:4` → cambiar `version-1.3.1` por `version-1.1.5`
- Si quieres bumpear: `npm version 1.4.0 --no-git-tag-version` + actualizar README a `1.4.0`

Plus: `tests-85 passing` → cambiar a `tests-95 passing` (4 skipped no se cuentan).

### 8. Limpiar dead deps

```bash
npm uninstall bcryptjs  # B-17 — 0 invocaciones en código
```

Verificar tests + build después.

---

## 🟢 NICE-TO-HAVE — sin urgencia

### 9. Setup statusline Caveman badge

Tu CLI Claude tiene plugin Caveman activo pero sin statusline. Si lo quieres:

```json
// Añadir a /Users/AGLAYA/.claude/settings.json
"statusLine": {
  "type": "command",
  "command": "bash \"/Users/AGLAYA/.claude/plugins/cache/caveman/caveman/84cc3c14fa1e/hooks/caveman-statusline.sh\""
}
```

### 10. Considerar UptimeRobot (free, 5 min)

5 monitors free, 5min interval. Apuntar a `https://kanban.aglaya.biz/api/health`. Notifica si Railway cae.

1. https://uptimerobot.com → signup free
2. Add New Monitor → HTTP(s) → URL: `https://kanban.aglaya.biz/api/health`
3. Interval: 5 minutes
4. Alert contacts: tu email
5. Save

### 11. Setup retention cron (workflow para aplicar plazos política)

Política dice cards archivadas hard-delete tras 24 meses + digest_logs 12 meses + notificaciones 90 días. Implementar workflow `.github/workflows/retention-cron.yml` con SQL que aplica cada semana.

Esto requiere también añadir `archived_at` column a tabla cards (migration). Puedo hacerlo en un sprint posterior si lo pides.

---

## ❌ DECISIONES FIRMES (no hacer)

| # | Item declinado | Razón |
|---|---|---|
| A | Upgrade Supabase Pro $25/mo | Quick-win backup workflow es suficiente. RPO 24h aceptable para uso actual. |
| B | Revisión legal externa €500-1500 | Política aprobada in-house. Re-evaluar si volumen UE crece >5000 únicos/año |
| C | Representante UE Art. 27 RGPD | No requerido obligatoriamente con volumen actual. Re-evaluar con crecimiento |
| D | Versión trilingüe política | Solo ES por ahora. Añadir EN/PT-BR cuando tracción real lo justifique |

---

## Estado audit Mariana al cerrar checklist

Cuando completes los items 1-4 (los 🔴+🟠):

- ✅ B-CRIT-02 mitigado y rotación renovada (4 días deadline cerrado)
- ✅ D-01 Sentry activo (cierra ceguera operativa)
- ✅ C-03 DPAs archivados (cierra evidencia documental RGPD Art. 28)
- ✅ C-01 política privacidad publicada (cierra RGPD Art. 13/14)

Eso cierra **TODOS los críticos abiertos del audit**. El resto (item 5-11) es cleanup operativo.

---

## Referencia rápida

- Audit completo: `docs/audits/2026-05-27-mariana/REPORT.md`
- Findings JSON queryable: `docs/audits/2026-05-27-mariana/findings.json`
- Política privacidad publishable: `docs/legal/privacy-policy-kanban.md`
- Runbook backup restore: `docs/runbooks/db-restore.md`
- Runbook key rotation: `docs/runbooks/key-rotation.md`
- SECURITY.md sync con realidad: `docs/SECURITY.md`

¿Dudas? Releé este archivo o `docs/legal/README.md` para el mapa legal completo.
