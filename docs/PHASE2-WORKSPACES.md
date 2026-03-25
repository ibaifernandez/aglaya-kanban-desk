# Phase 2 — Workspaces (Macro-tableros)

**Creado:** 2026-03-24
**Estado:** 📋 Planificado
**Objetivo:** Convertir MyBoardLFi en un Trello corporativo real con aislamiento por workspace.

---

## Visión del producto

Un usuario entra y ve **su dashboard personal**: todos los workspaces a los que pertenece.
Cada workspace es un espacio aislado — un cliente, un departamento, un proyecto macro.
Dentro de cada workspace: tableros, columnas, tarjetas, checklists.

```
Organización (LFi / AGLAYA)
  └── Workspace ("Banco Internacional de Chile", "Dpto. Mail Marketing"...)
        ├── Miembros del workspace  (owner · admin · member · guest)
        └── Tablero ("Campaña Q2", "Sitio Web", "Redes Sociales"...)
              └── Columna (Backlog · En Progreso · Entregado...)
                    └── Tarjeta
                          └── Checklist
```

**Regla de aislamiento:** Un usuario solo ve los workspaces a los que ha sido invitado.
Un cliente invitado al workspace "Banco Internacional de Chile" no sabe que existe "SONDA".

---

## Roles por workspace

| Rol | Puede hacer |
|-----|-------------|
| `owner` | Todo. Invitar, eliminar el workspace, cambiar roles. Solo uno por workspace. |
| `admin` | Crear/editar/borrar tableros, invitar miembros, cambiar roles (excepto owner). |
| `member` | Crear/editar tarjetas. No puede invitar ni borrar tableros. |
| `guest` | Solo lectura. Pensado para clientes que quieren ver el estado del trabajo. |

---

## Cambios en base de datos

### Nuevas tablas

```sql
-- Workspace (macro-tablero)
CREATE TABLE public.workspaces (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  emoji           text DEFAULT '📋',
  description     text,
  created_by      uuid REFERENCES public.users(id),
  created_at      timestamptz DEFAULT now()
);

-- Membresía por workspace
CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','admin','member','guest')),
  invited_by   uuid REFERENCES public.users(id),
  invited_at   timestamptz DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
```

### Migración de tabla existente

```sql
-- boards gana workspace_id
ALTER TABLE public.boards ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id);
```

### RLS para workspaces

```sql
-- Función helper
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

-- Workspaces: un usuario ve solo los que es miembro
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver workspaces propios" ON public.workspaces
  FOR SELECT USING (public.is_workspace_member(id));

-- workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver miembros de mis workspaces" ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(workspace_id));

-- boards: acceso via workspace
DROP POLICY IF EXISTS "Usuarios ven tableros de su org" ON public.boards;
CREATE POLICY "Ver tableros de mis workspaces" ON public.boards
  FOR SELECT USING (public.is_workspace_member(workspace_id));
-- (ídem para INSERT / UPDATE / DELETE)
```

---

## Cambios en el backend (Express)

### Nuevas rutas

```
GET    /api/workspaces                    → lista de workspaces del usuario
POST   /api/workspaces                    → crear workspace
GET    /api/workspaces/:id                → detalle + miembros
PATCH  /api/workspaces/:id                → editar nombre/emoji/descripción
DELETE /api/workspaces/:id                → eliminar (solo owner)

GET    /api/workspaces/:id/members        → lista de miembros
POST   /api/workspaces/:id/members        → invitar usuario
PATCH  /api/workspaces/:id/members/:uid   → cambiar rol
DELETE /api/workspaces/:id/members/:uid   → eliminar miembro

GET    /api/workspaces/:id/boards         → tableros del workspace (reemplaza /api/boards)
POST   /api/workspaces/:id/boards         → crear tablero en workspace
```

### Middleware de workspace

Crear `server/middleware/workspace.js`:
- `requireWorkspaceMember` — verifica que el usuario es miembro del workspace
- `requireWorkspaceRole('admin', 'owner')` — verifica rol mínimo

---

## Cambios en el frontend (React)

### Nuevas vistas

1. **WorkspaceDashboard** (`/`) — pantalla de entrada tras login
   - Grid de tarjetas: una por workspace
   - Cada tarjeta: emoji, nombre, descripción, N tableros, N miembros, tu rol
   - Botón "Nuevo workspace" (admin/superadmin de org)

2. **WorkspaceView** (`/workspace/:id`) — vista actual de tableros, pero acotada al workspace
   - Sidebar con tableros del workspace
   - Cabecera con nombre del workspace + gestión de miembros

3. **WorkspaceSettings** — modal/panel lateral
   - Editar nombre, emoji, descripción
   - Gestionar miembros (invitar, cambiar rol, eliminar)
   - Peligro: eliminar workspace

### Cambios en vistas existentes

- `App.jsx` — router que arranca en WorkspaceDashboard
- `Toolbar.jsx` — añadir breadcrumb "Workspace > Tablero"
- `AdminPage.jsx` — mantener para gestión de usuarios de la org
- `api/client.js` — añadir endpoints de workspaces

---

## Flujo de invitación a workspace

1. Admin abre "Gestionar miembros" del workspace
2. Introduce email + rol
3. Si el usuario ya existe en la org → se añade directamente a `workspace_members`
4. Si el usuario NO existe → se crea en Supabase Auth + `public.users` + `workspace_members` y recibe email de bienvenida

---

## ⚠️ Pendiente: arreglar el email de invitación

> Documentado aquí para revisarlo al implementar el flujo de invitación a workspace.

**Problema actual:** Supabase envía su plantilla genérica de "recovery" con dominio `supabase.co` en el enlace. El enlace funciona, pero el email parece un reset de contraseña, no una invitación de bienvenida.

**Dos pasos a ejecutar:**

**a) URL de redirect en Supabase**
- Ir a proyecto Supabase → **Authentication → URL Configuration**
- Verificar que `Site URL` = `https://myboardlfi.ibaifernandez.com`
- Añadir a `Redirect URLs`: `https://myboardlfi.ibaifernandez.com/**`

**b) Plantilla personalizada**
- Ir a **Authentication → Email Templates → Invite user**
- Reemplazar con plantilla HTML con branding de MyBoardLFi
- El asunto debe ser "Te han invitado a [Workspace] en MyBoardLFi"
- El CTA: "Aceptar invitación y crear contraseña"
- La plantilla tiene acceso a `{{ .ConfirmationURL }}` y `{{ .Email }}`

---

## Orden de implementación

### Etapa 1 — Base de datos (Supabase SQL Editor)
- [ ] Crear tabla `workspaces`
- [ ] Crear tabla `workspace_members`
- [ ] Añadir columna `workspace_id` a `boards`
- [ ] Crear función helper `is_workspace_member()`
- [ ] Aplicar RLS a `workspaces` y `workspace_members`
- [ ] Reescribir RLS de `boards` para usar `workspace_id`
- [ ] Migrar datos: crear workspace por defecto "LFi" y asignar todos los boards existentes

### Etapa 2 — Backend
- [ ] `server/routes/workspaces.js` — CRUD de workspaces
- [ ] `server/middleware/workspace.js` — `requireWorkspaceMember`, `requireWorkspaceRole`
- [ ] Adaptar `server/routes/boards.js` — filtrar por `workspace_id`
- [ ] Registrar rutas en `server/index.js`

### Etapa 3 — Frontend
- [ ] `client/src/pages/WorkspaceDashboard.jsx`
- [ ] `client/src/pages/WorkspaceView.jsx` (wrapper de la vista actual)
- [ ] `client/src/components/WorkspaceCard.jsx`
- [ ] `client/src/components/WorkspaceMembers.jsx` (panel de miembros)
- [ ] Actualizar `client/src/api/client.js`
- [ ] Actualizar `client/src/App.jsx` — routing entre dashboard y workspace

### Etapa 4 — Email de invitación
- [ ] Configurar Site URL y Redirect URLs en Supabase Auth
- [ ] Crear plantilla HTML personalizada para "Invite user"
- [ ] Probar flujo completo: invitar → recibir email → establecer contraseña → entrar al workspace

### Etapa 5 — QA
- [ ] Verificar aislamiento: usuario A no ve workspaces de usuario B
- [ ] Verificar roles: guest no puede editar, member no puede invitar
- [ ] Probar flujo de invitación end-to-end
- [ ] Deploy a Railway + Netlify
- [ ] Smoke test en producción

---

## Notas técnicas

- `workspace_id` en `boards` puede ser NULL durante la migración. Forzar NOT NULL después de migrar.
- El concepto de `organization_id` se mantiene — workspaces pertenecen a una org. Útil si en el futuro hay multi-org (AGLAYA vs LFi en la misma instancia).
- Para guests externos (clientes), considerar si deben tener cuenta en Supabase Auth o acceso por token temporal. De momento, cuenta real con rol `guest`.
- Supabase Realtime se puede activar por tabla sin cambios de código — útil para Phase 3 (colaboración en tiempo real).
