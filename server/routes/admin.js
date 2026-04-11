const express = require('express');
const { supabaseAdmin } = require('../utils/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_ROLES   = ['superadmin', 'admin', 'colaborador', 'cliente', 'guest'];
const SITE_URL        = process.env.SITE_URL || 'https://myboardlfi.ibaifernandez.com';

// All admin routes require auth + admin/superadmin role
router.use(requireAuth, requireRole('admin', 'superadmin'));

// ── GET /api/admin/users ──────────────────────────────────────────────────────
// List all users in the organization (or all for superadmin)
router.get('/users', async (req, res) => {
  let query = supabaseAdmin
    .from('users')
    .select('id, email, name, role, created_at');

  if (req.user.role !== 'superadmin') {
    if (!req.user.organizationId) {
       return res.json({ data: [] }); // Not in an org, see nothing if not super
    }
    query = query.eq('organization_id', req.user.organizationId);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) { console.error('[admin] GET /users:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data });
});

// ── POST /api/admin/users/invite ──────────────────────────────────────────────
// Create a new user and send them a password setup email
router.post('/users/invite', async (req, res) => {
  const { email, name, role = 'colaborador' } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'email y name son requeridos' });
  }
  if (!ALLOWED_ROLES.includes(role) || role === 'superadmin') {
    return res.status(400).json({ error: 'Rol no válido' });
  }

  // 1. Create user in Supabase Auth (no password — will be set via recovery email)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const userId = authData.user.id;

  // 2. Insert profile in public.users
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      id: userId,
      email,
      name,
      role,
      organization_id: req.user.organizationId,
    });

  if (profileError) {
    // Rollback: remove auth user if profile insert fails
    await supabaseAdmin.auth.admin.deleteUser(userId);
    console.error('[admin] POST /users/invite profile insert:', profileError.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  // 3. Send password setup email via recovery flow
  const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo: SITE_URL,
  });

  if (resetError) {
    // User is created but email failed — log and warn, don't fail the request
    console.warn(`[admin/invite] Failed to send invite email to ${email}:`, resetError.message);
  }

  res.status(201).json({
    data: { id: userId, email, name, role },
    message: `Usuario creado. Se ha enviado un email a ${email} para que establezca su contraseña.`,
    emailSent: !resetError,
  });
});

// ── PATCH /api/admin/users/:id/role ──────────────────────────────────────────
// Change a user's role
router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  const targetId = req.params.id;

  if (!ALLOWED_ROLES.includes(role) || role === 'superadmin') {
    return res.status(400).json({ error: 'Rol no válido' });
  }
  if (targetId === req.user.id) {
    return res.status(403).json({ error: 'No puedes cambiar tu propio rol' });
  }

  // 1. Fetch current target user to verify organization access
  const { data: targetUser, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role, organization_id')
    .eq('id', targetId)
    .single();

  if (fetchError || !targetUser) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // 2. Access control check
  if (req.user.role !== 'superadmin') {
    const userOrgId = req.user.organizationId || req.user.organization_id;
    const targetOrgId = targetUser.organization_id;

    if (!userOrgId) {
      return res.status(403).json({ error: 'Tu sesión no tiene organización asignada' });
    }

    if (userOrgId !== targetOrgId) {
      console.warn(`[admin] Access Denied: Requester ${req.user.email} (Org: ${userOrgId}) tried to edit ${targetUser.email} (Org: ${targetOrgId})`);
      return res.status(403).json({ 
        error: `Fuera de tu organización. (Tu Org: ${userOrgId.substring(0,8)}, Su Org: ${targetOrgId ? targetOrgId.substring(0,8) : 'NULL'})` 
      });
    }

    // NEW: Prevents Admin from modifying another Admin
    if (req.user.role === 'admin' && targetUser.role === 'admin') {
      return res.status(403).json({ error: 'Un Administrador no puede modificar a otro Administrador' });
    }
  }

  // 3. Perform the update
  const { data, error: updateError } = await supabaseAdmin
    .from('users')
    .update({ role })
    .eq('id', targetId)
    .select('id, email, name, role')
    .single();

  if (updateError) {
    console.error('[admin] role update error:', updateError.message);
    return res.status(500).json({ error: `Error al actualizar: ${updateError.message}` });
  }

  res.json({ data });
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
// Remove a user from the organization
router.delete('/users/:id', async (req, res) => {
  const targetId = req.params.id;

  // 1. Prevent self-deletion
  if (targetId === req.user.id) {
    return res.status(403).json({ error: 'No puedes eliminarte a ti mismo' });
  }

  // 2. Verify user exists and get their current role
  const { data: target, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, role, email')
    .eq('id', targetId)
    .eq('organization_id', req.user.organizationId)
    .single();

  if (fetchError || !target) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // 3. Prevent deleting a superadmin if you are just an admin
  if (target.role === 'superadmin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Solo un superadmin puede eliminar a otro superadmin' });
  }

  // NEW: Prevents Admin from deleting another Admin
  if (req.user.role === 'admin' && target.role === 'admin') {
    return res.status(403).json({ error: 'Un Administrador no puede eliminar a otro Administrador' });
  }

  // 4. Check for workspace ownership (Phase 2 constraint)
  // If the user is the ONLY owner of a workspace, prevent deletion or warn.
  // For safety, we block deletion if they own any workspace as 'owner'.
  const { data: ownerships, error: ownError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', targetId)
    .eq('role', 'owner');

  if (ownError) {
    console.error('[admin] DELETE /users/:id ownership check:', ownError.message);
    return res.status(500).json({ error: 'Error al verificar propiedades del usuario' });
  }

  if (ownerships && ownerships.length > 0) {
    return res.status(400).json({
      error: 'No se puede eliminar al usuario: es el propietario de uno o más espacios de trabajo. Transfiere la propiedad antes de borrarlo.',
      workspaces: ownerships.map(o => o.workspace_id)
    });
  }

  // 5. Delete from public.users
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', targetId);

  if (profileError) {
    console.error('[admin] DELETE /users/:id profile delete:', profileError.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  // 6. Delete from Supabase Auth
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (authError) {
    console.error('[admin] DELETE /users/:id auth delete:', authError.message);
    // Note: profile is already gone, which is slightly inconsistent but safer than leaving it orphaned
  }

  res.json({ success: true });
});

module.exports = router;
