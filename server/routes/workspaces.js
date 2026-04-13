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
  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('role, workspace:workspaces(id, name, emoji, description, type, cover_url, created_at, created_by)')
    .eq('user_id', req.user.id);

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
