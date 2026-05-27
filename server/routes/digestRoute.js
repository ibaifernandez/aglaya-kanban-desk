const express = require('express');
const { sendDigest }                            = require('../services/digest/admin');
const { buildUserCards, sendUserDigest, sendAllUserDigests } = require('../services/digest/user');
const { requireAuth, requireRole }              = require('../middleware/auth');
const { createAdminClient, supabaseAdmin }      = require('../utils/supabase');
const { getSyncedUserProfile }                  = require('../utils/userProfile');
const { queryDigestLogs }                       = require('../utils/digestLogging');

const router = express.Router();

// ── POST /api/digest/cron-trigger ─────────────────────────────────────────────
// Endpoint para GitHub Actions. Autentica con DIGEST_CRON_SECRET en header.
// No requiere JWT — el secreto es la autenticación.

router.post('/cron-trigger', async (req, res) => {
  const secret = process.env.DIGEST_CRON_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'DIGEST_CRON_SECRET no configurado.' });
  }

  const provided = req.headers['x-cron-secret'];
  if (!provided || provided !== secret) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const currentHourUtc = new Date().getUTCHours();
  const adminDigestHour = parseInt(process.env.ADMIN_DIGEST_HOUR ?? '7', 10);

  // Responde inmediatamente — los envíos pueden tardar varios minutos
  res.json({
    ok: true,
    message: `Digest cron iniciado para hora UTC ${currentHourUtc}. Revisa los logs del servidor.`,
  });

  sendAllUserDigests()
    .then(results => {
      console.log(`✅ [cron-trigger] Completado (UTC ${results.hour}): ${results.sent} enviados, ${results.skipped} omitidos, ${results.errors} errores`);
    })
    .catch(err => {
      console.error(`❌ [cron-trigger] Error fatal: ${err.message}`);
    });

  // Admin digest se envía solo una vez al día, a la hora configurada
  if (currentHourUtc === adminDigestHour) {
    sendDigest().catch(err => {
      console.error(`❌ [cron-trigger] Admin digest error: ${err.message}`);
    });
  }
});

// ── POST /api/digest/send-me ──────────────────────────────────────────────────
// Sends the admin usage digest to DIGEST_TO (superadmin/admin only).

router.post('/send-me', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const recipient = process.env.DIGEST_TO;
  if (!recipient) {
    return res.status(500).json({ error: 'DIGEST_TO no configurado en el servidor.' });
  }

  try {
    // Send with 10s timeout to avoid gateway timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Envío de digest expirado (>10s)')), 10000)
    );

    await Promise.race([sendDigest(recipient), timeoutPromise]);

    res.json({ ok: true, message: `Digest enviado a ${recipient}.` });
  } catch (err) {
    console.error('[digest/send-me]', err.message);
    res.status(500).json({ ok: false, error: `Error al enviar digest: ${err.message}` });
  }
});

// ── POST /api/digest/send-my-digest ──────────────────────────────────────────
// Sends the personal task digest to the authenticated user.
// Available to any authenticated user.

router.post('/send-my-digest', requireAuth, async (req, res) => {
  const adminClient = createAdminClient();
  const { workspaceId = null } = req.body ?? {};

  try {
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
    if (sections.total === 0 && !sections.assignedItems?.length) {
      return res.json({
        ok: true,
        message: workspace
          ? `No tienes tareas accionables ahora mismo en ${workspace.emoji ?? ''} ${workspace.name}`.trim()
          : 'No tienes tareas accionables ahora mismo.',
      });
    }

    const workspaceLabel = workspace ? `${workspace.emoji ?? ''} ${workspace.name}`.trim() : null;

    // Send with 10s timeout for feedback
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Envío de digest expirado (>10s)')), 10000)
    );

    await Promise.race([
      sendUserDigest({
        id: user.id,
        name: user.name,
        email: user.email,
        sections,
        workspaceName: workspace?.name ?? null,
        workspaceId,
      }),
      timeoutPromise,
    ]);

    res.json({
      ok: true,
      message: workspaceLabel
        ? `Resumen de ${workspaceLabel} enviado a ${user.email}.`
        : `Tu digest personal enviado a ${user.email}.`,
    });
  } catch (err) {
    console.error('[digest/send-my-digest]', err.message);
    res.status(500).json({ ok: false, error: `Error al enviar digest: ${err.message}` });
  }
});

// ── POST /api/digest/send-all-digests ─────────────────────────────────────────
// Triggers personal digests for ALL users (superadmin/admin only).
// Useful for testing the scheduler manually.

router.post('/send-all-digests', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  // Respond immediately — can take several minutes for large user bases
  res.json({
    ok: true,
    message: 'Enviando digests a todos los usuarios (modo forzado, sin filtro horario). Monitorea los logs del servidor para resultados.',
  });

  sendAllUserDigests({ force: true })
    .then((results) => {
      console.log(`✅ [digest/send-all-digests] Completado: ${results.sent} enviados, ${results.skipped} omitidos, ${results.errors} errores`);
    })
    .catch((err) => {
      console.error(`❌ [digest/send-all-digests] Error fatal: ${err.message}`);
    });
});

// ── GET /api/digest/logs ──────────────────────────────────────────────────────
// Query audit logs for digest send attempts (admin/superadmin only)
// Query params: type, status, dateStart, dateEnd, limit, offset

router.get('/logs', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { type, status, dateStart, dateEnd, limit = 50, offset = 0 } = req.query;

    const result = await queryDigestLogs({
      type: type || null,
      status: status || null,
      startDate: dateStart || null,
      endDate: dateEnd || null,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    });

    if (!result.ok) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    res.json({
      ok: true,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      logs: result.logs,
    });
  } catch (err) {
    console.error('[digest/logs]', err.message);
    res.status(500).json({ ok: false, error: `Error al obtener logs: ${err.message}` });
  }
});

module.exports = router;
