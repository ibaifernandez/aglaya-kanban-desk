# CLAUDE.md — AGLAYA Kanban Desk

> Este archivo es leído automáticamente por Claude Code al inicio de cada sesión.

---

## Identidad del proyecto

- **Nombre del repo en disco y en GitHub**: `aglaya-kanban-desk`
- **Nombre de display**: AGLAYA Kanban Desk
- **¿Qué es?**: plataforma de gestión de proyectos de AGLAYA. Tres tipos de _workspaces_ —personal, interno y externo—. Soporta colaboradores y clientes (estos últimos, solo en _workspaces_ externos asignados).

Proyecto migrado desde prototipos anteriores y consolidado bajo marca AGLAYA.

El diseño de UI debe estar alineado bajo el Design System de AGLAYA (`aglaya-design-system`).

---

## Puertos exclusivos de este proyecto

**⚠️ No cambiar estos puertos nunca.**

| Servicio | Puerto |
|----------|--------|
| Server (Express) | **3003** |
| Client (Vite) | **5175** |

Los proyectos hermanos tienen los suyos, y **sus puertos los custodian ellos** — aquí
llegaron a estar copiados, que es estado de otro repo escrito en este y sin forma de
comprobarlo desde aquí. Si un puerto está ocupado al arrancar, investiga qué proceso
lo tiene antes de matarlo: eso protege igual y no caduca.

Los servidores se arrancan con:

```plaintext
preview_start → "AGLAYA Kanban Desk Server"   (puerto 3003)
preview_start → "AGLAYA Kanban Desk Client"   (puerto 5175)
```

El custodio del puerto es el **código**: `client/vite.config.js` y `server/index.js`.
`.claude/launch.json` debe repetirlo, y estos documentos también.

Todo lo de arriba es copia por comodidad, y la regla `PORTS` de
[`scripts/docs-guard.sh`](scripts/docs-guard.sh) la comprueba en CI: extrae el canon
del código, exige que `launch.json` coincida, y luego exige que **cada puerto citado
en `CLAUDE.md` y `README.md`** —tabla, prosa, `localhost:`, `PORT=`— esté en ese canon.
Si inventas uno, rojo.

Antes aquí ponía «no modificar launch.json sin actualizar este archivo»: una copia
documentando por escrito su propio procedimiento manual, que es una copia igual.

---

## Dónde vive el estado del proyecto

Este archivo describe **diseño y decisiones**. No describe estado: **el estado SIEMPRE se consulta**:

|       Pregunta        |        Custodio       |
|-----------------------|-----------------------|
| ¿En qué fase estamos? | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| ¿Qué hay en cola y con qué prioridad? | [`docs/BACKLOG.md`](docs/BACKLOG.md) |
| ¿Qué versión es esta? | `package.json` |
| ¿Cuántos tests hay y cuántos pasan? | `npm test` |
| ¿Qué corre en producción? | Railway |
| ¿Cómo es el schema? | [`docs/schema/supabase-schema.sql`](docs/schema/supabase-schema.sql) |
| ¿Qué cambió y cuándo? | [`docs/CHANGELOG.md`](docs/CHANGELOG.md) |

Lo vigila [`scripts/docs-guard.sh`](scripts/docs-guard.sh) en CI.

---

## Endpoint interno: cómo crear cards sin UI

`POST /api/internal/create-card` — autenticado con `x-task-secret` (ver `TASK_SECRET` en `.env`).

La URL de producción **no se escribe aquí**: la custodia Railway. Se consulta con
`servicios("aglaya-kanban-desk")` en el MCP `aglaya-atlas`, o se lee de
`$RAILWAY_SERVER_URL` en el entorno.

```bash
curl -s -X POST "$RAILWAY_SERVER_URL/api/internal/create-card" \
  -H "x-task-secret: $TASK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title":      "Título de la tarea",
    "boardName":  "Nombre del tablero",
    "priority":   "high",
    "assignee":   "kanban-rail@aglaya.biz",
    "workspaceName": "<nombre exacto del workspace destino>"
  }'
```

**La forma completa de la puerta —campos, obligatoriedad, códigos de error,
compuertas— la custodia [`docs/contracts/CONTRACT.md`](docs/contracts/CONTRACT.md).**
Aquí llegó a estar copiada entera, y una copia de un contrato es peor que la de
un dato: no diverge de golpe, diverge en un campo, y quien la lea creerá que
conoce el contrato.

Lo único que se repite aquí es lo que hace daño si no lo lees a tiempo:

- **`workspaceName` es obligatorio, sin default, a propósito.** Tuvo uno y
  apuntaba al workspace **personal** de Ibai, zona intocable: omitir el campo
  mandaba la card ahí devolviendo `201`. Un default que apunta a un sitio
  prohibido es peor que ninguno — un 400 avisa, un 201 miente.
- **No teclees nombres de memoria.** El match es parcial: un nombre viejo da 404
  aunque se lea perfectamente bien, o peor, engancha con otro y aterriza mal
  devolviendo `201`. Lístalos antes de clavar.
- **Y no le preguntes al riel si un workspace existe.** `list_workspaces` lista
  aquello de lo que el riel es **miembro**, no lo que hay en la tabla. Son dos
  alcances distintos y confundirlos costó un diagnóstico entero.
- **`assignee` y `priority` son obligatorios, y por el mismo motivo que
  `workspaceName`.** Una tarjeta a la que le falte cualquiera de los dos no la
  coge nadie — y **no falla**: envejece pareciendo trabajo pendiente. Es peor que
  aterrizar mal, porque aterrizar mal se nota tarde y nacer invisible no se nota
  nunca. `priority` tuvo default `medium` y ya no lo tiene: quien creía no haber
  decidido, había decidido.

---

## Cómo entra trabajo desde otras naves de la flota

Dos puertas, con **alcance distinto**. Esa asimetría importa: probar una no dice nada
de la otra.

| Puerta | Quién puede usarla | Alcance | Direcciona por |
|---|---|---|---|
| MCP `aglaya-kanban-desk` | cualquier sesión de Claude **de esta máquina** (registrado en `~/.claude.json`, no en el repo) | solo los workspaces de los que el riel es **miembro** | UUID |
| `POST /api/internal/create-card` | quien tenga `TASK_SECRET` — también desde fuera de esta máquina | **todos** (usa `service_role`, salta RLS) | nombre |

Camino por MCP: `list_workspaces()` → `list_boards(workspace_id)` →
`list_columns(board_id)` → `create_card(column_id, title, description_md,
priority, assignee, …)`. **`priority` y `assignee` no son opcionales por ninguna
de las dos puertas** — sin ellos la tarjeta sería invisible para el sistema de
trabajo. Y asignar dispara la notificación in-app real: no es etiquetar.

⚠️ **El alcance del riel se mantiene a mano.** La cuenta `kanban-rail@aglaya.biz` es
superadmin **por rol**, pero `GET /workspaces` filtra por **membresía** y no mira el
rol (`server/routes/workspaces.js`). Consecuencia: **si creas un workspace y no añades
al riel como miembro, el riel se queda ciego a él en silencio** — no dará «no eres
miembro», simplemente ese workspace no aparecerá en la lista y ninguna nave podrá
dejar cards ahí. Al crear un workspace destinado a recibir comandas, añadir al riel.

Cómo se detecta eso sin depender de que alguien se acuerde está **diseñado y sin
implementar** en [`docs/BACKLOG.md`](docs/BACKLOG.md) («El punto ciego del riel»).
La pieza que hay que saber aquí: **el riel no puede contestar esta pregunta**. Sus
puntos ciegos no salen en su propia lista, por definición. Contesta la DB vía
`service_role` — el mismo alcance que usa `POST /api/internal/create-card`.

Quién es miembro de qué lo custodia la tabla `workspace_members`, no este archivo.

**Y a qué tablero va cada cosa, tampoco lo custodia este repo.** El criterio de
enrutado —qué trabajo entra como card y a qué workspace/tablero pertenece— lo custodia
el capitán. Se pregunta, no se cita: `donde_pregunto("enrutado de cards")` o
`ficha("aglaya-kanban-desk")` en el MCP `aglaya-atlas`, que contestan citando su fuente
en vivo. No apuntamos aquí la ruta de su atlas: la reorganiza cuando quiere y una ruta
copiada caduca en silencio. No lo adivines: el match es `ilike` parcial y un nombre
aproximado aterriza en el sitio equivocado devolviendo `201`.

---

## Acceso a Supabase desde Claude (DDL y queries directas)

`.env` (gitignored) contiene credenciales para que Claude ejecute migraciones y queries sin intervención manual:

- `SUPABASE_DATABASE_PASSWORD` — password del rol `postgres`. Habilita `psql`.
- `SUPABASE_PAT` — Personal Access Token. Habilita `supabase` CLI.

Patrón para aplicar DDL/migraciones:

```bash
set -a; source .env; set +a
export PGPASSWORD="$SUPABASE_DATABASE_PASSWORD"
# El host se DERIVA de SUPABASE_URL — no se teclea aquí. El custodio es .env / Supabase.
PGHOST="db.$(echo "$SUPABASE_URL" | sed -E 's#https?://([^.]+)\..*#\1#').supabase.co"
psql "postgresql://postgres@$PGHOST:5432/postgres" -f docs/schema/migration-<nombre>.sql
```

Para queries puntuales: `psql ... -c "SELECT ..."`.

Reglas:

- Toda migración va a `docs/schema/migration-<descripcion>.sql` con `ALTER TABLE ... IF NOT EXISTS` para idempotencia.
- Tras aplicar, actualizar `docs/schema/supabase-schema.sql` (fuente de verdad).
- No commitear `.env`. Verificar `.gitignore` antes de cualquier `git add`.

## Reglas críticas

- No matar procesos en puertos 3003/5175 sin verificar que son de AGLAYA Kanban Desk.
- No modificar `.claude/launch.json` sin actualizar este archivo.
- **La prioridad de una tarjeta se conserva al cerrarla.** Aquí decía lo contrario
  —«al mover a una columna de tipo hecho/entregado/completado, establecer
  `priority` a `"none"` automáticamente»— y esa regla **se retira**.

  Se borraba un dato para arreglar una vista, y la vista ya tenía arreglo sin
  pérdida: quien ordena por prioridad puede filtrar por columna, que es lo que
  hace [`server/services/digest/user.js`](server/services/digest/user.js). Una
  prioridad borrada no se recupera —no tiene historial— y **es la única señal de
  cuánto importaba** aquel trabajo, justo en la columna que lee quien audita: sin
  ella no se puede decir si lo cerrado fue lo urgente o lo cómodo.

  **Y lo que la retira no es esta línea: es una prueba.** El código nunca borró
  la prioridad —se comprobaron los cinco escritores— porque esta regla la
  ejecutaban **a mano las sesiones que leían este archivo**. La retirada la
  sostiene [`server/tests/move-card-preserva-prioridad.test.js`](server/tests/move-card-preserva-prioridad.test.js),
  que se pone roja si alguien vuelve a implementarla.

  `none` sigue siendo una prioridad válida. Lo que se retira es que se ponga sola.
- Idioma del código: inglés. Idioma de documentación, commits y las cards en sí mismas: español.
- Antes de implementar _features_, leer siempre `docs/ARCHITECTURE.md`.
- **Supabase GRANTs (deadline Oct 30, 2026):** toda migración SQL que cree tabla nueva en `public` debe **recortar primero y conceder después**, más RLS. Patrón obligatorio:

```sql
  -- 1. RECORTAR. Va PRIMERO, y no es simetría: este proyecto tiene DEFAULT
  --    PRIVILEGES en `public` que conceden a `anon` los OCHO privilegios sobre
  --    TODA tabla nueva. Cuando tu GRANT se ejecuta, lo que sobra YA está puesto.
  REVOKE ALL ON public.<tabla> FROM anon;

  -- 2. Conceder solo lo que hace falta. `anon` se queda en SELECT, que es lo que
  --    docs/schema/supabase-schema.sql declara para todas las tablas.
  GRANT SELECT ON public.<tabla> TO anon;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabla> TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabla> TO service_role;

  ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;
```

  **Por qué el paso 1 y por qué va primero.** Este patrón concedía sin recortar, y
  el 6-ago-2026 una tabla creada siguiéndolo al pie de la letra nació con siete
  privilegios para el rol anónimo mientras sus hermanas tenían uno. Nadie lo iba a
  ver: el esquema documentado decía una cosa y la base decía otra. Un `GRANT` no
  quita nada — solo añade.

  **Ocho, no siete, y ahí está la trampa:** `MAINTAIN` es un privilegio nuevo de
  PostgreSQL 17. `REVOKE ALL` sí lo quita —el patrón de arriba vale tal cual—
  pero **`information_schema` no lo lista**, porque solo expone los siete del
  estándar SQL. Se ve con `aclexplode(relacl)`.

  **Y ya no depende de que alguien se acuerde:** [`scripts/grants-guard.sh`](scripts/grants-guard.sh)
  corre en CI, le pregunta a la base y se pone rojo si alguna tabla de `public` da
  a `anon` más de lo que el esquema declara. Tiene su propio sello.

  ⚠️ **Pero hoy ese guardián lee `information_schema`, así que NO ve `MAINTAIN`.**
  Medido el 6-ago-2026: estaba en verde mientras `anon` lo tenía en diez tablas.
  Su verde no cubre ese privilegio hasta que lea `aclexplode`.

- Migración de referencia: `migrations/add_explicit_grants.sql`.
- Schema actualizado: `docs/schema/supabase-schema.sql`.

---

## AGLAYA · Flota — el capitán

Este _repo_ es una **nave de la flota AGLAYA**: el riel de comandas de los humanos (Ibai y Món). Existe un orquestador (a veces llamado «el capitán» en el _repo_ `aglaya-orchestrator`), que es el enrutador de Ibai para poder entender toda la flota AGLAYA desde un solo centro de control.

Reglas para cualquier hilo que trabaje aquí:

- **Antes de un cambio estructural** (schema de cards, tools del MCP `aglaya-kanban-desk`, workspaces/boards), pregunta el contrato con `contrato(nombre)` en el MCP `aglaya-atlas`: el capitán inyecta cards por ese contrato y un cambio unilateral lo rompe.
- **Si el capitán toca docs de este repo**, debería estar registrado en commits debidamente identificados y todos los cambios deberían quedar registrados en `docs/CHANGELOG.md`.
- **Solo estas tres cuentas están autorizadas**, mientras no cambie el paradigma de uso de esta aplicación: Ibai (`info@ibaifernandez.com`), Món (`mmontufarq@gmail.com`) y Kanban Rail (`kanban-rail@aglaya.biz`). No dar de alta a nadie sin OK de Ibai. Esto es una **decisión**, no un informe: dice quién *puede* existir. Quién existe de hecho lo custodia la tabla `users` — si no coinciden, el hallazgo es que hay que reconciliarlas, no que este archivo esté desactualizado.

**Al capitán se le pregunta, no se le cita.** MCP `aglaya-atlas`, disponible en toda sesión de Claude de esta máquina. Responde leyendo el atlas en vivo y citando fuente:

| Pregunta | Se contesta con | NUNCA con |
|---|---|---|
| ¿Qué es y qué NO es esta nave? | `ficha("aglaya-kanban-desk")` | lo que recuerde un doc |
| ¿Qué contrato me obliga? | `contrato(nombre)` | una copia pegada aquí |
| ¿Quién más consume esto? | `quien_consume(termino)` | suponerlo |
| ¿Precios, oferta, posicionamiento? | `verdad_comercial(tema)` | una cifra escrita en un repo |
| ¿Qué hay puesto en producción? | `flags` · `servicios` | este archivo |
| ¿Qué está mergeado de verdad? | `repo_estado` (mide por contenido) | el nombre de una rama |
| ¿Qué doctrina aplica y por qué? | `donde_pregunto("doctrina")` | intuición |
| ¿Queda estado escrito sobre mí? | `contradicciones("aglaya-kanban-desk")` | —|

El catálogo completo lo declara el propio servidor MCP. **Si esta tabla y las tools disponibles no coinciden, mandan las tools** — esta tabla enruta preguntas, no inventaría herramientas. Una lista de herramientas escrita a mano es un conteo disfrazado: esta sección llegó a nombrar siete cuando ya había el doble, y nadie lo notó porque las siete funcionaban.
