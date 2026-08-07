# BACKLOG — AGLAYA Kanban Desk

Registro granular de tareas por fase (producto). Actualizar al completar o añadir ítems.

> **Deuda técnica del audit Mariana:** los 49 findings medio/bajo/info pendientes
> (a11y, seguridad/DB, legales, ops) viven en su propia cola:
> [`backlog/audit-mariana-roadmap.md`](./backlog/audit-mariana-roadmap.md).
> Este BACKLOG.md cubre features/producto; el roadmap del audit cubre deuda técnica.
> Son complementarios — no dupliques ítems entre ambos.

---

## Riel MCP — `description` tragada + falta `update_card` *(2026-07-22)*

Reportado por el orquestador: cards clavadas por el MCP con descripción salían
vacías. Verificado en DB: 4 cards de esta semana, las 4 con `description` vacía.

**No es un bug de guardado.** Reproducido: `create_card(..., description_md="…")`
persiste (109 chars en DB). El camino API funciona (`POST /cards` lee `description`
y la inserta, `server/routes/cards.js:134`).

**Es un desajuste de nombre de parámetro, silencioso.** La tool MCP se llamaba
`description_md`; la ficha del riel y el endpoint HTTP `/api/internal/create-card`
lo llaman `description`. Quien pasaba `description` a la tool MCP veía el kwarg
descartado, `description_md` caía a `""`, y la card salía con brief vacío
devolviendo `201`. La peor forma de fallar es la que devuelve éxito.

- [x] **`create_card` acepta `description` como alias** de `description_md` — mata
      el footgun. Ambos persisten; los dos apuntan al mismo campo
- [x] **`update_card` nuevo** (`kanban-mcp/server.py`): edita `title` / `description`
      / `priority` / `due_date` de una card existente sin borrar y recrear. Envuelve
      `PUT /api/cards/:id` (`updateCard`), la misma ruta que usa la UI. Antes no había
      forma de corregir una descripción por el riel salvo borrar y re-crear
- [ ] **⚠️ REQUIERE REINICIO DEL MCP.** El servidor en marcha cargó el `server.py`
      anterior; ni el alias ni `update_card` están vivos hasta reiniciarlo. Workaround
      inmediato mientras tanto: pasar **`description_md`** (no `description`)
- [ ] **Ficha del capitán**: documenta el parámetro como `description` para la tool MCP.
      Es del capitán; señalado para que lo alinee — ahora ambos nombres valen, así que ya
      no miente, pero conviene nombrar el canónico. Se consulta por la puerta
      (`ficha("aglaya-kanban-desk")` · `contrato(...)` · `donde_pregunto(...)` en el MCP
      `aglaya-atlas`), no por ruta: aquí había una con los puntos suspensivos en medio,
      que ni resolvía ni se podía completar. El capitán reorganiza su atlas cuando quiere;
      una ruta copiada caduca en silencio y una elidida nace caducada. Lo caza
      `docs-guard[ELIDED]`

El lado API (`updateCard`) ya está cubierto por `cards-validation.test.js`. El cambio
del MCP es un envoltorio fino en Python sin harness de test en este repo; verificado
por ejecución contra la DB.

---

## El punto ciego del riel — cómo se detecta *(2026-07-27 · diseñado · IMPLEMENTADO el 6-ago-2026)*

> **Esta sección ya no es un plan: describe algo que corre.** `scripts/rail-blindspot.sh`
> implementa el cruce de abajo **en las dos direcciones**, con el alcance derivado de la
> PROPIEDAD como se decidió aquí, y `.github/workflows/rail-scope.yml` lo despierta **por
> reloj** además de con los empujes.
>
> Se conserva el diseño entero porque explica **por qué** el criterio es la propiedad y no
> el tipo — y eso no lo cuenta el código.
>
> El encabezado decía «sin implementar» y llevaba horas siendo falso: la primera mitad
> entró esta misma mañana. Un documento de diseño que no dice cuándo dejó de ser un plan
> manda a alguien a construir lo que ya existe.

**La fragilidad.** La membresía del riel se mantiene a mano y falla en silencio. Si se
crea un espacio y no se añade `kanban-rail@aglaya.biz` como miembro, `GET /workspaces`
—que filtra por `workspace_members`, no por rol— no lo devuelve. El riel no da «no eres
miembro»: ese espacio sencillamente no está en la lista, ninguna nave de la flota puede
dejar cards ahí, y nada lo dice. En un SaaS esto sería un detalle de permisos. Aquí el
riel **es** el producto: un espacio invisible para el riel es un espacio que no existe.

### La mitad que faltaba: quién custodia la intención

Para decir «este espacio debería recibir comandas y no las recibe» hace falta saber cuáles
*deberían*. Resuelto por Ibai el 2026-07-27, y la respuesta es **la propiedad**:

> El riel debe ser miembro de los espacios cuyo **owner es Ibai**, excluidos los que **él**
> tipe como `personal`. Todo lo demás queda fuera del alcance **por definición** — sin
> mirarlo y sin preguntar.

**Por qué NO el tipo, que fue la primera propuesta y era incorrecta.** El riel no debe ver
los espacios de Món: son suyos, igual que el espacio personal de Ibai es de Ibai. Un criterio
por tipo haría que el alcance del riel dependiera de **cómo tipe Món sus propios espacios** —
convertiría el detector en una petición permanente a otra persona, y la pondría a mantener a
mano una cosa que ni siquiera es suya. El tipo sigue en el criterio, pero solo dentro de lo
que ya es de Ibai: ahí sí es él quien elige, y elegir `personal` es decir «esto no».

**Cuál de las dos columnas de propiedad manda.** Hay dos candidatas y hoy coinciden en cada
fila: `workspaces.created_by` y el miembro con `workspace_members.role = 'owner'`. Coincidir
no las hace intercambiables — esa es la lección de «tres copias coincidiendo no es
corroboración», más abajo. **Manda `workspace_members.role = 'owner'`**, que es lo que
protege el código de permisos. `created_by` es un hecho del pasado y no se mueve: si algún
día Ibai cede un espacio a Món, `created_by` seguiría diciendo Ibai y el detector exigiría
meter el riel en un espacio ajeno — justo lo que este criterio existe para no hacer.

### El cruce, en dos piezas

**1 · Es mecánico, y va en las DOS direcciones.**
Un solo lado no basta: el olvido silencioso tiene un gemelo, que es el riel metido donde
no debe. Los dos se leen del mismo `JOIN`:

- en alcance **y** el riel NO es miembro → **punto ciego**. Nada puede aterrizar ahí, y nadie
  se entera.
- fuera de alcance **y** el riel SÍ es miembro → **fuga**. El riel puede escribir en zona
  ajena o protegida, que es exactamente el agujero que cerró el `400` de `workspaceName`.

**2 · Quién contesta: `service_role`, no el riel.**
Esto es lo único que no se puede negociar. El riel **no puede ver sus propios puntos ciegos**
— por definición no salen en su lista. Preguntárselo a `list_workspaces` es repetir el error
que ya está documentado más abajo («Un alcance no contesta por otro»): esa tool contesta «de
qué soy miembro», no «qué hay». El custodio es la DB vía `service_role`, que es el mismo
alcance que usa `POST /api/internal/create-card`. La consulta:

```sql
WITH alcance AS (
  SELECT w.id, w.name, w.type,
         EXISTS (SELECT 1 FROM workspace_members m JOIN users u ON u.id = m.user_id
                 WHERE m.workspace_id = w.id AND u.email = 'kanban-rail@aglaya.biz') AS riel_dentro,
         EXISTS (SELECT 1 FROM workspace_members o JOIN users x ON x.id = o.user_id
                 WHERE o.workspace_id = w.id AND o.role = 'owner'
                   AND x.email = 'info@ibaifernandez.com') AND w.type <> 'personal' AS deberia
  FROM workspaces w)
SELECT name, type,
       CASE WHEN deberia THEN 'PUNTO CIEGO' ELSE 'FUGA' END AS desviacion
FROM alcance WHERE deberia <> riel_dentro;
```

Devolver **cero filas** es el estado sano. Cualquier fila es una desviación con su nombre.

**Forma de entrega propuesta:** `GET /api/internal/rail-scope-drift`, autenticado con
`x-task-secret` igual que `create-card` (mismo secreto, mismo alcance, misma puerta), que
devuelve las desviaciones de las dos direcciones. Encima, un workflow programado calcado de
[`digest-cron.yml`](../.github/workflows/digest-cron.yml): `curl` al endpoint, y si devuelve
desviaciones, el job se pone rojo. Se descarta una tool MCP nueva para esto por la pieza 3 —
sería preguntarle al alcance equivocado.

### Estrena verde — comprobado antes de escribir esto

Corrida la consulta de arriba contra la DB con `service_role` (2026-07-27): **cero filas**.
Ni un punto ciego ni una fuga. El criterio por propiedad nace verde donde el criterio por
tipo, que fue la primera propuesta, habría nacido rojo sobre los espacios de Món.

Esa diferencia no es suerte y conviene no perderla: el criterio por tipo nacía rojo **porque
estaba mal**, no porque la realidad estuviera sucia. Pedía meter el riel donde no debe entrar.
El rojo era el síntoma; la causa era el criterio. Un guardián que nace rojo se normaliza hasta
que alguien lo apaga — pero antes de negociar el listón, conviene mirar si lo que falla es lo
medido o la medida.

- [ ] **Endpoint `GET /api/internal/rail-scope-drift`** — `x-task-secret`, `service_role`,
      devuelve las desviaciones de ambas direcciones. Vacío = sano
- [ ] **Workflow programado** calcado de `digest-cron.yml`: lo consulta y se pone rojo con
      cualquier desviación
- [ ] **Test que fija el criterio**, en la línea de `internal-create-card.test.js`: que la
      propiedad manda sobre el tipo, que el custodio es `role = 'owner'` y no `created_by`,
      y que los espacios ajenos quedan fuera **sin mirarlos**. Sin ese test, el día que
      alguien «simplifique» el detector a un criterio por tipo volverá a ser silencioso, y
      volverá silencioso, que es como llegó

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

### ✅ Cerrado — el default de `workspaceName` (era `internalRoute.js:34`)

```js
workspaceName = 'Ibai Fernández',   // .ilike('name', `%…%`) con service_role
```

> **Este titular decía «🔴 Bug vivo» hasta el 2026-07-27**, cuando el campo llevaba
> obligatorio desde el día 21 y el propio checkbox de abajo lo daba por cerrado.
> El cuerpo estaba bien; el titular es lo que se lee primero y lo que se cita.
>
> Es el mismo vicio que persigue `docs-guard`, aquí dentro: un documento
> afirmando el estado de un código que ya no dice eso. Y por qué no lo cazó el
> guardián: `BACKLOG.md` está fuera de su ámbito, con razón —es el custodio de la
> cola— pero ser custodio de la cola no le da autoridad sobre si un bug respira.
> Eso lo custodia el código. Hoy exige el campo y devuelve 400 (`internalRoute.js`).

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

Ambos creados por **Món** (admin) con 6 segundos de diferencia.
`3` es su espacio de pruebas: tableros «prueba», card «prueba adjunto» — probablemente
con un fichero en Storage que quedaría huérfano.

- [x] **Decidido (Ibai, 2026-07-21): se quedan. Cerrado.** No hay consulta pendiente ni
      limpieza futura. Son el espacio de trabajo de Món y se respetan — que `4` esté vacío
      no lo hace basura, lo hace suyo y vacío. Que la DB devuelva seis workspaces y no
      cuatro no es una anomalía a corregir: es el número correcto.

      Queda escrito solo para que la próxima auditoría no lo levante otra vez como
      hallazgo. No lo es.

### Las lecciones

**Un alcance no contesta por otro.** Le pregunté a `list_workspaces` si algo existía. Esa
tool contesta «de qué es miembro el riel», no «qué hay en la tabla». El endpoint consulta
con `service_role`, que salta RLS — otro alcance, otra respuesta. El capitán cometió el
mismo fallo el mismo día contando las tools de su MCP en el módulo en vez de en `server.py`.

**Tres copias coincidiendo no es corroboración.** El nombre muerto vivía a la vez en el
código, en el `CLAUDE.md` de este repo y en la ficha del atlas, de acuerdo entre sí, mientras
el manual que la propia ficha señala como custodio tenía el nombre bueno. Mismo mecanismo que
hacía fiable el badge `1.4.0`: coincidía.

Aquí había una ruta del atlas escrita. Se retiró el 2026-07-27, con el mismo argumento con el
que se retiró la elidida de más arriba: al capitán **se le pregunta, no se le cita**. La
defensa de esta —«es relato fechado, no un puntero»— es la misma excepción que se rechazó dos
párrafos antes al morder `docs-guard[ELIDED]` un ejemplo escrito a propósito en `CHANGELOG.md`.
Si «lo decía de ejemplo» no vale, «lo decía en pasado» tampoco. El relato se entiende igual sin
la ruta; la ruta es lo único que caduca.

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
