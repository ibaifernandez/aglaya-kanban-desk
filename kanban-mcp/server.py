"""AGLAYA Kanban Desk — MCP rail (stdio) for the captain / orchestrator.

Lets an orchestrator OPERATE the kanban — build structure and pin cards
(comandas) — WITHOUT touching the UI and WITHOUT ever seeing secrets.

DESIGN (auth = option A, JWT service account):
  The rail logs in ONCE as a dedicated superadmin SERVICE ACCOUNT and drives
  the EXISTING production API (/api/workspaces, /api/boards, /api/columns,
  /api/cards). Zero product-code change; every call inherits the server's
  validation, role checks and RLS. "God Mode" is ROLE-based
  (server/middleware/workspace.js:77 → role === 'superadmin'), so the service
  account can operate any workspace.

CREDENTIALS (server-side; the captain never sees them):
  Resolved from env vars OR the secret file ~/.config/aglaya/kanban-rail.env
  (chmod 600). `claude mcp add` carries NO credentials. Never logged, never
  committed. See README.md.

SAFETY:
  - Destructive tools (delete_*, clear_workspace) are GATED: they refuse unless
    called with confirm=true, and first report exactly what WOULD be removed.
  - Test procedure: always exercise the rail on a TEST workspace before real
    data. This module does not delete anything unless explicitly confirmed.

Response envelope from the API is {"data": ...} (or {"success":true,"data":...});
tools unwrap it and return compact dicts.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("aglaya-kanban-desk")

_ROW_CAP = 500
_TIMEOUT = 30.0
_SECRET_FILE = os.path.expanduser("~/.config/aglaya/kanban-rail.env")

# Cached access token (JWT, 15-min TTL server-side). Re-login on 401.
_token: str | None = None


# ---------------------------------------------------------------------------
# Credential + config resolution (env first, then chmod-600 secret file)
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
    email = _cfg("KANBAN_RAIL_EMAIL")
    password = _cfg("KANBAN_RAIL_PASSWORD")
    if not email or not password:
        raise RuntimeError(
            "Missing KANBAN_RAIL_EMAIL / KANBAN_RAIL_PASSWORD. Set them in the "
            "MCP env or in ~/.config/aglaya/kanban-rail.env (chmod 600). See README.md."
        )
    return email, password


# ---------------------------------------------------------------------------
# HTTP core — login + authed request with one transparent re-login on 401
# ---------------------------------------------------------------------------
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


def _err(r: httpx.Response) -> str:
    try:
        return r.json().get("error") or r.text[:200]
    except Exception:
        return r.text[:200]


def _request(method: str, path: str, json: dict | None = None, _retry: bool = True) -> Any:
    global _token
    if _token is None:
        _login()
    url = f"{_api_base()}{path}"
    with httpx.Client(timeout=_TIMEOUT) as c:
        r = c.request(method, url, json=json, headers={"Authorization": f"Bearer {_token}"})
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
# READ
# ---------------------------------------------------------------------------
@mcp.tool()
def list_workspaces() -> dict[str, Any]:
    """List every workspace the rail can see (all of them — the rail is
    superadmin). Each: id, name, emoji, type (personal|interno|externo),
    boardCount, memberCount."""
    rows = _request("GET", "/workspaces") or []
    items = [
        {"id": w["id"], "name": w["name"], "emoji": w.get("emoji"),
         "type": w.get("type"), "boards": w.get("boardCount"), "members": w.get("memberCount")}
        for w in rows[:_ROW_CAP]
    ]
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
    """List columns of a board, in order. Each: id, name (title), order.
    (New boards auto-get: Backlog, Prioridades, En curso, Bloqueado, Hecho.)"""
    rows = _request("GET", f"/boards/{board_id}/columns") or []
    items = [{"id": c["id"], "name": c.get("title") or c.get("name"), "order": c.get("order")}
             for c in rows[:_ROW_CAP]]
    return {"board_id": board_id, "count": len(items), "columns": items}


@mcp.tool()
def list_cards(board_id: str) -> dict[str, Any]:
    """List cards of a board. Each: id, title, column_id, priority, order,
    due_date."""
    rows = _request("GET", f"/boards/{board_id}/cards") or []
    items = [
        {"id": c["id"], "title": c.get("title"), "column_id": c.get("columnId") or c.get("column_id"),
         "priority": c.get("priority"), "order": c.get("order"), "due_date": c.get("dueDate") or c.get("due_date")}
        for c in rows[:_ROW_CAP]
    ]
    return {"board_id": board_id, "count": len(items), "cards": items}


# ---------------------------------------------------------------------------
# STRUCTURE
# ---------------------------------------------------------------------------
@mcp.tool()
def create_workspace(name: str, type: str = "interno") -> dict[str, Any]:
    """Create a workspace. type ∈ personal|interno|externo (default interno).
    The rail becomes owner. TIP: for testing, name it clearly (e.g.
    'TEST — rail')."""
    if type not in ("personal", "interno", "externo"):
        return {"error": "type must be personal | interno | externo"}
    ws = _request("POST", "/workspaces", {"name": name, "type": type})
    return {"created": "workspace", "id": ws["id"], "name": ws["name"], "type": ws.get("type")}


@mcp.tool()
def create_board(workspace_id: str, name: str) -> dict[str, Any]:
    """Create a board in a workspace. Auto-seeds default columns (Backlog,
    Prioridades, En curso, Bloqueado, Hecho)."""
    b = _request("POST", "/boards", {"title": name, "workspaceId": workspace_id})
    return {"created": "board", "id": b["id"], "name": b.get("title") or b.get("name"),
            "workspace_id": workspace_id}


@mcp.tool()
def create_column(board_id: str, name: str, order: int | None = None) -> dict[str, Any]:
    """Add a column to a board (appended). If `order` is given, the column is
    repositioned to that order afterwards."""
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
    board_id: str,
    column_id: str,
    title: str,
    description_md: str = "",
    priority: str = "medium",
    checklist: list[str] | None = None,
    due_date: str | None = None,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Pin a card (comanda). The BRIEF goes in `description_md` (markdown —
    rendered in the card). priority ∈ urgent|high|medium|low|none.
    `checklist` = list of item texts. `due_date` = ISO date (YYYY-MM-DD).
    `workspace_id` optional (context only; not required by the API)."""
    if priority not in ("urgent", "high", "medium", "low", "none"):
        return {"error": "priority must be urgent|high|medium|low|none"}
    body: dict[str, Any] = {
        "columnId": column_id,
        "boardId": board_id,
        "title": title,
        "description": description_md or "",
        "priority": priority,
    }
    if checklist:
        body["checklist"] = [{"text": str(t), "done": False, "assignees": []} for t in checklist]
    if due_date:
        body["dueDate"] = due_date
    card = _request("POST", "/cards", body)
    return {"created": "card", "id": card["id"], "title": card.get("title"),
            "board_id": board_id, "column_id": column_id, "priority": card.get("priority")}


# ---------------------------------------------------------------------------
# FLOW
# ---------------------------------------------------------------------------
@mcp.tool()
def move_card(card_id: str, column_id: str, order: int | None = None) -> dict[str, Any]:
    """Move a card to a column. Appends to the end unless `order` is given."""
    if order is None:
        dest = _request("GET", f"/columns/{column_id}/cards") or []
        order = len(dest)
    _request("PUT", f"/cards/{card_id}/move", {"columnId": column_id, "order": order})
    return {"moved": "card", "id": card_id, "to_column": column_id, "order": order}


# ---------------------------------------------------------------------------
# DESTRUCTIVE — GATED (require confirm=True; report the target first)
# ---------------------------------------------------------------------------
def _gate(kind: str, target: dict[str, Any]) -> dict[str, Any]:
    return {
        "requires_confirmation": True,
        "action": kind,
        "target": target,
        "hint": "Irreversible. Re-call the same tool with confirm=true to proceed.",
    }


@mcp.tool()
def delete_card(card_id: str, board_id: str | None = None, confirm: bool = False) -> dict[str, Any]:
    """Delete a card. GATED — pass confirm=true to actually delete."""
    if not confirm:
        return _gate("delete_card", {"card_id": card_id})
    body = {"boardId": board_id} if board_id else None
    _request("DELETE", f"/cards/{card_id}", body)
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
    """Delete a workspace (and everything in it). GATED — pass confirm=true."""
    if not confirm:
        boards = _request("GET", f"/workspaces/{workspace_id}/boards") or []
        return _gate("delete_workspace",
                     {"workspace_id": workspace_id, "boards_that_would_be_deleted": len(boards)})
    _request("DELETE", f"/workspaces/{workspace_id}")
    return {"deleted": "workspace", "id": workspace_id}


@mcp.tool()
def clear_workspace(workspace_id: str, confirm: bool = False) -> dict[str, Any]:
    """Remove ALL boards from a workspace (keeps the workspace itself). GATED —
    pass confirm=true."""
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
