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
    (server/routes/workspaces.js). Ser superadmin no concede nada en esa ruta.
    Al 2026-07-21 el riel ve 3 de las 6 filas de la tabla.

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
    """List cards of a board. Pass `board_id`, OR pass `column_id` and the board
    is derived from it."""
    if not board_id:
        if not column_id:
            return {"error": "pass board_id or column_id"}
        board_id = _board_of_column(column_id)
    rows = _request("GET", f"/boards/{board_id}/cards") or []
    items = [{"id": c["id"], "title": c.get("title"),
              "column_id": c.get("columnId") or c.get("column_id"),
              "assignee_id": c.get("assigneeId") or c.get("assignee_id"),
              "priority": c.get("priority"), "order": c.get("order"),
              "due_date": c.get("dueDate") or c.get("due_date")} for c in rows[:_ROW_CAP]]
    return {"board_id": board_id, "count": len(items), "cards": items}


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
    priority: str = "medium",
    checklist: list[str] | None = None,
    due_date: str | None = None,
    assignee: str | None = None,
    board_id: str | None = None,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Pin a card (comanda) in a column. `board_id` is OPTIONAL — derived from
    `column_id` if omitted. The BRIEF goes in `description_md` (markdown).
    priority ∈ urgent|high|medium|low|none. `checklist` = list of item texts.
    `due_date` = ISO (YYYY-MM-DD). `assignee` = email/name/id → set as owner AND
    notified (in-app)."""
    if priority not in ("urgent", "high", "medium", "low", "none"):
        return {"error": "priority must be urgent|high|medium|low|none"}
    if not board_id:
        board_id = _board_of_column(column_id)
    body: dict[str, Any] = {"columnId": column_id, "boardId": board_id, "title": title,
                            "description": description_md or "", "priority": priority}
    if checklist:
        body["checklist"] = [{"id": secrets.token_hex(6), "text": str(t), "done": False, "assignees": []}
                             for t in checklist]
    if due_date:
        body["dueDate"] = due_date
    card = _request("POST", "/cards", body)
    out = {"created": "card", "id": card["id"], "title": card.get("title"),
           "board_id": board_id, "column_id": column_id, "priority": card.get("priority")}
    if assignee:
        out["assigned"] = assign_card(card["id"], assignee).get("notified")
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
