"""AGLAYA Kanban Desk — MCP rail (stdio) for the captain / orchestrator.

Lets an orchestrator OPERATE the kanban — build structure, pin cards (comandas)
and assign owners — WITHOUT touching the UI and WITHOUT ever seeing secrets.

DESIGN (auth = option A, JWT service account):
  The rail logs in ONCE as a dedicated superadmin SERVICE ACCOUNT and drives the
  EXISTING production API (/api/workspaces, /api/boards, /api/columns, /api/cards,
  /api/admin/users). Zero product-code change; every WRITE inherits the server's
  validation, role checks, RLS AND its notification side-effects. "God Mode" is
  ROLE-based (server/middleware/workspace.js:77 → role === 'superadmin').

  A few READS the API doesn't expose (column→board derivation, a card's checklist)
  go through Supabase PostgREST with the service_role key. Writes never do.

CREDENTIALS (server-side; the captain never sees them). Resolved from env vars OR
the secret file ~/.config/aglaya/kanban-rail.env (chmod 600):
  KANBAN_API_URL, KANBAN_RAIL_EMAIL, KANBAN_RAIL_PASSWORD  (API login)
  KANBAN_SUPABASE_URL, KANBAN_SERVICE_ROLE_KEY             (PostgREST reads)

NOTIFICATIONS: assigning an owner goes through the API's updateCard (PUT), which
fires the EXISTING in-app notifications (table `notifications`, types
`card_assignment` for a card owner and `checklist_mention` for a checklist item).

SAFETY: destructive tools (delete_*, clear_workspace, remove_member) are GATED —
they refuse unless confirm=true and first report what WOULD change. Always test on
a TEST workspace before real data.
"""

from __future__ import annotations

import os
import re
import secrets
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

from validation import (VALID_PRIORITIES, cards_listing_plan, empty_brief_notice,
                        missing_assignee_error, missing_workspace_error,
                        priority_error, resolve_brief, row_cap_notice,
                        workspace_mismatch_error)

mcp = FastMCP("aglaya-kanban-desk")

_ROW_CAP = 500
_TIMEOUT = 30.0
_SECRET_FILE = os.path.expanduser("~/.config/aglaya/kanban-rail.env")
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

_token: str | None = None  # cached access JWT (15-min TTL); re-login on 401


# ---------------------------------------------------------------------------
# Config / credentials (env first, then chmod-600 secret file)
# ---------------------------------------------------------------------------
def _cfg(key: str, default: str | None = None) -> str | None:
    val = os.environ.get(key)
    if val:
        return val
    if os.path.exists(_SECRET_FILE):
        with open(_SECRET_FILE, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return default


def _api_base() -> str:
    return (_cfg("KANBAN_API_URL") or "https://kanban.aglaya.biz/api").rstrip("/")


def _creds() -> tuple[str, str]:
    email, password = _cfg("KANBAN_RAIL_EMAIL"), _cfg("KANBAN_RAIL_PASSWORD")
    if not email or not password:
        raise RuntimeError(
            "Missing KANBAN_RAIL_EMAIL / KANBAN_RAIL_PASSWORD (env or "
            "~/.config/aglaya/kanban-rail.env). See README.md."
        )
    return email, password


# ---------------------------------------------------------------------------
# HTTP core — API login + authed request (one transparent re-login on 401)
# ---------------------------------------------------------------------------
def _err(r: httpx.Response) -> str:
    try:
        return r.json().get("error") or r.text[:200]
    except Exception:
        return r.text[:200]


def _login() -> str:
    global _token
    email, password = _creds()
    with httpx.Client(timeout=_TIMEOUT) as c:
        r = c.post(f"{_api_base()}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        raise RuntimeError(f"login failed ({r.status_code}): {_err(r)}")
    _token = r.json().get("token")
    if not _token:
        raise RuntimeError("login ok but no token in response")
    return _token


def _request(method: str, path: str, json: dict | None = None, _retry: bool = True) -> Any:
    global _token
    if _token is None:
        _login()
    with httpx.Client(timeout=_TIMEOUT) as c:
        r = c.request(method, f"{_api_base()}{path}", json=json,
                      headers={"Authorization": f"Bearer {_token}"})
    if r.status_code == 401 and _retry:
        _login()
        return _request(method, path, json=json, _retry=False)
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {path} → {r.status_code}: {_err(r)}")
    if not r.content:
        return None
    body = r.json()
    return body.get("data", body) if isinstance(body, dict) else body


# ---------------------------------------------------------------------------
# PostgREST reads (service_role) — only for what the API doesn't expose
# ---------------------------------------------------------------------------
def _pg_get(table: str, query: str) -> list[dict[str, Any]]:
    base, key = _cfg("KANBAN_SUPABASE_URL"), _cfg("KANBAN_SERVICE_ROLE_KEY")
    if not base or not key:
        raise RuntimeError("Missing KANBAN_SUPABASE_URL / KANBAN_SERVICE_ROLE_KEY for reads.")
    url = f"{base.rstrip('/')}/rest/v1/{table}?{query}"
    with httpx.Client(timeout=_TIMEOUT) as c:
        r = c.get(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    if r.status_code >= 400:
        raise RuntimeError(f"pg_get {table} → {r.status_code}: {r.text[:200]}")
    return r.json()


def _board_of_column(column_id: str) -> str:
    rows = _pg_get("columns", f"id=eq.{column_id}&select=board_id")
    if not rows:
        raise RuntimeError(f"column {column_id} not found (cannot derive board_id)")
    return rows[0]["board_id"]


def _workspace_of_board(board_id: str) -> str | None:
    """Espacio real al que pertenece un tablero. `None` si no se puede leer —
    el llamante NO debe dar por bueno un destino que no se pudo comprobar."""
    rows = _pg_get("boards", f"id=eq.{board_id}&select=workspace_id")
    return rows[0]["workspace_id"] if rows else None


def _resolve_user(user: str) -> str:
    """Map an email / name / uuid to a user id. Prefers exact email match."""
    u = (user or "").strip()
    if _UUID_RE.match(u):
        return u
    users = _request("GET", "/admin/users") or []
    ul = u.lower()
    for row in users:
        if (row.get("email") or "").lower() == ul:
            return row["id"]
    named = [row for row in users if (row.get("name") or "").lower() == ul]
    if len(named) == 1:
        return named[0]["id"]
    if len(named) > 1:
        raise RuntimeError(f"ambiguous user '{user}' (multiple names match) — pass the email or id")
    raise RuntimeError(f"user '{user}' not found — pass an exact email, name, or id")


# ---------------------------------------------------------------------------
# READ
# ---------------------------------------------------------------------------
@mcp.tool()
def list_workspaces() -> dict[str, Any]:
    """List the workspaces the rail is a MEMBER of — NOT every workspace that exists.

    `GET /workspaces` parte de `workspace_members` filtrando por `user_id`
    (server/routes/workspaces.js). Ser superadmin no concede nada en esa ruta:
    el rol no es membresía, y esta lista puede ser un subconjunto de la tabla.

    Esta tool NO puede contestar "¿existe un workspace llamado X?". Para eso el
    custodio es la DB vía `service_role`, que salta RLS — que es justamente lo
    que usa `POST /api/internal/create-card`. Preguntar aquí y concluir que algo
    no existe es preguntarle al custodio equivocado.

    CONSECUENCIA OPERATIVA: el alcance del riel se mantiene A MANO. Si se crea un
    workspace y no se añade a `kanban-rail@aglaya.biz` como miembro, el riel se
    queda ciego a él EN SILENCIO — no hay error de permiso, simplemente no sale en
    la lista y ninguna nave de la flota puede dejar cards ahí.

    Each: id, name, emoji, type, boards, members."""
    rows = _request("GET", "/workspaces") or []
    items = [{"id": w["id"], "name": w["name"], "emoji": w.get("emoji"), "type": w.get("type"),
              "boards": w.get("boardCount"), "members": w.get("memberCount")} for w in rows[:_ROW_CAP]]
    return {"count": len(items), "workspaces": items}


@mcp.tool()
def list_boards(workspace_id: str) -> dict[str, Any]:
    """List boards inside a workspace. Each: id, name (title), order."""
    rows = _request("GET", f"/workspaces/{workspace_id}/boards") or []
    items = [{"id": b["id"], "name": b.get("title") or b.get("name"), "order": b.get("order")}
             for b in rows[:_ROW_CAP]]
    return {"workspace_id": workspace_id, "count": len(items), "boards": items}


@mcp.tool()
def list_columns(board_id: str) -> dict[str, Any]:
    """List columns of a board, in order. New boards auto-get: Backlog,
    Prioridades, En curso, Bloqueado, Hecho."""
    rows = _request("GET", f"/boards/{board_id}/columns") or []
    items = [{"id": c["id"], "name": c.get("title") or c.get("name"), "order": c.get("order")}
             for c in rows[:_ROW_CAP]]
    return {"board_id": board_id, "count": len(items), "columns": items}


@mcp.tool()
def list_cards(board_id: str | None = None, column_id: str | None = None) -> dict[str, Any]:
    """List cards. `column_id` returns ONLY that column's cards; `board_id`
    returns the whole board. If both are given, the column wins (narrower).

    It did not use to. `column_id` was used only to derive the board and then
    thrown away, so asking for one column and asking for an empty one returned
    the same answer byte for byte: the entire board. A scope answering for
    another, with a superset that looks right — the same shape this house
    already documents for `list_workspaces`. It matters because the work
    protocol starts all four roles with "take from such-and-such column".

    The response says which scope answered, so a caller can tell."""
    plan = cards_listing_plan(board_id, column_id)
    if "error" in plan:
        return plan

    rows = _request("GET", plan["path"]) or []
    # `description` va incluida: quien escribe por el riel tiene que poder LEER
    # lo que escribió. Sin esto, verificar que un brief entró de verdad obligaba
    # a crear una tarjeta de prueba y pedirle a un humano que la abriera.
    items = [{"id": c["id"], "title": c.get("title"),
              "description": c.get("description") or "",
              "column_id": c.get("columnId") or c.get("column_id"),
              "assignee_id": c.get("assigneeId") or c.get("assignee_id"),
              "priority": c.get("priority"), "order": c.get("order"),
              "due_date": c.get("dueDate") or c.get("due_date")} for c in rows[:_ROW_CAP]]

    out: dict[str, Any] = {"scope": plan["scope"], "board_id": plan["board_id"],
                           "column_id": plan["column_id"], "count": len(items),
                           "cards": items}
    # El tope existía y recortaba callando. Un conteo recortado sin avisar es un
    # conteo que miente: quien lea `count` creerá que eso es todo lo que hay.
    notice = row_cap_notice(len(rows), _ROW_CAP)
    if notice:
        out["warning"] = notice
    return out


# ---------------------------------------------------------------------------
# STRUCTURE
# ---------------------------------------------------------------------------
@mcp.tool()
def create_workspace(name: str, type: str = "interno") -> dict[str, Any]:
    """Create a workspace. type ∈ personal|interno|externo (default interno).
    The rail becomes owner."""
    if type not in ("personal", "interno", "externo"):
        return {"error": "type must be personal | interno | externo"}
    ws = _request("POST", "/workspaces", {"name": name, "type": type})
    return {"created": "workspace", "id": ws["id"], "name": ws["name"], "type": ws.get("type")}


@mcp.tool()
def create_board(workspace_id: str, name: str) -> dict[str, Any]:
    """Create a board in a workspace. Auto-seeds default columns."""
    b = _request("POST", "/boards", {"title": name, "workspaceId": workspace_id})
    return {"created": "board", "id": b["id"], "name": b.get("title") or b.get("name"),
            "workspace_id": workspace_id}


@mcp.tool()
def create_column(board_id: str, name: str, order: int | None = None) -> dict[str, Any]:
    """Add a column to a board (appended). If `order` is given, reposition to it."""
    col = _request("POST", f"/boards/{board_id}/columns", {"title": name})
    if order is not None:
        _request("PUT", f"/columns/{col['id']}", {"order": order})
        col["order"] = order
    return {"created": "column", "id": col["id"], "name": col.get("title") or col.get("name"),
            "board_id": board_id, "order": col.get("order")}


# ---------------------------------------------------------------------------
# COMANDA — pin a card; the BRIEF goes in description_md (markdown)
# ---------------------------------------------------------------------------
@mcp.tool()
def create_card(
    column_id: str,
    title: str,
    description_md: str = "",
    priority: str | None = None,
    checklist: list[str] | None = None,
    due_date: str | None = None,
    assignee: str | None = None,
    board_id: str | None = None,
    workspace_id: str | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    """Pin a card (comanda) in a column. `workspace_id` is REQUIRED and is
    VALIDATED against the column: if the column does not belong to that space,
    nothing is written.

    ROUTING RULE (summary — the manual is the custodian, not this docstring):
    the destination space is the one owning the ARTEFACT to be touched, and a
    task lives in ONE space only, never mirrored. For the full rule, ASK — do
    not follow a path: `donde_pregunto("tarea")` in the `aglaya-atlas` MCP
    (repo `aglaya-orchestrator`) resolves to the live manual and cites it. A
    typed-out atlas path expires silently when the captain reorganises; the
    repo name and the question do not. Live IDs: `list_workspaces` here.

    `priority` and `assignee` are BOTH REQUIRED: a card missing either is
    invisible to the work system — nobody picks it up and it does not fail, it
    just ages in the backlog looking like pending work. The contract is the
    custodian of when and why (`docs/contracts/CONTRACT.md`).

    `board_id` is OPTIONAL — derived from `column_id` if omitted. The BRIEF goes
    in `description_md` (markdown); `description` is an alias for the same field.
    priority ∈ urgent|high|medium|low|none. `checklist` = list of item texts.
    `due_date` = ISO (YYYY-MM-DD). `assignee` = email/name/id → owner AND notified."""
    # Todo lo que se puede juzgar sin red se juzga antes de tocarla. El destino se
    # comprueba DESPUÉS de derivar el tablero porque necesita leerlo; exigirlo sin
    # validarlo daría sensación de control sin control — la misma forma que el
    # default que mandaba cards al espacio personal devolviendo 201.
    for err in (priority_error(priority),
                missing_assignee_error(assignee),
                missing_workspace_error(workspace_id)):
        if err:
            return err
    if not board_id:
        board_id = _board_of_column(column_id)
    err = workspace_mismatch_error(workspace_id, _workspace_of_board(board_id), column_id)
    if err:
        return err

    # El responsable se resuelve ANTES de crear. Si se dejara para después —que es
    # donde estaba— un assignee que no resuelve dejaba la tarjeta ya escrita y sin
    # dueño: exactamente la tarjeta invisible que este campo existe para impedir,
    # creada por el propio guardián.
    try:
        assignee_id = _resolve_user(assignee)
    except RuntimeError as exc:
        return {"error": f"assignee no resuelve: {exc}. No se ha creado nada."}

    brief = resolve_brief(description, description_md)
    body: dict[str, Any] = {"columnId": column_id, "boardId": board_id, "title": title,
                            "description": brief, "priority": str(priority).strip()}
    if checklist:
        body["checklist"] = [{"id": secrets.token_hex(6), "text": str(t), "done": False, "assignees": []}
                             for t in checklist]
    if due_date:
        body["dueDate"] = due_date
    card = _request("POST", "/cards", body)
    out = {"created": "card", "id": card["id"], "title": card.get("title"),
           "board_id": board_id, "column_id": column_id, "priority": card.get("priority")}
    # Una tarjeta sin contenido se creó igual, pero deja de parecerse a una que
    # salió bien. Es lo único que distingue el 201 honesto del 201 que miente.
    notice = empty_brief_notice(brief)
    if notice:
        out["warning"] = notice
    # Se asigna por el PUT, no por el POST, porque es el update el que dispara la
    # notificación in-app. El id ya está resuelto arriba: llamar a `assign_card`
    # aquí volvería a pedir la lista de usuarios para averiguar lo que ya sabemos.
    _request("PUT", f"/cards/{card['id']}", {"assigneeId": assignee_id})
    out["assignee_id"] = assignee_id
    out["assigned"] = assignee
    return out


# ---------------------------------------------------------------------------
# ASSIGN (fires the existing in-app notifications via updateCard)
# ---------------------------------------------------------------------------
@mcp.tool()
def assign_card(card_id: str, user: str) -> dict[str, Any]:
    """Set the OWNER of a card (email/name/id). Goes through the API's update →
    fires the in-app `card_assignment` notification for that user."""
    uid = _resolve_user(user)
    _request("PUT", f"/cards/{card_id}", {"assigneeId": uid})
    return {"assigned": "card", "card_id": card_id, "assignee_id": uid, "notified": user}


@mcp.tool()
def assign_checklist_item(card_id: str, item: str, user: str) -> dict[str, Any]:
    """Assign a checklist ITEM to a user. `item` = the item's 0-based index (as a
    string, e.g. "0") or a substring of its text. `user` = email/name/id, or
    "all" for every member. Fires the in-app `checklist_mention` notification."""
    uid = "__all__" if user.strip().lower() in ("all", "todos", "__all__") else _resolve_user(user)
    card = _pg_get("cards", f"id=eq.{card_id}&select=checklist")
    if not card:
        return {"error": f"card {card_id} not found"}
    checklist = card[0].get("checklist") or []
    if not checklist:
        return {"error": "card has no checklist items"}

    idx: int | None = None
    if item.strip().lstrip("-").isdigit():
        i = int(item)
        if 0 <= i < len(checklist):
            idx = i
    if idx is None:
        matches = [i for i, it in enumerate(checklist) if item.lower() in (it.get("text") or "").lower()]
        if len(matches) == 1:
            idx = matches[0]
        elif len(matches) > 1:
            return {"error": f"'{item}' matches {len(matches)} items — pass the index"}
    if idx is None:
        return {"error": f"no checklist item matches '{item}'"}

    assignees = checklist[idx].get("assignees") or []
    if uid not in assignees:
        assignees.append(uid)
    checklist[idx]["assignees"] = assignees
    _request("PUT", f"/cards/{card_id}", {"checklist": checklist})
    return {"assigned": "checklist_item", "card_id": card_id, "item_index": idx,
            "item_text": checklist[idx].get("text"), "assignee_id": uid, "notified": user}


# ---------------------------------------------------------------------------
# FLOW
# ---------------------------------------------------------------------------
@mcp.tool()
def move_card(card_id: str, column_id: str, order: int | None = None) -> dict[str, Any]:
    """Move a card to a column. Appends unless `order` is given."""
    if order is None:
        order = len(_request("GET", f"/columns/{column_id}/cards") or [])
    _request("PUT", f"/cards/{card_id}/move", {"columnId": column_id, "order": order})
    return {"moved": "card", "id": card_id, "to_column": column_id, "order": order}


@mcp.tool()
def update_card(
    card_id: str,
    title: str | None = None,
    description: str | None = None,
    priority: str | None = None,
    due_date: str | None = None,
) -> dict[str, Any]:
    """Edit an EXISTING card's fields, without deleting and re-creating it.
    Only the fields you pass change; the rest are left as they are. Use this to
    fix a card whose brief (`description`) came out empty, or to retitle,
    re-prioritise or set a due date.

    `description` is the markdown brief. priority ∈ urgent|high|medium|low|none.
    `due_date` = ISO (YYYY-MM-DD). Wraps PUT /api/cards/:id (server/routes/cards.js
    → updateCard), which is the same endpoint the UI uses."""
    # Aquí `priority` SÍ es opcional —no pasarla significa «no la cambies», que es
    # distinto de crearla sin decidirla—, así que no vale `priority_error`: esa
    # exige presencia. Lo que sí se comparte es la LISTA, para que las dos puertas
    # no puedan divergir en qué valores aceptan.
    if priority is not None and str(priority).strip() not in VALID_PRIORITIES:
        return {"error": f"priority must be {'|'.join(VALID_PRIORITIES)}"}
    body: dict[str, Any] = {}
    if title is not None:       body["title"] = title
    if description is not None: body["description"] = description
    if priority is not None:    body["priority"] = priority
    if due_date is not None:    body["dueDate"] = due_date
    if not body:
        return {"error": "nothing to update — pass at least one of title|description|priority|due_date"}
    card = _request("PUT", f"/cards/{card_id}", body)
    return {"updated": "card", "id": card_id, "fields": list(body.keys()),
            "title": (card or {}).get("title")}


@mcp.tool()
def card_history(card_id: str) -> dict[str, Any]:
    """PREVIOUS versions of a card's description, newest first — the undo.

    `update_card` REPLACES the description; it cannot append. A caller that does
    not read before writing destroys what was there and gets success back. That
    happened on 2026-08-06 and was recovered only by luck. Since then the server
    stores the previous text on every change, and this is how you reach it.

    TO UNDO: read the version you want from here and send it back with
    `update_card(card_id, description=…)`. There is no separate restore call on
    purpose — restoring IS an edit, and it must leave its own history entry like
    any other.

    Only covers changes made through the API (the UI and this rail). A write made
    straight to the database does not pass through it."""
    rows = _request("GET", f"/cards/{card_id}/history") or []
    return {"card_id": card_id, "count": len(rows), "versions": rows}


@mcp.tool()
def update_board(board_id: str, title: str) -> dict[str, Any]:
    """RENAME a board, keeping its columns and cards. Wraps PUT /api/boards/:id.

    Until this existed, the only way to rename a board through the rail was
    `delete_board` + recreate — which drags every card in it. That is not a
    rename, it is data loss under another name.

    Moving a board BETWEEN workspaces is deliberately NOT exposed here: it
    changes who can see the work. Do that in the UI, where it is confirmed."""
    if not title or not title.strip():
        return {"error": "title es obligatorio para renombrar"}
    board = _request("PUT", f"/boards/{board_id}", {"title": title.strip()})
    return {"updated": "board", "id": board_id,
            "title": (board or {}).get("title") or title.strip()}


@mcp.tool()
def update_workspace(
    workspace_id: str,
    name: str | None = None,
    emoji: str | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    """RENAME / retouch a workspace (name, emoji, description). Wraps
    PATCH /api/workspaces/:id. Requires owner or admin on that workspace.

    `type` is deliberately NOT exposed. Flipping a workspace interno → externo
    makes it visible to `cliente` accounts: that is a VISIBILITY decision, not a
    rename, and in practice it is not reversible once someone has seen it. The
    UI asks for confirmation before doing it; a rail call would not. Change the
    type in the UI, on purpose, or not at all."""
    body: dict[str, Any] = {}
    if name is not None:        body["name"] = name
    if emoji is not None:       body["emoji"] = emoji
    if description is not None: body["description"] = description
    if not body:
        return {"error": "nothing to update — pass at least one of name|emoji|description"}
    ws = _request("PATCH", f"/workspaces/{workspace_id}", body)
    return {"updated": "workspace", "id": workspace_id, "fields": list(body.keys()),
            "name": (ws or {}).get("name")}


# ---------------------------------------------------------------------------
# MEMBERS (audit membership from outside)
# ---------------------------------------------------------------------------
@mcp.tool()
def list_members(workspace_id: str) -> dict[str, Any]:
    """List members of a workspace. Each: user_id, name, email, role."""
    rows = _request("GET", f"/workspaces/{workspace_id}/members") or []
    items = [{"user_id": (m.get("user") or {}).get("id"), "name": (m.get("user") or {}).get("name"),
              "email": (m.get("user") or {}).get("email"), "role": m.get("role")} for m in rows]
    return {"workspace_id": workspace_id, "count": len(items), "members": items}


# ---------------------------------------------------------------------------
# DESTRUCTIVE — GATED (require confirm=True; report the target first)
# ---------------------------------------------------------------------------
def _gate(kind: str, target: dict[str, Any]) -> dict[str, Any]:
    return {"requires_confirmation": True, "action": kind, "target": target,
            "hint": "Irreversible. Re-call the same tool with confirm=true to proceed."}


@mcp.tool()
def remove_member(workspace_id: str, user: str, confirm: bool = False) -> dict[str, Any]:
    """Remove a user from a workspace (membership only — does NOT delete the
    account). GATED — pass confirm=true. `user` = email/name/id."""
    uid = _resolve_user(user)
    if not confirm:
        return _gate("remove_member", {"workspace_id": workspace_id, "user": user, "user_id": uid})
    _request("DELETE", f"/workspaces/{workspace_id}/members/{uid}")
    return {"removed": "member", "workspace_id": workspace_id, "user_id": uid}


@mcp.tool()
def delete_card(card_id: str, board_id: str | None = None, confirm: bool = False) -> dict[str, Any]:
    """Delete a card. GATED — pass confirm=true."""
    if not confirm:
        return _gate("delete_card", {"card_id": card_id})
    _request("DELETE", f"/cards/{card_id}", {"boardId": board_id} if board_id else None)
    return {"deleted": "card", "id": card_id}


@mcp.tool()
def delete_board(board_id: str, confirm: bool = False) -> dict[str, Any]:
    """Delete a board (cascades its columns + cards). GATED — pass confirm=true."""
    if not confirm:
        cards = _request("GET", f"/boards/{board_id}/cards") or []
        return _gate("delete_board", {"board_id": board_id, "cards_that_would_be_deleted": len(cards)})
    _request("DELETE", f"/boards/{board_id}")
    return {"deleted": "board", "id": board_id}


@mcp.tool()
def delete_workspace(workspace_id: str, confirm: bool = False) -> dict[str, Any]:
    """Delete a workspace and everything in it. GATED — pass confirm=true."""
    if not confirm:
        boards = _request("GET", f"/workspaces/{workspace_id}/boards") or []
        return _gate("delete_workspace",
                     {"workspace_id": workspace_id, "boards_that_would_be_deleted": len(boards)})
    _request("DELETE", f"/workspaces/{workspace_id}")
    return {"deleted": "workspace", "id": workspace_id}


@mcp.tool()
def clear_workspace(workspace_id: str, confirm: bool = False) -> dict[str, Any]:
    """Remove ALL boards from a workspace (keeps the workspace). GATED."""
    boards = _request("GET", f"/workspaces/{workspace_id}/boards") or []
    if not confirm:
        return _gate("clear_workspace",
                     {"workspace_id": workspace_id, "boards_that_would_be_deleted": len(boards)})
    removed = []
    for b in boards:
        _request("DELETE", f"/boards/{b['id']}")
        removed.append(b["id"])
    return {"cleared": "workspace", "id": workspace_id, "boards_removed": removed, "count": len(removed)}


if __name__ == "__main__":
    mcp.run()
