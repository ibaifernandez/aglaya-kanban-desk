# Fase D — Operación y mantenibilidad · Auditoría Mariana 2026-09-24

**Leído:** `.github/workflows/*` (7), `server/index.js`, `server/app.js`, `docs/RUNBOOK.md`, `docs/runbooks/*`, `docs/INCIDENTS.md`, `docs/ARCHITECTURE.md` (ADR), `README.md`, `package.json` (raíz y `client/`).
**Consultado en solo lectura:** ajustes y corridas de GitHub (`gh api`, `gh run list`) y configuración del servicio en Railway (`describe-service`: nombres de variables sin valores).

## Panel de evidencia — Fase D

| Confianza | Nº | % de la fase |
|---|---|---|
| PROVEN | 15 | 93,8 % |
| UNVERIFIABLE | 1 | 6,2 % |
| **Total** | **16** | 100 % |

Fuente: code-read 12 · tool-external 3 (`gh api`: reglas de rama y ajustes de seguridad; API de Railway) · manual-verification 0.

Salud: PROVEN ≥ 60 % → sana.

## Recuento por severidad

| CRITICAL | HIGH | MEDIUM | LOW | UNVERIFIABLE |
|---|---|---|---|---|
| 0 | 1 | 10 | 4 | 1 |

## Estado de las corridas (24-sep-2026)

Todo en verde. Copia diaria `db-backup.yml`: 4 de 4 correctas (última: `35975083149`). `schema-drift.yml`, `rail-scope.yml` y `pr-corridas.yml`: diarias, en verde. `ci.yml`: verde en los dos últimos PR y sus `push` a `main` (19-sep). `npm-audit.yml`: verde porque es informativo (ver B-08).

## Hallazgos

| ID | Confianza | Dim | Hallazgo | Evidencia | Severidad | Esfuerzo |
|---|---|---|---|---|---|---|
| D-19 | PROVEN | despliegue | Producción no espera a CI: `main` exige PR pero no comprobaciones en verde, y Railway despliega sin mirar los checks | ruleset `23694681`; Railway `source.checkSuites: false`; `.github/workflows/ci.yml:36` | HIGH | 0,5 h |
| D-23 | PROVEN | docs/UI | La interfaz dice que el Invitado es de solo lectura; la matriz y el servidor le dejan crear, editar y mover tarjetas | `client/src/components/Workspace/WorkspaceMembers.jsx:215,392-393`; `docs/PERMISSIONS.md` (matriz); `server/routes/cards.js:132-199,219-501,503-566` | MEDIUM | 1 h |
| D-24 | PROVEN | proceso | El registro de la auditoría de mayo cerró como «MITIGATED» arreglos que eran parciales | `docs/audits/2026-05-27-mariana/findings.json` (A-01, A-03, A-04, A-22); commit `a9437ec` | MEDIUM | 1 h |
| D-20 | PROVEN | observabilidad | El cliente no registra errores en ningún sitio | `client/package.json:13-24`; `netlify.toml:41` | MEDIUM | 2 h |
| D-21 | PROVEN | fiabilidad | Ante una excepción no capturada el proceso no sale, y Railway no llega a reiniciarlo | `server/index.js:31-35` | MEDIUM | 0,5 h |
| D-02 | PROVEN | observabilidad | Registros en texto libre, sin estructura | `server/app.js:114-122` | MEDIUM | 3 h |
| D-04 | PROVEN | mantenibilidad | Sin linter, formateador ni tipos, en CI ni en local | `package.json:6-13`; `client/package.json:6-12`; 0 ficheros de configuración | MEDIUM | 4 h |
| D-07 | PROVEN | observabilidad | Ningún monitor de disponibilidad documentado | 0 coincidencias en `docs/` y `README.md`; `server/app.js:93-94` | MEDIUM | 0,5 h |
| D-11 | PROVEN | dependencias | Actualizaciones de seguridad de Dependabot desactivadas y sin `dependabot.yml` | `gh api repos/…` → `dependabot_security_updates: disabled` | MEDIUM | 0,5 h |
| D-13 | PROVEN | docs | ADR-001 a 010 sin ficha, y ADR-005 sigue diciendo que el repositorio es privado | `docs/ARCHITECTURE.md:202,322` | MEDIUM | 2 h |
| D-16 | PROVEN | observabilidad | `/api/health` responde `ok` sin comprobar nada | `server/app.js:185-187` | MEDIUM | 1 h |
| D-09 | PROVEN | runbooks | Hay runbooks de restauración, rotación de claves y dominio; falta el de marcha atrás de un despliegue | `docs/runbooks/` (3); `docs/RUNBOOK.md` | LOW | 1 h |
| D-17 | PROVEN | docs | `INCIDENTS.md` no recoge los incidentes de agosto y septiembre que el propio código documenta | `docs/INCIDENTS.md:9,32`; `server/routes/cards.js:244,331,353`; `server/middleware/hostMonitor.js:21-24` | LOW | 1 h |
| D-25 | PROVEN | docs | `package.json` presenta la app como «multi-tenant» (contra ADR-020) | `package.json:4` | LOW | 0,1 h |
| D-26 | PROVEN | docs | El README muestra licencia MIT y no hay fichero `LICENSE` en un repositorio público | `README.md:7`; `git ls-files` | LOW | 0,1 h |
| D-NV-01 | UNVERIFIABLE (`NV_DASHBOARD`) | observabilidad | Reglas de alerta de Sentry, a quién avisan, y si Netlify espera a CI | — | — | — |

## Detalle

### D-19 · HIGH · NEW

La regla de rama `23694681` («main: solo por PR», activa, sin excepciones) impide el `push` directo, el borrado y la reescritura de historia. Eso cierra lo que pasó el 6-ago. Pero sus reglas son `deletion`, `non_fast_forward` y `pull_request` con 0 aprobaciones: **ninguna `required_status_checks`**. Un PR con CI en rojo se puede fusionar.

Y Railway no espera: el servicio `web` tiene `"source": {"branch": "main", "checkSuites": false}` (`describe-service`, 24-sep), así que despliega en cuanto `main` se mueve. La norma de no fusionar en rojo existe, pero la aplica quien fusiona, no la plataforma. El comentario de `ci.yml:36` («`main` no está protegida») ha quedado viejo.

**Arreglo:** añadir `required_status_checks` con los trabajos de `ci.yml` al conjunto de reglas, y activar en Railway la espera a los checks.

### D-23 · MEDIUM · NEW

Al añadir un miembro, el selector ofrece «Invitado — solo lectura» (`WorkspaceMembers.jsx:215`), y el pie del panel dice que los invitados «solo pueden ver el contenido» (`:392-393`). La matriz de `PERMISSIONS.md` da al Invitado ✅ en «Crear tarjetas» y «Gestionar tarjetas/contenido», y el servidor no comprueba el rol al crear, editar ni mover (`cards.js:132-199`, `:219-501`, `:503-566`). Quien da acceso a un cliente creyendo que solo mirará está dando escritura. La decisión es de la matriz. La frase de la UI es la que falla.

### D-24 · MEDIUM · NEW

Cuatro hallazgos de mayo se cerraron como `MITIGATED` con un arreglo parcial:

- A-01: «htmlFor + id en inputs críticos»;
- A-03 y A-17: «6 modales», dejando fuera `AvatarCropModal`, que estaba en la lista;
- A-04: quedaron dos botones;
- A-22: «4 formularios».

El commit `a9437ec` dice «cierra A-01 + A-22 100%». Nada se rompió después: lo que falló fue el cierre. Por protocolo, estos hallazgos vuelven como `REGRESSED` (Fase A). **Arreglo de proceso:** cerrar un hallazgo con la misma medición que lo abrió (el inventario completo, no una muestra) y dejar `PARTIAL` cuando no llegue al 100 %.

### D-20 · MEDIUM · NEW (D-01 queda FIXED en el servidor)

Sentry está activo en el servidor. En el cliente no hay SDK (`client/package.json:13-24`, sin `@sentry/*`), aunque la CSP ya deja pasar `*.sentry.io` (`netlify.toml:41`). Un fallo de render o de red en el navegador no deja rastro. Y la Fase A mostró que muchos de esos fallos no se le enseñan al usuario (A-30).

### D-21 · MEDIUM · NEW

`process.on('uncaughtException')` registra el error y no sale: «No exit — dejamos que el sistema decida (Railway reinicia container automático)» (`server/index.js:31-35`). Railway reinicia cuando el proceso termina, y este manejador impide justo eso. Node advierte que tras una excepción no capturada el proceso queda en estado indefinido. **Arreglo:** registrar, enviar a Sentry y `process.exit(1)`.

### D-02 · MEDIUM · DEESCALATED (ALTO → MEDIUM por rúbrica)

El registro de peticiones escribe texto libre (`[req] GET /api/... → 12ms`, `server/app.js:114-122`), y el resto es `console.*` suelto. La rúbrica de DevOps pone «sin logs estructurados» en MEDIUM.

### D-04 · MEDIUM · DEESCALATED (ALTO → MEDIUM por rúbrica)

No hay `eslint`, `prettier`, `tsc`, `ruff` ni `mypy` en `package.json`, `client/package.json`, `kanban-mcp/pyproject.toml` ni en los workflows. Los comentarios `eslint-disable` que hay en el código (`client/src/App.jsx:109`, `server/app.js:192`) apuntan a un linter que no se ejecuta.

### D-07 · MEDIUM · DEESCALATED (ALTO → MEDIUM por rúbrica)

`/api/health` se excluye del límite «para uptime monitors» (`server/app.js:93-94`), pero ningún documento dice qué monitor lo consulta ni a quién avisa. Si existe uno externo, no consta en el repo.

### D-11 · MEDIUM · UNCHANGED

`gh api repos/ibaifernandez/aglaya-kanban-desk` → `dependabot_security_updates: disabled`, y no hay `.github/dependabot.yml`. La vigilancia de dependencias es `npm-audit.yml`, que no falla nunca (B-08).

### D-13 · MEDIUM · UNCHANGED

La nota de numeración sigue diciendo «Backfill formal pendiente: finding D-13 del audit» (`docs/ARCHITECTURE.md:322`). Y ADR-005 afirma que «el repositorio fuente es privado» y que se despliegan artefactos compilados (`:202`). El repositorio es público desde el 6-ago-2026, y Railway construye desde el código (`builder: RAILPACK`). Una decisión revocada que sigue en vigor sobre el papel.

### D-16 · MEDIUM · UNCHANGED

`app.get('/api/health', …)` devuelve `{ status: 'ok' }` sin tocar la base ni Supabase Auth (`server/app.js:185-187`).

### D-09 · LOW · DEESCALATED (ALTO → LOW)

De los cuatro runbooks que pedía mayo existen tres: `docs/runbooks/db-restore.md`, `key-rotation.md` y `docs/legal/breach-notification-procedure.md`, además de `railway-custom-domain.md`. No existe el de volver a un despliegue anterior. Con D-19 abierto, es el que más falta haría.

### D-17 · LOW · REGRESSED

Se cerró en mayo al actualizar `INCIDENTS.md`. Hoy su entrada más reciente es del 12-jul-2026 (`:9`, `:32`). Los incidentes posteriores están contados en comentarios de código y no en el registro:

- la descripción de una tarjeta sustituida por un obrero automático (6-ago, `cards.js:331`);
- la reconstrucción que perdió trabajo (8-ago, `:244`, `:353`);
- la cuota de Sentry de toda la organización agotada por el monitor B-03 (1-sep, `hostMonitor.js:21-24`).

**Nota:** por protocolo, un `REGRESSED` es P0. La severidad sigue siendo LOW.

### D-25 · LOW · NEW

`"description": "AGLAYA Kanban Desk — plataforma de gestión de proyectos multi-tenant"` (`package.json:4`). Es lo que los dos commits más recientes de documentación retiraron del resto del repo (`7640a02`).

### D-26 · LOW · NEW

`README.md:7` muestra la insignia «License: MIT», y `git ls-files` no tiene ningún `LICENSE`. En un repositorio público, sin el fichero la licencia no está concedida.

## Delta contra mayo (hallazgos D)

| ID mayo | Estado mayo | Hoy | Nota |
|---|---|---|---|
| D-01 | MITIGATED | FIXED | Sentry activo en el servidor; el cliente, en D-20 |
| D-02 | open (ALTO) | DEESCALATED | MEDIUM por rúbrica |
| D-03 | MITIGATED | FIXED | `ci.yml` en PR y en `push` |
| D-04 | open (ALTO) | DEESCALATED | MEDIUM por rúbrica |
| D-05 | MITIGATED | FIXED | lo de mayo; inexactitud nueva en C-28 |
| D-06 | MITIGATED | FIXED | insignias dinámicas en `README.md:3-4` |
| D-07 | open (ALTO) | DEESCALATED | MEDIUM por rúbrica |
| D-08 | open | FIXED | despliegue fallido y copia fallida abren incidencia (`despliegue-fallido.yml`, `db-backup.yml`) |
| D-09 | open (ALTO) | DEESCALATED | solo falta la marcha atrás |
| D-10 | open | FIXED | `docs/SECURITY.md:254-260` tiene canal de aviso, y GitHub reconoce `docs/SECURITY.md` como política |
| D-11 | open | UNCHANGED | — |
| D-12 | open | FIXED | `README.md:156` («Instalación») |
| D-13 | open | UNCHANGED | más ADR-005 obsoleto |
| D-14 | MITIGATED | FIXED | — |
| D-15 | open | FIXED | `validateCoreConfig` (`server/utils/config.js:14-24`) |
| D-16 | open | UNCHANGED | — |
| D-17 | MITIGATED | **REGRESSED** | sin entradas desde el 12-jul |
| D-18 | MITIGATED | FIXED | `docs/runbooks/key-rotation.md` |

## Lagunas

- **Paneles:** no hay acceso a Sentry, Netlify ni Railway más allá de la API de Railway en solo lectura (D-NV-01).
- **Sin `eslint` ni `radon`:** la complejidad ciclomática no se midió (`NV_TOOL`). La densidad se midió por LOC y comentario (B-16, A-10).
