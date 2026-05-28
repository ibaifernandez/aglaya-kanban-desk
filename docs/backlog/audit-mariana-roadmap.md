# Audit Mariana — Roadmap Backlog

**Origen:** audit Mariana Trench (2026-05-27 → cierre 2026-05-28). Ver `docs/audits/2026-05-27-mariana/REPORT.md`.
**Estado:** críticos + altos cerrados. Quedan **49 hallazgos** medio/bajo/info distribuidos en 3 bloques estratégicos.

> **Cómo usar este documento:** cada bloque es un sprint independiente. Items dentro del bloque pueden ejecutarse incrementalmente o en batch. Cada item linkea su ID en `findings.json` para queries.

---

## Bloque A — Atajar deuda medio/bajo del audit (~40-60h)

ROI incremental. Ningún item mueve aguja como críticos cerrados. Ritmo natural: 1-2 items por sprint integrado al desarrollo normal.

### A.1 — A11y completar (~15-20h)

| ID | Severidad | Esfuerzo | Acción | Bloqueante |
|---|---|---|---|---|
| A-06 | ALTO | 8h | A11y sweep completo: aria-* states en toggles/expandible/listas/comboboxes | requiere audit visual componente-por-componente |
| A-07 | ALTO | 4h | Code splitting bundle: React.lazy por ruta + manualChunks vendor en vite.config | bundle actual 728 KB → target <300 KB initial |
| A-08 | MEDIO | 0.5h | `motion-reduce:` en animaciones (Spinner, transitions) — WCAG 2.3.3 AAA | n/a |
| A-09 | ALTO | 1h | Auditar useEscapeKey en cada modal (verificar consistencia) | n/a |
| A-10 | ALTO | 16h | CardModal 937 LOC → split por tabs (Detalles / Checklist / Adjuntos / Asignaciones) | decisión UX |
| A-12 | MEDIO | 0.5h | OG/Twitter/canonical meta tags en `client/index.html` | n/a |
| A-13 | BAJO | 0.25h | robots.txt explícito (User-agent: * / Disallow: /) | publicar custom robots en Netlify |
| A-15 | ALTO | 2h | Ajustar contraste texto secundario `#555b70` `#8b92a5` → tokens design system con ratio ≥4.5:1 | rediseño tokens |
| A-20 | ALTO | 1h | Completar h1 en WorkspaceDashboard, AdminPage, Toolbar (1 h1 por route) | parcial cerrado (LoginPage hecho) |
| A-21 | ALTO | 1h | aria-live en NotificationBell badge + toast container | n/a |
| A-23 | MEDIO | 4h | Empty states: búsqueda sin resultados, board vacío, columna vacía, notifications vacías, checklist vacía | UX copy needed |
| A-24 | MEDIO | 2h | Touch targets IconButton `p-1.5` mínimo + gap entre clusters | n/a |
| A-25 | ALTO | 16h | Mobile responsive audit + decisión desktop-only declarada explícita | decisión producto |
| A-06 | ALTO | 8h | A11y sweep aria states agregado | n/a |

### A.2 — Seguridad/DB residual (~10h)

| ID | Severidad | Esfuerzo | Acción |
|---|---|---|---|
| B-08 | MEDIO | 2h | `npm audit fix` non-breaking + evaluar major bumps de lodash + path-to-regexp |
| B-10 | MEDIO | 2h | CI lint que rechace PRs con migrations sin GRANT explícito + RLS (deadline Oct 30 2026) |
| B-12 | MEDIO | 4h | Auditoría policies WRITE por tabla (boards/columns/cards/categories/workspaces) — declarar service-role-only writes o añadir policies explícitas |
| B-14 | MEDIO | 1h | Índices DB añadir: `cards.priority`, `cards.due_date`, `cards.assigned_to`, `digest_logs.created_at` |
| B-15 | BAJO | n/a | digestRouter degree=29 — ACCEPTED (ADR-025 documenta decisión) |
| B-18 | MEDIO | n/a | Comunidad 0 frontend cohesión — cross-ref A-10 (CardModal split) |
| B-19 | INFO | 0.1h | Comment-only en migración GRANTs aclarando ALTER TABLE ENABLE RLS no incluido |

### A.3 — Legales medios (~10h)

| ID | Severidad | Esfuerzo | Acción |
|---|---|---|---|
| C-10 | ALTO | 1h | Consent banner kanban transparencia localStorage (JWT + UI prefs) — mínimo informativo sin blocking |
| C-11 | MEDIO | 4h | JWT payload minimal (B-02 ya redujo TTL, queda quitar email/name de claims y resolver via DB-fresh — relacionado B-07) |
| C-12 | ALTO | 1h | Plazos retención cards/comments/digest_logs declarados en política — ya en doc, falta cron de aplicación retention |
| C-14 | ALTO | 4h | Mapeo transferencias internacionales + SCC documentación cross-procesador |
| C-16 | MEDIO | 40h | Programa Gobernanza LGPD (Art. 50) — proyecto trimestre — requerido cuando equipo crezca o cliente externo lo exija |
| C-18 | BAJO | n/a | Observación cross-domain consent tracking — sin tracking activo actual |

### A.4 — Ops/Docs/Mantenibilidad (~15h)

| ID | Severidad | Esfuerzo | Acción |
|---|---|---|---|
| D-02 | ALTO | 5h | pino structured logging + PII redaction (Sentry beforeSend ya lo hace pero stdout sigue raw) |
| D-04 | ALTO | 3h | ESLint + Prettier configs (skip TypeScript migration por ahora — proyecto largo) |
| D-07 | ALTO | 0.5h | UptimeRobot/BetterStack apuntando a /api/health |
| D-08 | ALTO | 1h | Slack/email webhook alerts en workflows (db-backup + digest-cron) |
| D-09 | ALTO | 5h | Runbooks faltantes: data-breach-response, healthcheck, deploy-rollback |
| D-10 | MEDIO | 0.5h | `.github/SECURITY.md` con responsible disclosure timeline |
| D-11 | MEDIO | 0.25h | `.github/dependabot.yml` weekly |
| D-12 | MEDIO | 2h | `docs/onboarding.md` extraer secciones README + AGENTS.md |
| D-13 | MEDIO | 10h | Backfill ADRs 001-024 históricos (ARCHITECTURE.md menciona pero no existen como archivos) |
| D-15 | MEDIO | 0.5h | zod schema env vars validation al startup (joi/envalid alternativa) |
| D-16 | MEDIO | 0.5h | Healthcheck deep: ping Supabase + Resend SMTP |
| A-11 | INFO | n/a | lucide-react 29MB node_modules — tree-shake OK por named imports |
| A-14 | INFO | n/a | SPA auth-walled sin SSR — body vacío crawlers — N/A práctico |
| A-16 | RESUELTO | done | Spinner SIZE_CLASSES (resuelto en `105872d` junto a A-05) |

### A.5 — Tests preexistentes (~3h)

| ID | Esfuerzo | Acción |
|---|---|---|
| tests-preexisting | 3h | Arreglar 4 tests fallando preexistentes auth/admin/security (mocks legacy `inviteUserByEmail`, `createPublicClient`, domain restriction) |

---

## Bloque B — Hardening avanzado (fuera audit)

Cosas que el audit NO levantó pero serían mejoras significativas. Bajo prioridad mientras audit cerrado.

### B.1 — Stack quality

| Item | Esfuerzo | ROI |
|---|---|---|
| TypeScript migration (server + client) | 40-80h | Detecta bugs estáticos. Proyecto grande, considerar tras crecimiento equipo dev |
| E2E tests Playwright (login → create card → assign → notification) | 20h | Cobertura integración real. Critical user flows |
| Storybook para componentes UI + visual regression | 16h | Si equipo design crece + clientes externos exigen consistencia |

### B.2 — Observabilidad avanzada

| Item | Esfuerzo | ROI |
|---|---|---|
| Sentry profiling + distributed tracing | 4h | Detecta perf regressions automáticamente |
| Prometheus + Grafana dashboards (Railway exports) | 8h | Custom metrics: digest send rate, RLS hit ratio, etc. |
| Log aggregation external (Logtail / Better Stack) | 4h | Búsqueda + retention >30d para auditoría |

### B.3 — Infraestructura

| Item | Esfuerzo | ROI |
|---|---|---|
| Cloudflare Tunnel B-03 cierre 100% | 3h + complejidad infra | Cierra bypass Railway URL completamente |
| Multi-region backup (R2 → Backblaze cross-replication) | 4h | Disaster recovery cross-provider |
| Read replicas Supabase (Pro plan) | $25/mo + 2h setup | Lectura escalable cuando equipo crezca |

---

## Bloque C — Features producto (no security)

Roadmap producto que el equipo necesita usar daily. Decisión del operador.

### C.1 — UX críticas

| Item | Esfuerzo | Notas |
|---|---|---|
| Mobile responsive serio (A-25 cross-link) | 40-60h | Decisión producto: ¿desktop-only o mobile-supported? |
| CardModal 937 LOC → tabs (A-10 cross-link) | 16h | Reduce densidad cognitiva. UX research recomendado |
| Search global mejorado (fuzzy + filters avanzados) | 12h | Productividad ganada cuando workspace tiene >100 cards |
| Bulk operations (multi-select cards → move/delete/assign) | 16h | Power user feature |
| Keyboard shortcuts completos (más allá de ⌘1-9) | 8h | Cmd+K palette, Cmd+/ help, etc. |

### C.2 — Colaboración

| Item | Esfuerzo | Notas |
|---|---|---|
| Real-time updates (Supabase Realtime subscriptions) | 16h | Cards aparecen al instante sin refresh — critical para clientes externos |
| Cross-workspace mentions (@usuario en otro workspace) | 8h | Si workspaces "externos" colaboran |
| Comment threads (replies anidados) | 12h | Mejora UX en cards con discusión |
| Activity feed por workspace | 8h | Audit trail visible al equipo |

### C.3 — Integraciones

| Item | Esfuerzo | Notas |
|---|---|---|
| GitHub issues sync bidireccional | 20h | Para equipo dev |
| Slack notifications (replazar emails digest opcionalmente) | 8h | Cuando equipo use Slack |
| Webhooks salientes (Zapier/n8n bridge) | 12h | Automatización custom |
| Export workspace completo (ZIP + JSON estructurado) | 8h | Portabilidad real (extensión de C-05 self-export) |

---

## Priorización sugerida cuando se retome backlog

**Sprint 1 — A.1 a11y + A.4 ops rápidos (2 semanas, ~12h):**
- A-08 motion-reduce
- A-12 OG meta tags
- A-13 robots.txt
- A-20 h1 routes restantes
- A-21 aria-live
- D-07 UptimeRobot
- D-10 .github/SECURITY.md
- D-11 dependabot.yml
- D-15 zod env validation
- D-16 healthcheck deep
- B-14 índices DB

**Sprint 2 — A.2 seguridad/DB + tests (2 semanas, ~15h):**
- B-08 npm audit fix
- B-10 CI lint GRANTs
- B-12 RLS WRITE policies
- tests-preexisting (3h)
- A-09 useEscapeKey audit
- A-15 contraste tokens

**Sprint 3 — A.3 legales medios (2 semanas, ~10h):**
- C-10 consent banner
- C-11 JWT payload minimal
- C-12 retention cron implementation
- C-14 SCC documentación cross-procesador

**Sprint 4 — Ops/docs (2 semanas, ~15h):**
- D-02 pino structured logging
- D-04 ESLint + Prettier
- D-08 Slack webhook alerts
- D-09 runbooks faltantes
- D-12 onboarding doc

**Sprint 5+ — A.1 a11y profundo (4-6 semanas, ~40h):**
- A-06 aria sweep completo
- A-07 code splitting
- A-10 CardModal split
- A-23 empty states
- A-24 touch targets
- A-25 mobile decisión + implement

**Backlog largo plazo (B + C):**
- TypeScript migration (decisión arquitectónica)
- Real-time updates (decisión producto)
- Mobile responsive (decisión producto)
- LGPD Programa Gobernanza (cuando volumen brasileño justifique)

---

## Cómo retomar el backlog en sesiones futuras

1. Leer `docs/audits/2026-05-27-mariana/REPORT.md` sección "Cierre formal"
2. Query `findings.json` por status: `cat findings.json | jq '.findings[] | select(.status == null or .status == "OPEN")'`
3. Elegir sprint por bloque (A.1, A.2, ...) o item individual por ID
4. Actualizar `findings.json` con `fix_sha` + `fix_note` al cerrar
5. Cross-ref en commit message: `fix(audit-mariana): cierra A-XX — descripción`

---

## Referencias cross-document

- Audit findings JSON: `docs/audits/2026-05-27-mariana/findings.json`
- Audit REPORT.md: `docs/audits/2026-05-27-mariana/REPORT.md`
- Operator checklist: `docs/operator-checklist.md`
- Session handoff: `.claude/handoffs/2026-05-28-mariana-trench-cierre.md` (generado al final sesión)
