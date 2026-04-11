const { supabaseAdmin } = require('../utils/supabase');

/**
 * Middleware: verifies the authenticated user is a member of the relevant workspace.
 * Resolves workspaceId from:
 * 1. Direct params/body: workspaceId, id (if route is /workspaces/:id)
 * 2. Board context: boardId
 * 3. Column context: columnId
 * 4. Card context: cardId
 * Attaches req.workspaceMember = { workspace_id, user_id, role } if valid.
 */
async function requireWorkspaceMember(req, res, next) {
  let workspaceId = req.params.workspaceId || req.body.workspaceId;

  // If no direct workspaceId, try to resolve from other IDs
  if (!workspaceId) {
    const { id, boardId, columnId, cardId } = req.params;
    
    // Determine context based on route pattern or common param names
    if (req.baseUrl.includes('/workspaces') && id) {
      workspaceId = id;
    } else if (boardId || (req.baseUrl.includes('/boards') && id)) {
      const bid = boardId || id;
      const { data } = await supabaseAdmin.from('boards').select('workspace_id').eq('id', bid).single();
      workspaceId = data?.workspace_id;
    } else if (columnId || (req.baseUrl.includes('/columns') && id)) {
      const cid = columnId || id;
      const { data } = await supabaseAdmin
        .from('columns')
        .select('boards(workspace_id)')
        .eq('id', cid)
        .single();
      workspaceId = data?.boards?.workspace_id;
    } else if (cardId || (req.baseUrl.includes('/cards') && id)) {
      const cid = cardId || id;
      const { data } = await supabaseAdmin
        .from('cards')
        .select('boards(workspace_id)')
        .eq('id', cid)
        .single();
      workspaceId = data?.boards?.workspace_id;
    }
  }

  if (!workspaceId) return res.status(400).json({ error: 'Contexto de workspace no encontrado' });

  // 🛡️ GOD MODE: Superadmin bypasses membership checks
  if (req.user.role === 'superadmin') {
    req.workspaceMember = {
      workspace_id: workspaceId,
      user_id:      req.user.id,
      role:         'owner' // Virtual power
    };
    return next();
  }

  const [memberRes, wsRes] = await Promise.all([
    supabaseAdmin
      .from('workspace_members')
      .select('workspace_id, user_id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', req.user.id)
      .single(),
    supabaseAdmin
      .from('workspaces')
      .select('type')
      .eq('id', workspaceId)
      .single(),
  ]);

  if (memberRes.error || !memberRes.data) {
    return res.status(403).json({ error: 'Sin acceso a este workspace' });
  }

  // Clients can only access external workspaces
  const wsType = wsRes.data?.type;
  if (req.user.role === 'cliente' && wsType !== 'externo') {
    return res.status(403).json({ error: 'Sin acceso a este workspace' });
  }

  req.workspaceMember = memberRes.data;
  next();
}

/**
 * Middleware factory: restricts access to specific workspace roles.
 * Must be used after requireWorkspaceMember.
 * Usage: requireWorkspaceRole('owner', 'admin')
 */
function requireWorkspaceRole(...roles) {
  return (req, res, next) => {
    if (!req.workspaceMember) {
      return res.status(401).json({ error: 'No autenticado en este workspace' });
    }
    if (!roles.includes(req.workspaceMember.role)) {
      return res.status(403).json({ error: 'Rol insuficiente para esta acción' });
    }
    next();
  };
}

module.exports = { requireWorkspaceMember, requireWorkspaceRole };
