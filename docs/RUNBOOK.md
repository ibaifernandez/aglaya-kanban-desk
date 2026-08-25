# RUNBOOK.md — Guía de Operaciones AGLAYA

**Última actualización:** 2026-07-13 (operativa sincronizada)

Este documento centraliza toda la operativa técnica de AGLAYA Kanban Desk, tanto para desarrollo local como para puesta en producción en infraestructura soberana de AGLAYA.

---

## 🛠️ 1. Desarrollo Local

### Instalación Inicial
```bash
# 1. Instalar dependencias del servidor
npm install

# 2. Instalar dependencias del cliente
cd client && npm install
cd ..
```

### Arrancar la Aplicación
```bash
# Desde la raíz del proyecto
npm run dev
```
- **Backend**: [http://localhost:3003](http://localhost:3003)
- **Frontend**: [http://localhost:5175](http://localhost:5175)

*Vite proxy: todas las peticiones a `/api/*` y `/uploads/*` se redirigen automáticamente al puerto 3003.*

---

## 🚀 2. Despliegue en Producción

### Estado actual (real): Railway + Netlify

El despliegue de producción **hoy** es automático en cada push a `main`:

- **Server (Express):** Railway. URL interna `https://web-production-099a0.up.railway.app`. Arranque `node server/index.js` (ver `Procfile`). Sentry activo.
- **Client (React/Vite):** Netlify. Proxy `/api/*` y `/uploads/*` → Railway; CSP y headers de seguridad (ver `netlify.toml`). Dominio `kanban.aglaya.biz`.
- **Backups:** GitHub Actions → pg_dump 17 → Cloudflare R2, retención 30d (`.github/workflows/db-backup.yml`).

> ⚠️ Un push a `main` = un deploy a producción (server **y** client). No pushear sin intención de desplegar.

### Objetivo futuro: infraestructura soberana (Docker/Nginx)

Visión a futuro (ADR-003/010): control total en servidores propios de AGLAYA. Railway es provisional. Requisitos previstos para esa migración:

### Requisitos del Servidor
- **Docker 24+** y **Docker Compose v2**.
- **Nginx** (o similar) como proxy inverso con terminación SSL.
- Puerto **3003** (API) y **80/443** (Nginx) disponibles.

### Estructura en Servidor (`/opt/aglaya/`)
El despliegue se realiza mediante artefactos precompilados y contenedores, no se distribuye el código fuente.

1. `.env`: Archivo de configuración confidencial.
2. `docker-compose.yml`: Definición de los servicios (API + Client Nginx).
3. `uploads/`: Carpeta persistente para archivos adjuntos.

### Variables de Entorno (`.env`)
```env
# Servidor
PORT=3003

# Supabase (Auth & DB)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<key_anon>
SUPABASE_SERVICE_ROLE_KEY=<key_service_role>
JWT_SECRET=<string_seguro>
```

**Ya no hay variables de correo.** Aquí estaban las de Resend y la del cron de
digests; desde el 25-ago-2026 la nave **no manda ningún correo** y nada las lee.
Si siguen puestas en Railway o en GitHub Secrets, retirarlas es limpieza
pendiente, no un requisito: el servidor arranca sin ellas y hay prueba de eso en
[`server/tests/config.test.js`](../server/tests/config.test.js).

---

## 🔍 3. Diagnóstico y Mantenimiento

### Verificar Salud del Sistema
```bash
# Local
curl http://localhost:3003/api/health

# Producción
curl https://kanban.aglaya.biz/api/health
```

### Ejecutar Tareas Manuales

Aquí vivían los tres disparos del digest. **`/api/digest/*` se retiró entero**
(25-ago-2026, «cero mails»): no hay ninguna tarea de correo que lanzar a mano.

### Consultar Historial de Incidencias
- Revisar [INCIDENTS.md](./INCIDENTS.md) antes de diagnosticar regresiones ya conocidas.
- Si el síntoma afecta a correo transaccional de Supabase, verificar también que las plantillas del panel Auth coincidan con los HTML versionados en `docs/mails/`.
- Si el síntoma afecta a permisos o errores RLS intermitentes, confirmar que Railway esté corriendo una revisión posterior al aislamiento de clientes Supabase (ADR-016).

### Limpieza de Caché y Reinstalación
```bash
# Solo si hay problemas graves de dependencias
rm -rf node_modules client/node_modules
npm install && cd client && npm install && cd ..
```

---

## ⚠️ Reglas Críticas de Operación
1. **Nunca** matar procesos en el rango 3001-3003 sin verificar a qué instancia de AGLAYA pertenecen.
2. **Nunca** compartir las Service Role Keys por canales no cifrados.
3. El servidor requiere **Node.js v20+** (CI y build usan Node 20 — ver `.github/workflows/ci.yml`).
