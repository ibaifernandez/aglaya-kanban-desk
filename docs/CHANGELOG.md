# CHANGELOG — AGLAYA Kanban Desk

Registro de cambios por versión. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)

---

## [1.1.5] - 2026-04-13
### Fixed
- **Estabilización de RLS (Identidad Blindada)**: Resolución definitiva de los errores "Failed to fetch" y violaciones de políticas RLS al crear o eliminar workspaces.
- **Backend Robustness**: Implementación de instancias locales "frescas" del cliente de Supabase Admin (`freshAdmin`) en rutas críticas para evitar la contaminación de sesiones del singleton global.
- **Auto-healing de JWT**: El backend ahora recupera automáticamente el `organization_id` directamente de la base de datos si el token del usuario está desactualizado, evitando fallos en claves foráneas.
- **Permisos GUI/API alineados**: La UI deja de mostrar acciones de workspace y tablero que el backend no autoriza por rol micro (`workspace.myRole`), reduciendo conflictos de validación falsos en creación, edición, movimiento e invitaciones.
- **Invitaciones de workspace saneadas**: Nuevo flujo con endpoint dedicado de usuarios disponibles por workspace, validación de organización y tipo (`cliente` solo en workspaces `externo`), y protección de invariantes del `owner`.
- **Panel admin coherente**: Eliminada la opción `guest` del panel global de usuarios; ese rol queda restringido al ámbito del workspace, como dicta la arquitectura del producto.
- **Sesión sensible endurecida**: Migración de autenticación desde `localStorage` a `sessionStorage` con compatibilidad de migración para sesiones ya existentes.
- **Reorder de tableros protegido**: `PUT /api/boards/reorder` ahora exige `workspaceId` y valida permisos micro antes de persistir el cambio.
- **Invitación admin más resistente**: `POST /api/admin/users/invite` ya no confía ciegamente en el `organizationId` del JWT, recupera la organización real desde base de datos, repara estados parciales donde existe el usuario en Auth pero no en `public.users`, y degrada conflictos de unicidad a `409` en vez de `500`.
- **Aislamiento de clientes Supabase en backend**: `auth` y `admin` dejan de reutilizar el singleton global para flujos sensibles; ahora crean clientes frescos por request para evitar contaminación de sesión y errores RLS tras login.

### Added
- **Cobertura renovada de validación**: Nuevas suites y smoke checks para auth, workspaces y administración, enfocadas en los flujos de permisos que estaban desalineados entre GUI, backend y Supabase.
- **Cobertura anti-regresión para invitaciones admin**: Tests específicos para JWT con organización obsoleta, recuperación de usuarios parciales y conflictos de email ya existente.

## [1.1.1] - 2026-04-12

## [1.1.0.0] — 2026-04-11 — Certificación "Kosher" · Nutrición Atlas · v1.1.0 Global Sync

Versión de consolidación documental y técnica para el Atlas de Proyectos, sincronizando todo el ecosistema AGLAYA tras la publicación oficial.

### Added
- **Atlas de Proyectos (Ficha Visual)**: Reconstrucción total de `index.html` bajo el estándar v1.0.0 del Atlas, incluyendo matriz de roles, stack técnico detallado y pipeline de despliegue.
- **Registro de Archivo Nutrido**: Expansión profunda de `archive/aglaya-kanban-desk.md` con ADRs, lógica de permisos y métricas de salud del código.

### Changed
- **Salto Versional Global**: Sincronización de todas las cabeceras técnicas y archivos `package.json` a la versión **v1.1.0.0** (o 1.1.0 semver).
- **Hardening de Documentación**: Certificación "Kosher" de toda la suite `docs/`, eliminando cualquier residuo de marca externa y validando la precisión técnica.

---

## [1.0.0.0] — 2026-04-11 — Lanzamiento Oficial GitHub

Hito de publicación oficial del repositorio en GitHub como plataforma base estable.


## [0.9.0.0] — 2026-04-11 — Estabilización AGLAYA · Fix Avatar · Jest Downgrade

Versión de consolidación de marca y corrección de bugs críticos de la Phase 1.

### Fixed
- **Persistencia de Avatar**: `server/routes/auth.js` ahora incluye `avatarUrl` en la respuesta de login, evitando que el perfil se "resetee" al cerrar sesión.
- **Identidad AGLAYA**: Eliminación total de referencias residuales a la marca anterior en código, tests y documentación.
- **Seguridad**: Implementación de restricción de dominios corporativos (`@aglaya.biz`, `@ibaifernandez.com`) en el backend y actualización del email del Superadmin.

### Infrastructure
- **Jest Downgrade**: Bajada a `jest@29.7.0` (versión estable) para mitigar procesos huérfanos.
- **Cleanup**: Purga sistemática de procesos zombis (Node/Playwright/Chrome) en el entorno de desarrollo.

### Known Issues
- **Jest Hanging**: La suite de tests automatizada presenta bloqueos en el runner (Mac/Node 18). Verificada la lógica del código manualmente; queda como pendiente técnico para la próxima iteración.

---

## [1.2.1] — 2026-04-10 — Tests · Mover tarjetas cross-workspace · Settings de workspace

### Added
- Mover tarjetas a otro tablero (cross-workspace): `CardModal` muestra selector agrupado por espacio de trabajo con `<optgroup>` cuando hay más de un tablero accesible; carga lazy con `api.getBoards()` + `api.getWorkspaces()`, fallback inmediato a los tableros del workspace activo mientras carga
- Workspace settings panel: panel lateral accesible desde el Toolbar (icono `SlidersHorizontal`) para owners y admins del workspace; permite editar nombre, emoji, descripción, tipo (con aviso amber cuando el cambio es a `externo`) y portada sin salir del workspace
- Tests backend actualizados: `server/tests/workspaces.test.js` (nuevo, 13 tests) cubre validación de `POST /api/workspaces`, coerción de tipo por rol, `requireWorkspaceMember` y gestión de miembros; `auth.test.js` añade test de no-restricción de dominio desde v1.1.0; `cards-validation.test.js` añade `'urgent'` a la lista de prioridades válidas

---

## [1.2.0] — 2026-04-10 — Workspace UX · Movilidad de tableros · Digest personal

### Added
- Mover tableros entre workspaces: botón en Sidebar (hover sobre tablero) → `BoardMoveModal` con selector de workspace destino y carga lazy; validación de organización en backend (`PUT /api/boards/:id` acepta `workspaceId`); `useBoards.moveBoard()` elimina el tablero de la lista local del workspace origen
- User digest personal diario: `server/userDigest.js` — agrupa tarjetas urgentes/vencidas del usuario por workspace y tablero (Personal → Interno → Clientes); badges de prioridad, fechas de vencimiento y progreso de checklist en el email; endpoints `POST /api/digest/send-my-digest` (cualquier usuario) y `POST /api/digest/send-all-digests` (admin); arranca con `startUserDigestScheduler` en `index.js`
- Confirmaciones al borrar tarjetas: diálogo inline en `CardModal` (estado `confirmDelete` con botones Sí/No en el header)
- Confirmaciones al borrar columnas: modal de confirmación en `Board` (menú contextual), misma lógica para tarjetas desde ese contexto
- Workspace settings — botón lápiz visible al hover en tarjetas de workspace (junto al de portada), para acceso directo al modal de edición sin depender del menú contextual
- Aviso amber al cambiar un workspace a tipo `externo`: informa al usuario que pasará a ser visible para usuarios con rol `cliente`

### Fixed
- Workspace settings: inicialización del tipo en el formulario usaba `'personal'` como fallback para el tipo `'externo'`; ahora preserva el tipo real del workspace al abrir el modal de edición
- `Toolbar.jsx`: clave localStorage unificada a `aglaya_token` (residuo de rebranding previo)
- `server/index.js`: mensaje de arranque actualizado con nombre del proyecto

### Chore
- Repo GitHub renombrado: `aglaya-board` → `aglaya-kanban-desk`
- `.claude/launch.json`: nombres de servidor actualizados a "AGLAYA Kanban Desk Server/Client"
- `CLAUDE.md`: identidad del proyecto, carpeta local y backlog actualizados

---

## [1.1.1] — 2026-04-08 — Fixes post-migración + herramientas de migración

### Fixed
- `server/routes/cards.js`: `VALID_PRIORITIES` no incluía `'urgent'`; cualquier tarjeta con prioridad urgente fallaba al guardar con 400. Bug preexistente que la migración de MyBoard hizo visible (14 tarjetas afectadas)
- `WorkspaceDashboard`: opción `personal` ausente en selector de tipo al crear workspace — el auto-creado en registro no cubría usuarios existentes

### Added
- `server/scripts/migrate-myboard.js` — script de migración one-shot desde MyBoard (tasks.json) a AGLAYA Kanban (Supabase): mapea categorías a UUIDs, asigna workspace_id correcto, preserva checklists y metadatos
- Migración ejecutada en producción: 7 tableros, 35 columnas, 10 categorías, 61/62 tarjetas importadas (1 tarjeta con columna huérfana en origen)
- `docs/BACKLOG.md`: sección «Movilidad de objetos» — workspace type editing, mover boards entre workspaces, mover cards entre boards; principio de diseño de visibilidad

---

## [1.1.0] — 2026-04-07 — Rebrand AGLAYA + Workspace Types + Acceso por Rol

Migración completa de la marca anterior → AGLAYA Kanban Desk. Cuatro fases ejecutadas en una sola iteración desde la rama `feature/rebrand-aglaya`, mergeada a `main` y desplegada en producción.

### Fase A — Rebrand visual y de dominio
- Producto renombrado: **AGLAYA Kanban Desk**
- Repo renombrado en GitHub: `aglaya-kanban-desk`
- `package.json`: `name: aglaya-kanban-desk`, `version: 1.1.0`
- Dominio de producción: `kanban.aglaya.biz`
- CORS producción restringido a `https://kanban.aglaya.biz`
- localStorage keys: `aglaya_token/user`
- Logo y favicon → assets AGLAYA (SVG rojo, blanco, negro, color)
- Restricción de dominio corporativo eliminada — la plataforma acepta cualquier email
- Placeholder de email en login: `tu@empresa.com`

### Fase B — Workspace types
- Tipos de workspace renombrados: `general/departamento/cliente` → `personal/interno/externo`
- SQL migration `002-workspace-types-aglaya.sql` (DROP constraint + UPDATE + ADD constraint)
- Constraint `workspaces_type_check` actualizado a nuevos valores
- Auto-creación de workspace `personal` al registrar nuevos usuarios

### Fase C — Control de acceso por tipo de usuario
- Rol `cliente`: solo puede ver y acceder a workspaces de tipo `externo`
- Middleware `workspace.js`: bloquea con 403 a clientes intentando acceder a workspaces `personal` o `interno`
- `server/routes/workspaces.js`: filtrado de tipos permitidos según rol en creación

### Fase D — UI diferenciada por rol
- `WorkspaceDashboard`: vista en secciones para colaboradores (Personal / Internos / Clientes), vista plana para clientes
- `TYPE_LABELS` actualizadas a nuevos tipos
- Logo y branding AGLAYA en toda la UI

### Infraestructura y deploy
- Supabase Auth → Site URL: `https://kanban.aglaya.biz`
- Supabase Auth → Redirect URLs: añadidas con wildcard `/**`
- Railway `SITE_URL` actualizado
- Tests de auth reescritos: eliminada suite de restricción de dominio, añadido test de nombre requerido

---

## [0.8.1] — 2026-03-27 — Hotfix: categoría hardcodeada en tarjetas

### Fixed
- `CardModal`: `EMPTY.category` era `'personal'` en lugar de `''`; las nuevas tarjetas se guardaban con esa cadena literal si las categorías no estaban cargadas al abrir el formulario
- `Card`: la categoría ya no muestra el valor crudo cuando no se encuentra en el contexto; si no hay match simplemente no se renderiza el badge

---

## [0.8.0] — 2026-03-27 — Sesión 7: Sub-fase 2.1 + bug sweep + performance

### Supabase Storage
- Bucket `media` creado (público, 5 MB), 3 RLS policies (INSERT/UPDATE/SELECT)
- SQL migrations: `users.avatar_url`, `workspaces.cover_url`, `workspaces.type`
- Endpoints `POST /api/media/users/me/avatar` y `POST /api/media/workspaces/:id/cover`

### Foto de perfil
- Avatar con foto real en header (Toolbar y WorkspaceDashboard); fallback a inicial
- `ProfileDropdown`: click en avatar → cropper → upload → persiste en DB y localStorage
- Fix: mousedown del dropdown cerraba el `AvatarCropModal`; añadida guardia `cropSrcRef`

### Espacios de trabajo — identidad visual
- Portada (`cover_url`): imagen real en tarjeta del workspace; fallback al mini-kanban
- Menú contextual (clic derecho) en cada tarjeta: Editar / Eliminar
- Modal de edición: selector de tipo (Cliente / Departamento), portada, icono, nombre, descripción
- `WorkspaceForm` acepta `onCoverChange` para upload directo de portada desde el modal de edición
- Filtro de tipo simplificado: solo «Clientes» y «Departamentos» (sin «General»)

### Asignación y filtros en tarjetas (Bani #1 y #3)
- Campo `assignee_id` en `cards` (SQL migration ya ejecutada)
- Backend: `getCardsByBoard` hace JOIN `users!assignee_id(id, name, email)`
- `CardModal`: selector de responsable (visible solo si el workspace tiene miembros)
- `Card`: avatar del responsable (inicial en círculo índigo) en el footer
- `Card`: contador de días reemplaza icono de prioridad (hoy=rojo, ≤3d=ámbar, >3d=gris, vencida=rojo)
- `Toolbar`: filtro por responsable + toggle «Vencidas»
- `Board`: aplica filtros `assignee` y `overdue`

### Categorías por tablero
- SQL: `categories.board_id UUID REFERENCES boards(id) ON DELETE CASCADE`
- Backend `GET/POST/PUT/DELETE /api/categories` filtran y guardan por `boardId`
- `useCategories(boardId)`: guardia si `boardId` es null (evita request innecesaria al mount)

### Performance
- `GET /api/workspaces`: reemplazado bucle N+1 (1+2N queries) por 3 queries de agregado
  - De ~21 round-trips para 10 workspaces a **3 fijos**, ~85% menos latencia en dashboard

### Bug sweep
- **Crítico**: `activeBoardId` referenciado antes de su `useState` → `ReferenceError` → pantalla negra en producción. Corregido reordenando declaraciones
- `Card.jsx`: `assignee.name || assignee.email` sin fallback → crash si ambos son null; añadido `|| '?'`
- `dates.js`: `parseLocalDate` sin guardia de longitud mínima; añadida

### Seguridad
- `express-rate-limit`: límite de 20 req/15 min en todos los endpoints de auth
- CORS diferenciado por entorno: solo `localhost:5175` en dev, dominios corporativos en prod
- Helmet CSP activado en producción (desactivado solo en dev)
- `PUT /api/cards/:id`: validación explícita de `priority` (enum), `title` (non-empty, <255 chars), `dueDate` (fecha válida o null)
- `GET /api/cards/search`: input capeado a 100 chars
- `express.json()` limitado a 2 MB
- `server/index.js`: app exportada como módulo → permite tests sin arrancar el servidor

### Tests
- Suite Jest + Supertest: 26 tests en 4 suites, 0.59s (`npm test`)
  - `health.test.js`: smoke test del endpoint `/api/health`
  - `auth.test.js`: validación de inputs, restricción de dominio corporativo, protección JWT en `/api/auth/me`
  - `cards-validation.test.js`: validación de enums, tipos y edge cases en `PUT /api/cards/:id`
  - `security.test.js`: 11 rutas protegidas devuelven 401 sin token; rutas públicas accesibles

### Infraestructura
- SMTP migrado de Migadu a Resend (`smtp.resend.com`) — confirmado operativo en Railway
- Email de invitación Supabase: plantilla corporativa configurada; subject «¡Hola! Te han invitado a AGLAYA Kanban Desk.»; URL de redirección verificada ✅ (cierra KNOWN-02)
- Supabase Index Advisor habilitado (`index_advisor` + `hypopg`) — analiza queries y sugiere índices

### WorkspaceDashboard
- Botón Admin movido a header del WorkspaceDashboard (visible para admin/superadmin); eliminado de la Toolbar
- `sessionStorage` persiste vista activa entre recargas (workspace + tablero)
- History API: botón Atrás del navegador navega entre workspaces y dashboard

---

## [0.7.0] — 2026-03-25 — Sesión 6: UI Polish — display name, logo, mini-kanban, espacios de trabajo

### Identidad visual
- Display name oficial: **AGLAYA Kanban Desk** (nombre técnico/repo permanece aglaya-kanban-desk)
- Actualizado en: título de pestaña (`index.html`), LoginPage, ResetPasswordPage, Sidebar, WorkspaceDashboard, footer copyright
- Logo AGLAYA en header del WorkspaceDashboard (reemplaza la «M» genérica en azul)

### WorkspaceDashboard
- Tarjetas de espacios de trabajo muestran ahora **counts reales** de tableros y miembros (cierra KNOWN-01)
  - `GET /api/workspaces` enriquece cada workspace con `memberCount` y `boardCount` vía `Promise.all` de queries `count:exact`
- Añadido **mini-kanban abstracto** en cada tarjeta: 4 columnas con barras de color de altura variable, generadas deterministamente desde `ws.id` (visual decorativo, no refleja datos reales)
- Botón Admin eliminado del header del WorkspaceDashboard (acceso admin sigue disponible en la Toolbar dentro de un tablero)

### Lenguaje
- Renombrado «workspace/workspaces» → «espacio de trabajo / espacios de trabajo» en toda la UI (WorkspaceDashboard, WorkspaceMembers, Toolbar)

---

## [0.6.0] — 2026-03-24 — Sesión 5: Phase 2 — Workspaces completa en producción

### Backend — Workspaces
- `server/routes/workspaces.js`: CRUD completo de workspaces + gestión de miembros
  - `GET /api/workspaces` — lista de workspaces del usuario autenticado
  - `POST /api/workspaces` — crear workspace (creator → owner)
  - `GET /api/workspaces/:id` — detalle + memberCount + boardCount
  - `PATCH /api/workspaces/:id` — editar (requiere admin/owner)
  - `DELETE /api/workspaces/:id` — eliminar (requiere owner)
  - `GET /api/workspaces/:id/members` — lista de miembros
  - `POST /api/workspaces/:id/members` — añadir miembro
  - `PATCH /api/workspaces/:id/members/:userId` — cambiar rol
  - `DELETE /api/workspaces/:id/members/:userId` — eliminar miembro
- `server/middleware/workspace.js`: `requireWorkspaceMember` + `requireWorkspaceRole`
- `GET /api/boards` ahora acepta `?workspaceId=` para filtrar por workspace
- Fix 504 en Railway: digest con fire-and-forget (responde 200 inmediatamente, procesa en background)

### Base de datos (Supabase)
- Tablas: `workspaces`, `workspace_members` (roles: owner/admin/member/guest)
- RLS activa con funciones `SECURITY DEFINER` para evitar recursión:
  - `get_workspace_role(workspace_id uuid)` → role del usuario actual
  - `is_workspace_member(workspace_id uuid)` → boolean
- FK disambiguation: `workspace_members` tiene dos FKs a `users` — siempre usar `.select('user:users!user_id(...)')`

### Frontend — Workspaces
- `WorkspaceDashboard.jsx`: grid de tarjetas de workspaces, modal de creación, estado vacío
- `WorkspaceMembers.jsx`: panel lateral de miembros con gestión de roles (solo admin/owner)
- `useWorkspaces.js`: hook de estado para lista de workspaces
- `useBoards.js` modificado: acepta `workspaceId`, usa `getWorkspaceBoards`
- `App.jsx`: estado `view` con valores `'workspaces' | 'board' | 'admin'`; punto de entrada siempre `'workspaces'`
- `Toolbar.jsx`: breadcrumb espacio de trabajo → tablero; botón UserCog para panel de miembros
- `api/client.js`: 10 métodos nuevos para workspaces

### Conocido
- ⚠️ KNOWN-02: Email de invitación de nuevos usuarios no funciona — requiere configurar template en Supabase Auth (pendiente)

---

## [0.5.0] — 2026-03-24 — Sesión 4: Producción completa + Resend + seguridad RLS

### Email transaccional — migración a Resend completada
- El departamento de TI del entorno previo verificó el dominio corporativo en Resend
- Railway actualizado: `SMTP_HOST=smtp.resend.com`, `SMTP_USER=resend`, `SMTP_FROM=myboard@dominio-previo.com`
- Supabase → Authentication → Email → SMTP Settings: mismas credenciales configuradas
- Probado y confirmado: email de recuperación de contraseña llega correctamente desde el dominio configurado
- Ver ADR-007 (estado actualizado a Activa)

### Seguridad — RLS restaurada correctamente en public.users
- Restaurada la protección RLS eliminada en v0.4.0, ahora sin recursión
- Creada función `public.get_my_role()` con `SECURITY DEFINER` para obtener el rol del usuario sin releer `public.users` bajo RLS
- Policy `"Admins ven usuarios de su org"` recreada usando dicha función: admins ven todos, cualquier usuario ve su propia fila
- La `anon` key de Supabase puede estar en el bundle del cliente con seguridad (solo permite Auth + leer propia fila)
- `SECRETS_SCAN_OMIT_KEYS` eliminado de `netlify.toml` — ya no hace falta suprimir el escáner de Netlify

### Deploy Netlify — resolución de bloqueo por escáner de secretos
- `VITE_SUPABASE_ANON_KEY` y `VITE_SUPABASE_URL` reconfiguradas como **Plain text** (no Secret) en Netlify UI
- Netlify solo escanea en el bundle las variables marcadas como Secret; la anon key es una variable pública por diseño de Supabase
- Deploy limpio confirmado: `main` publicado con dominio corporativo

### UI — mejoras menores
- Añadido toggle de visibilidad de contraseña (ojito) en `LoginPage.jsx` y `ResetPasswordPage.jsx`
- Enlace "¿Olvidaste tu contraseña?" centrado correctamente en `LoginPage.jsx`

### Verificado en producción
- Login con cuenta administrativa funciona en el dominio de producción
- 5 tableros corporativos cargando desde Supabase (datos filtrados por `organization_id`)
- Email de recuperación de contraseña entregado vía Resend en menos de 1 minuto

---

## [0.4.0] — 2026-03-23 — Sesión 3: Fix login + deploy Netlify + migración schema

### Bug crítico resuelto: login bloqueado por RLS recursiva
- **Causa raíz:** La policy RLS `"Admins ven todos los usuarios de su org"` en `public.users` hacía una subconsulta a `public.users` para comprobar el rol del usuario autenticado, creando una recursión infinita que bloqueaba *todas* las consultas a la tabla, incluso las realizadas con la `service_role` key desde el servidor.
- **Síntoma:** Login fallaba con "Error al obtener el perfil de usuario" aunque las credenciales fueran correctas y la fila existiera en `public.users`.
- **Solución:** `DROP POLICY IF EXISTS "Admins ven todos los usuarios de su org" ON public.users;` ejecutado en Supabase SQL Editor. Ver ADR-009.

### Cuenta corporativa de acceso
- Creado usuario administrador en Supabase Auth (sin necesidad de email; contraseña asignada directamente desde el dashboard)
- Insertada la fila correspondiente en `public.users` con rol `superadmin` y la organización base
- Confirmado que el login funciona correctamente tras eliminar la policy RLS

### Deploy frontend — Netlify
- Frontend desplegado en Netlify: `https://kanban.aglaya.biz` (dominio primario)
- `netlify.toml` configurado: build desde `client/`, proxy `/api/*` y `/uploads/*` → Railway, SPA fallback
- CORS del servidor Express ya incluía el dominio Netlify
- Supabase Auth → URL Configuration: Site URL actualizado a `https://kanban.aglaya.biz`; Redirect URLs añadida
- Variables de entorno Netlify: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas
- Ver ADR-010

### Migración de schema — alineación camelCase frontend/backend
Ejecutado en Supabase SQL Editor para alinear nombres de columna con la API del frontend:
```sql
ALTER TABLE public.boards   RENAME COLUMN name     TO title;
ALTER TABLE public.boards   RENAME COLUMN position TO "order";
ALTER TABLE public.columns  RENAME COLUMN name     TO title;
ALTER TABLE public.columns  RENAME COLUMN position TO "order";
ALTER TABLE public.cards    RENAME COLUMN position TO "order";
ALTER TABLE public.cards    RENAME COLUMN category_id TO category;
ALTER TABLE public.cards    ADD COLUMN IF NOT EXISTS tags           JSONB DEFAULT '[]';
ALTER TABLE public.cards    ADD COLUMN IF NOT EXISTS checklist_title TEXT DEFAULT '';
ALTER TABLE public.columns  ADD COLUMN IF NOT EXISTS default_sort   TEXT DEFAULT NULL;
```

### Seguridad — limpieza de secretos en repositorio
- `docs/DECISIONS.md`: clave API real de Resend que estaba hardcodeada en el ADR-007 → redactada y sustituida por placeholder. **Clave revocada y nueva generada por Ibai; guardada a buen recaudo hasta poder configurar Resend.**
- `.env.example`: placeholders de SMTP neutralizados para no activar detectores de secretos (GitGuardian)
- `docs/README-deploy.md`: URL real de Supabase sustituida por placeholder
- GitGuardian: 3 incidentes resueltos (2 falsos positivos de `.env.example`, 1 clave Resend real ya revocada)

---

## [0.3.0] — 2026-03-18 — Sesión 2: Admin Digest + correcciones de flujo auth

### Admin Digest (reescritura completa)
- `server/digest.js` reconvertido de "resumen de tareas personales" a **admin digest con estadísticas de uso**
- Contenido del digest: estado global (tableros / columnas / tarjetas / % completadas), alertas automáticas (tarjetas vencidas, tarjetas huérfanas sin columna), pendientes por prioridad, top 10 tableros por volumen de tarjetas
- **Integración Supabase Admin API**: si está disponible, el digest incluye tabla de usuarios con total, confirmados, activos en 24h, activos en 7 días y último login de cada usuario
- Endpoint `POST /api/digest/send-me` restringido a roles `admin` y `superadmin` (antes cualquier usuario autenticado podía invocarlo)
- Botón de digest en Toolbar visible **solo para admins/superadmins**
- `DIGEST_TO` y `DIGEST_HOUR` mantienen su función pero ahora alimentan un informe ejecutivo de uso, no un resumen de tareas

### Correcciones auth
- `App.jsx`: detección del token de recuperación de contraseña corregida — Supabase redirige a `/#access_token=...&type=recovery` (hash en raíz), no a `/reset-password`; el condicional ahora detecta ambas variantes
- `App.jsx`: redirección post-reset cambiada de `history.replaceState` (sin re-render) a `window.location.replace('/')` (recarga completa al login)

### Supabase — fixes operativos
- SQL de schema corregido: `DROP POLICY IF EXISTS` antes de `CREATE POLICY` para evitar error `42710` al re-ejecutar el schema
- `public.users`: row de Ibai debe insertarse manualmente cuando la cuenta se crea desde el Dashboard de Supabase (no desde el formulario de registro de la app)

### Conocido / Limitaciones
- Supabase free tier: límite de ~3 emails de recuperación por hora (`email rate limit exceeded`). No afecta al login ni al funcionamiento general.
- El `UPDATE role = 'admin'` debe ejecutarse en SQL Editor tras el primer login, o usar el INSERT directo con rol incluido

---

## [0.2.0] — 2026-03-19 — Sesión 1: Phase 1 — Autenticación, Supabase y email

### Infraestructura
- Proyecto Supabase creado (`aglaya-kanban`, región São Paulo) y conectado al servidor
- Schema inicial ejecutado: tablas `organizations`, `users`, `boards`, `columns`, `cards`, `categories` con RLS activado
- Organización principal AGLAYA insertada como tenant base
- `@supabase/supabase-js` instalado en server y client
- `jsonwebtoken` y `bcryptjs` instalados en server

### Autenticación
- `server/utils/supabase.js` — cliente Supabase admin + anon para el servidor
- `server/middleware/auth.js` — middleware `requireAuth` (JWT) y `requireRole(...roles)`
- `server/routes/auth.js` — endpoints `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Restricción de dominio corporativo: solo dominios autorizados pueden registrarse o iniciar sesión (validación en servidor y en frontend)
- Usuario superadmin creado con rol `superadmin` en la organización base

### Frontend — Autenticación
- `client/src/context/AuthContext.jsx` — estado global de sesión (token + user en localStorage)
- `client/src/pages/LoginPage.jsx` — pantalla de login con branding AGLAYA, diseño corporativo oscuro
- `client/src/pages/ResetPasswordPage.jsx` — página de restablecimiento de contraseña (flujo Supabase Auth)
- `client/src/utils/supabaseClient.js` — cliente Supabase anon para el frontend
- `client/.env` — variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- `client/src/api/client.js` — interceptor JWT: todas las peticiones incluyen `Authorization: Bearer <token>`
- `client/src/main.jsx` — envuelto en `AuthProvider`
- `App.jsx` — gate de autenticación: muestra `LoginPage` si no hay sesión; detecta ruta `/reset-password`
- Flujo "Olvidé mi contraseña" integrado en `LoginPage` (sin página separada)
- Toolbar actualizado: avatar con inicial, nombre de usuario y botón de logout

### Branding
- Branding AGLAYA visible en: pantalla de login, sidebar, página de reset de contraseña
- Sidebar renombrada de "MyBoard" a "AGLAYA Kanban Desk"
- Footer del digest actualizado: "AGLAYA Kanban Desk · © 2026 AGLAYA"

### Email — Digest bajo demanda
- `server/routes/digestRoute.js` — endpoint `POST /api/digest/send-me` (requiere auth JWT)
- Botón "Enviarme mis tareas" (icono sobre) en Toolbar — envía el digest al email del usuario autenticado
- Feedback visual en botón: verde si OK, rojo si error, desaparece a los 4 segundos
- `digest.js` refactorizado: `sendDigest(to?)` acepta destinatario arbitrario; rebrandeado a AGLAYA Kanban Desk

### SMTP / Email
- SMTP configurado con Migadu (provisional para pruebas — ver nota de migración)
- Cuenta Resend creada — pendiente verificación de dominio por el departamento técnico
- ⚠️ **Pendiente migración a Resend** tan pronto el dominio corporativo esté verificado

### Seguridad
- Claves Supabase (service_role) solo en servidor, nunca expuestas al cliente
- Validación de dominio corporativo en dos capas: frontend (UX inmediato) + servidor (fuente de verdad)
- JWT con expiración de 7 días

---

## [0.1.0] — 2026-03-18 — Sesión 0: Limpieza y documentación inicial

### Fork
- Proyecto creado como fork de MyBoard (versión personal de Ibai Fernández, Phase 1 completa)
- Renombrado a MyBoard Legacy con enfoque corporativo multi-tenant para AGLAYA

### Eliminado
- Datos personales de Ibai en `server/data/tasks.json` → respaldados en `tasks.personal-backup.json`
- Adjuntos personales en `server/uploads/` (5 archivos: 2 PNG, 1 PDF, 1 CSV, 1 MD)
- `estrategia.ibaifernandez.com.md` de la raíz del proyecto
- Credenciales SMTP personales (info@ibaifernandez.com) del archivo `.env`

### Añadido
- **Dummy data corporativa** en `server/data/tasks.json`:
  - 5 tableros: 🚀 Proyectos Activos, 📧 Campañas Email, 🤝 Clientes, ⚙️ Automatizaciones, 🏢 Operaciones AGLAYA
  - 18 columnas distribuidas entre los 5 tableros
  - 30 tarjetas con datos verosímiles de agencia de marketing (prioridades, fechas, checklists, categorías)
  - 8 categorías: email-marketing, web, social-media, automatizacion, clientes, operaciones, contenido, analytics
- Variable `PORT=3003` en `.env`

### Modificado
- **Puertos actualizados de 3001/5173 → 3003/5175:**
  - `server/index.js`: `PORT = process.env.PORT || 3003`
  - `client/vite.config.js`: port 5175, proxy → localhost:3003
  - `.claude/launch.json`: configuraciones actualizadas a 3003/5175
- `server/index.js`: CORS actualizado para aceptar `localhost:5175`

### Documentación reescrita
- `CLAUDE.md` — contexto AGLAYA Kanban Desk, puertos 3003/5175, reglas Phase 0
- `AGENTS.md` — identidad, comportamiento, convenciones, reglas de datos e IP
- `README.md` — orientado a gerencia AGLAYA + equipo técnico propio
- `docs/ROADMAP.md` — 4 fases: Phase 0→4 con objetivos y entregables
- `docs/BACKLOG.md` — tareas por fase (Phase 0 completada, Phases 1–3 planificadas)
- `docs/ARCHITECTURE.md` — arquitectura actual (Phase 0) + arquitectura objetivo (Phase 1) con esquema Supabase, roles, multi-tenancy
- `docs/DECISIONS.md` — 6 ADRs: Supabase, auth JWT, Infra-Soberana, freemium, IP, fork
- `docs/PRODUCT.md` — visión de producto para stakeholders AGLAYA, comparativa herramientas, modelo freemium

---

## Versiones heredadas de MyBoard (referencia)

### [0.3.0] — 2026-03-03 (MyBoard personal)
- Columnas por defecto al crear tablero
- Búsqueda global
- Filtros por categoría y prioridad

### [0.2.0] — 2026-03-02 (MyBoard personal)
- Sistema de categorías via API
- Drag & drop de columnas y tarjetas

### [0.1.0] — 2026-03-01 (MyBoard personal)
- MVP inicial: tableros, columnas, tarjetas, CRUD completo
