const { supabaseAdmin } = require('../utils/supabase');

/**
 * Middleware: verifies the authenticated user is a member of :workspaceId.
 * Attaches req.workspaceMember = { workspace_id, user_id, role } if valid.
 */
async function requireWorkspaceMember(req, res, next) {
  const workspaceId = req.params.workspaceId || req.params.id || req.body.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId requerido' });

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
