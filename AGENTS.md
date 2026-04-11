# AGENTS.md — Reglas persistentes para el agente de IA

> Este archivo es leído automáticamente por Claude Code al inicio de cada sesión.
> Define cómo debe comportarse el agente durante todo el desarrollo de AGLAYA Kanban Desk.
> **No modificar sin consenso explícito con el owner del proyecto.**

---

## 1. Identidad del proyecto

- **Nombre:** AGLAYA Kanban Desk
- **Owner:** AGLAYA (info@ibaifernandez.com)
- **Fase actual:** Phase 0 — Limpieza y documentación → Phase 1 — Multi-tenant y autenticación
- **Documentación de referencia:**
  - Arquitectura → `docs/ARCHITECTURE.md`
  - Seguridad → `docs/SECURITY.md`
  - Permisos → `docs/PERMISSIONS.md` (Roles Micro)
  - Roadmap → `docs/ROADMAP.md`
  - Backlog → `docs/BACKLOG.md`
  - Producto → `docs/PRD.md`
  - Operaciones → `docs/RUNBOOK.md`
  - Email Templates → `docs/mails/`
  - Database Schema → `docs/schema/supabase-schema.sql`
- **Datos de demo:** `server/data/tasks.json` contiene dummy data corporativa — puede sobreescribirse libremente en desarrollo. En producción será reemplazado por base de datos real (Supabase/PostgreSQL).

---

## 2. Comportamiento general del agente

- Trabaja paso a paso y confirma al terminar cada Paso antes de avanzar al siguiente (salvo instrucción explícita de operar en modo autónomo).
- Antes de escribir código, lee los archivos relevantes (`PRD.md`, `ARCHITECTURE.md`). No propongas cambios sobre código que no hayas leído.
- Si algo no está especificado o detectas inconsistencias, **pregunta antes de asumir**.
- Documenta toda decisión no trivial en `docs/ARCHITECTURE.md` (sección ADR).
- Registra todos los cambios significativos en `docs/CHANGELOG.md`.
- Actualiza `docs/BACKLOG.md` al completar o agregar tareas.
- **Protección de datos**: `server/data/tasks.json` es para desarrollo. Nunca lo uses como plantilla de placeholders con datos sensibles.

---

## 3. Convenciones de código

- **Idioma**: Código en **inglés** (variables, funciones, comentarios). Documentación y commits en **español**.
- **Frontend (React)**:
  - Functional components con hooks. Estilos con Vanilla CSS / Tailwind.
  - API calls centralizadas en `client/src/api/` o hooks.
- **Backend (Express)**:
  - Rutas modulares en `server/routes/`. Lógica fuera de `index.js`.
  - Respuestas JSON consistentes: `{ success: true, data: ... }` o `{ error: "mensaje" }`.
- **Formato**:
  - `camelCase` (JS vars), `PascalCase` (React Components), `kebab-case` (archivos), `UPPER_SNAKE_CASE` (constantes).
- **Commits**: `tipo: descripción en español` (ej. `feat: añadir autenticación`).

---

## 4. Gestión de Errores y Seguridad

- Valida datos en las fronteras del sistema (API).
- Devuelve códigos HTTP semánticos (200, 201, 400, 401, 403, 404, 500).
- **Multi-tenant**: El aislamiento entre organizaciones y workspaces es crítico. No permitas fugas de ID entre contextos.

---

## 5. Reglas críticas de puertos e Infraestructura

- **Server:** 3003 | **Client:** 5175
- MyBoard personal: 3001/5173 | conta-if: 3002/5174
- El despliegue final se realiza en **Infraestructura Soberana AGLAYA**. Actualmente se usa Railway/Netlify para staging.

---

## 6. Lo que el agente NO debe hacer

- ❌ Instalar librerías sin preguntar.
- ❌ Cambiar el stack tecnológico basal sin aprobación.
- ❌ Generar placeholders; construye con datos estructurados reales.
- ❌ Usar `localStorage` para persistencia de sesión sensible (usa `sessionStorage` con las claves aprobadas como `aglaya_session`).
- ❌ Compartir acceso al código fuente con terceros sin autorización explícita de Ibai Fernández.

---

## 7. Propiedad intelectual

- El código fuente reside en repo privado de AGLAYA.
- No compartir acceso al código fuente con terceros sin autorización explícita de Ibai Fernández.
- Copyright: "AGLAYA Kanban Desk · © 2026 AGLAYA"
