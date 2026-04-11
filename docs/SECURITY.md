# SECURITY — AGLAYA Kanban Desk

Auditoría de seguridad y superficie de ataque. Actualizar con cada cambio significativo.

---

## Estado general Phase 1

| Área | Estado | Detalle |
|---|---|---|
| Autenticación | ✅ | Supabase Auth + JWT firmado |
| Autorización | ✅ Parcial | Middleware `requireAuth` implementado; rutas de datos aún no protegidas |
| Restricción de dominio | ✅ | Doble capa: frontend + servidor |
| Security headers HTTP | ✅ | `helmet` instalado en Express |
| Exposición de claves | ✅ | `service_role` solo en servidor |
| CORS | ✅ | Solo orígenes conocidos |
| HTTPS | ⚠️ | Solo en producción (PRONODO) — desarrollo en HTTP local |
| Rutas de datos protegidas | ❌ | Pendiente migración a Supabase |
| Rate limiting | ❌ | No implementado |
| Input sanitization | ⚠️ | Parcial — JSON parseado por Express, sin sanitización explícita |

---

## Claves y secretos

### Variables de entorno críticas

| Variable | Dónde vive | Nivel de criticidad |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Solo `.env` del servidor | 🔴 CRÍTICO — acceso total a la BD sin RLS |
| `JWT_SECRET` | Solo `.env` del servidor | 🔴 CRÍTICO — permite forjar tokens |
| `SMTP_PASS` | Solo `.env` del servidor | 🟠 ALTO — acceso a la cuenta de email |
| `SUPABASE_ANON_KEY` | `.env` servidor + `client/.env` (VITE_) | 🟡 MEDIO — respeta RLS, seguro en cliente |
| `SUPABASE_URL` | `.env` servidor + `client/.env` (VITE_) | 🟢 BAJO — solo es una URL pública |

### Reglas de manejo de claves
- ✅ `.env` y `client/.env` están en `.gitignore` — nunca se suben al repositorio
- ✅ `SUPABASE_SERVICE_ROLE_KEY` nunca se envía al frontend ni aparece en respuestas HTTP
- ✅ Solo las variables `VITE_*` son accesibles en el bundle del cliente (Vite las inyecta en build time)
- ⚠️ En producción, las variables deben gestionarse como secretos del servidor, no en archivos `.env`

---

## Autenticación y autorización

### Flujo de autenticación
1. Cliente envía `POST /api/auth/login` con email + password
2. Servidor valida dominio corporativo o dominio invitado (ej. `@aglaya.is`, `@aglaya.biz`)
3. Servidor llama a Supabase Auth con las credenciales
4. Supabase valida y devuelve el usuario autenticado
5. Servidor genera JWT propio firmado con `JWT_SECRET` (7 días de expiración)
6. Cliente almacena el token en `localStorage` y lo envía en cada petición como `Authorization: Bearer <token>`
7. Middleware `requireAuth` verifica la firma del JWT en cada ruta protegida

### Superficie de ataque — rutas públicas (sin auth)
```
POST /api/auth/login        — intencionalmente público
POST /api/auth/register     — intencionalmente público (restringido por dominio)
GET  /api/health            — solo devuelve status:ok, sin datos sensibles
```

### Rutas protegidas por `requireAuth`
```
GET  /api/auth/me           ✅
POST /api/digest/send-me    ✅
```

### Rutas pendientes de proteger ❌
```
GET/POST/PUT/DELETE /api/boards/*
GET/POST/PUT/DELETE /api/columns/*
GET/POST/PUT/DELETE /api/cards/*
GET/POST/PUT/DELETE /api/categories/*
GET/POST            /api/uploads/*
```
> ⚠️ Estas rutas actualmente no requieren autenticación. Están protegidas por el
> hecho de que la app no es pública, pero **deben protegerse antes de producción**.
> Se resolverá al migrar de `tasks.json` a Supabase con RLS.

---

## Headers HTTP de seguridad

Configurados vía `helmet` en `server/index.js`:

| Header | Valor | Protege contra |
|---|---|---|
| `X-DNS-Prefetch-Control` | off | Filtración de DNS |
| `X-Frame-Options` | SAMEORIGIN | Clickjacking |
| `X-Content-Type-Options` | nosniff | MIME type sniffing |
| `Referrer-Policy` | no-referrer | Filtración de URL en Referer |
| `X-Permitted-Cross-Domain-Policies` | none | Flash/PDF cross-domain |
| `Strict-Transport-Security` | max-age=15552000 | Downgrade HTTPS→HTTP |

> `Content-Security-Policy` desactivado en desarrollo para compatibilidad con Vite.
> **Activar explícitamente en producción.**

---

## CORS

```js
cors({ origin: ['http://localhost:5175', 'http://localhost:5173', 'http://localhost:5174'] })
```

- Solo acepta peticiones de los puertos de desarrollo conocidos
- En producción: actualizar con el dominio real (`https://kanban.aglaya.biz`)

---

## Supabase Row Level Security (RLS)

Todas las tablas tienen RLS activado. Políticas actuales:

| Tabla | Política | Estado |
|---|---|---|
| `users` | Solo ven su propio perfil (o admins de la misma org) | ✅ |
| `boards` | Solo usuarios de la misma organización | ✅ |
| `columns` | Solo usuarios con acceso al tablero padre | ✅ |
| `cards` | Solo usuarios de la misma organización | ✅ |
| `categories` | Solo usuarios de la misma organización | ✅ |

> Las políticas RLS son la segunda línea de defensa. La primera es el middleware de auth en Express.

---

## Pendientes de seguridad antes de producción

1. **Proteger todas las rutas de datos** con `requireAuth` + filtrado por `organizationId`
2. **Rate limiting**: instalar `express-rate-limit` en rutas de auth (previene fuerza bruta)
3. **CSP en producción**: configurar `Content-Security-Policy` adecuado
4. **CORS de producción**: cambiar orígenes al dominio real
5. **JWT refresh**: implementar renovación de token antes de los 7 días (opcional Phase 2)
6. **Auditoría de logs**: Supabase ya registra auth events; añadir logs de acceso en Express

---

*Última actualización: 2026-03-19 — Sesión 1 Phase 1*
