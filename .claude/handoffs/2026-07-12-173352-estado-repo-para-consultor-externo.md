# Handoff: Estado del repo AGLAYA Kanban Desk — dossier para consultor externo

## Session Metadata
- Created: 2026-07-12 17:33:52
- Project: /Users/AGLAYA/Local Sites/aglaya-kanban-desk
- Branch: main (limpia salvo cambios pre-existentes en graphify-out/ + config)
- HEAD: 13190a3
- Session duration: ~1h — auditoría de estado en profundidad (solo lectura + ejecución de tests/audit)
- Propósito: entregar a un consultor externo que se incorpora al equipo AGLAYA un mapa completo y honesto del contenido y estado del repositorio a fecha de hoy.

### Recent Commits (for context)
  - 13190a3 fix(tests+version): digest timeout test + version drift resuelto
  - cabf19a docs(handoff): session handoff audit Mariana cierre + backlog roadmap
  - c9dffb4 docs(audit): cierre formal audit Mariana Trench — 30 hallazgos mitigados
  - dbb414f feat(security): JWT refresh token + access token corto (B-02 audit Mariana)
  - 66ca5eb fix(security): B-03 monitor + runbook custom domain Railway

## Handoff Chain

- **Continues from**: [2026-05-28-034424-mariana-trench-cierre.md](./2026-05-28-034424-mariana-trench-cierre.md)
  - Previous title: Audit Mariana Trench — Cierre formal + Backlog A/B/C
- **Supersedes**: None (complementa; el previo es el cierre del audit, este es el estado presente para onboarding de consultor)

> Review the previous handoff for full context before filling this one.

## Current State Summary

Producto SaaS Kanban multi-tenant **en producción y uso diario** en kanban.aglaya.biz. El repo está estable: rama `main` limpia, tests en verde (102 pass / 4 skip / 13 suites), CI/CD funcional (Netlify + Railway auto-deploy), backups diarios operativos. El hito reciente dominante fue el **Audit "Mariana Trench"** (2026-05-27/28): 79 hallazgos, 30 cerrados (16 críticos + 9 altos + 5 medios), 49 en backlog priorizado. La seguridad quedó notablemente endurecida (XSS cerrado, JWT refresh, rate limiting, RLS, compliance RGPD/LGPD/Ley 21.719 con DPAs y política publicada). No hay trabajo a medias en curso: esta sesión fue una auditoría de estado de solo lectura para producir el dossier de onboarding. El siguiente agente/consultor arranca con foco en **deuda inventariada** (49 hallazgos backlog) y **dos temas que atacar ya**: vulnerabilidades de dependencias y deriva de versiones/documentación.

## Codebase Understanding

### Architecture Overview

- **Stack:** React 18 + Vite 5 + Tailwind (client, Netlify, puerto 5175) · Express 4 + Node CommonJS (server, Railway, puerto 3003) · Supabase PostgreSQL 17.6 + RLS + Auth + Storage · Resend (email) · Sentry (solo server) · Cloudflare R2 (backups).
- **Jerarquía de datos (5 niveles):** Organización → Workspace → Board → Column → Card.
- **Multi-tenancy:** el schema soporta multi-organización (todas las tablas con `organization_id` + RLS por org), pero la app opera **single-tenant intencional** (una org `AGLAYA`, id fijo `00000000-...-0001`). Decisión formal en **ADR-020**. Activar multi-org = extender backend+frontend; la BD ya está lista.
- **Seguridad concéntrica (middleware):** `requireAuth` (JWT) → `requireRole` (macro: superadmin/admin/colaborador/cliente) → `requireWorkspaceMember` (micro: owner/admin/member/guest; deriva workspaceId desde board/column/card). Superadmin (`info@ibaifernandez.com`) tiene bypass "Modo Dios".
- **Producto:** tres tipos de workspace (personal/interno/externo) con un solo acceso; `cliente` solo ve externos asignados.
- **Tamaño:** ~7.021 L server (40 ficheros JS) / ~6.930 L client (41 ficheros JSX/JS). 171 commits desde 2026-03-19.
- **Orientación de código:** existe knowledge graph en `graphify-out/`. Regla del proyecto: usar `graphify query "<pregunta>"` / `graphify explain "<concepto>"` / `graphify path "<A>" "<B>"` ANTES de leer fuentes en crudo. Tras modificar código: `graphify update .`.

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| server/app.js | Express configurado sin listen(): rutas, 3 rate limiters, helmet, CORS, monitor B-03, error handler global + 404 JSON | Punto de entrada lógico del backend (ADR-024) |
| server/index.js | Entry point real (valida config + listen) | Arranque proceso |
| server/middleware/auth.js · workspace.js | requireAuth / requireRole / requireWorkspaceMember | Núcleo de multi-tenancy |
| server/routes/ | auth, boards, cards, columns, categories, workspaces, notifications, media, digest, admin, internalRoute | Toda la API |
| server/services/digest/ | admin.js, user.js, shared.js | Refactor del god-route digestRoute.js (mayo 2026) |
| server/utils/supabase.js | createAdminClient / createPublicClient (sesiones no persistentes por request) | ADR-016, evita contaminación de sesión |
| client/src/api/client.js | Objeto api.* plano + interceptor refresh token (401→/auth/refresh→retry con mutex) | Toda petición del cliente; ADR-025 mantiene acoplamiento plano |
| client/src/components/CardModal/CardModal.jsx | 957 L — god component | Candidato #1 a split (A-10) |
| client/src/pages/WorkspaceDashboard.jsx | 709 L — god component | Candidato a split |
| docs/schema/supabase-schema.sql | Fuente de verdad del schema (10 tablas, RLS, GRANTs, 7 índices) | Cualquier cambio de DB |
| docs/audits/2026-05-27-mariana/REPORT.md + findings.json | Audit completo, 79 hallazgos, status por finding | Mapa de deuda técnica/legal |
| docs/backlog/audit-mariana-roadmap.md | 49 hallazgos backlog en 3 bloques con esfuerzos | Roadmap accionable |
| docs/ARCHITECTURE.md | Arquitectura + ADRs inline (011..025) | Decisiones y por qué |
| .github/workflows/ | ci.yml, db-backup.yml, digest-cron.yml | CI/CD y ops |
| netlify.toml | Proxy /api + /uploads a Railway, CSP + security headers, /privacidad estática | Comportamiento de producción del cliente |

### Key Patterns Discovered

- **Idioma:** código en inglés; documentación y commits en español.
- **ADRs inline** en `docs/ARCHITECTURE.md` sección 7 (no ficheros separados). Registro: hasta ADR-025. Próximo disponible: ADR-026.
- **Backend fuente de verdad** de permisos: la UI oculta lo no autorizado por `workspace.myRole`, pero el backend valida siempre (ADR-014).
- **Clientes Supabase frescos por request** en auth/admin para evitar contaminación de singleton (ADR-016).
- **Contratos explícitos** en operaciones destructivas: frontend envía `boardId` en DELETE de cards; middleware resuelve workspace en 2 pasos deterministas (ADR-017).
- **GRANTs obligatorios**: toda tabla nueva en `public` requiere GRANT explícito (`authenticated` + `service_role`) + RLS, o falla vía supabase-js. **Deadline Supabase 30-oct-2026.** Patrón en `migrations/add_explicit_grants.sql`.
- **Regla de negocio:** al mover card a columna hecho/entregado/completado → `priority` = `"none"` automático.
- **Endpoint interno** `POST /api/internal/create-card` autenticado por `x-task-secret` (no JWT), rate-limit estricto.

## Work Completed

### Tasks Finished

- [x] Auditoría de estado en profundidad del repositorio completo (docs, server, client, schema, CI, infra, seguridad, legal).
- [x] Ejecución en vivo de la suite de tests (13 suites, 102 pass / 4 skip).
- [x] Ejecución de `npm audit` en server y client (hallazgo de vulns sin atender).
- [x] Verificación cruzada de versiones (detectada deriva no resuelta) y enlaces de documentación (detectado enlace roto).
- [x] Producción del dossier de onboarding para consultor externo (este handoff).

### Files Modified

Esta sesión **no modificó código de producto**. Los cambios sin commitear presentes al inicio son pre-existentes (artefactos de graphify + config), ajenos a esta sesión:

| File | Changes | Rationale |
|------|---------|-----------|
| .gitignore | pre-existente (no tocado en esta sesión) | — |
| .claude/settings.json | pre-existente | — |
| graphify-out/*.json, graph.html | pre-existentes (regeneración de graph) | — |
| .graphifyignore | pre-existente | — |
| .claude/handoffs/2026-07-12-173352-...md | **creado esta sesión** | Este dossier |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Entregar dossier como session-handoff validado | Markdown suelto / Artifact web / handoff | Handoff = formato estándar del proyecto, versionado en repo, con validación de secretos y chain al cierre del audit |
| No ejecutar `npm audit fix` en esta sesión | Arreglar ahora / reportar | Sesión de solo lectura; el fix (B-08) es decisión del operador/consultor, requiere validar breaking changes |

## Pending Work

### Immediate Next Steps

1. **Atender vulnerabilidades de dependencias (B-08).** `npm audit` en vivo: **server 21 vulns (1 crítica, 6 high, 13 moderate, 1 low)**; **client 6 vulns (3 high)** — incl. `ws` (memory disclosure + DoS). CI corre audit pero en modo informativo (`continue-on-error`), no bloquea. Ejecutar `npm audit fix` y evaluar bumps mayores.
2. **Resolver deriva de versiones (aún abierta pese al último commit).** `package.json` raíz = 1.3.1 ✅; `client/package.json` = 1.1.0 ❌; README badge = 1.1.5 y "95 passing" ❌; `docs/ARCHITECTURE.md` header = 1.1.5 ❌; `docs/schema/supabase-schema.sql` header = 1.2.0 ❌. Definir fuente única de verdad de versión.
3. **Arreglar enlace roto de docs:** README apunta a `docs/README-deploy.md`, que no existe.
4. Elegir un bloque del backlog del audit (`docs/backlog/audit-mariana-roadmap.md`): Bloque A (a11y/seguridad/legal medio ~40-60h), B (hardening), C (features).

### Blockers/Open Questions

- [ ] **Decisión de producto pendiente:** ¿mobile responsive serio o desktop-only declarado? (A-25). Bloquea ~40-60h de trabajo.
- [ ] **B-03 no cerrado al 100%:** monitor de acceso directo a URL Railway solo loguea (no bloquea con 403). Falta custom domain `api.kanban.aglaya.biz` + Cloudflare Tunnel. Runbook: `docs/runbooks/railway-custom-domain.md`.
- [ ] Sin observabilidad en cliente (Sentry solo en server).

### Deferred Items

- Split de god components (CardModal 957 L → tabs A-10; WorkspaceDashboard 709 L) — deuda de mantenibilidad, no urgente.
- Code splitting bundle (~728 KB / 207 KB gzip, single chunk) — A-07.
- ESLint/Prettier (D-04), TypeScript, E2E Playwright, Storybook — deuda estructural, decisión arquitectónica.
- pino structured logging + PII redaction (D-02).
- Backfill de ADRs 001-024 como ficheros (D-13; hoy solo referenciados).
- Multi-org GUI, real-time (Supabase Realtime), sandbox demo público (Fase 5, por definir).

## Context for Resuming Agent

### Important Context

Este repo está **excepcionalmente bien documentado y auditado** para su tamaño — no confíes solo en README (está desactualizado en versión/badges); la verdad operativa vive en `docs/audits/2026-05-27-mariana/` (estado real de seguridad/legal/deuda), `docs/backlog/audit-mariana-roadmap.md` (roadmap con esfuerzos), `docs/ARCHITECTURE.md` (ADRs y por qué de cada decisión), y `docs/schema/supabase-schema.sql` (fuente de verdad de DB). Los tests están verdes y el producto sirve tráfico real, así que **cualquier cambio debe preservar producción**: `main` auto-deploya a Netlify+Railway en cada push. El operador es Antonio Ibai Fernández (info@ibaifernandez.com / info@aglaya.biz), superadmin con bypass. Varias decisiones que parecen "faltantes" son deliberadas y documentadas (single-tenant ADR-020, acoplamiento plano de estado ADR-025, RPO 24h con backup a R2 en lugar de Supabase Pro) — no las "arregles" sin releer el ADR correspondiente.

### Assumptions Made

- Los cambios sin commitear en `graphify-out/` y config son artefactos ajenos a producto; no revisados a fondo.
- Los 4 tests skipped son intencionales (mocks legacy, `it.skip()` documentado), no fallos nuevos.
- La política de privacidad fue aprobada in-house (el operador declinó revisión legal externa €500-1500) — re-evaluar si volumen UE >5000 únicos/año.

### Potential Gotchas

- **Puertos fijos 3003/5175** — no cambiar nunca. Proyectos hermanos usan 3001/5173 y 3002/5174. Verificar qué proceso ocupa antes de matar.
- **GRANTs Supabase:** toda migración con tabla nueva en `public` DEBE incluir GRANT explícito + RLS o falla silenciosamente vía supabase-js. Deadline 30-oct-2026.
- **macOS sin `timeout`** por defecto — usar `gtimeout` (coreutils) o `connect_timeout` en URLs.
- **Cloudflare R2 usa API nativa, NO S3-compat** (tokens `cfut_`/`cfat_` de 53 chars, incompatibles con SDKs S3 que esperan 32).
- **GitHub Actions runners no soportan IPv6** — Supabase directo solo resuelve IPv6; usar Session Pooler IPv4.
- **Jest** requiere `--runInBand --no-watchman --forceExit` o cuelga (ver scripts npm).
- README declara "85 tests / 10 suites" y badge "95 passing"; real = **106 tests / 13 suites**. No fiarse del README para métricas.

## Environment State

### Tools/Services Used

- **Supabase** (proyecto `AGLAYA Kanban Desk`, ref `jowtasxhnluqqcgkeoll`) — PostgreSQL 17.6 + Auth + Storage. Plan Free. Credenciales de admin en `.env` (gitignored) para migraciones vía psql/CLI.
- **Railway** — server prod: `https://web-production-099a0.up.railway.app`. Sentry activo.
- **Netlify** — cliente prod (kanban.aglaya.biz), proxy a Railway.
- **Cloudflare R2** — bucket `aglaya-kanban-backups-prod` (WEUR), retención 30d. Bootstrap token válido hasta May 2027.
- **Resend** — email transaccional + digests (from info@aglaya.biz).
- **GitHub Actions** — CI (jest+build+audit), db-backup diario 03:17 UTC, digest-cron horario.

### Active Processes

- Ninguno arrancado por esta sesión. Servidores de dev NO levantados. Para local: `preview_start` "AGLAYA Kanban Desk Server" (3003) + "AGLAYA Kanban Desk Client" (5175), config en `.claude/launch.json`.

### Environment Variables

Solo NOMBRES (valores en `.env` gitignored, nunca commitear):
- Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SUPABASE_DATABASE_PASSWORD, SUPABASE_PAT
- Auth: JWT_SECRET, JWT_REFRESH_SECRET
- Email: RESEND_API_KEY, SMTP_FROM, DIGEST_TO, DIGEST_HOUR/MINUTE, USER_DIGEST_HOUR/MINUTE
- Cron/interno: DIGEST_CRON_SECRET, TASK_SECRET
- Observabilidad: SENTRY_DSN, SENTRY_ENVIRONMENT, SENTRY_RELEASE
- App: PORT, SITE_URL, NODE_ENV, TZ
- GH Secrets (backups): DATABASE_URL, R2_ACCESS_KEY_ID, R2_BUCKET, CF_ACCOUNT_ID, RAILWAY_SERVER_URL

## Related Resources

- Audit consolidado: [docs/audits/2026-05-27-mariana/REPORT.md](../../docs/audits/2026-05-27-mariana/REPORT.md)
- Findings queryable: [docs/audits/2026-05-27-mariana/findings.json](../../docs/audits/2026-05-27-mariana/findings.json)
- Backlog roadmap: [docs/backlog/audit-mariana-roadmap.md](../../docs/backlog/audit-mariana-roadmap.md)
- Arquitectura + ADRs: [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- Schema DB: [docs/schema/supabase-schema.sql](../../docs/schema/supabase-schema.sql)
- Changelog: [docs/CHANGELOG.md](../../docs/CHANGELOG.md) · Roadmap: [docs/ROADMAP.md](../../docs/ROADMAP.md)
- Legal: [docs/legal/](../../docs/legal/) (DPAs, DPIA, RAT, TOMs, política, retención, subprocesadores)
- Runbooks: [docs/runbooks/](../../docs/runbooks/) (db-restore, key-rotation, railway-custom-domain)
- Handoff previo (cierre audit): [2026-05-28-034424-mariana-trench-cierre.md](./2026-05-28-034424-mariana-trench-cierre.md)
- Instrucciones del proyecto para agentes: [CLAUDE.md](../../CLAUDE.md) · [AGENTS.md](../../AGENTS.md)

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
