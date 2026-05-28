const express = require('express');
const jwt = require('jsonwebtoken');
const { createAdminClient, createPublicClient } = require('../utils/supabase');
const { requireAuth } = require('../middleware/auth');
const { getSyncedUserProfile } = require('../utils/userProfile');

const router = express.Router();

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const adminClient = createAdminClient();
  const { email, password, name, organizationId, role = 'colaborador' } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password y name son requeridos' });
  }

  // 0. Domain validation (AGLAYA Corporate Policy)
  const allowedDomains = ['aglaya.biz', 'ibaifernandez.com'];
  const domain = email.split('@')[1];
  if (!allowedDomains.includes(domain)) {
    return res.status(403).json({ error: 'Dominio no autorizado para registro corporativo' });
  }

  // 1. Create user in Supabase Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const userId = authData.user.id;

  // 2. Insert profile in public.users table
  const { error: profileError } = await adminClient
    .from('users')
    .insert({ id: userId, email, name, role, organization_id: organizationId || null });

  if (profileError) {
    console.error('[auth] insert profile:', profileError.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  // 3. Auto-create personal workspace for non-guest users (if org is set)
  if (organizationId && role !== 'guest' && role !== 'cliente') {
    const { data: ws } = await adminClient
      .from('workspaces')
      .insert({ name: 'Personal', emoji: '🏠', type: 'personal', organization_id: organizationId, created_by: userId })
      .select()
      .single();
    if (ws) {
      await adminClient.from('workspace_members').insert({ workspace_id: ws.id, user_id: userId, role: 'owner', invited_by: userId });
    }
  }

  // 4. Build JWT
  const token = jwt.sign(
    { id: userId, email, name, role, organizationId: organizationId || null },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return res.status(201).json({ token, user: { id: userId, email, name, role, avatarUrl: null } });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const authClient = createPublicClient();
  const adminClient = createAdminClient();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email y password son requeridos' });
  }

  // 1. Authenticate via Supabase Auth
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const userId = authData.user.id;

  // 2. Fetch profile and repair email drift against Supabase Auth
  const { profile, error: profileError } = await getSyncedUserProfile(adminClient, userId);

  if (profileError || !profile) {
    return res.status(500).json({ error: 'Error al obtener el perfil de usuario' });
  }

  // 3. Build JWT
  const token = jwt.sign(
    {
      id: userId,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      organizationId: profile.organization_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return res.json({
    token,
    user: {
      id: userId,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      organizationId: profile.organization_id,
      avatarUrl: profile.avatar_url ?? null,
      digestHour: profile.digest_hour ?? 7,
      digestEnabled: profile.digest_enabled !== false,
    },
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const adminClient = createAdminClient();
  const { profile } = await getSyncedUserProfile(adminClient, req.user.id);

  if (!profile) return res.json({ user: req.user });

  return res.json({
    user: {
      id:             profile.id,
      email:          profile.email,
      name:           profile.name,
      role:           profile.role,
      organizationId: profile.organization_id,
      avatarUrl:      profile.avatar_url ?? null,
      digestHour:     profile.digest_hour ?? 7,
      digestEnabled:  profile.digest_enabled !== false,
    },
  });
});

// ── PATCH /api/auth/me/preferences ────────────────────────────────────────────
// Update user preferences (digest hour, digest enabled).
router.patch('/me/preferences', requireAuth, async (req, res) => {
  const adminClient = createAdminClient();
  const { digestHour, digestEnabled } = req.body ?? {};

  const update = {};
  if (digestHour !== undefined) {
    const h = Number(digestHour);
    if (!Number.isInteger(h) || h < 0 || h > 23) {
      return res.status(400).json({ error: 'digestHour debe ser un entero entre 0 y 23' });
    }
    update.digest_hour = h;
  }
  if (digestEnabled !== undefined) {
    if (typeof digestEnabled !== 'boolean') {
      return res.status(400).json({ error: 'digestEnabled debe ser booleano' });
    }
    update.digest_enabled = digestEnabled;
  }

  if (!Object.keys(update).length) {
    return res.status(400).json({ error: 'Nada que actualizar' });
  }

  const { data, error } = await adminClient
    .from('users')
    .update(update)
    .eq('id', req.user.id)
    .select('digest_hour, digest_enabled')
    .single();

  if (error) {
    console.error('[auth] update preferences:', error.message);
    return res.status(500).json({ error: 'Error al actualizar preferencias' });
  }

  return res.json({
    data: {
      digestHour:    data.digest_hour ?? 7,
      digestEnabled: data.digest_enabled !== false,
    },
  });
});

// ── GET /api/auth/me/export ───────────────────────────────────────────────────
// Self-service data export (RGPD Art. 20 portabilidad + LGPD Art. 18(V) + Ley 21.719 Art. 13).
// Returns JSON con todos los datos personales del usuario solicitante.
// Hallazgo audit Mariana C-05.
router.get('/me/export', requireAuth, async (req, res) => {
  const adminClient = createAdminClient();
  const userId = req.user.id;

  try {
    // 1. Profile completo
    const { data: profile, error: profileErr } = await adminClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 2. Workspaces a los que pertenece (vía workspace_members)
    const { data: memberships } = await adminClient
      .from('workspace_members')
      .select('workspace_id, role, invited_by, created_at, workspaces(id, name, emoji, type)')
      .eq('user_id', userId);

    // 3. Cards de las que es owner
    const { data: ownedCards } = await adminClient
      .from('cards')
      .select('id, title, description, priority, due_date, board_id, column_id, tags, checklist, created_at, updated_at')
      .eq('owner_id', userId);

    // 4. Notifications dirigidas al usuario
    const { data: notifications } = await adminClient
      .from('notifications')
      .select('id, type, payload, read_at, created_at')
      .eq('user_id', userId);

    // 5. Cards donde aparece en checklist como asignado
    const { data: allCardsWithChecklist } = await adminClient
      .from('cards')
      .select('id, title, board_id, checklist')
      .not('checklist', 'is', null);

    const assignedChecklistItems = (allCardsWithChecklist ?? [])
      .flatMap((card) => {
        const items = Array.isArray(card.checklist) ? card.checklist : [];
        return items
          .filter((item) => Array.isArray(item.assignees) && item.assignees.includes(userId))
          .map((item) => ({
            card_id: card.id,
            card_title: card.title,
            board_id: card.board_id,
            item_text: item.text,
            item_done: item.done,
          }));
      });

    // 6. Digest logs (audit trail de envíos al usuario)
    const { data: digestLogs } = await adminClient
      .from('digest_logs')
      .select('id, type, recipient, status, error_msg, created_at')
      .eq('user_id', userId);

    // 7. Auth user metadata (last_sign_in, created_at, etc.)
    let authMeta = null;
    try {
      const { data: authData } = await adminClient.auth.admin.getUserById(userId);
      if (authData?.user) {
        authMeta = {
          id: authData.user.id,
          email: authData.user.email,
          email_confirmed_at: authData.user.email_confirmed_at,
          last_sign_in_at: authData.user.last_sign_in_at,
          created_at: authData.user.created_at,
          updated_at: authData.user.updated_at,
        };
      }
    } catch (_) {
      // Si falla auth admin, exportamos sin metadata
    }

    const exportData = {
      _meta: {
        export_date: new Date().toISOString(),
        export_subject: 'AGLAYA Kanban Desk — Personal data export (RGPD Art. 20 portabilidad)',
        user_id: userId,
        notice: 'Este export contiene todos los datos personales asociados a tu cuenta en el sistema. Si tienes preguntas, contacta info@aglaya.biz.',
      },
      auth: authMeta,
      profile,
      memberships: memberships ?? [],
      owned_cards: ownedCards ?? [],
      assigned_checklist_items: assignedChecklistItems,
      notifications: notifications ?? [],
      digest_logs: digestLogs ?? [],
    };

    const filename = `aglaya-kanban-export-${userId}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    console.error('[auth] export error:', err.message);
    return res.status(500).json({ error: 'Error al generar export' });
  }
});

// ── DELETE /api/auth/me ───────────────────────────────────────────────────────
// Self-service account deletion (RGPD Art. 17 supresión + LGPD Art. 18(VI) +
// Ley 21.719 Art. 12).
// Hallazgo audit Mariana C-04.
//
// Body opcional: { confirm_email: string } — email del propio usuario como confirmación.
// FK cascading:
//   - auth.users → public.users: ON DELETE CASCADE (id FK)
//   - public.users → workspace_members: ON DELETE CASCADE
//   - public.users → cards (owner_id): ON DELETE SET NULL (cards permanecen, ownerless)
//   - public.users → notifications: ON DELETE CASCADE
//   - public.users → boards.created_by: ON DELETE SET NULL
router.delete('/me', requireAuth, async (req, res) => {
  const adminClient = createAdminClient();
  const userId = req.user.id;
  const userEmail = req.user.email;

  // Confirmación opcional pero recomendada: email match
  const { confirm_email: confirmEmail } = req.body ?? {};
  if (confirmEmail && confirmEmail !== userEmail) {
    return res.status(400).json({
      error: 'CONFIRMATION_MISMATCH',
      message: 'El email de confirmación no coincide con tu cuenta',
    });
  }

  try {
    // 1. Snapshot pre-delete para log (audit trail)
    console.warn(`[auth] self-delete iniciado userId=${userId} email=${userEmail} at=${new Date().toISOString()}`);

    // 2. Eliminar de Supabase Auth — cascade automático a public.users vía FK
    const { error: authErr } = await adminClient.auth.admin.deleteUser(userId);

    if (authErr) {
      console.error('[auth] self-delete auth.users error:', authErr.message);
      return res.status(500).json({ error: 'Error al eliminar cuenta' });
    }

    // 3. Limpieza defensiva: public.users (debería estar cascadeado pero por si acaso)
    await adminClient.from('users').delete().eq('id', userId);

    console.warn(`[auth] self-delete completado userId=${userId} email=${userEmail}`);

    return res.status(200).json({
      ok: true,
      message: 'Cuenta eliminada. Las cards de las que eras owner permanecen accesibles a los workspaces correspondientes (sin owner asignado). Los workspaces que pertenecían solo a ti han sido eliminados en cascada.',
    });
  } catch (err) {
    console.error('[auth] self-delete error:', err.message);
    return res.status(500).json({ error: 'Error al eliminar cuenta' });
  }
});

module.exports = router;
