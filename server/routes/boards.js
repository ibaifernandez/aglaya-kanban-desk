const { supabaseAdmin } = require('../utils/supabase');

const DEFAULT_COLUMNS = [
  { title: '🗂 Backlog',     order: 1 },
  { title: '🎯 Prioridades', order: 2 },
  { title: '🔄 En curso',    order: 3 },
  { title: '⏸ Bloqueado',   order: 4 },
  { title: '✅ Hecho',       order: 5 },
];

const toBoard = (row) => ({
  id:          row.id,
  title:       row.title,
  workspaceId: row.workspace_id,
  createdAt:   row.created_at,
});

const getBoards = async (req, res) => {
  let query = supabaseAdmin
    .from('boards')
    .select('*')
    .eq('organization_id', req.user.organizationId);

  // Hardening: Only superadmin sees everything. 
  // Others only see boards from workspaces they belong to.
  if (req.user.role !== 'superadmin') {
    const { data: memberships, error: memError } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', req.user.id);

    if (memError) {
      console.error('[boards] getBoards membership check:', memError.message);
      return res.status(500).json({ error: 'Error al verificar permisos' });
    }

    const invitedWsIds = (memberships || []).map(m => m.workspace_id);
    query = query.in('workspace_id', invitedWsIds);
  }

  const { data, error } = await query
    .order('order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) { console.error('[boards] getBoards:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: (data || []).map(toBoard) });
};

const createBoard = async (req, res) => {
  const { title, workspaceId } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  if (!workspaceId)   return res.status(400).json({ error: 'workspaceId is required' });

  // req.workspaceMember is attached by requireWorkspaceMember middleware
  const { role: wsRole } = req.workspaceMember;
  const allowedRoles = ['owner', 'admin', 'member'];
  if (!allowedRoles.includes(wsRole)) {
    return res.status(403).json({ error: 'Rol insuficiente en este workspace para crear tableros' });
  }

  const { data: existing } = await supabaseAdmin
    .from('boards')
    .select('order')
    .eq('workspace_id', workspaceId)
    .order('order', { ascending: false })
    .limit(1);

  const maxOrder = existing?.[0]?.order ?? 0;

  const { data: board, error } = await supabaseAdmin
    .from('boards')
    .insert({
      title:           title.trim(),
      organization_id: req.user.organizationId,
      workspace_id:    workspaceId,
      owner_id:        req.user.id, // Audit
      order:           maxOrder + 1
    })
    .select()
    .single();

  if (error) { console.error('[boards] createBoard:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  const cols = DEFAULT_COLUMNS.map((col) => ({
    board_id: board.id,
    title:    col.title,
    order:    col.order,
  }));
  await supabaseAdmin.from('columns').insert(cols);

  res.status(201).json({ data: toBoard(board) });
};

const updateBoard = async (req, res) => {
  const { title, workspaceId } = req.body;
  const { role: wsRole } = req.workspaceMember;
  
  // Only Owner/Admin/Member can update board (matching Create/Delete)
  if (!['owner', 'admin', 'member'].includes(wsRole)) {
    return res.status(403).json({ error: 'Rol insuficiente para modificar tableros' });
  }

  const update = {};
  if (title?.trim()) update.title = title.trim();

  if (workspaceId) {
    // 🛡️ Biblia Rule: Mover tableros entre WS is Propietario/Admin ONLY
    if (!['owner', 'admin'].includes(wsRole)) {
      return res.status(403).json({ error: 'Solo Propietarios y Admins pueden mover tableros entre workspaces' });
    }

    // Verify destination workspace belongs to same organization
    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('organization_id', req.user.organizationId)
      .single();
    if (!ws) return res.status(403).json({ error: 'Workspace no autorizado o inexistente' });
    update.workspace_id = workspaceId;
  }

  const { data, error } = await supabaseAdmin
    .from('boards')
    .update(update)
    .eq('id', req.params.id)
    .eq('organization_id', req.user.organizationId)
    .select()
    .single();

  if (error) { console.error('[boards] updateBoard:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: toBoard(data) });
};

const deleteBoard = async (req, res) => {
  const { role: wsRole } = req.workspaceMember;
  
  // Biblia matrix: Crear/Eliminar tableros ✅ for owner, admin, member
  if (!['owner', 'admin', 'member'].includes(wsRole)) {
    return res.status(403).json({ error: 'Rol insuficiente para eliminar tableros' });
  }

  const { error } = await supabaseAdmin
    .from('boards')
    .delete()
    .eq('id', req.params.id)
    .eq('organization_id', req.user.organizationId);

  if (error) { console.error('[boards] deleteBoard:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ success: true });
};

const reorderBoards = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });

  await Promise.all(
    ids.map((id, i) =>
      supabaseAdmin.from('boards').update({ order: i }).eq('id', id).eq('organization_id', req.user.organizationId)
    )
  );

  const { data } = await supabaseAdmin
    .from('boards')
    .select('*')
    .eq('organization_id', req.user.organizationId)
    .order('order', { ascending: true });

  res.json({ data: (data || []).map(toBoard) });
};

module.exports = { getBoards, createBoard, updateBoard, deleteBoard, reorderBoards };
