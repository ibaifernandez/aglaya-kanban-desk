const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createAdminClient, createPublicClient } = require('../utils/supabase');
const { requireAuth } = require('../middleware/auth');

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

  // 2. Fetch profile
  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

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
    },
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from('users')
    .select('id, email, name, role, organization_id, avatar_url')
    .eq('id', req.user.id)
    .single();

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

module.exports = router;
