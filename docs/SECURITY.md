# SECURITY — AGLAYA Kanban Desk

Auditoría de seguridad y superficie de ataque. Documento de referencia para la certificación Kosher.

---

## Estado general Phase 1 (v0.9.0.0)

| Área | Estado | Detalle |
|---|---|---|
| Autenticación | ✅ | Supabase Auth + JWT firmado por el servidor |
| Autorización | ✅ | Middleware `requireAuth` y `requireWorkspaceMember` en todos los endpoints de datos |
| Restricción de dominio | ✅ | Capa de filtrado corporativo (`@aglaya.biz`, `@ibaifernandez.com`) |
| Security headers HTTP | ✅ | `helmet` configurado con CSP activa en producción |
| Exposición de claves | ✅ | `service_role` restringido al backend; RLS activo en DB |
| CORS | ✅ | Orígenes estrictos (puerto 5175 en local, dominio real en prod) |
| Rate limiting | ✅ | `express-rate-limit` activo en los endpoints de autenticación |
| Row Level Security | ✅ | Políticas de Supabase activas por `organization_id` y `workspace_id` |

---

## Claves y secretos

### Variables de entorno críticas

| Variable | Dónde vive | Nivel de criticidad |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Solo `.env` del servidor | 🔴 CRÍTICO — bypass de RLS; solo para tareas administrativas |
| `JWT_SECRET` | Solo `.env` del servidor | 🔴 CRÍTICO — firma de tokens de sesión |
| `SMTP_PASS` | Solo `.env` del servidor | 🟠 ALTO — credenciales de Resend |
| `SUPABASE_ANON_KEY` | Servidor + Cliente | 🟡 MEDIO — limitada por políticas RLS |

### Reglas de manejo
- ✅ `.env` bajo `.gitignore`; gestión vía secretos en PRONODO/Railway.
- ✅ `VITE_` prefix asegura que solo las claves necesarias lleguen al bundle del cliente.

---

## Autenticación y autorización

### Flujo Hardened
1.  **Rate Limiting**: Los endpoints de auth están limitados por IP para prevenir fuerza bruta.
2.  **Domain Guard**: El registro y login validan estrictamente los dominios `@aglaya.biz` e `@ibaifernandez.com`.
3.  **Sign-in**: Las credenciales se validan contra Supabase Auth.
4.  **Token Issuance**: El servidor emite un JWT firmado que expira en 7 días.
5.  **Multi-layer Auth**: 
    - `requireAuth`: Valida identidad.
    - `requireWorkspaceMember`: Valida que el usuario tenga acceso al workspace específico que intenta tocar.

### Superficie de ataque (Endpoints)

#### Públicos 🔓
- `POST /api/auth/login` (Protegido por Rate Limit y Domain Guard)
- `POST /api/auth/register` (Protegido por Rate Limit y Domain Guard)
- `GET /api/health` (Status anónimo)

#### Protegidos por `requireAuth` 🛡️
- `GET /api/auth/me`
- `/api/digest/*`
- `/api/admin/*`
- `/api/categories/*`

#### Protegidos por `requireWorkspaceMember` 🏰 (Context-Aware)
- `/api/workspaces/*` (Aislamiento total)
- `/api/boards/*`
- `/api/columns/*`
- `/api/cards/*`
- `/api/uploads/*`

---

## CORS y Headers

### Configuración Nativa
- **Helmet**: Activo con `contentSecurityPolicy` y Protecciones XSS/Clickjacking.
- **CORS**: 
  - Local: `http://localhost:5175`
  - Prod: `https://kanban.aglaya.biz`

---

## Supabase Row Level Security (RLS)

Segunda línea de defensa (Capa de datos):
- `users`: RLS por `id` y `organization_id`.
- `workspaces`: RLS por membresía.
- `boards/columns/cards`: RLS jerárquico por `workspace_id`.

---

## Logros de Seguridad (Certificados)

1.  **Purga de Identidad**: Eliminación total de marcas previas y dominios obsoletos en el flujo de seguridad.
2.  **Hardening de Registro**: Solo personal autorizado puede crear cuentas.
3.  **Consolidación de Middlewares**: No hay rutas de datos expuestas sin validación de JWT.

---

*Última actualización: 2026-04-11 — Auditoría Final v0.9.0.0*
