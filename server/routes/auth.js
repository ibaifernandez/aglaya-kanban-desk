const express = require('express');
const jwt = require('jsonwebtoken');
const { createAdminClient, createPublicClient } = require('../utils/supabase');
const { requireAuth, invalidateUserCache } = require('../middleware/auth');
const { getSyncedUserProfile } = require('../utils/userProfile');

const router = express.Router();

// ── B-02 audit Mariana: tokens dual ───────────────────────────────────────────
// Access token: corto (15 min), va en response body + localStorage cliente.
// Refresh token: largo (30 días), va en HttpOnly cookie (XSS-resistant).
// Refresh secret distinto al access secret para que leak access NO derive refresh.
//
// JWT_REFRESH_SECRET en env vars. Si no está seteado, fallback al JWT_SECRET
// (compat con setup pre-B-02). Recomendado: setear distinto en prod.

const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 30;
const REFRESH_TTL = `${REFRESH_TTL_DAYS}d`;
const REFRESH_COOKIE_NAME = 'aglaya_refresh';

function refreshSecret() {
  return process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
}

function signAccessToken(claims) {
  return jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefreshToken(claims) {
  // Refresh payload mínimo — solo lo que necesitamos para re-emitir access:
  return jwt.sign({ id: claims.id, typ: 'refresh' }, refreshSecret(), { expiresIn: REFRESH_TTL });
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth',  // cookie solo se envía a /api/auth/* — minimal exposure
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
}

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

  // 4. Build JWTs (B-02 — access corto + refresh HttpOnly cookie)
  const claims = { id: userId, email, name, role, organizationId: organizationId || null };
  const accessToken = signAccessToken(claims);
  const refreshToken = signRefreshToken(claims);
  setRefreshCookie(res, refreshToken);

  return res.status(201).json({ token: accessToken, user: { id: userId, email, name, role, avatarUrl: null } });
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

  // 3. Build JWTs (B-02 — access corto + refresh HttpOnly cookie)
  const claims = {
    id: userId,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    organizationId: profile.organization_id,
  };
  const accessToken = signAccessToken(claims);
  const refreshToken = signRefreshToken(claims);
  setRefreshCookie(res, refreshToken);

  return res.json({
    token: accessToken,
    user: {
      id: userId,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      organizationId: profile.organization_id,
      avatarUrl: profile.avatar_url ?? null,
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

    // 4. B-07: invalidar cache para que future requests con este JWT retornen 401
    invalidateUserCache(userId);

    console.warn(`[auth] self-delete completado userId=${userId} email=${userEmail}`);

    // B-02: clear refresh cookie también
    clearRefreshCookie(res);

    return res.status(200).json({
      ok: true,
      message: 'Cuenta eliminada. Las cards de las que eras owner permanecen accesibles a los workspaces correspondientes (sin owner asignado). Los workspaces que pertenecían solo a ti han sido eliminados en cascada.',
    });
  } catch (err) {
    console.error('[auth] self-delete error:', err.message);
    return res.status(500).json({ error: 'Error al eliminar cuenta' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
// B-02 audit Mariana: emite nuevo access token desde refresh cookie HttpOnly.
// Sin auth header — el refresh cookie ES la auth aquí.
// Rate-limited via authLimiter (montado en app.js a /api/auth).
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, refreshSecret());
  } catch (err) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Refresh token inválido o expirado' });
  }

  if (decoded?.typ !== 'refresh' || !decoded?.id) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Refresh token mal formado' });
  }

  // Re-fetch user de DB para que el nuevo access reflect role/orgId actuales (B-07).
  const adminClient = createAdminClient();
  const { data: profile, error } = await adminClient
    .from('users')
    .select('id, email, name, role, organization_id, avatar_url')
    .eq('id', decoded.id)
    .single();

  if (error || !profile) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Usuario no encontrado' });
  }

  const claims = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    organizationId: profile.organization_id,
  };
  const accessToken = signAccessToken(claims);

  // Rotación: emit nuevo refresh también (extends sliding window, mitigates replay)
  const newRefresh = signRefreshToken(claims);
  setRefreshCookie(res, newRefresh);

  return res.json({
    token: accessToken,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      organizationId: profile.organization_id,
      avatarUrl: profile.avatar_url ?? null,
    },
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// B-02 audit Mariana: clear refresh cookie. Access token muere por TTL 15min.
// No requiere auth — clear funciona aunque el cookie esté inválido/expirado.
router.post('/logout', (req, res) => {
  clearRefreshCookie(res);
  return res.json({ ok: true });
});

module.exports = router;
