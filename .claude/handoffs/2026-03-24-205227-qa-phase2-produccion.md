# Session Handoff: QA Phase 2 — Workspaces en producción

**Created**: 2026-03-24 20:52:27
**Project**: /Users/AGLAYA/Local Sites/MyBoardLFi
**Branch**: main
**Last commit**: f759f4f — docs: checklist de QA exhaustivo Phase 2 — Workspaces

---

## Current State Summary

Phase 2 — Workspaces está **completamente implementada y commiteada**. El código está en producción (Railway + Netlify). El QA CSV acaba de ser generado. La sesión anterior se cortó por contexto y la nueva sesión arrancó con los archivos de la sesión anterior re-inyectados como system-reminder (lo que generó texto repetido molesto para el usuario).

**Lo que está hecho:**
- Backend completo de workspaces: `server/routes/workspaces.js` + `server/middleware/workspace.js`
- Frontend completo: `WorkspaceDashboard.jsx`, `WorkspaceMembers.jsx`, breadcrumb en Toolbar, routing en App.jsx
- RLS en Supabase con funciones SECURITY DEFINER para evitar recursión
- Digest con fire-and-forget (fix del 504 de Railway)
- Checklist de QA en `docs/QA-PHASE2.csv` con 100+ checks

---

## Important Context

### Arquitectura del proyecto
- **Puertos**: Server Express en **3003**, Client Vite en **5175** — NO cambiar nunca
- **Jerarquía**: Organization → Workspace → Board → Column → Card
- **Roles workspace**: owner / admin / member / guest (por workspace, separado del rol de org)
- **Producción**: Railway (server) + Netlify (client) en `myboardlfi.ibaifernandez.com`
- **Supabase**: RLS activa, funciones `get_workspace_role()` / `is_workspace_member()` con SECURITY DEFINER

### Issues conocidos (documentados en QA-PHASE2.csv)
1. **KNOWN-01 (menor)**: Las tarjetas del WorkspaceDashboard muestran "0 tableros / 0 miembros" porque `GET /api/workspaces` (lista) no retorna counts. El endpoint de detalle `GET /api/workspaces/:id` sí los tiene.
2. **KNOWN-02 (crítico)**: Email de invitación de nuevos usuarios NO funciona. Requiere: (a) configurar `SITE_URL` en Supabase Auth, (b) template personalizado "Invite user". Documentado en `memory/project_email_invite_pending.md` y `docs/PHASE2-WORKSPACES.md`.

### Patrón FK disambiguation en Supabase
`workspace_members` tiene dos FKs a `users` (`user_id` e `invited_by`). Siempre usar:
```js
.select('user:users!user_id(id, name, email)')
```

### Fire-and-forget en digest
`server/routes/digestRoute.js` responde 200 inmediatamente y ejecuta `sendDigest()` en background para evitar 504 en Railway.

---

## Immediate Next Steps

1. **QA en producción**: Abrir `myboardlfi.ibaifernandez.com` en modo incógnito y ejecutar los checks `PRD-01` a `PRD-08` del archivo `docs/QA-PHASE2.csv`
2. **Fix KNOWN-01**: Enriquecer `GET /api/workspaces` para incluir `memberCount` y `boardCount` por workspace (subconsultas o Promise.all por cada workspace)
3. **Fix KNOWN-02 (al final de Phase 2)**: Configurar email de invitación — ver `memory/project_email_invite_pending.md`

---

## Decisions Made

- **Fire-and-forget para digest**: Railway tenía 504 porque `listUsers()` de Supabase Auth es lento. Decisión: responder 200 inmediatamente.
- **RLS con SECURITY DEFINER**: Para romper recursión en políticas de `workspace_members`. Las funciones `get_workspace_role()` / `is_workspace_member()` bypasean RLS internamente.
- **FK disambiguation explícita**: Obligatorio en PostgREST cuando hay múltiples FKs a la misma tabla.
- **`view` state en App.jsx**: `'workspaces' | 'board' | 'admin'` — el punto de entrada es siempre `'workspaces'`.

---

## Critical Files

| Archivo | Descripción |
|---------|-------------|
| `server/routes/workspaces.js` | CRUD workspaces + gestión de miembros |
| `server/middleware/workspace.js` | requireWorkspaceMember + requireWorkspaceRole |
| `client/src/pages/WorkspaceDashboard.jsx` | Dashboard con grid de workspaces |
| `client/src/components/Workspace/WorkspaceMembers.jsx` | Panel lateral de miembros |
| `client/src/hooks/useWorkspaces.js` | Hook de estado para lista de workspaces |
| `client/src/hooks/useBoards.js` | Modificado: acepta workspaceId, usa getWorkspaceBoards |
| `client/src/App.jsx` | Routing: view state + activeWorkspace + showMembers |
| `client/src/components/Toolbar/Toolbar.jsx` | Breadcrumb + botón UserCog para miembros |
| `client/src/api/client.js` | 10 métodos nuevos de API para workspaces |
| `docs/QA-PHASE2.csv` | Checklist QA con 100+ checks, columna robot pre-rellenada |
| `docs/PHASE2-WORKSPACES.md` | Plan de implementación + email invite pendiente |
| `memory/project_email_invite_pending.md` | Memoria persistente: email invite CRITICO |

---

## Pending Work

- [ ] QA humano en producción (docs/QA-PHASE2.csv)
- [ ] Fix KNOWN-01: counts en WorkspaceDashboard cards
- [ ] Fix KNOWN-02: email de invitación (fin de Phase 2)
- [ ] Phase 3: por definir

---

## Potential Gotchas

- **No cambiar puertos** 3003/5175 — otros proyectos usan 3001/5173 y 3002/5174
- **No sobreescribir `server/data/tasks.json`** — contiene dummy data corporativa
- Al mover tarjeta a columna "done/completado/entregado": `priority` debe quedar en `"none"` (lógica ya implementada)
- Los servidores locales se arrancan con `preview_start` usando `.claude/launch.json` — el client necesita `cwd: client/` para que Vite encuentre `index.html`
- El panel de admin (`AdminPage`) vuelve a `'workspaces'`, no a `'board'`
