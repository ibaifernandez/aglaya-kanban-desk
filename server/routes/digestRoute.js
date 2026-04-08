const express = require('express');
const { sendDigest }                            = require('../digest');
const { sendUserDigest, sendAllUserDigests }    = require('../userDigest');
const { requireAuth, requireRole }              = require('../middleware/auth');
const { supabaseAdmin }                         = require('../utils/supabase');

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
  // Get user profile from `users` table to obtain name + email
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email')
    .eq('id', req.user.id)
    .single();

  if (error || !user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  // Respond immediately so the client isn't blocked waiting for SMTP
  res.json({ ok: true, message: 'Tu digest personal está en camino. Revisa tu correo en unos segundos.' });

  sendUserDigest({ id: user.id, name: user.name, email: user.email }).catch((err) => {
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
