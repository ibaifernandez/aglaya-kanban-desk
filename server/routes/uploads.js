const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const FileType = require('file-type');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Security: file-type allowlist + blocklist ──────────────────────────────
//
// Hallazgo audit Marianas 2026-05-27 (B-CRIT-01, CVSS 8.0):
//   /uploads/* es servido público por express.static + proxy Netlify desde
//   kanban.aglaya.biz. Un SVG con <script> embebido se ejecutaba same-origin
//   y exfiltraba el JWT desde localStorage. Mitigación en 3 capas.

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/csv',
  'text/plain',
]);

// Tipos peligrosos rechazados explícitamente (defensa en profundidad)
const FORBIDDEN_MIME = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'application/javascript',
  'text/javascript',
  'application/x-shockwave-flash',
  'application/x-msdownload',
]);

// Extensiones peligrosas (defensa adicional contra Content-Type spoofing)
const FORBIDDEN_EXT = /\.(svg|html?|xhtml|js|mjs|swf|exe|bat|cmd|sh|ps1|vbs)$/i;

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uuidv4() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    // Layer 1: rechaza extensiones peligrosas explícitas
    if (FORBIDDEN_EXT.test(file.originalname)) {
      return cb(new Error('FILE_TYPE_FORBIDDEN: extensión no permitida'), false);
    }
    // Layer 2: rechaza MIME peligrosos declarados por cliente
    if (FORBIDDEN_MIME.has(file.mimetype)) {
      return cb(new Error('FILE_TYPE_FORBIDDEN: MIME no permitido'), false);
    }
    // Layer 3: solo acepta MIME en allowlist
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('FILE_TYPE_NOT_ALLOWED: tipo no soportado'), false);
    }
    cb(null, true);
  },
});

// POST /api/uploads  →  { data: { url, name, type } }
const uploadFile = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

      // Layer 4: magic-bytes validation post-upload (anti-spoofing)
      //
      // Tipos texto-plano (CSV, TXT) NO tienen magic bytes detectables por
      // file-type. Se confía en MIME + extension blocklist para ellos.
      const isTextLike = req.file.mimetype === 'text/csv' || req.file.mimetype === 'text/plain';
      if (!isTextLike) {
        const detected = await FileType.fromFile(req.file.path);
        if (!detected || !ALLOWED_MIME.has(detected.mime)) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({
            error: 'FILE_MAGIC_MISMATCH',
            message: 'El contenido del archivo no coincide con un tipo permitido',
          });
        }
      }

      res.json({
        data: {
          url:  `/uploads/${req.file.filename}`,
          name: req.file.originalname,
          type: req.file.mimetype,
        },
      });
    } catch (err) {
      // Si el archivo quedó escrito a disco, borrarlo
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
      }
      next(err);
    }
  },
];

// DELETE /api/uploads/:filename
const deleteFile = (req, res) => {
  const { filename } = req.params;
  if (!filename || filename.includes('/') || filename.includes('..') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }
  const filepath = path.join(UPLOAD_DIR, filename);
  try {
    fs.unlinkSync(filepath);
    res.json({ data: { ok: true } });
  } catch {
    res.status(404).json({ error: 'Archivo no encontrado' });
  }
};

// Mantener alias para compatibilidad con index.js / app.js
module.exports = {
  uploadImage: uploadFile,
  deleteImage: deleteFile,
  uploadFile,
  deleteFile,
  // Exportados para tests
  ALLOWED_MIME,
  FORBIDDEN_MIME,
  FORBIDDEN_EXT,
};
