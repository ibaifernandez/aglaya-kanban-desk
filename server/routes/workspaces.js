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
  createdAt:   row.created_at,
  createdBy:   row.created_by,
});

// ── GET /api/workspaces ───────────────────────────────────────────────────────
// Returns all workspaces the authenticated user is a member of.

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('role, workspace:workspaces(id, name, emoji, description, created_at, created_by)')
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });

  const workspaces = (data || []).map((row) => ({
    ...toWorkspace(row.workspace),
    myRole: row.role,
  }));

  res.json({ data: workspaces });
});

// ── POST /api/workspaces ──────────────────────────────────────────────────────
// Creates a new workspace. Creator becomes 'owner'.

router.post('/', requireAuth, async (req, res) => {
  const { name, emoji = '📋', description = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const { data: ws, error: wsErr } = await supabaseAdmin
    .from('workspaces')
    .insert({
      name:            name.trim(),
      emoji,
      description,
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
    supabaseAdmin.from('workspace_members').select('user_id, role, invited_at, user:users(id, name, email, avatar_url)').eq('workspace_id', workspaceId),
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
  const { name, emoji, description } = req.body;
  const update = {};
  if (name?.trim())        update.name        = name.trim();
  if (emoji)               update.emoji       = emoji;
  if (description != null) update.description = description;

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
  const { error } = await supabaseAdmin
    .from('workspaces')
    .delete()
    .eq('id', req.params.workspaceId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── GET /api/workspaces/:workspaceId/members ──────────────────────────────────

router.get('/:workspaceId/members', requireAuth, requireWorkspaceMember, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('role, invited_at, invited_by, user:users(id, name, email, avatar_url)')
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
