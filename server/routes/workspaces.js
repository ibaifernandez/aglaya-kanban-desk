const express = require('express');
const { supabaseAdmin }        = require('../utils/supabase');
const { requireAuth }          = require('../middleware/auth');
const { requireWorkspaceMember, requireWorkspaceRole } = require('../middleware/workspace');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_TYPES = ['personal', 'interno', 'externo'];

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

  // Admins can create any type. Colaboradores ONLY personal.
  let wsType = type;
  if (req.user.role === 'colaborador') {
    wsType = 'personal';
  } else if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'El tipo de espacio de trabajo es obligatorio y debe ser válido (personal, interno o externo)' });
  }

  // Self-healing: if organizationId is missing from token (stale session), fetch from DB
  let orgId = req.user.organizationId;
  if (!orgId) {
    console.log(`[workspaces] Token missing orgId for ${req.user.email}. Fetching from DB...`);
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', req.user.id)
      .single();
    orgId = userProfile?.organization_id;
  }

  if (!orgId) {
    return res.status(403).json({ error: 'Tu usuario no tiene una organización asignada. Contacta con soporte.' });
  }

  // 🔍 SECURITY DIAGNOSTIC: Verify if service_role is being used
  const keyPref = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').substring(0, 10);
  console.log(`[workspaces] [AUTH_CHECK] User: ${req.user.email} | KeyPrefix: ${keyPref} | OrgId: ${orgId} | Type: ${wsType}`);

  const { data: ws, error: wsErr } = await supabaseAdmin
    .from('workspaces')
    .insert({
      name:            name.trim(),
      emoji,
      description,
      type:            wsType,
      organization_id: orgId,
      created_by:      req.user.id,
    })
    .select()
    .single();

    if (wsErr) {
      console.error('[workspaces] POST /:', wsErr.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

  await supabaseAdmin.from('workspace_members').insert({
    workspace_id: ws.id,
    user_id:      req.user.id,
    role:         'owner',
    invited_by:   req.user.id,
  });

  res.status(201).json({ data: { ...toWorkspace(ws), myRole: 'owner' } });
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
  const wsId = req.params.workspaceId;

  try {
    // 1. Get all boards in this workspace
    const { data: boards } = await supabaseAdmin
      .from('boards').select('id').eq('workspace_id', wsId);

    if (boards?.length) {
      const boardIds = boards.map((b) => b.id);

      // 2. Get all columns in those boards
      const { data: columns } = await supabaseAdmin
        .from('columns').select('id').in('board_id', boardIds);

      if (columns?.length) {
        const colIds = columns.map((c) => c.id);
        // 3. Delete all cards
        await supabaseAdmin.from('cards').delete().in('column_id', colIds);
        // 4. Delete all columns
        await supabaseAdmin.from('columns').delete().in('id', colIds);
      }

      // 5. Delete all boards
      await supabaseAdmin.from('boards').delete().in('id', boardIds);
    }

    // 6. Delete workspace members
    await supabaseAdmin.from('workspace_members').delete().eq('workspace_id', wsId);

    // 7. Delete workspace
    const { error } = await supabaseAdmin.from('workspaces').delete().eq('id', wsId);
    if (error) { console.error('[workspaces] DELETE /:id:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

    res.json({ success: true });
  } catch (err) {
    console.error('[workspaces] DELETE /:id catch:', err.message);
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

// ── POST /api/workspaces/:workspaceId/members ─────────────────────────────────
// Invites an existing org user to the workspace.

router.post('/:workspaceId/members', requireAuth, requireWorkspaceMember, requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  const { userId, role = 'member' } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!['owner', 'admin', 'member', 'guest'].includes(role)) {
    return res.status(400).json({ error: 'role must be owner, admin, member, or guest' });
  }

  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .insert({
      workspace_id: req.params.workspaceId,
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

  if (!['owner', 'admin', 'member', 'guest'].includes(role)) {
    return res.status(400).json({ error: 'role must be owner, admin, member, or guest' });
  }
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
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
