const express = require('express');
const { supabaseAdmin }        = require('../utils/supabase');
const { requireAuth }          = require('../middleware/auth');
const { requireWorkspaceMember, requireWorkspaceRole } = require('../middleware/workspace');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const toWorkspace = (row) => ({
  id:          row.id,
  name:        row.name,
  emoji:       row.emoji,
  description: row.description,
  type:        row.type ?? 'general',
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

  if (error) return res.status(500).json({ error: error.message });

  const rows = (data || []).filter((row) => row.workspace != null);
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
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/workspaces ──────────────────────────────────────────────────────
// Creates a new workspace. Creator becomes 'owner'.

router.post('/', requireAuth, async (req, res) => {
  const { name, emoji = '📋', description = '', type = 'general' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const validTypes = ['cliente', 'departamento', 'general'];
  const wsType = validTypes.includes(type) ? type : 'general';

  const { data: ws, error: wsErr } = await supabaseAdmin
    .from('workspaces')
    .insert({
      name:            name.trim(),
      emoji,
      description,
      type:            wsType,
      organization_id: req.user.organizationId,
      created_by:      req.user.id,
    })
    .select()
    .single();

  if (wsErr) return res.status(500).json({ error: wsErr.message });

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

  if (wsRes.error) return res.status(500).json({ error: wsRes.error.message });

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
  const validTypes = ['cliente', 'departamento', 'general'];
  if (type && validTypes.includes(type)) update.type = type;

  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .update(update)
    .eq('id', req.params.workspaceId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
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
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/workspaces/:workspaceId/members ──────────────────────────────────

router.get('/:workspaceId/members', requireAuth, requireWorkspaceMember, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('role, invited_at, invited_by, user:users!user_id(id, name, email)')
    .eq('workspace_id', req.params.workspaceId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});

// ── POST /api/workspaces/:workspaceId/members ─────────────────────────────────
// Invites an existing org user to the workspace.

router.post('/:workspaceId/members', requireAuth, requireWorkspaceMember, requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  const { userId, role = 'member' } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!['admin', 'member', 'guest'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin, member, or guest' });
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

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data });
});

// ── PATCH /api/workspaces/:workspaceId/members/:userId ────────────────────────
// Changes a member's role.

router.patch('/:workspaceId/members/:userId', requireAuth, requireWorkspaceMember, requireWorkspaceRole('owner', 'admin'), async (req, res) => {
  const { role } = req.body;
  const { workspaceId, userId } = req.params;

  if (!['admin', 'member', 'guest'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin, member, or guest' });
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

  if (error) return res.status(500).json({ error: error.message });
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

  if (error) return res.status(500).json({ error: error.message });
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

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
});

module.exports = router;
