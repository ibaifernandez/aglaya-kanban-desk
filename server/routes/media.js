const express = require('express');
const multer  = require('multer');
const path    = require('path');
const { supabaseAdmin }        = require('../utils/supabase');
const { requireAuth }          = require('../middleware/auth');
const { requireWorkspaceMember, requireWorkspaceRole } = require('../middleware/workspace');

const router = express.Router();

// Memory storage — we pipe the buffer directly to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (jpg, png, gif, webp)'));
    }
  },
});

// ── POST /api/media/users/me/avatar ──────────────────────────────────────────
// Uploads current user's avatar to Supabase Storage and updates users.avatar_url

router.post('/users/me/avatar', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  const ext      = path.extname(req.file.originalname).toLowerCase();
  const filePath = `avatars/${req.user.id}${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('media')
    .upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert:      true,
    });

  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('media')
    .getPublicUrl(filePath);

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ avatar_url: publicUrl })
    .eq('id', req.user.id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  res.json({ data: { avatarUrl: publicUrl } });
});

// ── POST /api/media/workspaces/:workspaceId/cover ─────────────────────────────
// Uploads workspace cover image and updates workspaces.cover_url

router.post(
  '/workspaces/:workspaceId/cover',
  requireAuth,
  requireWorkspaceMember,
  requireWorkspaceRole('owner', 'admin'),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    const { workspaceId } = req.params;
    const ext      = path.extname(req.file.originalname).toLowerCase();
    const filePath = `workspace-covers/${workspaceId}${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('media')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert:      true,
      });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('media')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabaseAdmin
      .from('workspaces')
      .update({ cover_url: publicUrl })
      .eq('id', workspaceId);

    if (updateError) return res.status(500).json({ error: updateError.message });

    res.json({ data: { coverUrl: publicUrl } });
  }
);

module.exports = router;
