const express = require('express');
const path = require('path');
const fs = require('fs');
const { createAdminClient } = require('../utils/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');

const INVITE_TEMPLATE_PATH = path.join(__dirname, '../../docs/mails/supabase-email-invite.html');
let _inviteTemplate = null;
function getInviteTemplate() {
  if (!_inviteTemplate) {
    try { _inviteTemplate = fs.readFileSync(INVITE_TEMPLATE_PATH, 'utf8'); }
    catch (e) { console.warn('[admin] invite template not found:', e.message); }
  }
  return _inviteTemplate;
}

const router = express.Router();

const ALLOWED_ROLES   = ['superadmin', 'admin', 'colaborador', 'cliente'];
const SITE_URL        = process.env.SITE_URL || 'https://kanban.aglaya.biz';

// All admin routes require auth + admin/superadmin role
router.use(requireAuth, requireRole('admin', 'superadmin'));

async function resolveRequesterOrganizationId(req, adminClient) {
  const { data, error } = await adminClient
    .from('users')
    .select('organization_id')
    .eq('id', req.user.id)
    .maybeSingle();

  if (error) {
    console.error('[admin] resolveRequesterOrganizationId:', error.message);
    return req.user.organizationId || req.user.organization_id || null;
  }

  return data?.organization_id ?? req.user.organizationId ?? req.user.organization_id ?? null;
}

function isDuplicateAuthError(error) {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('already been registered')
    || message.includes('already registered')
    || message.includes('already exists')
    || error?.status === 422
  );
}

function isUniqueConstraintError(error) {
  return error?.code === '23505';
}

async function findAuthUserByEmail(email, adminClient) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) return { user: null, error };

    const user = data?.users?.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
    if (user) return { user, error: null };

    const lastPage = data?.lastPage ?? page;
    if (!data?.users?.length || page >= lastPage) {
      return { user: null, error: null };
    }

    page += 1;
  }
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────
// List all users in the organization (or all for superadmin)
router.get('/users', async (req, res) => {
  const adminClient = createAdminClient();
  let query = adminClient
    .from('users')
    .select('id, email, name, role, created_at');

  if (req.user.role !== 'superadmin') {
    const organizationId = await resolveRequesterOrganizationId(req, adminClient);
    if (!organizationId) {
       return res.json({ data: [] }); // Not in an org, see nothing if not super
    }
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) { console.error('[admin] GET /users:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data });
});

// ── POST /api/admin/users/invite ──────────────────────────────────────────────
// Create a new user and send them a password setup email
router.post('/users/invite', async (req, res) => {
  const adminClient = createAdminClient();
  const rawEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const rawName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const role = req.body.role || 'colaborador';

  if (!rawEmail || !rawName) {
    return res.status(400).json({ error: 'email y name son requeridos' });
  }
  if (!ALLOWED_ROLES.includes(role) || role === 'superadmin') {
    return res.status(400).json({ error: 'Rol no válido' });
  }

  const requesterOrganizationId = await resolveRequesterOrganizationId(req, adminClient);
  if (!requesterOrganizationId) {
    return res.status(403).json({ error: 'Tu sesión no tiene organización asignada para invitar usuarios' });
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from('users')
    .select('id, email, name, role, organization_id')
    .eq('email', rawEmail)
    .maybeSingle();

  if (existingProfileError) {
    console.error('[admin] POST /users/invite profile lookup:', existingProfileError.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  const { user: existingAuthUser, error: authLookupError } = await findAuthUserByEmail(rawEmail, adminClient);
  if (authLookupError) {
    console.error('[admin] POST /users/invite auth lookup:', authLookupError.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  if (existingProfile && existingAuthUser) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
  }

  if (existingProfile && !existingAuthUser) {
    console.error('[admin] POST /users/invite inconsistent profile without auth user:', JSON.stringify({
      email: rawEmail,
      profileId: existingProfile.id,
    }));
    return res.status(409).json({ error: 'Ya existe un perfil con ese correo. Revisa la integridad del usuario antes de reinvitarlo.' });
  }

  // Case: auth user exists but no profile — inconsistent state, reject cleanly
  if (existingAuthUser && !existingProfile) {
    return res.status(409).json({
      error: 'El email ya existe en el sistema de autenticación pero sin perfil. Elimina el usuario desde el panel de Supabase Auth antes de reinvitarlo.',
    });
  }

  // Normal path: create user via inviteUserByEmail (atomic: creates auth user + sends invite email)
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    rawEmail,
    { redirectTo: SITE_URL }
  );

  if (inviteError) {
    if (isDuplicateAuthError(inviteError)) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }
    return res.status(400).json({ error: inviteError.message });
  }

  const userId = inviteData.user.id;

  // 1. Insert profile in public.users
  const { error: profileError } = await adminClient
    .from('users')
    .insert({
      id: userId,
      email: rawEmail,
      name: rawName,
      role,
      organization_id: requesterOrganizationId,
    });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId);

    if (isUniqueConstraintError(profileError)) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }

    console.error('[admin] POST /users/invite profile insert:', JSON.stringify({
      message: profileError.message,
      code: profileError.code,
      inviteEmail: rawEmail,
    }));
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  // Email was sent by Supabase via inviteUserByEmail
  const emailSent = true;

  res.status(201).json({
    data: { id: userId, email: rawEmail, name: rawName, role },
    message: `Usuario creado. Se ha enviado un email a ${rawEmail} para que establezca su contraseña.`,
    emailSent,
  });
});

// ── PATCH /api/admin/users/:id/role ──────────────────────────────────────────
// Change a user's role
router.patch('/users/:id/role', async (req, res) => {
  const adminClient = createAdminClient();
  const { role } = req.body;
  const targetId = req.params.id;

  if (!ALLOWED_ROLES.includes(role) || role === 'superadmin') {
    return res.status(400).json({ error: 'Rol no válido' });
  }
  if (targetId === req.user.id) {
    return res.status(403).json({ error: 'No puedes cambiar tu propio rol' });
  }

  // 1. Fetch current target user to verify organization access
  const { data: targetUser, error: fetchError } = await adminClient
    .from('users')
    .select('id, email, name, role, organization_id')
    .eq('id', targetId)
    .single();

  if (fetchError || !targetUser) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // 2. Access control check
  if (req.user.role !== 'superadmin') {
    const userOrgId = await resolveRequesterOrganizationId(req, adminClient);
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
  const { data, error: updateError } = await adminClient
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
  const adminClient = createAdminClient();
  const targetId = req.params.id;

  // 1. Prevent self-deletion
  if (targetId === req.user.id) {
    return res.status(403).json({ error: 'No puedes eliminarte a ti mismo' });
  }

  // 2. Verify user exists and get their current role
  let targetQuery = adminClient
    .from('users')
    .select('id, role, email, organization_id')
    .eq('id', targetId);

  if (req.user.role !== 'superadmin') {
    const requesterOrganizationId = await resolveRequesterOrganizationId(req, adminClient);
    if (!requesterOrganizationId) {
      return res.status(403).json({ error: 'Tu sesión no tiene organización asignada' });
    }

    targetQuery = targetQuery.eq('organization_id', requesterOrganizationId);
  }

  const { data: target, error: fetchError } = await targetQuery.single();

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
  const { data: ownerships, error: ownError } = await adminClient
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
  const { error: profileError } = await adminClient
    .from('users')
    .delete()
    .eq('id', targetId);

  if (profileError) {
    console.error('[admin] DELETE /users/:id profile delete:', profileError.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  // 6. Delete from Supabase Auth
  const { error: authError } = await adminClient.auth.admin.deleteUser(targetId);
  if (authError) {
    console.error('[admin] DELETE /users/:id auth delete:', authError.message);
    // Note: profile is already gone, which is slightly inconsistent but safer than leaving it orphaned
  }

  res.json({ success: true });
});

module.exports = router;
