const express = require('express');
const multer  = require('multer');
const path    = require('path');
const { supabaseAdmin }        = require('../utils/supabase');
const { requireAuth }          = require('../middleware/auth');
const { requireWorkspaceMember, requireWorkspaceRole } = require('../middleware/workspace');
const { withCacheBuster }      = require('../utils/mediaUrl');

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

  if (uploadError) { console.error('[media] avatar upload:', uploadError.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('media')
    .getPublicUrl(filePath);

  // La ruta es determinista y `upsert` la sobrescribe, así que la URL sería
  // idéntica y el navegador seguiría sirviendo la imagen vieja. Ver utils/mediaUrl.
  const versionedUrl = withCacheBuster(publicUrl);

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ avatar_url: versionedUrl })
    .eq('id', req.user.id);

  if (updateError) { console.error('[media] avatar update user:', updateError.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  res.json({ data: { avatarUrl: versionedUrl } });
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

    if (uploadError) { console.error('[media] cover upload:', uploadError.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('media')
      .getPublicUrl(filePath);

    // Sin esto la URL no cambia entre subidas y el navegador sigue mostrando la
    // portada anterior — el bug que hacía parecer que no se guardaba nada.
    const versionedUrl = withCacheBuster(publicUrl);

    const { error: updateError } = await supabaseAdmin
      .from('workspaces')
      .update({ cover_url: versionedUrl })
      .eq('id', workspaceId);

    if (updateError) { console.error('[media] cover update workspace:', updateError.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

    res.json({ data: { coverUrl: versionedUrl } });
  }
);

module.exports = router;
