# AGLAYA Kanban Desk

![Version](https://img.shields.io/badge/version-1.1.0-6366f1)
![Tests](https://img.shields.io/badge/tests-26%20passing-brightgreen)
![Client](https://img.shields.io/badge/client-Netlify-00C7B7?logo=netlify)
![Server](https://img.shields.io/badge/server-Railway-0B0D0E?logo=railway)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

**Tu trabajo personal y el de tu equipo, en el mismo sitio. Sin fricciones, sin cuentas separadas, sin perder el hilo.**

Kanban multi-tenant para equipos que trabajan con clientes. Separa lo que es tuyo, lo que es del equipo y lo que es del cliente — y decide en cada momento quién ve qué. En producción en [kanban.aglaya.biz](https://kanban.aglaya.biz).

---

## Por qué existe esto

La mayoría de herramientas Kanban te obligan a elegir: o gestionas tu trabajo personal, o gestionas proyectos de equipo. AGLAYA Kanban Desk no te obliga a elegir.

Tres tipos de espacio de trabajo, un solo acceso:

- **Personal** — tu backlog, tus proyectos, lo que solo te concierne a ti
- **Interno** — tableros de equipo para proyectos departamentales
- **Externo** — espacios compartidos con clientes, con visibilidad controlada

Los clientes ven únicamente lo que les has asignado. El equipo ve todo lo interno. Tú ves todo.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Drag & drop | @dnd-kit |
| Backend | Express 4 + Node.js |
| Base de datos | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth + JWT middleware + bcryptjs |
| Storage | Supabase Storage (adjuntos, avatares, portadas) |
| Email | Nodemailer + node-cron (digest diario) |
| Seguridad | Helmet + express-rate-limit + CORS por entorno |
| Tests | Jest + Supertest (26 tests) |
| Deploy cliente | Netlify (auto-deploy en push a `main`) |
| Deploy servidor | Railway (auto-deploy en push a `main`) |

---

## Arquitectura

```
client/  (React 18 + Vite · Netlify · puerto 5175)
├── src/
│   ├── pages/          ← LoginPage, WorkspaceDashboard, ResetPasswordPage
│   ├── components/     ← Board, Card, CardModal, Sidebar, Toolbar…
│   ├── context/        ← AuthContext, CategoriesContext
│   ├── hooks/          ← useBoardData, useWorkspaces, useBoards…
│   └── api/client.js   ← interceptor JWT · todas las peticiones

server/  (Express 4 · Railway · puerto 3003)
├── routes/             ← auth, boards, cards, columns, categories,
│                          workspaces, media, digest
├── middleware/         ← requireAuth, requireRole, requireWorkspaceMember
├── digest.js           ← admin digest · estadísticas globales diarias
└── utils/supabase.js   ← cliente admin (service_role) + anon

         React ←──── JWT / HTTPS ────→ Express
                                           │
                                      Supabase
                               (PostgreSQL + RLS + Auth
                                + Storage + Admin API)
```

**Aislamiento de datos:** Row Level Security activa en todas las tablas. El servidor usa `service_role` (bypasa RLS para operaciones administrativas); el cliente nunca toca la DB directamente.

**Jerarquía de objetos:** Organization → Workspace → Board → Column → Card. Cada nivel hereda las restricciones de visibilidad del nivel superior.

---

## Características — v1.1.0

### Workspaces y roles
- Tres tipos de workspace: `personal` / `interno` / `externo`
- Dos roles de usuario: `colaborador` (acceso completo) y `cliente` (solo workspaces externos asignados)
- Roles por workspace: `owner` / `admin` / `member` / `guest`
- Creación automática de workspace personal al registrarse

### Tableros y tarjetas
- Drag & drop de columnas y tarjetas
- Prioridades: urgente / alta / media / baja / ninguna
- Fecha límite con indicador visual de urgencia
- Checklist con progreso, reordenación y edición inline
- Responsable por tarjeta (con avatar)
- Etiquetas y adjuntos
- Búsqueda global y filtros por responsable / vencidas

### Identidad visual y storage
- Avatar de usuario (upload directo, crop integrado)
- Portada de workspace (imagen real o mini-kanban generativo)
- Mini-kanban decorativo determinista en tarjetas de workspace

### Email y notificaciones
- Digest diario de administrador: estadísticas globales, tarjetas vencidas, huérfanas, top tableros, datos de usuarios Supabase
- Endpoint `POST /api/digest/send-me` para envío bajo demanda (admin)
- SMTP via Resend

### Seguridad
- CORS restringido por entorno (solo `kanban.aglaya.biz` en producción)
- Rate limiting: 20 req / 15 min en rutas de auth
- Helmet con CSP en producción
- Validación de enums y tipos en todos los endpoints de mutación
- JWT con expiración de 7 días; tokens en localStorage con keys propias (`aglaya_token`, `aglaya_user`)

---

## Primeros pasos

### Requisitos

- Node.js 20+
- Un proyecto [Supabase](https://supabase.com) (el plan free es suficiente para desarrollo)

### Instalación

```bash
# Clonar
git clone https://github.com/ibaifernandez/aglaya-board.git
cd aglaya-board

# Dependencias del servidor
npm install

# Dependencias del cliente
cd client && npm install && cd ..

# Variables de entorno
cp .env.example .env
# Rellena SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET y SMTP
```

### Ejecutar en local

```bash
npm run dev
# Servidor → http://localhost:3003
# Cliente  → http://localhost:5175
```

---

## Variables de entorno

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# JWT
JWT_SECRET=

# Email digest
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
DIGEST_TO=
DIGEST_HOUR=6

# App
PORT=3003
SITE_URL=https://kanban.aglaya.biz
NODE_ENV=production
```

---

## Scripts

```bash
npm run dev       # Servidor + cliente en paralelo (concurrently)
npm run server    # Solo servidor
npm run client    # Solo cliente (desde /client)
npm test          # Suite Jest + Supertest (desde /server)
```

---

## Migraciones SQL

```bash
# Ejecutar en Supabase → SQL Editor

# Schema inicial (Phase 1)
docs/supabase-schema.sql

# Workspace types (v1.1.0 — solo si actualizas desde una versión anterior)
docs/migrations/002-workspace-types-aglaya.sql
```

---

## Tests

26 tests en 4 suites — todos en verde.

| Suite | Tests |
|---|---|
| Auth API | 8 |
| Boards API | 7 |
| Cards API | 6 |
| Workspaces API | 5 |

```bash
cd server && npm test
```

---

## Estrategia de ramas

`main` es la rama de producción. Netlify y Railway despliegan automáticamente en cada push. El trabajo de features va en ramas cortas con merge manual.

---

## Documentación

| Documento | Descripción |
|---|---|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Arquitectura técnica detallada |
| [ROADMAP.md](./docs/ROADMAP.md) | Fases completadas y próximos pasos |
| [CHANGELOG.md](./docs/CHANGELOG.md) | Historial de versiones |
| [BACKLOG.md](./docs/BACKLOG.md) | Features en cola |
| [DECISIONS.md](./docs/DECISIONS.md) | Registro de decisiones técnicas (ADRs) |
| [README-deploy.md](./docs/README-deploy.md) | Guía de deploy paso a paso |
| [SECURITY.md](./docs/SECURITY.md) | Modelo de seguridad y RLS |

---

*AGLAYA Kanban Desk · parte de la red [AGLAYA](https://aglaya.biz) · © 2026 Ibai Fernández · MIT License*
