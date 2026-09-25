# Fase 0 — Alcance · Auditoría Mariana 2026-09-24

**Modo:** `report` (sin fixes). **Commit de partida:** `a630a84`. **Auditoría previa:** `docs/audits/2026-05-27-mariana/` (80 entradas en `findings.json`) — base del delta de regresión en Fase E.

**Cooldown:** `RUN` — última auditoría hace 120 días (≥ techo de 30).

## Stack detectado

| Pieza | Indicador | Dónde |
|---|---|---|
| API Node/Express | `package.json` raíz (express, helmet, express-rate-limit, multer, jsonwebtoken, cookie-parser, @sentry/node) | `server/` — Railway (`Procfile`) |
| SPA React 18 + Vite + Tailwind | `client/package.json`, `client/vite.config.js` | `client/` — Netlify (`netlify.toml`) |
| Supabase Postgres | `docs/schema/*.sql`, `migrations/*.sql`, `@supabase/supabase-js` | esquema documentado en `docs/schema/supabase-schema.sql` |
| Servidor MCP stdio (Python) | `kanban-mcp/pyproject.toml` (mcp, httpx) | `kanban-mcp/` — corre en la máquina del operador |
| CI | 7 workflows | `.github/workflows/` |
| Observabilidad | `@sentry/node` | `server/utils/sentry.js`, `server/app.js`, `server/index.js` |
| Subida de ficheros | `multer` (disco + memoria) | `server/routes/uploads.js`, `server/routes/media.js` — prioridad Fase B |

**Arquetipo:** herramienta interna con UI tras login, con backend y base de datos. Tres cuentas autorizadas por decisión (`CLAUDE.md`). **Repositorio público** desde el 6-ago-2026 (`gh repo view` → `PUBLIC`). Página legal pública en `/privacidad`.

## Matriz de alcance

| # | Dimensión | Aplica | Motivo |
|---|---|---|---|
| 1 | Seguridad | SÍ | API expuesta (Railway + proxy Netlify), subidas, JWT, puerta interna con secreto, repo público |
| 2 | Accesibilidad WCAG 2.1 | SÍ | SPA con UI propia. `axe` ausente → lo que dependa de escaneo es `NV_TOOL`; lectura de código como vía principal |
| 3 | Usabilidad | SÍ | — |
| 4 | Rendimiento | PARCIAL | Bundle medible con `vite build` local. Core Web Vitals → `NV_RUNTIME` |
| 5 | Bases de datos | SÍ | Esquema documentado. Estado vivo de la base no consultable desde aquí (enganche de secretos, `ARCHITECTURE.md` §5 bis) → se citan corridas existentes de CI, fechadas, solo lectura |
| 6 | SEO técnico | PARCIAL | Tras login: solo meta/OG de `index.html`, `robots.txt`, página legal |
| 7 | Arquitectura + deuda | SÍ | — |
| 8 | Cumplimiento legal | SÍ (reducido) | Herramienta interna, pero trata datos personales y publica política |
| 9 | Cookies + consentimiento | SÍ (reducido) | `cookie-parser` en uso; sin analítica detectada por `grep` |
| 10 | Retención + DPA | SÍ | `docs/legal/` existe desde la auditoría previa |
| 11 | DevOps / CI | SÍ | — |
| 12 | Despliegue + observabilidad | SÍ / PARCIAL | Paneles de Railway, Netlify, Sentry → `NV_DASHBOARD` |
| 13 | Docs + mantenibilidad | SÍ | 106 ficheros en `docs/` |

## Herramientas (no se instaló nada)

| Herramienta | Estado | Efecto |
|---|---|---|
| `npm` (`npm audit`) | presente | CVE de dependencias Node como `tool-external` |
| `pip-audit` | presente | CVE de `kanban-mcp` como `tool-external` |
| `gh` | presente | lectura de corridas de Actions y ajustes del repo (solo lectura) |
| `psql` | presente, **no usable** | bloqueado por el enganche de secretos; no se rodea |
| `axe`, `radon`, `eslint`, `semgrep`, `trivy`, `lighthouse` | ausentes | hallazgos que solo ellos probarían → `UNVERIFIABLE / NV_TOOL` |

## Criterio de redacción

El repositorio es público. Los hallazgos de seguridad **abiertos** se describen por defecto y `file:line`, sin cargas de explotación. Si este directorio se commitea, o cómo, se decide en Fase E.
