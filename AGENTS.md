# AGENTS.md — Reglas del agente (AGLAYA Kanban Desk)

> **Fuente única de reglas del agente: [`CLAUDE.md`](./CLAUDE.md).**
> Este proyecto lo desarrolla Claude Code, que lee `CLAUDE.md` automáticamente al
> iniciar. Este `AGENTS.md` existe por convención (otras herramientas lo leen) y
> solo **resume**; ante cualquier discrepancia, manda `CLAUDE.md`.

## Esenciales (el detalle vive en CLAUDE.md)

- **Proyecto:** AGLAYA Kanban Desk — plataforma Kanban multi-tenant. Phase 4 completada (**v1.3.1**). Producción en **kanban.aglaya.biz**.
- **Puertos (no cambiar nunca):** server **3003** · client **5175**. Proyectos hermanos: 3001/5173, 3002/5174.
- **Idioma:** código en **inglés**; documentación y commits en **español**.
- **Datos:** persistencia real en **Supabase** (PostgreSQL + RLS). No existe `tasks.json` — migrado a Supabase en Phase 1.
- **Infra:** Railway (server) + Netlify (client) en **producción**; push a `main` = **deploy**. Visión a futuro: infraestructura soberana AGLAYA.
- **Sesión sensible:** `sessionStorage` con clave `aglaya_session` (nunca `localStorage`).
- **Antes de tocar el schema:** leer `docs/schema/supabase-schema.sql` (fuente de verdad, espejo de la DB real) + la regla de GRANTs de CLAUDE.md. El CI `schema-guard` rechaza migraciones que no actualicen el schema doc.
- **Documentación:** decisiones no triviales → ADR en `docs/ARCHITECTURE.md` §7. Cambios → `docs/CHANGELOG.md`.

## Lo que el agente NO debe hacer

- ❌ Instalar librerías o cambiar el stack basal sin preguntar.
- ❌ Usar `localStorage` para sesión sensible.
- ❌ Compartir acceso al código fuente con terceros sin autorización de Ibai Fernández.

_Repo privado de AGLAYA · © 2026 AGLAYA Kanban Desk._
