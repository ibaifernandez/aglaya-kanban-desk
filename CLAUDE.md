# CLAUDE.md — MyBoardLFi

> Este archivo es leído automáticamente por Claude Code al inicio de cada sesión.

---

## Identidad del proyecto

**MyBoardLFi** (nombre técnico/repositorio) — **display name: LFi Kanban Desk** — es la versión corporativa multi-tenant de MyBoard, orientada a equipos y clientes de LFi (agencia de marketing, Chile). Desarrollado por Ibai Fernández como ejercicio de emprendimiento interno.

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

**Phase 0 — Limpieza y documentación**

Eliminar datos personales, cargar dummy data corporativa, actualizar toda la documentación y ajustar puertos. Sin nuevas features hasta completar Phase 0.

---

## Reglas críticas

- No matar procesos en puertos 3003/5175 sin verificar que son de MyBoardLFi.
- No modificar `.claude/launch.json` sin actualizar este archivo.
- **No sobreescribir `server/data/tasks.json` con datos personales de Ibai.** Contiene dummy data corporativa de demostración; en producción será reemplazado por Supabase.
- Al mover una tarjeta a una columna de tipo "hecho/entregado/completado": establecer `priority` a `"none"` automáticamente.
- Idioma del código: inglés. Idioma de documentación y commits: español.
- Antes de implementar features de Phase 1, leer siempre `docs/ARCHITECTURE.md`.
