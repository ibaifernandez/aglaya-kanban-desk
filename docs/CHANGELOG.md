# CHANGELOG — AGLAYA Kanban Desk

Registro de cambios por versión. Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)

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
- `Toolbar.jsx`: clave localStorage unificada a `aglaya_token` (residuo `myboardlfi_token` del rebrand pre-v1.1.0)
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

Migración completa de LFi Kanban Desk → AGLAYA Kanban Desk. Cuatro fases ejecutadas en una sola iteración desde la rama `feature/rebrand-aglaya`, mergeada a `main` y desplegada en producción.

### Fase A — Rebrand visual y de dominio
- Producto renombrado: **LFi Kanban Desk** → **AGLAYA Kanban Desk**
- Repo renombrado en GitHub: `myboardlfi` → `aglaya-board`
- `package.json`: `name: aglaya-kanban-desk`, `version: 1.1.0`
- Dominio de producción: `myboardlfi.ibaifernandez.com` → `kanban.aglaya.biz`
- CORS producción restringido a `https://kanban.aglaya.biz`
- localStorage keys: `myboardlfi_token/user` → `aglaya_token/user`
- Logo y favicon LFi → assets AGLAYA (SVG rojo, blanco, negro, color)
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
- Email de invitación Supabase: plantilla LFi con tabla HTML + doctype configurada; subject «¡Hola! Te han invitado a LFi Kanban Desk.»; URL de redirección → `https://myboardlfi.ibaifernandez.com` ✅ (cierra KNOWN-02)
- Supabase Index Advisor habilitado (`index_advisor` + `hypopg`) — analiza queries y sugiere índices

### WorkspaceDashboard
- Botón Admin movido a header del WorkspaceDashboard (visible para admin/superadmin); eliminado de la Toolbar
- `sessionStorage` persiste vista activa entre recargas (workspace + tablero)
- History API: botón Atrás del navegador navega entre workspaces y dashboard

---

## [0.7.0] — 2026-03-25 — Sesión 6: UI Polish — display name, logo, mini-kanban, espacios de trabajo

### Identidad visual
- Display name oficial: **LFi Kanban Desk** (nombre técnico/repo permanece MyBoardLFi)
- Actualizado en: título de pestaña (`index.html`), LoginPage, ResetPasswordPage, Sidebar, WorkspaceDashboard, footer copyright
- Logo LFi (`lfi.png`) en header del WorkspaceDashboard (reemplaza la «M» genérica en azul)

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
- Fernando Murillo (PRONODO/TI de LFi) verificó el dominio `lafabricaimaginaria.com` en Resend
- Railway actualizado: `SMTP_HOST=smtp.resend.com`, `SMTP_USER=resend`, `SMTP_FROM=myboard@lafabricaimaginaria.com`
- Supabase → Authentication → Email → SMTP Settings: mismas credenciales configuradas
- Probado y confirmado: email de recuperación de contraseña llega correctamente desde `myboard@lafabricaimaginaria.com`
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
- Deploy limpio confirmado: `main@1f9cb48` publicado en `https://myboardlfi.ibaifernandez.com`

### UI — mejoras menores
- Añadido toggle de visibilidad de contraseña (ojito) en `LoginPage.jsx` y `ResetPasswordPage.jsx`
- Enlace "¿Olvidaste tu contraseña?" centrado correctamente en `LoginPage.jsx`

### Verificado en producción
- Login con `ibai@lfi.la` funciona en `https://myboardlfi.ibaifernandez.com`
- 5 tableros corporativos cargando desde Supabase (datos filtrados por `organization_id`)
- Email de recuperación de contraseña entregado vía Resend en menos de 1 minuto

---

## [0.4.0] — 2026-03-23 — Sesión 3: Fix login + deploy Netlify + migración schema

### Bug crítico resuelto: login bloqueado por RLS recursiva
- **Causa raíz:** La policy RLS `"Admins ven todos los usuarios de su org"` en `public.users` hacía una subconsulta a `public.users` para comprobar el rol del usuario autenticado, creando una recursión infinita que bloqueaba *todas* las consultas a la tabla, incluso las realizadas con la `service_role` key desde el servidor.
- **Síntoma:** Login fallaba con "Error al obtener el perfil de usuario" aunque las credenciales fueran correctas y la fila existiera en `public.users`.
- **Solución:** `DROP POLICY IF EXISTS "Admins ven todos los usuarios de su org" ON public.users;` ejecutado en Supabase SQL Editor. Ver ADR-009.

### Cuenta corporativa de acceso
- Creado usuario `ibai@lfi.la` en Supabase Auth → Authentication → Users (sin necesidad de email; contraseña asignada directamente desde el dashboard)
- Insertada la fila correspondiente en `public.users` con rol `superadmin` y `organization_id` de LFi Agency
- Confirmado que el login funciona correctamente tras eliminar la policy RLS

### Deploy frontend — Netlify
- Frontend desplegado en Netlify: `https://myboardlfi.ibaifernandez.com` (dominio primario) y `https://myboardlfi.netlify.app`
- `netlify.toml` configurado: build desde `client/`, proxy `/api/*` y `/uploads/*` → Railway, SPA fallback
- CORS del servidor Express ya incluía ambos dominios Netlify
- Supabase → Authentication → URL Configuration: Site URL actualizado a `https://myboardlfi.ibaifernandez.com`; Redirect URLs añadida
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
- Proyecto Supabase creado (`myboardlfi`, región São Paulo) y conectado al servidor
- Schema inicial ejecutado: tablas `organizations`, `users`, `boards`, `columns`, `cards`, `categories` con RLS activado
- Organización LFi Agency (`id: 00000000-0000-0000-0000-000000000001`, plan `pro`) insertada como tenant base
- `@supabase/supabase-js` instalado en server y client
- `jsonwebtoken` y `bcryptjs` instalados en server

### Autenticación
- `server/utils/supabase.js` — cliente Supabase admin + anon para el servidor
- `server/middleware/auth.js` — middleware `requireAuth` (JWT) y `requireRole(...roles)`
- `server/routes/auth.js` — endpoints `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Restricción de dominio corporativo: solo `@lfi.la` y `@lafabricaimaginaria.com` pueden registrarse o iniciar sesión (validación en servidor y en frontend)
- Usuario superadmin creado: `ibai@lfi.la`, rol `superadmin`, org LFi Agency

### Frontend — Autenticación
- `client/src/context/AuthContext.jsx` — estado global de sesión (token + user en localStorage)
- `client/src/pages/LoginPage.jsx` — pantalla de login con logo LFi, validación de dominio, diseño corporativo oscuro
- `client/src/pages/ResetPasswordPage.jsx` — página de restablecimiento de contraseña (flujo Supabase Auth)
- `client/src/utils/supabaseClient.js` — cliente Supabase anon para el frontend
- `client/.env` — variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- `client/src/api/client.js` — interceptor JWT: todas las peticiones incluyen `Authorization: Bearer <token>`
- `client/src/main.jsx` — envuelto en `AuthProvider`
- `App.jsx` — gate de autenticación: muestra `LoginPage` si no hay sesión; detecta ruta `/reset-password`
- Flujo "Olvidé mi contraseña" integrado en `LoginPage` (sin página separada)
- Toolbar actualizado: avatar con inicial, nombre de usuario y botón de logout

### Branding
- `lfi.png` movido a `client/src/assets/lfi.png`
- Logo LFi visible en: pantalla de login, sidebar (sustituyendo icono genérico), página de reset de contraseña
- Sidebar renombrada de "MyBoard" a "MyBoardLFi"
- Footer del digest actualizado: "MyBoardLFi · © 2026 Ibai Fernández"

### Email — Digest bajo demanda
- `server/routes/digestRoute.js` — endpoint `POST /api/digest/send-me` (requiere auth JWT)
- Botón "Enviarme mis tareas" (icono sobre) en Toolbar — envía el digest al email del usuario autenticado
- Feedback visual en botón: verde si OK, rojo si error, desaparece a los 4 segundos
- `digest.js` refactorizado: `sendDigest(to?)` acepta destinatario arbitrario; rebrandeado a MyBoardLFi

### SMTP / Email
- SMTP configurado con Migadu (provisional para pruebas — ver nota de migración)
- Cuenta Resend creada (`ibai.fernandez@lafabricaimaginaria.com`) — pendiente verificación de dominio por Fernando Murillo
- ⚠️ **Pendiente migración a Resend** tan pronto `lafabricaimaginaria.com` esté verificado en Resend

### Seguridad
- Claves Supabase (service_role) solo en servidor, nunca expuestas al cliente
- Validación de dominio corporativo en dos capas: frontend (UX inmediato) + servidor (fuente de verdad)
- JWT con expiración de 7 días

---

## [0.1.0] — 2026-03-18 — Sesión 0: Limpieza y documentación inicial

### Fork
- Proyecto creado como fork de MyBoard (versión personal de Ibai Fernández, Phase 1 completa)
- Renombrado a MyBoardLFi con enfoque corporativo multi-tenant para LFi

### Eliminado
- Datos personales de Ibai en `server/data/tasks.json` → respaldados en `tasks.personal-backup.json`
- Adjuntos personales en `server/uploads/` (5 archivos: 2 PNG, 1 PDF, 1 CSV, 1 MD)
- `estrategia.ibaifernandez.com.md` de la raíz del proyecto
- Credenciales SMTP personales (info@ibaifernandez.com) del archivo `.env`

### Añadido
- **Dummy data corporativa** en `server/data/tasks.json`:
  - 5 tableros: 🚀 Proyectos Activos, 📧 Campañas Email, 🤝 Clientes, ⚙️ Automatizaciones, 🏢 Operaciones LFi
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
- `CLAUDE.md` — contexto MyBoardLFi, puertos 3003/5175, reglas Phase 0
- `AGENTS.md` — identidad, comportamiento, convenciones, reglas de datos e IP
- `README.md` — orientado a gerencia LFi + equipo técnico (Fernando/PRONODO)
- `docs/ROADMAP.md` — 4 fases: Phase 0→4 con objetivos y entregables
- `docs/BACKLOG.md` — tareas por fase (Phase 0 completada, Phases 1–3 planificadas)
- `docs/ARCHITECTURE.md` — arquitectura actual (Phase 0) + arquitectura objetivo (Phase 1) con esquema Supabase, roles, multi-tenancy
- `docs/DECISIONS.md` — 6 ADRs: Supabase, auth JWT, PRONODO, freemium, IP, fork
- `docs/PRODUCT.md` — visión de producto para stakeholders LFi, comparativa herramientas, modelo freemium

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
