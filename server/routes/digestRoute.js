const express = require('express');
const { sendDigest } = require('../digest');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/digest/send-me
// Sends the admin usage digest to DIGEST_TO (superadmin only).
router.post('/send-me', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const recipient = process.env.DIGEST_TO;
  if (!recipient) {
    return res.status(500).json({ error: 'DIGEST_TO no configurado en el servidor.' });
  }

  // Respond immediately — digest builds + sends async to avoid gateway timeout
  res.json({ ok: true, message: `Digest en camino a ${recipient}. Revisa tu correo en unos segundos.` });

  sendDigest(recipient).catch(err => {
    console.error('[digest/send-me]', err.message);
  });
});

module.exports = router;
