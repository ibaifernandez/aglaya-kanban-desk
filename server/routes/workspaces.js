const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin }        = require('../utils/supabase');
const { requireAuth }          = require('../middleware/auth');
const { requireWorkspaceMember, requireWorkspaceRole } = require('../middleware/workspace');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_TYPES = ['personal', 'interno', 'externo'];
const MANAGEABLE_MEMBER_ROLES = ['admin', 'member', 'guest'];

const toWorkspace = (row) => ({
  id:          row.id,
  name:        row.name,
  emoji:       row.emoji,
  description: row.description,
  type:        row.type ?? 'externo',
  coverUrl:    row.cover_url ?? null,
  createdAt:   row.created_at,
  createdBy:   row.created_by,
  // `null` mientras la migración del orden no esté aplicada. El cliente ordena
  // por esto y cae al nombre si falta, así que la pantalla funciona igual en los
  // dos mundos — que es lo que permite desplegar antes de que el Operador toque
  // la base.
  order:       row.order ?? null,
});

async function getWorkspaceContext(workspaceId) {
  return supabaseAdmin
    .from('workspaces')
    .select('id, type, organization_id')
    .eq('id', workspaceId)
    .single();
}

async function getWorkspaceMember(workspaceId, userId) {
  return supabaseAdmin
    .from('workspace_members')
    .select('workspace_id, user_id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();
}

async function getUserProfile(userId) {
  return supabaseAdmin
    .from('users')
    .select('id, email, name, role, organization_id, created_at')
    .eq('id', userId)
    .single();
}

// ── GET /api/workspaces ───────────────────────────────────────────────────────
// Returns all workspaces the authenticated user is a member of.

router.get('/', requireAuth, async (req, res) => {
  // ⚠️ Se pide `order`, y si la columna todavía no existe se reintenta sin ella.
  //
  // No es cosmético: este código se despliega ANTES de que el Operador aplique
  // `migration-orden-de-espacios.sql`, y PostgREST responde con error a un
  // `select` que nombra una columna inexistente. Sin este reintento, la pantalla
  // de espacios se quedaría en blanco entre el despliegue y la migración — o
  // sea, el arreglo rompería lo que venía a mejorar.
  const CAMPOS = 'id, name, emoji, description, type, cover_url, created_at, created_by';

  const pedir = (conOrden) =>
    supabaseAdmin
      .from('workspace_members')
      .select(`role, workspace:workspaces(${conOrden ? `${CAMPOS}, order` : CAMPOS})`)
      .eq('user_id', req.user.id);

  let { data, error } = await pedir(true);

  // 42703 = undefined_column, y SOLO ese. Abrir esto a `if (error)` convertiría
  // el reintento en un tapón: un permiso denegado, una caída de red o una
  // consulta mal escrita se reintentarían «sin orden», saldrían bien, y el fallo
  // real desaparecería del registro. Hay un caso que lo fija — otro código de
  // error NO reintenta.
  if (error?.code === '42703') {
    console.warn('[workspaces] la columna `order` no existe todavía; se sirve sin orden. Falta aplicar migration-orden-de-espacios.sql');
    ({ data, error } = await pedir(false));
  }

  if (error) { console.error('[workspaces] GET /:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  let rows = (data || []).filter((row) => row.workspace != null);

  // Clients can only see external workspaces
  if (req.user.role === 'cliente') {
    rows = rows.filter((row) => row.workspace.type === 'externo');
  }
  if (!rows.length) return res.json({ data: [] });

  // Fetch member + board counts in 2 aggregate queries instead of 2N
  const wsIds = rows.map((r) => r.workspace.id);
  try {
    const [membersRes, boardsRes] = await Promise.all([
      supabaseAdmin.from('workspace_members').select('workspace_id').in('workspace_id', wsIds),
      supabaseAdmin.from('boards').select('workspace_id').in('workspace_id', wsIds),
    ]);

    const membersByWs = (membersRes.data || []).reduce((acc, r) => {
      acc[r.workspace_id] = (acc[r.workspace_id] || 0) + 1; return acc;
    }, {});
    const boardsByWs = (boardsRes.data || []).reduce((acc, r) => {
      acc[r.workspace_id] = (acc[r.workspace_id] || 0) + 1; return acc;
    }, {});

    const workspaces = rows.map((row) => ({
      ...toWorkspace(row.workspace),
      myRole:      row.role,
      memberCount: membersByWs[row.workspace.id] ?? 0,
      boardCount:  boardsByWs[row.workspace.id]  ?? 0,
    }));
    res.json({ data: workspaces });
  } catch (e) {
    console.error('[workspaces] GET / counts:', e.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── PATCH /api/workspaces/reorder ─────────────────────────────────────────────
// Reordena espacios DENTRO DE UNA SECCIÓN. Tarjeta `d0954969`.
//
// ⚠️ POR QUÉ NO SE COPIA `reorderBoards`, que era el molde natural. Aquél
// renumera fila a fila con un `Promise.all` de `UPDATE` sueltos **cuyo resultado
// no se comprueba**: si uno falla o el proceso muere a mitad, el orden queda
// medio aplicado —dos espacios con el mismo número, o un hueco— y nadie se
// entera. Esta casa ya lo pagó (`c1efd488`).
//
// Aquí el reorden es **una sola sentencia** dentro de `reorder_workspaces`, y una
// sentencia es atómica por definición: o entra entera o no entra nada.
//
// LA SECCIÓN NO ES DECORACIÓN: el orden es por tipo (decisión de Ibai), así que
// mezclar tipos en una misma llamada produciría números que la vista no puede
// representar. Se rechaza con 400 en vez de guardarlo y que se vea raro después.
router.patch('/reorder', requireAuth, async (req, res) => {
  const { ids } = req.body ?? {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids debe ser un array no vacío' });
  }

  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length !== ids.length) {
    return res.status(400).json({ error: 'ids no puede traer repetidos ni vacíos' });
  }

  if (req.user.role === 'cliente') {
    return res.status(403).json({ error: 'Los usuarios cliente no pueden reordenar espacios' });
  }

  // Alcance: solo espacios de los que este usuario es miembro. Se comprueba
  // ANTES de escribir — un identificador ajeno no se ordena mal, se rechaza.
  const { data: miembro, error: errorMiembro } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace:workspaces(id, type, organization_id)')
    .eq('user_id', req.user.id)
    .in('workspace_id', unicos);

  if (errorMiembro) {
    console.error('[workspaces] reorder alcance:', errorMiembro.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  const suyos = (miembro || []).map((r) => r.workspace).filter(Boolean);

  if (suyos.length !== unicos.length) {
    return res.status(400).json({ error: 'Uno o más espacios no existen o no son tuyos' });
  }

  const tipos = [...new Set(suyos.map((w) => w.type ?? 'externo'))];
  if (tipos.length > 1) {
    return res.status(400).json({
      error: `El orden es por sección: no se pueden mezclar tipos en una misma llamada (${tipos.join(', ')})`,
    });
  }

  const { data: aplicadas, error: errorOrden } = await supabaseAdmin.rpc('reorder_workspaces', {
    p_org: req.user.organizationId,
    p_ids: unicos,
  });

  if (errorOrden) {
    // 42883 = undefined_function. Es el estado normal entre desplegar esto y que
    // el Operador aplique la migración, y merece un mensaje que diga qué falta
    // en vez de un 500 mudo que parezca una avería.
    if (errorOrden.code === '42883' || /reorder_workspaces/.test(errorOrden.message || '')) {
      console.warn('[workspaces] reorder: falta aplicar migration-orden-de-espacios.sql');
      return res.status(503).json({
        error: 'El orden de espacios todavía no está disponible: falta aplicar docs/schema/migration-orden-de-espacios.sql en la base.',
      });
    }
    console.error('[workspaces] reorder:', errorOrden.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  // ⚠️ LA FUNCIÓN DEVUELVE CUÁNTAS FILAS TOCÓ, Y AQUÍ SE MIRA.
  //
  // Antes se tiraba ese número y se contestaba `200` con los ids **pedidos**,
  // no con los guardados. Si la función tocaba menos filas —una fila borrada
  // entre la comprobación y la escritura, un espacio movido de organización—,
  // la respuesta decía que todo salió bien.
  //
  // Y eso no es un `200` optimista: es un `200` que MIENTE, porque el cliente
  // pinta el orden nuevo al soltar y lo deja ahí. La pantalla se quedaría
  // mostrando un orden que la base no tiene, hasta que alguien recargue.
  //
  // Se pide devolver el conteo desde la base en vez de fiarse de lo enviado
  // precisamente porque **lo enviado es lo que creemos, y lo devuelto es lo que
  // pasó**.
  if (typeof aplicadas === 'number' && aplicadas !== unicos.length) {
    console.warn(`[workspaces] reorder: se pidieron ${unicos.length} y se aplicaron ${aplicadas}`);
    return res.status(409).json({
      error: 'El orden no se aplicó entero: alguno de esos espacios cambió mientras se guardaba. Recarga y vuelve a intentarlo.',
      pedidos: unicos.length,
      aplicados: aplicadas,
    });
  }

  return res.json({ data: { ids: unicos, aplicados: aplicadas ?? unicos.length } });
});

// ── POST /api/workspaces ──────────────────────────────────────────────────────
// Creates a new workspace. Creator becomes 'owner'.

router.post('/', requireAuth, async (req, res) => {
  const { name, emoji = '📋', description = '', type } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  if (req.user.role === 'cliente') {
    return res.status(403).json({ error: 'Los usuarios cliente no pueden crear espacios de trabajo' });
  }

  // Admins can create any type. Colaboradores ONLY personal.
  let wsType = type;
  if (req.user.role === 'colaborador') {
    wsType = 'personal';
  } else if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'El tipo de espacio de trabajo es obligatorio y debe ser válido (personal, interno o externo)' });
  }

  const freshAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Self-healing: if organizationId is missing from token (stale session), fetch from DB
    let orgId = req.user.organizationId;
    if (!orgId) {
      const { data: userProfile } = await freshAdmin
        .from('users')
        .select('organization_id')
        .eq('id', req.user.id)
        .single();
      orgId = userProfile?.organization_id;
    }

    if (!orgId) {
      return res.status(403).json({ error: 'Usuario sin organización asignada' });
    }

    // 1. Create the workspace
    const { data: ws, error: wsErr } = await freshAdmin
      .from('workspaces')
      .insert({
        name:            name.trim(),
        emoji:           emoji || '📋',
        description:     description || '',
        type:            wsType,
        organization_id: orgId,
        created_by:      req.user.id,
      })
      .select()
      .single();

    if (wsErr) {
      console.error('[workspaces] POST create error:', wsErr.message);
      return res.status(500).json({ error: 'Error al crear el espacio de trabajo' });
    }

    // 2. Add creator as initial member (owner)
    const { error: memErr } = await freshAdmin.from('workspace_members').insert({
      workspace_id: ws.id,
      user_id:      req.user.id,
      role:         'owner',
      invited_by:   req.user.id,
    });

    if (memErr) {
      console.error('[workspaces] POST member error:', memErr.message);
      return res.status(500).json({ error: 'Error al asignar propietario' });
    }

    res.status(201).json({ success: true, data: { ...toWorkspace(ws), myRole: 'owner' } });
  } catch (err) {
    console.error('[workspaces] POST exception:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /api/workspaces/:workspaceId ─────────────────────────────────────────
// Returns workspace detail + member count + board count.

router.get('/:workspaceId', requireAuth, requireWorkspaceMember, async (req, res) => {
  const { workspaceId } = req.params;

  const [wsRes, membersRes, boardsRes] = await Promise.all([
    supabaseAdmin.from('workspaces').select('*').eq('id', workspaceId).single(),
    supabaseAdmin.from('workspace_members').select('user_id, role, invited_at, user:users!user_id(id, name, email)').eq('workspace_id', workspaceId),
    supabaseAdmin.from('boards').select('id').eq('workspace_id', workspaceId),
  ]);

  if (wsRes.error) { console.error('[workspaces] GET /:id:', wsRes.error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  res.json({
    data: {
      ...toWorkspace(wsRes.data),
      myRole:      req.workspaceMember.role,
      memberCount: membersRes.data?.length ?? 0,
      boardCount:  boardsRes.data?.length ?? 0,
      members:     membersRes.data ?? [],
    },
  });
});

// ── PATCH /api/workspaces/:workspaceId ────────────────────────────────────────
// Edits name / emoji / description. Requires admin or owner.

router.patch('/:workspaceId', requireAuth, requireWorkspaceMember, requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  const { name, emoji, description, type } = req.body;
  const update = {};
  if (name?.trim())        update.name        = name.trim();
  if (emoji)               update.emoji       = emoji;
  if (description != null) update.description = description;
  if (type && VALID_TYPES.includes(type)) update.type = type;

  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .update(update)
    .eq('id', req.params.workspaceId)
    .select()
    .single();

  if (error) { console.error('[workspaces] PATCH /:id:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: toWorkspace(data) });
});

// ── DELETE /api/workspaces/:workspaceId ───────────────────────────────────────
// Deletes workspace. Only owner can do this.

router.delete('/:workspaceId', requireAuth, requireWorkspaceMember, requireWorkspaceRole('owner'), async (req, res) => {
  const freshAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const wsId = req.params.workspaceId;

  try {
    // 1. Get all boards in this workspace
    const { data: boards } = await freshAdmin
      .from('boards').select('id').eq('workspace_id', wsId);

    if (boards?.length) {
      const boardIds = boards.map((b) => b.id);

      // 2. Get all columns in those boards
      const { data: columns } = await freshAdmin
        .from('columns').select('id').in('board_id', boardIds);

      if (columns?.length) {
        const colIds = columns.map((c) => c.id);
        // 3. Delete all cards
        await freshAdmin.from('cards').delete().in('column_id', colIds);
        // 4. Delete all columns
        await freshAdmin.from('columns').delete().in('id', colIds);
      }

      // 5. Delete all boards
      await freshAdmin.from('boards').delete().in('id', boardIds);
    }

    // 6. Delete workspace members
    await freshAdmin.from('workspace_members').delete().eq('workspace_id', wsId);

    // 7. Delete workspace
    const { error } = await freshAdmin.from('workspaces').delete().eq('id', wsId);
    if (error) { 
      console.error('[workspaces] DELETE error:', error.message); 
      return res.status(500).json({ error: 'Error al eliminar el espacio de trabajo' }); 
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[workspaces] DELETE exception:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /api/workspaces/:workspaceId/members ──────────────────────────────────

router.get('/:workspaceId/members', requireAuth, requireWorkspaceMember, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('role, invited_at, invited_by, user:users!user_id(id, name, email)')
    .eq('workspace_id', req.params.workspaceId);

  if (error) { console.error('[workspaces] GET /:id/members:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: data ?? [] });
});

// ── GET /api/workspaces/:workspaceId/available-users ─────────────────────────
// Lists org users that can still be invited to this workspace.

router.get('/:workspaceId/available-users', requireAuth, requireWorkspaceMember, requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  const { workspaceId } = req.params;

  const [wsRes, membersRes] = await Promise.all([
    getWorkspaceContext(workspaceId),
    supabaseAdmin.from('workspace_members').select('user_id').eq('workspace_id', workspaceId),
  ]);

  if (wsRes.error || !wsRes.data) {
    console.error('[workspaces] GET /:id/available-users workspace:', wsRes.error?.message);
    return res.status(404).json({ error: 'Workspace no encontrado' });
  }

  let usersQuery = supabaseAdmin
    .from('users')
    .select('id, email, name, role, created_at');

  if (wsRes.data.organization_id) {
    usersQuery = usersQuery.eq('organization_id', wsRes.data.organization_id);
  }

  const { data: users, error: usersError } = await usersQuery.order('created_at', { ascending: true });

  if (usersError) {
    console.error('[workspaces] GET /:id/available-users users:', usersError.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  const existingIds = new Set((membersRes.data || []).map((member) => member.user_id));
  const availableUsers = (users || []).filter((candidate) => !existingIds.has(candidate.id));

  res.json({ data: availableUsers });
});

// ── POST /api/workspaces/:workspaceId/members ─────────────────────────────────
// Invites an existing org user to the workspace.

router.post('/:workspaceId/members', requireAuth, requireWorkspaceMember, requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  const { userId, role = 'member' } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!MANAGEABLE_MEMBER_ROLES.includes(role)) {
    return res.status(400).json({ error: 'role must be admin, member, or guest' });
  }

  const { workspaceId } = req.params;
  const [wsRes, userRes, memberRes] = await Promise.all([
    getWorkspaceContext(workspaceId),
    getUserProfile(userId),
    getWorkspaceMember(workspaceId, userId),
  ]);

  if (wsRes.error || !wsRes.data) {
    console.error('[workspaces] POST /:id/members workspace:', wsRes.error?.message);
    return res.status(404).json({ error: 'Workspace no encontrado' });
  }

  if (userRes.error || !userRes.data) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  if (memberRes.data) {
    return res.status(409).json({ error: 'El usuario ya pertenece a este workspace' });
  }

  if (userRes.data.organization_id !== wsRes.data.organization_id) {
    return res.status(403).json({ error: 'El usuario no pertenece a la organización de este workspace' });
  }

  if (userRes.data.role === 'cliente' && wsRes.data.type !== 'externo') {
    return res.status(400).json({ error: 'Los usuarios cliente solo pueden ser invitados a workspaces externos' });
  }

  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id:      userId,
      role,
      invited_by:   req.user.id,
    })
    .select()
    .single();

  if (error) { console.error('[workspaces] POST /:id/members:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.status(201).json({ data });
});

// ── PATCH /api/workspaces/:workspaceId/members/:userId ────────────────────────
// Changes a member's role.

router.patch('/:workspaceId/members/:userId', requireAuth, requireWorkspaceMember, requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  const { role } = req.body;
  const { workspaceId, userId } = req.params;

  if (!MANAGEABLE_MEMBER_ROLES.includes(role)) {
    return res.status(400).json({ error: 'role must be admin, member, or guest' });
  }
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
  }

  const { data: targetMember, error: targetError } = await getWorkspaceMember(workspaceId, userId);

  if (targetError || !targetMember) {
    return res.status(404).json({ error: 'Miembro no encontrado en este workspace' });
  }

  if (targetMember.role === 'owner') {
    return res.status(400).json({ error: 'El rol owner es inmutable en el workspace' });
  }

  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) { console.error('[workspaces] PATCH /:id/members/:userId:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data });
});

// ── DELETE /api/workspaces/:workspaceId/members/:userId ───────────────────────
// Removes a member from the workspace.

router.delete('/:workspaceId/members/:userId', requireAuth, requireWorkspaceMember, requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  const { workspaceId, userId } = req.params;

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo del workspace' });
  }

  const { data: targetMember, error: targetError } = await getWorkspaceMember(workspaceId, userId);

  if (targetError || !targetMember) {
    return res.status(404).json({ error: 'Miembro no encontrado en este workspace' });
  }

  if (targetMember.role === 'owner') {
    return res.status(400).json({ error: 'No se puede eliminar al owner del workspace' });
  }

  const { error } = await supabaseAdmin
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) { console.error('[workspaces] DELETE /:id/members/:userId:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ success: true });
});

// ── GET /api/workspaces/:workspaceId/boards ───────────────────────────────────
// Returns boards scoped to this workspace.

router.get('/:workspaceId/boards', requireAuth, requireWorkspaceMember, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('boards')
    .select('*')
    .eq('workspace_id', req.params.workspaceId)
    .order('order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) { console.error('[workspaces] GET /:id/boards:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: data ?? [] });
});

module.exports = router;
