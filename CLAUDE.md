# CLAUDE.md — AGLAYA Kanban Desk

> Este archivo es leído automáticamente por Claude Code al inicio de cada sesión.

---

## Identidad del proyecto

**aglaya-board** (nombre del repo en GitHub) — **display name: AGLAYA Kanban Desk** — plataforma de gestión de proyectos multi-tenant bajo la red AGLAYA (aglaya.biz). Soporta colaboradores (workspaces personal, interno y externo) y clientes (solo workspaces externos asignados). Desarrollado por Ibai Fernández.

Antes llamado **MyBoardLFi / LFi Kanban Desk** — migrado a AGLAYA en v1.1.0.

---

## Puertos exclusivos de este proyecto

| Servicio | Puerto |
|----------|--------|
| Server (Express) | **3003** |
| Client (Vite) | **5175** |

**⚠️ No cambies estos puertos nunca.**
- MyBoard (versión personal) usa 3001/5173
- conta-if usa 3002/5174

Si alguno está ocupado al arrancar, investiga qué proceso lo tiene antes de matarlo.

Los servidores se arrancan con:
```
preview_start → "MyBoardLFi Server"   (puerto 3003)
preview_start → "MyBoardLFi Client"   (puerto 5175)
```
Configuración en `.claude/launch.json`.

---

## Fase actual

**Phase 1 — Rebrand AGLAYA + arquitectura de tipos de usuario**

- [x] Fase A: Rebrand (display strings, dominio, localStorage keys, CORS)
- [ ] Fase B: Workspace types (`personal / interno / externo`)
- [ ] Fase C: Control de acceso por tipo de usuario (`colaborador` vs `cliente`)
- [ ] Fase D: UI diferenciada por tipo de usuario en WorkspaceDashboard

---

## Reglas críticas

- No matar procesos en puertos 3003/5175 sin verificar que son de AGLAYA Kanban Desk.
- No modificar `.claude/launch.json` sin actualizar este archivo.
- Al mover una tarjeta a una columna de tipo "hecho/entregado/completado": establecer `priority` a `"none"` automáticamente.
- Idioma del código: inglés. Idioma de documentación y commits: español.
- Todo el trabajo de la migración AGLAYA se hace en la rama `feature/rebrand-aglaya`. No mergear a `main` hasta validar en local.
- Antes de implementar features, leer siempre `docs/ARCHITECTURE.md`.
