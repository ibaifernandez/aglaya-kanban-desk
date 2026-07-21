# BACKLOG — AGLAYA Kanban Desk

Registro granular de tareas por fase (producto). Actualizar al completar o añadir ítems.

> **Deuda técnica del audit Mariana:** los 49 findings medio/bajo/info pendientes
> (a11y, seguridad/DB, legales, ops) viven en su propia cola:
> [`backlog/audit-mariana-roadmap.md`](./backlog/audit-mariana-roadmap.md).
> Este BACKLOG.md cubre features/producto; el roadmap del audit cubre deuda técnica.
> Son complementarios — no dupliques ítems entre ambos.

---

## Phase 0 — Limpieza y preparación *(Completada)*

- [x] Backup de `tasks.json` original → `tasks.personal-backup.json`
- [x] Limpiar datos personales de `tasks.json`
- [x] Cargar dummy data corporativa (5 tableros, 30+ tarjetas, 8 categorías)
- [x] Borrar archivos en `server/uploads/` (adjuntos personales)
- [x] Borrar `estrategia.ibaifernandez.com.md` de la raíz
- [x] Limpiar `.env` — eliminar credenciales personales, añadir `PORT=3003`
- [x] Actualizar `.claude/launch.json` → puertos 3003/5175
- [x] Actualizar `client/vite.config.js` → puerto 5175, proxy a 3003
- [x] Actualizar `server/index.js` → `PORT = process.env.PORT || 3003`
- [x] Reescribir `CLAUDE.md` con contexto AGLAYA Kanban Desk
- [x] Reescribir `AGENTS.md` con contexto AGLAYA Kanban Desk
- [x] Reescribir `README.md` orientado a gerencia AGLAYA + equipo técnico
- [x] Reescribir `docs/ROADMAP.md` con 4 fases corporativas
- [x] Reescribir `docs/BACKLOG.md`
- [x] Reescribir `docs/ARCHITECTURE.md` con visión Phase 1+
- [x] Consolidar decisiones estratégicas en `docs/ARCHITECTURE.md` (sección ADR)
- [x] Reescribir `docs/PRD.md` orientado a stakeholders AGLAYA
- [x] Añadir entrada en `docs/CHANGELOG.md` — Sesión 0

---

## Phase 1 — Multi-tenant y autenticación *(En curso)*

### Base de datos ✅
- [x] Diseño del esquema completo en Supabase: `organizations`, `users`, `boards`, `columns`, `cards`, `categories`
- [x] Crear proyecto en Supabase (`aglaya-kanban`, región São Paulo, plan free)
- [x] Ejecutar schema SQL inicial con RLS activado
- [x] Insertar organización AGLAYA como tenant base

### Autenticación ✅
- [x] Integrar Supabase Auth + cliente admin en servidor
- [x] Endpoint `POST /api/auth/register` (con validación de dominio corporativo)
- [x] Endpoint `POST /api/auth/login`
- [x] Endpoint `GET /api/auth/me`
- [x] Middleware `requireAuth` (JWT) para rutas protegidas
- [x] Middleware `requireRole(...roles)` para rutas por rol
- [x] Restricción de dominio en registro corporativo: solo @aglaya.biz e @ibaifernandez.com
- [x] Usuario superadmin actualizado: info@ibaifernandez.com

### Frontend — Autenticación ✅
- [x] `AuthContext` con token + user en sessionStorage (`aglaya_session`) con migración suave desde localStorage legado
- [x] Pantalla de login con logo AGLAYA y validación de dominio
- [x] Flujo "Olvidé mi contraseña" integrado (Supabase Auth)
- [x] Página `/reset-password` para restablecimiento de contraseña
- [x] Interceptor JWT en `api/client.js`
- [x] Gate de autenticación en `App.jsx`
- [x] Avatar + nombre de usuario + logout en Toolbar

### Branding ✅
- [x] Logo AGLAYA en login, sidebar y reset de contraseña
- [x] Email digest rebrandeado a AGLAYA Kanban Desk
- [x] Display name «AGLAYA Kanban Desk» en toda la UI (sesión 6)

### Email ✅ (parcial)
- [x] Endpoint `POST /api/digest/send-me` para el admin digest global (requiere auth + rol macro)
- [x] Endpoint `POST /api/digest/send-my-digest` para el digest personal/contextual del usuario autenticado
- [x] Botón "Enviarme mis tareas" en Toolbar con feedback visual y scope por workspace
- [x] SMTP funcional con Resend
- [ ] Templates de Supabase Auth sincronizados manualmente con `docs/mails/` (invite y reset password)

### Seguridad
- [x] Claves Supabase service_role solo en servidor
- [x] Validación de dominio en doble capa (frontend + servidor)
- [x] Security headers HTTP (helmet — diferenciado por entorno desde 2026-03-27)
- [x] Rate limiting en `/api/auth` — 20 req/15 min por IP
- [x] CORS restringido por entorno: solo `localhost:5175` en dev, dominios corporativos en prod
- [x] Validación de enums y tipos en `PUT /api/cards/:id` (priority, title, dueDate)
- [x] Input sanitizado en `GET /api/cards/search` (cap 100 chars)
- [x] Auditoría completa de superficie de ataque (2026-03-27 — 15 hallazgos, 2 altos resueltos)
- [x] Alineación de permisos entre GUI y backend para workspaces/tableros (acciones visibles según `workspace.myRole`)
- [x] Endurecimiento de invitaciones de workspace: validación de organización, tipo y protección del `owner`
- [x] Protección del reorder de tableros con `workspaceId` y control micro en backend
- [x] Invitación admin blindada frente a JWT desfasado y estados parciales Auth/perfil público
- [x] Aislamiento de clientes Supabase en rutas `auth` y `admin` para evitar contaminación de sesión y errores RLS
- [x] Resolución robusta del contexto de workspace al borrar tarjetas (`DELETE /api/cards/:id`)
- [ ] Exposición de mensajes de error Supabase al cliente (media — pendiente refactor)
- [ ] **Estabilización de infra de tests (Mac/Node 18)**: Resolver bloqueo sistemático de Jest en el entorno local (Hanging).

### Multi-tenancy
- [ ] Consolidar el aislamiento multi-tenant legado basado en `organizationId` en helpers compartidos para rutas no contextualizadas por workspace
- [ ] Endpoint `POST /api/organizations`
- [ ] Endpoint `GET /api/organizations/:id/members`

### Roles y permisos
- [ ] Permisos por tablero: owner / editor / viewer
- [x] Panel de administración (crear/gestionar usuarios)
- [x] Separación explícita de roles macro y roles micro (el rol `guest` queda restringido al workspace)

### Freemium
- [ ] Middleware de límites: máx. 3 tableros y 50 tarjetas en plan free
- [ ] UI de aviso cuando se alcanza el límite

### QA y documentación
- [x] `docs/RUNBOOK.md` — guía operativa unificada para local y producción
- [x] `docs/INCIDENTS.md` — registro de fallos reales, causa raíz y correctivos aplicados
- [x] Sincronización de `PRD`, `PERMISSIONS`, `SECURITY`, `RUNBOOK`, `ROADMAP` y schema documentado con la codebase `v1.1.5`
- [x] Confirmaciones explícitas al borrar tableros, columnas y workspaces desde la GUI
- [x] Cierre por `Escape` en overlays principales (workspace, card, invitaciones y confirmaciones)
- [x] Digest contextual por workspace con confirmación previa y destinatario derivado de Auth

---

## Phase 2 — Workspaces *(Completada — 2026-03-24/25)*

### Backend ✅
- [x] `server/routes/workspaces.js` — CRUD workspaces + gestión de miembros (9 endpoints)
- [x] `server/middleware/workspace.js` — requireWorkspaceMember + requireWorkspaceRole
- [x] RLS en Supabase con funciones SECURITY DEFINER (`get_workspace_role`, `is_workspace_member`)
- [x] Fix 504 en Railway: digest fire-and-forget
- [x] `GET /api/workspaces` enriquece con memberCount + boardCount reales

### Frontend ✅
- [x] WorkspaceDashboard con grid de tarjetas, mini-kanban abstracto, counts reales
- [x] WorkspaceMembers — panel lateral gestión de miembros + roles
- [x] Breadcrumb espacio de trabajo → tablero en Toolbar
- [x] Hooks useWorkspaces, useBoards (con workspaceId)
- [x] 10 métodos nuevos en api/client.js

### UX/Branding ✅
- [x] Renombrado workspace → espacio de trabajo en toda la UI
- [x] Logo AGLAYA en header del WorkspaceDashboard
- [x] Botón Admin eliminado del WorkspaceDashboard
- [x] Mini-kanban abstracto decorativo en tarjetas (seed desde ws.id)

## Sub-fase 2.1: Supabase Storage + Identidad visual *(Completada — 2026-03-27)*

### Supabase Storage ✅
- [x] SQL migrations: `users.avatar_url`, `workspaces.cover_url`, `workspaces.type`
- [x] Bucket `media` (público, 5 MB), RLS policies para INSERT/UPDATE/SELECT
- [x] Endpoint `POST /api/media/users/me/avatar` — upload + actualiza `users.avatar_url`
- [x] Endpoint `POST /api/media/workspaces/:id/cover` — upload + actualiza `workspaces.cover_url`

### Foto de perfil ✅
- [x] Avatar con foto real en Toolbar (fallback a inicial)
- [x] Click en avatar → file picker → upload inmediato
- [x] `GET /api/auth/me` devuelve `avatarUrl` fresco desde DB

### Portada visual de espacios de trabajo ✅
- [x] WorkspaceDashboard: cover image si existe, mini-kanban si no
- [x] Botón cámara al hover sobre tarjeta (solo admins/owners)

### Tipo de espacio de trabajo ✅
- [x] Campo `type`: `'personal'` | `'interno'` | `'externo'`
- [x] Selector en modal de creación (botones)
- [x] Badge TypeBadge en cada tarjeta de workspace
- [x] Filtro por tipo — tabs en WorkspaceDashboard

---

## Backlog — Sub-fase 2.2: Alertas automáticas (sugerencia Bani #4)

Cron job que envía email de alerta dos veces al día con tarjetas prioritarias / con vencimiento próximo.

### Decisiones de diseño pendientes
- ¿Destinatario? → El responsable de cada tarjeta (`assignee_id`), no el admin
- ¿Ventana de alerta? → Configurable, default 72h
- ¿Frecuencia? → 2 veces/día, horas configurables (ej. 09:00 y 17:00)
- ¿Scope? → Por workspace (cada workspace puede tener destinatarios distintos)

### Componentes necesarios
- [ ] Tabla `alert_subscriptions` (o configuración en `workspaces`): `alert_hours`, `alert_window_hours`, `alert_enabled`
- [ ] Endpoint `POST /api/alerts/send` (protegido, solo admin/superadmin o cron key)
- [ ] `server/digest-alerts.js` — construye y envía el email de alerta: filtra tarjetas con `due_date <= NOW() + alert_window_hours` y `assignee_id IS NOT NULL`
- [ ] Cron en Railway (o cron en Node con `node-cron`) que llama al endpoint dos veces al día
- [ ] Template de email: lista de tarjetas con responsable, fecha y prioridad

### Bloqueantes
- Requiere que `assignee_id` esté en uso (Sub-fase 2.1 completada)
- Requiere acordar scope exacto con Bani/Ibai antes de implementar

---

## Backlog — Movilidad de objetos *(Visión a largo plazo — no implementar sin diseño previo)*

La plataforma debe reflejar cómo funciona el trabajo real: los proyectos y tareas cambian de contexto. Un objeto puede empezar como personal y terminar siendo de cliente, o un trabajo interno puede abrirse a colaboración externa. La jerarquía completa debe ser fluida:

### Nivel workspace — Cambio de tipo
- [x] **Editar tipo de workspace** (personal / interno / externo) después de la creación — `WorkspaceSettings` panel · v1.2.1
  - Panel lateral desde Toolbar (icono SlidersHorizontal), solo visible a owners/admins del workspace
  - Edita: nombre, emoji, descripción, tipo, portada
  - Aviso amber al cambiar a `externo`: informa que pasará a ser visible para usuarios `cliente`

### Nivel board — Mover entre workspaces
- [x] **Mover un tablero de un workspace a otro** — `90f4c4f` · v1.2.0
  - Sidebar: botón FolderInput al hover → `BoardMoveModal` con selector de workspace destino
  - Backend `PUT /api/boards/:id` acepta `workspaceId`; valida que ambos workspaces pertenezcan a la misma organización
  - `useBoards.moveBoard()` elimina el tablero de la lista local del workspace origen

### Nivel card — Mover entre tableros (y por tanto entre workspaces)
- [x] **Mover una tarjeta a un tablero diferente** (ya existe entre columnas del mismo tablero) — `CardModal` · v1.2.1
  - Selector agrupado por workspace con `<optgroup>` (carga lazy: fallback inmediato a tableros del workspace activo)
  - Solo muestra tableros de workspaces a los que el usuario tiene acceso
  - La columna destino se selecciona en el mismo CardModal (campo Columna)

### Principio de diseño
> La visibilidad de un objeto siempre la determina el contexto más restrictivo en el que vive. Mover un objeto a un contexto más abierto requiere confirmación explícita; moverlo a uno más cerrado es inmediato.

---

## Backlog — Features futuras (sin fase asignada)

- [ ] **Permisos por tablero**: owner / editor / viewer (dentro de un workspace, acceso diferenciado por tablero — Phase 1+, no bloquea v1.0)
- [ ] **Notificaciones in-app**: alertas de cambios en tarjetas asignadas
- [ ] **Límites freemium**: middleware (máx. 3 tableros / 50 tarjetas en plan free)
- [ ] **Foto de perfil en tarjeta**: mostrar `avatar_url` del assignee en el avatar de la tarjeta (hoy solo muestra inicial); requiere añadir `avatar_url` al select de `users!assignee_id` en `/api/boards/:boardId/cards` y renderizar `<img>` con fallback a inicial

---

## Infraestructura soberana *(Pendiente)*

- [ ] Configurar servidores propios de AGLAYA con PM2/Docker
- [ ] Configurar HTTPS / SSL y monitoreo de salud del servidor
- [ ] Implementar CI/CD básico hacia producción (GitHub Actions)

---

## Higiene documental — estado copiado *(2026-07-21)*

**Doctrina:** un documento puede describir diseño y decisiones; no puede describir
estado. Ante cada línea: ¿es este documento el **custodio** de este dato, o lo copia?
De la versión manda `package.json`; de los tests, el runner; del despliegue, Railway;
del schema, `docs/schema/supabase-schema.sql`; de la fase y la cola, `ROADMAP.md` y
este archivo.

Origen: auditoría del orquestador de flota (`aglaya-orchestrator`). Las cifras
encontradas no estaban «mal» al escribirse — eran copias que envejecieron solas.

### Hecho
- [x] **Guardián `docs-guard`** — `scripts/docs-guard.sh` + workflow `.github/workflows/docs-guard.yml`
  - V1 versión literal · V2 conteos de tests/suites · V3 fase/backlog duplicados
  - Ámbito estrecho a propósito (`README.md`, `CLAUDE.md`). Excluidos por diseño:
    `docs/CHANGELOG.md` (versiones son su oficio), `docs/legal/` (bajo Art. 30 el RAT
    **debe** fechar tratamientos — ahí la regla se aplica al revés), `ROADMAP.md`,
    `BACKLOG.md` y `docs/audits/` (observaciones fechadas)
- [x] **Sello del guardián** — `scripts/docs-guard.test.sh`: sabotea un fichero con cada
      forma vigilada y exige rojo, más casos de no-falso-positivo (`React 18`, `Node.js 20+`,
      badges derivados del custodio)
- [x] **Mutación del sello** — `scripts/docs-guard.mutation.sh`: amputa cada regla del
      guardián y exige que el sello lo note. Sin esto, el sello podría ser decoración
- [x] **README.md** — badge de versión ahora derivado de `package.json` vía shields;
      badge de tests sustituido por el de CI; borrados el sello `v1.4.0` del título de
      características, el conteo de la tabla de stack y la tabla de suites con cifras
      (decía 13 suites / 106 tests / 102 verde; el runner decía 14 / 107 / 103)
- [x] **CLAUDE.md** — borradas las secciones «Fase actual» y «Backlog priorizado»
      (tercera copia de `ROADMAP.md` y de este archivo); sustituidas por una tabla de
      custodios

### Pendiente — commit en espera

> **Decisión (Ibai, árbitro, 2026-07-21):** el pase NO se commitea hasta que el capitán
> limpie su sección. Un guardián que nace rojo se normaliza y acaba apagándolo alguien.
> `docs-guard` estrena verde o no estrena. Todo lo de arriba está hecho y verificado en
> el árbol de trabajo, esperando ese único desbloqueo.

- [ ] **`CLAUDE.md` · sección de flota** *(bloqueante del commit)* — propiedad del capitán
      (`aglaya-orchestrator`), no de este repo. `CLAUDE.md:150` sigue con versión literal
      tecleada y con conteos (workspaces, boards, miembros, nodos del grafo) que no
      custodia. Es la única línea que mantiene a `docs-guard` en rojo. Consultarle en vivo
      por MCP `aglaya-atlas` (`flota_estado`, `ficha`, `donde_pregunto`) en vez de copiar
      cifras
- [ ] **Borrado de `AGENTS.md`** — ya hecho en el árbol de trabajo; entra en el mismo
      commit que el resto del pase. Se declaraba «resumen de CLAUDE.md» y acabó afirmando
      Phase 4 completada mientras CLAUDE.md la daba pendiente. Un resumen es una copia
- [x] **Huella del capitán en `CLAUDE.md`** — hecho. La tabla de tools pasa de inventario
      a enrutador y declara que mandan las tools disponibles, no la tabla
- [x] **Ficha del capitán en el atlas** — hecho por él, `06751d7` en `aglaya-orchestrator`.
      Retiradas la enumeración de las 17 tools (las 17 correctas: el problema no era que
      fallara ninguna, era que la lista envejece sola), los valores de los rate limiters,
      el intervalo de la campana y la lista de las 12 rutas HTTP

---

## Nombres de entidades copiados de la DB *(2026-07-21)*

Cuarta clase de estado copiado, **fuera del alcance de `docs-guard`**: no hay regex que
sepa si un nombre existe. Detectada aplicando el método del capitán — comprobar el ejemplo
contra la realidad en vez de leerlo.

### 🔴 Bug vivo — `internalRoute.js:34`

```js
workspaceName = 'Ibai Fernández',   // .ilike('name', `%…%`) con service_role
```

> **Corrección (2026-07-21).** Una versión anterior de esta sección, y el commit `7f61ba7`,
> afirmaban que ese workspace **no existía** y que omitir el campo daba **404**. Es falso.
> Lo concluí de `list_workspaces` del riel, que devuelve 3 filas — pero esa tool no custodia
> esa pregunta: `GET /workspaces` filtra por `workspace_members.user_id` y el riel solo ve
> aquello de lo que es miembro. El hallazgo es del capitán. Los commits no se reescriben:
> la corrección va encima.

Consultado el custodio real (`psql` con `service_role`, que es lo que usa el endpoint):

```
SELECT id, name, type FROM workspaces WHERE name ILIKE '%Ibai Fernández%';
→ 198853c9-4f5d-46ef-bdcb-e4d3bddd16f5 | Ibai Fernández | personal   (1 fila)

SELECT id, name, type FROM workspaces;   → 6 filas   (el riel ve 3)
```

**El default existe y apunta al workspace personal de Ibai — zona intocable por regla dura.**
Omitir `workspaceName` no falla: devuelve `201` y la card aterriza ahí. Es la rama peor de
las dos: un 404 avisa, un 201 no.

Rastro: 0 cards de prueba en ese workspace (nunca se ejecutó el paso). Pero tiene 56 cards:
está vivo y en uso.

- [x] **`docs/runbooks/key-rotation.md:186`** — el paso de verificación tras rotar
      `TASK_SECRET` omitía `workspaceName`: cada rotación habría escrito en el espacio
      personal devolviendo `201`. Corregido a `⭐ AGLAYA 2.0`
- [x] **`CLAUDE.md`** — el ejemplo advierte el destino real en vez de recomendarlo
- [x] **`kanban-mcp/server.py:166`** — el docstring decía «every workspace the rail can see
      (all — the rail is superadmin)». Falso: la ruta es por membresía y el rol no concede
      nada. Es lo que me hizo preguntarle al custodio equivocado
- [x] **`workspaceName` obligatorio (400 si falta)** — firmado por Ibai sabiendo que la
      premisa había cambiado: no era higiene, era cerrar una fuga silenciosa hacia su
      espacio privado. El 400 nombra la causa (qué campo falta y por qué no hay default),
      porque quien se lo coma vendrá de un runbook viejo y merece entenderlo en vez de
      creer que algo se rompió. Fijado por `server/tests/internal-create-card.test.js`:
      sin ese test el default vuelve el día que alguien lo «arregle» por comodidad, y
      volverá silencioso, que es como llegó

---

## Workspaces `3` y `4` — forense, sin tocar *(2026-07-21)*

La DB devuelve 6 workspaces; Ibai cuenta 4. Sobran los llamados `3` y `4`.
**No se ha borrado nada.** Borrar un workspace es irreversible.

| ws | tipo | tableros | cards | miembros | creado | contenido |
|---|---|---|---|---|---|---|
| `3` | interno | 2 (ambos «prueba») | 1 | 1 | 2026-04-13 18:38:00 | card «prueba adjunto», tocada 2026-05-15 |
| `4` | externo | 0 | 0 | 1 | 2026-04-13 18:38:06 | vacío |

Ambos creados por **Món** (`correo-retirado`, admin) con 6 segundos de diferencia.
`3` es su espacio de pruebas: tableros «prueba», card «prueba adjunto» — probablemente
con un fichero en Storage que quedaría huérfano.

- [ ] **Preguntar a Món antes de tocar nada.** No son basura anónima: son suyos. `4` está
      vacío y es trivial, pero es suyo igual. Ninguno de los que encontró esto tiene firma
      para borrar el espacio de trabajo de otra persona

### Las lecciones

**Un alcance no contesta por otro.** Le pregunté a `list_workspaces` si algo existía. Esa
tool contesta «de qué es miembro el riel», no «qué hay en la tabla». El endpoint consulta
con `service_role`, que salta RLS — otro alcance, otra respuesta. El capitán cometió el
mismo fallo el mismo día contando las tools de su MCP en el módulo en vez de en `server.py`.

**Tres copias coincidiendo no es corroboración.** El nombre muerto vivía a la vez en el
código, en el `CLAUDE.md` de este repo y en la ficha del atlas, de acuerdo entre sí, mientras
`atlas/kanban-manual.md` —el custodio que la propia ficha señala— tenía el nombre bueno.
Mismo mecanismo que hacía fiable el badge `1.4.0`: coincidía.

**Corolario para el test de ejemplos** (ver más abajo): debe validar contra `service_role`,
no contra el riel, o hereda este mismo punto ciego.

---

## Doctrina — conteos en mensajes de commit *(2026-07-21)*

Refinamiento del capitán sobre una regla mía que prohibía de más («no metas conteos en
commits»). Una regla que prohíbe de más se incumple hasta que se ignora.

Un mensaje de commit es un **registro fechado e inmutable** — misma clase que `CHANGELOG.md`
o que un RAT. Puede decir qué midió ese cambio; no puede describir cómo es el mundo.

| | Ejemplo | Por qué |
|---|---|---|
| ✅ | `grafo refrescado — 1274 nodos` (`b2f49df`) | Cuenta lo que hizo. Fechado, siempre cierto |
| ❌ | `MCP aglaya-atlas — 7 tools read-only` (`f90b58f`) | Afirma lo que el MCP **es**. Se lee en presente, y hoy son 17 |
| ❌ | `suite del servidor en 107 tests / 103 verde` (`ce93c82`) | Igual: se lee como el estado de la suite, no como mi medición |

**La pregunta:** ¿estoy contando lo que hice, o describiendo lo que hay? Lo primero envejece
bien porque va fechado. Lo segundo envejece mal porque se lee como presente.
