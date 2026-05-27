# Audit D — DevOps + Observabilidad + Documentación + Mantenibilidad

**Fecha:** 2026-05-27
**Repo SHA:** `5e94b54`
**Dimensiones:** DevOps/CI, Despliegue, Observabilidad (logs/metrics/alerts/error tracking), Documentación, Mantenibilidad (lint/types/onboarding).

---

## Resumen Fase D

| Severidad | Count |
|---|---|
| CRÍTICO | 2 |
| ALTO | 6 |
| MEDIO | 7 |
| BAJO | 3 |
| **Total** | **18** |

---

## Hallazgos

| ID | Dim | Hallazgo | Evidencia | Severidad | Esfuerzo |
|---|---|---|---|---|---|
| **D-01** | Obs | **ZERO error tracking en producción.** No Sentry, Bugsnag, Datadog, Rollbar, NewRelic. 148 `console.log/warn/error` dispersos en `server/` van a stdout → Railway logs. Si Railway pierde un log o el equipo no monitorea Railway dashboard manualmente, los errores en prod son invisibles. Riesgo: B-CRIT-01 (XSS) o B-CRIT-02 (backup) podrían haber estado fallando silenciosamente meses antes del audit. | `grep -rE "sentry\|bugsnag\|datadog\|rollbar\|newrelic" package.json client/package.json server/` → 0 hits. `grep -rE "console.(log\|warn\|error)" server/ --include=*.js` → 148 occurrences | **CRÍTICO** | Bajo — `npm i @sentry/node @sentry/react` + init + DSN env. ~2h |
| **D-02** | Obs | **ZERO structured logging.** No `pino`, `winston`, `bunyan`. Logs son texto plano `console.log` sin niveles, sin correlación, sin redacción de PII (Art. 32 RGPD). Filtrado/búsqueda en Railway dashboard manual. Si email/JWT/password se loguea por error → leak. | 0 hits de logging libs. 148 logs raw | **ALTO** | Medio — migrar a `pino` con redaction `paths: ['*.password', '*.token', '*.email']`. ~4-6h |
| **D-03** | CI | **No CI para tests/lint/build.** `.github/workflows/` solo tiene `digest-cron.yml` + `db-backup.yml` (este audit). NO hay workflow que ejecute `npm test` en PRs. Bugs entran a `main` sin gate automático. | `ls .github/workflows/` → 2 files (cron, backup). Ningún PR/push workflow. | **CRÍTICO** | Bajo — `.github/workflows/ci.yml` ejecutando `npm ci && npm test`. ~1h |
| **D-04** | Mant | **ZERO ESLint, Prettier, TypeScript.** Sin lint, sin formatter, sin types. Devs pueden shippear código con bugs detectables estáticamente (unused vars, missing returns, type mismatches, accessibility eslint plugins). | `ls .eslintrc* eslint.config.* .prettierrc* tsconfig*` → 0 archivos. `grep eslint\|prettier\|typescript package.json client/package.json` → 0 deps | **ALTO** | Medio — `npm i -D eslint eslint-plugin-react eslint-plugin-jsx-a11y prettier` + configs. TypeScript = proyecto separado mayor. ~3h ESLint+Prettier solo |
| **D-05** | Mant | **`docs/SECURITY.md` documenta estado FALSO.** Dice "Rate limiting ✅ activo" → realidad B-06: solo `/api/auth`. Dice "RLS activo en DB" → realidad B-04: `organizations` sin RLS. Dice "Persistencia de sesión... sessionStorage" → realidad: localStorage (audit C-10). Documentación que dice "verde" cuando es amarillo es PEOR que ausencia — induce falsa confianza al lector. | `docs/SECURITY.md` cells: "Rate limiting ✅", "Row Level Security ✅", "Persistencia de sesión... sessionStorage" — todas inexactas | **CRÍTICO** | Bajo — sincronizar SECURITY.md con realidad post-audit (~30 min) |
| **D-06** | Docs | **README desactualizado.** Badge: `tests-85 passing` — real es 89 (+5 uploads.test.js commit `402b0d7`). Badge `version-1.3.1` — `package.json` dice `"version": "1.1.5"`. Documento que se publica visible en GitHub homepage del repo da info incorrecta. | `README.md:4-5` vs `package.json:3` ("1.1.5") + jest run (89 tests) | **MEDIO** | Trivial — actualizar 2 badges + columna "Tests" |
| **D-07** | Ops | **No uptime monitor externo.** Health endpoint `/api/health` existe pero nadie lo pinguea. Si Railway cae 30 min en madrugada, equipo se entera al llegar la mañana siguiente. | `grep "uptimerobot\|pingdom\|betteruptime\|statuscake" docs/` → 0 hits | **ALTO** | Trivial — UptimeRobot/BetterStack free tier (5 min interval) apuntando a `kanban.aglaya.biz/api/health`. 10 min setup |
| **D-08** | Obs | **No alertas operativas.** Sin Slack/email webhook para: backup workflow failure (B-CRIT-02 mitigación dejó `::error::` en GH Actions log pero sin notificación push), digest cron failure, healthcheck failure, deploy failure. Cron silencioso = cron muerto eventualmente. | `db-backup.yml`: `Notify on failure` step solo emite `::error::`, no envía. `digest-cron.yml`: idem | **ALTO** | Bajo — añadir `slack-action` o webhook a workflows. ~1h |
| **D-09** | Ops | **No runbooks para incidentes comunes.** `docs/runbooks/` solo tiene `db-restore.md` (creado este audit). Faltan: `data-breach-response.md` (RGPD Art. 33 timeline 72h — referencia cruzada C-08), `incident-response.md` (qué hacer si /api/health 5xx), `key-rotation.md` (Supabase service_role, JWT_SECRET, Resend API, R2 token expiring Jun 2), `deploy-rollback.md` (Railway rollback). | `ls docs/runbooks/` → solo `db-restore.md` | **ALTO** | Medio — 4-5 runbooks × ~1h cada uno. Plantillas + adaptación |
| **D-10** | Docs | **Sin `.github/SECURITY.md` (Security Policy pública).** GitHub muestra "Security Policy" link en repo cuando existe. Sin esto, reporter externo de vulns no sabe a quién contactar. Para repo público + procesando datos personales con RGPD, esto es expectativa industria. | `ls .github/SECURITY.md SECURITY.md` → No such file. Solo `docs/SECURITY.md` (interno) | **MEDIO** | Trivial — crear `.github/SECURITY.md` con contact + responsible disclosure timeline |
| **D-11** | Mant | **Sin `.github/dependabot.yml`.** Sin updates automáticos de dependencies. npm audit reporta 13 vulns (2 HIGH, 11 MODERATE) — algunos podrían cerrarse con bumps. Sin Dependabot, esos vulns se acumulan hasta auditoría manual. | `ls .github/dependabot.yml` → No such file | **MEDIO** | Trivial — copy-paste template oficial. 10 min |
| **D-12** | Mant | **Onboarding doc ausente.** No existe `docs/onboarding.md` ni `docs/getting-started.md`. Nuevo dev (incluso AI agent) debe inferir setup desde README + AGENTS.md + CLAUDE.md fragmentado. `README.md` cubre algo pero no menciona: cómo correr migraciones Supabase locales, qué pasa si .env falta vars, cómo correr tests con env vars correctas (descubrimos en Fase B que `--runInBand --no-watchman` es requerido pero solo está en package.json scripts, no documentado por qué). | `find docs -iname "onboarding*\|getting-started*"` → 0 hits | **MEDIO** | Bajo — extraer secciones del README + AGENTS.md a docs específico. ~2h |
| **D-13** | Mant | **1 sólo ADR archivado (ADR-025).** Existe pattern de ADRs pero sub-utilizado. Decisiones grandes sin documentar: por qué Supabase vs PostgreSQL self-hosted, por qué Railway vs Render/Fly, por qué JWT en localStorage vs sessionStorage vs httpOnly cookie, por qué Resend vs Mailgun. ARCHITECTURE.md menciona ADR-001 a ADR-024 inline pero NO existen como archivos individuales — sólo el ADR-025 (state mgmt) este audit. | `find docs -name "ADR-*"` → solo ADR-025 | **MEDIO** | Bajo — backfilling ADRs históricos (1-2h cada uno × 5-10 ADRs clave) |
| **D-14** | Mant | **Deps muertas en `package.json`.** `bcryptjs` declarado pero 0 invocaciones (auth delega a Supabase Auth — confirmado audit B-17). `file-type` añadido durante mitigación B-CRIT-01 — SÍ se usa en `server/routes/uploads.js`. `nodemailer` declarado: verificar uso (probable fallback de Resend, no eliminar sin confirmar). Cada dep huérfana es superficie de ataque innecesaria + bloat npm install. | `package.json:19 bcryptjs`, `:28 nodemailer`. `grep -rE "require.*bcrypt\|require.*nodemailer" server/`: bcrypt = 1 import sin uso, nodemailer = verificar | **BAJO** | Trivial — `npm uninstall bcryptjs` + verificar nodemailer. ~15 min |
| **D-15** | Ops | **Sin validación de env vars al startup.** Server arranca sin validar que `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, etc. estén presentes. Falla en runtime al primer request que las necesite. Mejor: validar en `app.js` antes de `app.listen()` y crashear con mensaje claro. | `grep -rE "joi\|zod\|envalid" server/` → 0 hits. `server/utils/smtpConfig.js` valida SMTP vars pero no resto | **MEDIO** | Bajo — añadir `zod` schema con todas las vars críticas. ~30 min |
| **D-16** | Obs | **Healthcheck superficial.** `GET /api/health` retorna `{status:'ok', timestamp}` sin verificar dependencies. Si Supabase está down pero Express vivo, healthcheck dice "ok" → uptime monitor no detecta la incidencia real. Mejor: ping a `supabaseAdmin.from('users').select('id').limit(1)` + ping a SMTP/Resend. | `server/app.js:133-135` | **MEDIO** | Trivial — extender healthcheck a deep-check. ~30 min |
| **D-17** | Docs | **`docs/INCIDENTS.md` stale.** "Última actualización 2026-04-28" — antes del audit Mariana. Este audit añadió B-CRIT-01 (XSS) y B-CRIT-02 (backup) — ambos son incidentes formales merecedores de entry. Sin esto, equipo futuro lee INCIDENTS.md y cree que el repo está limpio post-abril. | `docs/INCIDENTS.md:3` | **BAJO** | Trivial — añadir 2 entries con SHA fixes |
| **D-18** | Ops | **No `docs/runbooks/key-rotation.md`.** Tras mitigación B-CRIT-02, `aglaya-kanban-r2-bootstrap` Cloudflare token expira Jun 2 2026 (6 días). Sin runbook, riesgo es: deadline pasa, workflow falla silenciosamente (D-08), nadie se entera hasta auditoría manual. Aplicable también a Supabase service_role rotation, JWT_SECRET rotation, Resend API rotation. | Token rotation registrada en `audit-B.md` deuda pero no en runbook accionable | **ALTO** | Bajo — `docs/runbooks/key-rotation.md` con checklist por secret + cron next-renewal. ~1h |

---

## Recuento por dimensión

| Dimensión | CRÍTICO | ALTO | MEDIO | BAJO | Total |
|---|---|---|---|---|---|
| Observabilidad | 1 (D-01) | 2 (D-02, D-08) | 1 (D-16) | 0 | 4 |
| CI / DevOps | 1 (D-03) | 0 | 0 | 0 | 1 |
| Ops / Runbooks | 0 | 3 (D-07, D-09, D-18) | 1 (D-15) | 0 | 4 |
| Mantenibilidad | 0 | 1 (D-04) | 4 (D-11, D-12, D-13, D-14↓BAJO) | 1 (D-14) | 5 BAJO contado en mant |
| Docs | 1 (D-05) | 0 | 2 (D-06, D-10) | 1 (D-17) | 4 |

> Distribución total: 2 CRÍTICOS + 6 ALTO + 7 MEDIO + 3 BAJO = 18 entries.

---

## `[NO VERIFICABLE]` registrados

- **Railway deploy logs retention:** requiere acceso Railway dashboard. ¿Cuánto tiempo retiene logs? ¿Forwarding a externo configurado?
- **Si hay uptime monitor externo no declarado:** quizás operador tiene UptimeRobot/BetterStack apuntando a `/api/health` pero no documentado. Verificar.
- **Railway region específica:** US default Railway o EU configurado? Afecta transferencias internacionales (C-14).
- **GitHub Actions usage:** ¿se acerca el limit del free tier (2000 min/mes)? cron horario digest + backup daily = ~720 min/mes solo cron, parece bajo pero verificar.

---

## Hallazgos sorpresa durante audit Fase D

1. **`SECURITY.md` mentirosamente verde (D-05) es el problema MÁS grave de docs.** Worse than empty — induce falsa confianza. Cualquier dev/auditor lee "RLS activo en DB" y NO va a re-verificar. Lo descubrimos por casualidad re-comparando contra hallazgos B-04/B-06/C-10.

2. **README badge `version-1.3.1` vs package.json `1.1.5`.** Sugiere existencia de versionado dual (cosmético en docs vs semver real). Operador debería decidir cuál es la verdad y sincronizar.

3. **`docs/SECURITY.md` dice "Documento de referencia para la certificación Kosher".** "Certificación Kosher" no es estándar de seguridad — parece referencia interna AGLAYA. Aclarar significado o reemplazar por estándar reconocido (SOC 2, ISO 27001, RGPD compliance).

---

## Conclusión Fase D

**Estado observabilidad: ROJO.** Cero error tracking + cero structured logging + cero alertas operativas = vuelo a ciegas. Cualquier incidente prod (incluso bug mediano) puede pasar desapercibido hasta auditoría manual.

**Estado CI: ROJO.** Sin gate automático de tests, bugs entran a `main`. Risk amplified post-audit-mitigations: con 7 commits incrementales para B-CRIT-02 sin CI verde gate, podríamos haber roto algo no relacionado y nadie detectarlo.

**Estado mantenibilidad: AMARILLO.** ESLint/Prettier ausentes son fácil arreglar. TypeScript = decisión arquitectónica mayor, no urgente. Deps muertas trivial limpieza.

**Estado docs: AMARILLO con riesgo de ROJO.** `SECURITY.md` mentiroso (D-05) puede inducir decisiones equivocadas por equipo o auditor externo. Resto de docs operan razonablemente pero falta onboarding + runbooks.

**Acciones más urgentes Fase D:**
1. **D-05** (SECURITY.md mentiroso) — 30 min, riesgo alto si pasa desapercibido
2. **D-01** (Sentry) — 2h, cierra ceguera operativa
3. **D-03** (CI tests workflow) — 1h, gate básico
4. **D-18** (key-rotation runbook) — 1h, deadline real Jun 2

---

**Awaiting `OK Fase D` para arrancar Fase E (Síntesis final + REPORT.md consolidado + findings.json queryable + commit final).**
