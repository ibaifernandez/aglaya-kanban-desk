# CLAUDE.md — AGLAYA Kanban Desk

> Este archivo es leído automáticamente por Claude Code al inicio de cada sesión.

---

## Identidad del proyecto

**aglaya-kanban-desk** (nombre del repo en GitHub) — **display name: AGLAYA Kanban Desk** — plataforma de gestión de proyectos multi-tenant bajo la red AGLAYA (aglaya.biz). Soporta colaboradores (workspaces personal, interno y externo) y clientes (solo workspaces externos asignados). Desarrollado por AGLAYA.

Proyecto migrado desde prototipos anteriores en v1.1.0 para consolidar la marca AGLAYA.

---

## Carpeta local

`/Users/AGLAYA/Local Sites/aglaya-kanban-desk`

---

## Puertos exclusivos de este proyecto

| Servicio | Puerto |
|----------|--------|
| Server (Express) | **3003** |
| Client (Vite) | **5175** |

**⚠️ No cambies estos puertos nunca.**
- Proyectos hermanos: 3001/5173 (personal) | 3002/5174 (conta-if)

Si alguno está ocupado al arrancar, investiga qué proceso lo tiene antes de matarlo.

Los servidores se arrancan con:
```
preview_start → "AGLAYA Kanban Desk Server"   (puerto 3003)
preview_start → "AGLAYA Kanban Desk Client"   (puerto 5175)
```
Configuración en `.claude/launch.json`.

---

## Fase actual

**Phase 4 — Calidad de producto y UX completa** *(ROADMAP.md)*

Phase 1 (rebrand AGLAYA) completada en v1.1.0 — todas las fases A–D ejecutadas.

Pendiente en Phase 4:
- [ ] Página de ajustes de workspace (editar nombre, tipo, portada desde UI)
- [ ] Verificación end-to-end flujo invite email → kanban.aglaya.biz *(bloqueante Phase 5)*
- [ ] Mover tarjeta entre tableros (cross-board desde CardModal)
- [ ] Tests actualizados (auth sin restricción de dominio + rutas workspaces)

---

## Backlog priorizado (post-Phase 1A)

| # | Feature | Prioridad | Estado |
|---|---------|-----------|--------|
| 1 | Movilidad de objetos — mover tableros entre workspaces | 🟡 MEDIA | ✅ v1.2.0 |
| 1b | Movilidad de objetos — mover tarjetas cross-workspace | 🟡 MEDIA | ❌ Pendiente diseño |
| 2 | Tests actualizados — auth, workspaces (code viejo sistema) | 🟡 MEDIA | ❌ Pendiente |
| 3 | Limpiar localStorage — remover `myboardlfi_token` (ruido) | 🟢 BAJA | ✅ v1.2.0 |
| 4 | Verificar flujo email invite — end-to-end kanban.aglaya.biz | 🔴 CRÍTICO | ❌ Bloqueante Phase 5 |
| 5 | Deprecación de prototipos legacy — archivar repos antiguos | 🟢 BAJA | ❌ Pendiente |

---

## Reglas críticas

- No matar procesos en puertos 3003/5175 sin verificar que son de AGLAYA Kanban Desk.
- No modificar `.claude/launch.json` sin actualizar este archivo.
- Al mover una tarjeta a una columna de tipo "hecho/entregado/completado": establecer `priority` a `"none"` automáticamente.
- Idioma del código: inglés. Idioma de documentación y commits: español.
- Antes de implementar features, leer siempre `docs/ARCHITECTURE.md`.
