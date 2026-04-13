const express = require('express');
const { sendDigest }                            = require('../digest');
const { buildUserCards, sendUserDigest, sendAllUserDigests } = require('../userDigest');
const { requireAuth, requireRole }              = require('../middleware/auth');
const { createAdminClient, supabaseAdmin }      = require('../utils/supabase');
const { getSyncedUserProfile }                  = require('../utils/userProfile');

const router = express.Router();

// ── POST /api/digest/send-me ──────────────────────────────────────────────────
// Sends the admin usage digest to DIGEST_TO (superadmin/admin only).

router.post('/send-me', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const recipient = process.env.DIGEST_TO;
  if (!recipient) {
    return res.status(500).json({ error: 'DIGEST_TO no configurado en el servidor.' });
  }

  // Respond immediately — digest builds + sends async to avoid gateway timeout
  res.json({ ok: true, message: `Digest en camino a ${recipient}. Revisa tu correo en unos segundos.` });

  sendDigest(recipient).catch((err) => {
    console.error('[digest/send-me]', err.message);
  });
});

// ── POST /api/digest/send-my-digest ──────────────────────────────────────────
// Sends the personal task digest to the authenticated user.
// Available to any authenticated user.

router.post('/send-my-digest', requireAuth, async (req, res) => {
  const adminClient = createAdminClient();
  const { workspaceId = null } = req.body ?? {};

  const { profile: user, error } = await getSyncedUserProfile(adminClient, req.user.id);
  if (error || !user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  let workspace = null;
  if (workspaceId) {
    const { data: candidateWorkspace, error: workspaceError } = await adminClient
      .from('workspaces')
      .select('id, name, emoji')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !candidateWorkspace) {
      return res.status(404).json({ error: 'Espacio de trabajo no encontrado.' });
    }

    if (req.user.role !== 'superadmin') {
      const { data: membership, error: membershipError } = await adminClient
        .from('workspace_members')
        .select('workspace_id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (membershipError || !membership) {
        return res.status(403).json({ error: 'No tienes acceso a este espacio de trabajo.' });
      }
    }

    workspace = candidateWorkspace;
  }

  const sections = await buildUserCards(user.id, { workspaceId });
  if (sections.total === 0) {
    return res.json({
      ok: true,
      message: workspace
        ? `No tienes tareas accionables ahora mismo en ${workspace.emoji ?? ''} ${workspace.name}`.trim()
        : 'No tienes tareas accionables ahora mismo.',
    });
  }

  const workspaceLabel = workspace ? `${workspace.emoji ?? ''} ${workspace.name}`.trim() : null;

  // Respond immediately so the client isn't blocked waiting for SMTP
  res.json({
    ok: true,
    message: workspaceLabel
      ? `Resumen de ${workspaceLabel} en camino a ${user.email}. Revisa tu correo en unos segundos.`
      : `Tu digest personal está en camino a ${user.email}. Revisa tu correo en unos segundos.`,
  });

  sendUserDigest({
    id: user.id,
    name: user.name,
    email: user.email,
    sections,
    workspaceName: workspace?.name ?? null,
    workspaceId,
  }).catch((err) => {
    console.error('[digest/send-my-digest]', err.message);
  });
});

// ── POST /api/digest/send-all-digests ─────────────────────────────────────────
// Triggers personal digests for ALL users (superadmin/admin only).
// Useful for testing the scheduler manually.

router.post('/send-all-digests', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  // Respond immediately — can take several seconds for large user bases
  res.json({ ok: true, message: 'Enviando digest a todos los usuarios. Revisa los logs del servidor.' });

  sendAllUserDigests().catch((err) => {
    console.error('[digest/send-all-digests]', err.message);
  });
});

module.exports = router;
