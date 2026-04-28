const express           = require('express');
const { supabaseAdmin } = require('../utils/supabase');
const { requireAuth }   = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — user's notifications, unread first, max 50
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('read', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) { console.error('[notifications] get:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: data || [] });
});

// PATCH /api/notifications/read-all — must be before /:id/read (static before dynamic)
router.patch('/read-all', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', req.user.id)
    .eq('read', false);

  if (error) { console.error('[notifications] markAllRead:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: { ok: true } });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) { console.error('[notifications] markRead:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: { ok: true } });
});

module.exports = router;
