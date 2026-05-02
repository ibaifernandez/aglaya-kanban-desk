# AGLAYA Kanban Desk

![Version](https://img.shields.io/badge/version-1.3.1-6366f1)
![Tests](https://img.shields.io/badge/tests-85%20passing-brightgreen)
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

| Capa            | Tecnología                                      |
| --------------- | ----------------------------------------------- |
| Frontend        | React 18 + Vite + TailwindCSS                   |
| Drag & drop     | @dnd-kit                                        |
| Backend         | Express 4 + Node.js                             |
| Base de datos   | Supabase (PostgreSQL + RLS)                     |
| Auth            | Supabase Auth + JWT middleware + bcryptjs       |
| Storage         | Supabase Storage (adjuntos, avatares, portadas) |
| Email           | Resend + node-cron (digests diarios)            |
| Seguridad       | Helmet + express-rate-limit + CORS por entorno  |
| Tests           | Jest + Supertest (85 tests · 10 suites)         |
| Deploy cliente  | Netlify (auto-deploy en push a `main`)          |
| Deploy servidor | Railway (auto-deploy en push a `main`)          |

---

## Arquitectura

```
client/  (React 18 + Vite · Netlify · puerto 5175)
├── src/
│   ├── pages/          ← LoginPage, WorkspaceDashboard, ResetPasswordPage
│   ├── components/     ← Board, Card, CardModal, Sidebar, Toolbar, NotificationBell…
│   ├── context/        ← AuthContext, CategoriesContext
│   ├── hooks/          ← useBoardData, useWorkspaces, useBoards…
│   └── api/client.js   ← interceptor JWT · todas las peticiones

server/  (Express 4 · Railway · puerto 3003)
├── app.js              ← Express config, rutas, middlewares, 404 y error handler
├── index.js            ← Entry point: valida config y arranca listen()
├── routes/             ← auth, boards, cards, columns, categories,
│                          workspaces, notifications, media, digest
├── middleware/         ← requireAuth, requireRole, requireWorkspaceMember
├── digest.js           ← Admin digest · estadísticas globales diarias
├── userDigest.js       ← User digest · tarjetas urgentes/vencidas por usuario
└── utils/supabase.js   ← Cliente admin (service_role) + anon

         React ←──── JWT / HTTPS ────→ Express
                                           │
                                      Supabase
                               (PostgreSQL + RLS + Auth
                                + Storage + Admin API)
```

**Aislamiento de datos:** Row Level Security activa en todas las tablas. El servidor usa `service_role` (bypasa RLS para operaciones administrativas); el cliente nunca toca la DB directamente.

**Jerarquía de objetos:** Organization → Workspace → Board → Column → Card. Cada nivel hereda las restricciones de visibilidad del nivel superior.

---

## Características — v1.3.1

### Workspaces y roles

- Tres tipos de workspace: `personal` / `interno` / `externo`
- Dos roles de usuario: `colaborador` (acceso completo) y `cliente` (solo workspaces externos asignados)
- Roles por workspace: `owner` / `admin` / `member` / `guest`
- Creación automática de workspace personal al registrarse
- Ajustes de workspace desde la UI: editar nombre, emoji, tipo, descripción y portada
- Aviso al cambiar un workspace a tipo `externo` (visibilidad para clientes)

### Tableros y tarjetas

- Drag & drop de columnas y tarjetas
- Prioridades: urgente / alta / media / baja / ninguna
- Fecha límite con indicador visual de urgencia
- Checklist con progreso, reordenación, edición inline y **asignaciones por ítem** (con buscador de miembros)
- Responsable por tarjeta (con avatar)
- Etiquetas y adjuntos
- Búsqueda global y filtros por responsable / vencidas
- Mover tarjeta entre tableros (cross-board, incluso cross-workspace)
- Mover tablero entre workspaces

### Notificaciones

- **Campana in-app** con badge de no leídas (polling cada 45 s)
- Visible en la lista de workspaces y dentro de los tableros
- Notificaciones automáticas al ser mencionado en un ítem de checklist
- Marcar como leída individualmente o todas a la vez

### Identidad visual y storage

- Avatar de usuario (upload directo, crop integrado)
- Portada de workspace (imagen real o mini-kanban generativo)
- Mini-kanban decorativo determinista en tarjetas de workspace

### Email y digests

- **Admin digest:** estadísticas globales, tarjetas vencidas, huérfanas, top tableros y datos de usuarios Supabase — enviado diariamente vía GitHub Actions
- **User digest:** email personal con tarjetas urgentes/vencidas y asignaciones pendientes, segmentado por workspace
- Endpoint `POST /api/digest/send-me` para envío bajo demanda (admin)
- Email vía [Resend](https://resend.com)

### Seguridad

- CORS restringido por entorno (solo `kanban.aglaya.biz` en producción)
- Rate limiting: 20 req / 15 min en rutas de auth
- Helmet con CSP en producción
- Validación de enums y tipos en todos los endpoints de mutación
- JWT con expiración de 7 días; tokens en sessionStorage
- Confirmación de borrado en tarjetas y columnas
- Global error handler: todos los errores no capturados responden con JSON (nunca HTML)

---

## Primeros pasos

### Requisitos

- Node.js 20+
- Un proyecto [Supabase](https://supabase.com) (el plan free es suficiente para desarrollo)
- Una cuenta [Resend](https://resend.com) para el envío de emails (plan free disponible)

### Instalación

```bash
# Clonar
git clone https://github.com/ibaifernandez/aglaya-kanban-desk.git
cd aglaya-kanban-desk

# Dependencias del servidor
npm install

# Dependencias del cliente
cd client && npm install && cd ..

# Variables de entorno
cp .env.example .env
# Rellena las variables según la sección siguiente
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

# Email (Resend)
RESEND_API_KEY=
SMTP_FROM=noreply@tudominio.com

# Admin digest (cron diario)
DIGEST_TO=admin@tudominio.com
DIGEST_HOUR=6
DIGEST_MINUTE=0

# User digest (cron diario)
USER_DIGEST_HOUR=7
USER_DIGEST_MINUTE=0

# GitHub Actions cron trigger (necesario en Railway + GH Secrets)
DIGEST_CRON_SECRET=genera-un-secreto-largo-aqui

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

El schema completo está en `docs/schema/supabase-schema.sql`. Ejecutar en **Supabase → SQL Editor**.

Incluye:
- Jerarquía completa: organizations → workspaces → boards → columns → cards
- Tabla `notifications` con índices parciales (`WHERE read = false`)
- `cards.category` como UUID FK con `ON DELETE SET NULL`
- 7 índices de rendimiento en columnas de alta frecuencia
- RLS activado en todas las tablas con funciones `SECURITY DEFINER`

---

## Tests

85 tests en 10 suites — todos en verde.

| Suite                | Tests | Descripción                                          |
| -------------------- | ----- | ---------------------------------------------------- |
| `auth`               | 9     | Registro, login, restricción de dominio              |
| `workspaces`         | 13    | Tipos personal/interno/externo, permisos por rol     |
| `notifications`      | 16    | GET, PATCH /read-all, PATCH /:id/read, aislamiento   |
| `security`           | 15    | 401 en rutas protegidas, 200 en públicas, 404 JSON   |
| `cards-validation`   | 7     | Validación de enums y tipos en mutaciones            |
| `smtpConfig`         | 10    | Validación de variables de entorno de email          |
| `admin`              | 5     | Rutas de administración                              |
| `digest`             | 5     | Lógica de digest                                     |
| `digestLogging`      | 4     | Registro de intentos de envío                        |
| `health`             | 1     | Endpoint `/api/health`                               |

```bash
cd server && npm test
```

---

## Estrategia de ramas

`main` es la rama de producción. Netlify y Railway despliegan automáticamente en cada push. El trabajo de features va en ramas cortas con merge manual.

---

## Documentación

| Documento                                            | Descripción                            |
| ---------------------------------------------------- | -------------------------------------- |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md)            | Arquitectura técnica detallada + ADRs  |
| [ROADMAP.md](./docs/ROADMAP.md)                      | Fases completadas y próximos pasos     |
| [CHANGELOG.md](./docs/CHANGELOG.md)                  | Historial de versiones                 |
| [BACKLOG.md](./docs/BACKLOG.md)                      | Features en cola                       |
| [README-deploy.md](./docs/README-deploy.md)          | Guía de deploy paso a paso             |
| [SECURITY.md](./docs/SECURITY.md)                    | Modelo de seguridad y RLS              |
| [supabase-schema.sql](./docs/schema/supabase-schema.sql) | Schema SQL completo                |

---

_AGLAYA Kanban Desk · parte de la red [AGLAYA](https://aglaya.biz) · © 2026 Ibai Fernández · MIT License_
