# kanban-mcp — el riel del capitán

Servidor MCP (stdio) que deja al **orquestador OPERAR** AGLAYA Kanban Desk —
crear estructura y clavar comandas — **sin tocar la UI ni ver secretos**.

## Cómo funciona (auth = opción A)

El riel hace **login una vez** como una **cuenta de servicio superadmin dedicada**
y conduce la **API de producción ya existente** (`/api/workspaces`, `/api/boards`,
`/api/columns`, `/api/cards`). **Cero código de producto**: cada llamada hereda la
validación, los checks de rol y RLS del servidor. El "Modo Dios" es por rol
(`server/middleware/workspace.js:77` → `role === 'superadmin'`), así que la cuenta
de servicio puede operar cualquier workspace.

**Por qué A y no B** (extender la API interna secret-authed): A no toca código de
producto → sin deploy, sin riesgo sobre la app en producción, y reutiliza la API ya
probada. B era más coherente con la "puerta secreta" pero exigía endpoints nuevos +
tests + deploy sobre una app en producción — coste sin beneficio funcional (A ya
cubre todo el CRUD, `clear_workspace` incluido, como composición de deletes).

## Credenciales (server-side; el capitán nunca las ve)

Se resuelven desde **variables de entorno** o desde el **fichero secreto**
`~/.config/aglaya/kanban-rail.env` (`chmod 600`). `claude mcp add` **no lleva
credenciales**. Nunca se loguean, nunca se commitean.

```bash
mkdir -p ~/.config/aglaya
cat > ~/.config/aglaya/kanban-rail.env <<'EOF'
KANBAN_API_URL=https://kanban.aglaya.biz/api
KANBAN_RAIL_EMAIL=kanban-rail@aglaya.biz
KANBAN_RAIL_PASSWORD=<password de la cuenta de servicio>
EOF
chmod 600 ~/.config/aglaya/kanban-rail.env
```

## Instalación

```bash
cd kanban-mcp
python3 -m venv .venv
.venv/bin/pip install -e .
```

## Registro en Claude (`.mcp.json`)

A nivel usuario:

```bash
claude mcp add aglaya-kanban-desk -- /ruta/a/kanban-mcp/.venv/bin/python /ruta/a/kanban-mcp/server.py
```

o en un `.mcp.json` de proyecto:

```json
{
  "mcpServers": {
    "aglaya-kanban-desk": {
      "command": "/ruta/a/kanban-mcp/.venv/bin/python",
      "args": ["/ruta/a/kanban-mcp/server.py"]
    }
  }
}
```

(Sin credenciales en el registro — se leen del fichero secreto o del env.)

## Tools

| Grupo | Tool | Notas |
|-------|------|-------|
| Lectura | `list_workspaces` · `list_boards(ws)` · `list_columns(board)` · `list_cards(board?,column?)` · `list_members(ws)` | `list_cards` acepta `board_id` **o** `column_id` (deriva el board) |
| Estructura | `create_workspace(name,type)` · `create_board(ws,name)` · `create_column(board,name,order?)` | board auto-siembra columnas por defecto |
| Comanda | `create_card(column,title,description_md,priority,assignee,checklist[],due_date,board_id?)` | el BRIEF va en `description_md`; **`board_id` OPCIONAL** (se deriva de `column`); **`priority` y `assignee` OBLIGATORIOS** — sin ellos la tarjeta no la coge nadie y no falla, envejece pareciendo pendiente; `assignee` fija responsable **y notifica** |
| Asignar | `assign_card(card_id,user)` · `assign_checklist_item(card_id,item,user)` | `user` = email/nombre/id; `item` = índice o texto; **dispara notificación in-app** |
| Flujo | `move_card(card_id,column,order?)` | append por defecto |
| Destructivas 🔒 | `delete_card` · `delete_board` · `delete_workspace` · `clear_workspace` · `remove_member(ws,user)` | **GATED: exigen `confirm=true`**; `remove_member` quita membresía (no borra la cuenta) |

`priority ∈ urgent|high|medium|low|none`. `type ∈ personal|interno|externo`.

## Notificaciones

Asignar responsable (card o ítem de checklist) pasa por el `update` de la API,
que dispara las **notificaciones in-app existentes** (tabla `notifications`,
tipos `card_assignment` y `checklist_mention`). El asignado las ve en la campana.

## Seguridad

- Cuenta de **servicio dedicada** (no el login personal de Ibai) → revocable sin afectar a nadie.
- Destructivas **gated** por `confirm=true` (doble llamada).
- **Procedimiento:** probar SIEMPRE en un workspace de TEST antes de tocar datos reales.
- Secretos **solo** en env / fichero `chmod 600`; nunca en el código versionado ni en logs.
