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
- [x] Página de ajustes de workspace (editar nombre, tipo, portada desde UI)
- [x] Verificación end-to-end flujo invite email → kanban.aglaya.biz
- [x] Mover tarjeta entre tableros (cross-board y cross-workspace desde CardModal)
- [x] Menciones en checklist (asignaciones por ítem) + notificaciones in-app (campana) + digest
- [x] Tests actualizados (auth sin restricción de dominio + rutas workspaces)

---

## Backlog priorizado (post-Phase 1A)

| # | Feature | Prioridad | Estado |
|---|---------|-----------|--------|
| 1 | Movilidad de objetos — mover tableros entre workspaces | 🟡 MEDIA | ✅ v1.2.0 |
| 1b | Movilidad de objetos — mover tarjetas cross-workspace | 🟡 MEDIA | ✅ v1.2.x |
| 2 | Tests actualizados — auth, workspaces (code viejo sistema) | 🟡 MEDIA | ✅ v1.3.0 |
| 3 | Limpiar localStorage — remover `aglaya_token` (legacy nomenclature) | 🟢 BAJA | ✅ v1.2.0 |
| 4 | Verificar flujo email invite — end-to-end kanban.aglaya.biz | 🔴 CRÍTICO | ✅ v1.2.x |
| 5 | Deprecación de prototipos legacy — archivar repos antiguos | 🟢 BAJA | ❌ Pendiente |

---

## Endpoint interno — crear cards sin UI

`POST /api/internal/create-card` — autenticado con `x-task-secret` (ver `TASK_SECRET` en `.env`).
URL producción: `https://web-production-099a0.up.railway.app`

```bash
curl -s -X POST "$RAILWAY_SERVER_URL/api/internal/create-card" \
  -H "x-task-secret: $TASK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title":      "Título de la tarea",
    "boardName":  "Nombre del tablero",
    "priority":   "high",
    "workspaceName": "Ibai Fernández"
  }'
```

- `priority`: `urgent` | `high` | `medium` (default) | `low` | `none`
- `workspaceName`: default `"Ibai Fernández"` — omitir si es personal
- `boardName`: nombre exacto del tablero (case-insensitive)
- La card va al **Backlog** (o primera columna si no existe)
- `description` y `dueDate` (ISO 8601) son opcionales

---

## Acceso a Supabase desde Claude (DDL y queries directas)

`.env` (gitignored) contiene credenciales para que Claude ejecute migraciones y queries sin intervención manual:

- `SUPABASE_DATABASE_PASSWORD` — password del rol `postgres`. Habilita `psql`.
- `SUPABASE_PAT` — Personal Access Token. Habilita `supabase` CLI.

Patrón para aplicar DDL/migraciones:

```bash
set -a; source .env; set +a
export PGPASSWORD="$SUPABASE_DATABASE_PASSWORD"
psql "postgresql://postgres@db.jowtasxhnluqqcgkeoll.supabase.co:5432/postgres" -f docs/schema/migration-<nombre>.sql
```

Para queries puntuales: `psql ... -c "SELECT ..."`.

Reglas:
- Toda migración va a `docs/schema/migration-<descripcion>.sql` con `ALTER TABLE ... IF NOT EXISTS` para idempotencia.
- Tras aplicar, actualizar `docs/schema/supabase-schema.sql` (fuente de verdad).
- No commitear `.env`. Verificar `.gitignore` antes de cualquier `git add`.

## Reglas críticas

- No matar procesos en puertos 3003/5175 sin verificar que son de AGLAYA Kanban Desk.
- No modificar `.claude/launch.json` sin actualizar este archivo.
- Al mover una tarjeta a una columna de tipo "hecho/entregado/completado": establecer `priority` a `"none"` automáticamente.
- Idioma del código: inglés. Idioma de documentación y commits: español.
- Antes de implementar features, leer siempre `docs/ARCHITECTURE.md`.
- **Supabase GRANTs (deadline Oct 30, 2026):** toda migración SQL que cree tabla nueva en `public` debe incluir GRANTs explícitos + RLS, o fallará vía supabase-js. Patrón obligatorio:
  ```sql
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabla> TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabla> TO service_role;
  ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;
  ```
  Migración de referencia: `migrations/add_explicit_grants.sql`. Schema actualizado: `docs/schema/supabase-schema.sql`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

---

## AGLAYA · Flota — el capitán

Este repo es una **nave de la flota AGLAYA** — el riel de comandas de los humanos (Ibai y Món). Existe un orquestador (el «capitán», repo `aglaya-orchestrator` en `/Users/AGLAYA/Local Sites/aglaya-orchestrator`) cuyo atlas es la fuente de verdad **de flota**: registro de contratos inter-nave (`atlas/contratos/README.md` — incluido el **contrato captain→kanban de inyección de cards**), fichas por nave (`atlas/repos/aglaya-kanban/`), tablero global (`atlas/tablero.md`) y las reglas de ruteo de cards (`atlas/kanban-manual.md`).

Reglas para cualquier hilo que trabaje aquí:
- **Antes de un cambio estructural** (schema de cards, tools del MCP `aglaya-kanban-desk`, workspaces/boards), consulta el registro de contratos del atlas — el capitán inyecta cards por ese contrato.
- **El capitán puede haber tocado docs de este repo**: sus commits van identificados y se registran en `docs/CHANGELOG.md`.
- Los 3 miembros (Ibai, Món, capitán) son los únicos usuarios — la purga de 2026-07 es deliberada; no re-invites a nadie sin OK de Ibai.


**Consulta al capitán EN VIVO:** MCP **`aglaya-atlas`** (disponible en toda sesión de Claude de esta máquina) — `flota_estado` · `ficha(nave)` · `contrato(nombre)` · `quien_consume` · `verdad_comercial` · `parked` · `buscar`. Responde leyendo el atlas en vivo y citando fuente. Ya no hace falta esperar un brief del capitán: pregúntale.

**Último pase del capitán: 2026-07-17** — re-verificación 7/7 (kosher v1.4.0 del 13-jul intacto): MCP vivo (probado: 3 workspaces / 12 boards / 3 miembros), grafo 760 @ HEAD (fantasmas 0), selladas las modernizaciones de config de graphify 0.9.13 que estaban sin commitear (esenciales estándar + hooks `hook-guard`), huella colocada.
