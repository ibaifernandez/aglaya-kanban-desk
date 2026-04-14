# RUNBOOK.md — Guía de Operaciones AGLAYA

**Última actualización:** 2026-04-14 (v1.1.5 - Operativa sincronizada)

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

## 🚀 2. Despliegue en Producción (Infraestructura Soberana)

Este apartado está dirigido al responsable de infraestructura de AGLAYA.

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

# Email Transaccional (Resend)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=<api_key_resend>
SMTP_FROM="AGLAYA <no-reply@aglaya.biz>"
```

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
```bash
# Forzar envío del admin digest global (ignora el cron)
node -e "require('dotenv').config(); require('./server/digest').sendDigest()"
```

```bash
# Enviar digest personal/contextual vía API autenticada
# POST /api/digest/send-my-digest
# Body opcional: { "workspaceId": "<uuid-del-workspace>" }
```

### Consultar Historial de Incidencias
- Revisar [INCIDENTS.md](./INCIDENTS.md) antes de diagnosticar regresiones ya conocidas.
- Si el síntoma afecta a correo transaccional de Supabase, verificar también que las plantillas del panel Auth coincidan con los HTML versionados en `docs/mails/`.
- Si el síntoma afecta a permisos o errores RLS intermitentes, confirmar que Railway esté corriendo una revisión posterior al aislamiento de clientes Supabase (`v1.1.5`).

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
3. El servidor debe correr con **Node.js v18** o superior (entorno de producción probado: v18.18.0).
