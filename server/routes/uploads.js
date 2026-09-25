const path   = require('path');
const os     = require('os');
const fs     = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const FileType = require('file-type');
const { crearAlmacen } = require('../utils/almacen-adjuntos');

// ⚠️ ESTE DIRECTORIO YA NO GUARDA NADA: es el paso intermedio entre multer y R2.
// Los adjuntos vivían aquí —en el disco del contenedor, sin volumen montado— y
// **se perdían en cada despliegue**; los cinco que había registrados daban 404
// (tarjeta `4f4e6e2b`). El fichero se sube a R2 y se borra de aquí en el acto.
const DIR_TEMPORAL = path.join(os.tmpdir(), 'akd-adjuntos');
if (!fs.existsSync(DIR_TEMPORAL)) fs.mkdirSync(DIR_TEMPORAL, { recursive: true });

const almacen = crearAlmacen();

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
  destination: DIR_TEMPORAL,
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

      // Layer 5: a R2, que sobrevive al despliegue. Si esto falla, NO se contesta
      // con una URL: una tarjeta con el nombre de un fichero que no está en
      // ninguna parte es exactamente el defecto que esta tarjeta cierra.
      if (!almacen.configurado()) {
        return res.status(503).json({
          error: 'ALMACEN_NO_CONFIGURADO',
          message: 'El almacén de adjuntos no está configurado en este entorno. No se guarda nada a medias.',
        });
      }

      // El flujo se cierra A MANO si la subida falla. `createReadStream` abre el
      // fichero de forma perezosa: si el almacén rechaza antes de leerlo, el
      // flujo se queda abierto, y cuando por fin intenta abrirlo el temporal ya
      // no está — un ENOENT que estalla FUERA de la petición, sin dueño y sin
      // nadie a quien contestar. Lo destapó la prueba del almacén que falla.
      const flujo = fs.createReadStream(req.file.path);
      // Y con oyente de error: `destroy()` sobre un flujo que aún no había
      // abierto el fichero emite el ENOENT igualmente, y un 'error' sin oyente
      // en Node **tumba el proceso**. Un fallo al subir no puede matar al
      // servidor — y menos ahora, que morir es lo que hace bien (`3e2f6a84`).
      flujo.on('error', () => { /* el fallo de la subida ya se contesta abajo */ });
      try {
        await almacen.guardar({
          clave: req.file.filename,
          cuerpo: flujo,
          tipo: req.file.mimetype,
        });
      } finally {
        flujo.destroy();
      }

      res.json({
        data: {
          url:  `/uploads/${req.file.filename}`,
          name: req.file.originalname,
          type: req.file.mimetype,
        },
      });
    } catch (err) {
      next(err);
    } finally {
      // El fichero temporal se va SIEMPRE, salga bien o mal: si se quedara,
      // volveríamos a acumular en el disco efímero que causó la pérdida.
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
      }
    }
  },
];

// DELETE /api/uploads/:filename
function nombreValido(filename) {
  return Boolean(filename) && !filename.includes('/') && !filename.includes('..') && !filename.includes('\\');
}

// DELETE /api/uploads/:filename
//
// ⚠️ CAMBIO DE COMPORTAMIENTO, dicho para que nadie lo descubra por sorpresa:
// antes, con el disco, borrar un fichero que no existía daba **404**. R2 contesta
// éxito al borrar una clave ausente, así que ahora da **200**. El borrado es
// idempotente. Lo señaló el vigilante al revisar `4f4e6e2b`; lo fija
// `server/tests/almacen-adjuntos.test.js`.
const deleteFile = async (req, res, next) => {
  const { filename } = req.params;
  if (!nombreValido(filename)) {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }
  try {
    await almacen.borrar(filename);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
};

// GET /uploads/:filename — los sirve el servidor porque el bucket NO es público.
//
// Y aquí vive la parte honesta de la tarjeta: los cinco adjuntos subidos antes
// del 25-sep-2026 **no están y no se recuperan**. Sus filas siguen en la base con
// su nombre. Antes, pulsarlos daba un `404` pelado —indistinguible de una ruta
// mal escrita—; ahora contestan **410 Gone** y dicen qué pasó. Un enlace que
// finge funcionar es peor que uno que explica que el fichero ya no está.
const serveFile = async (req, res, next) => {
  const { filename } = req.params;
  if (!nombreValido(filename)) return res.status(400).json({ error: 'Nombre de archivo inválido' });

  try {
    const objeto = await almacen.leer(filename);

    if (!objeto) {
      return res.status(410).json({
        error: 'ADJUNTO_PERDIDO',
        message: 'Este adjunto ya no existe. Los ficheros subidos antes del 25-sep-2026 se guardaban en el disco del contenedor y se perdieron en un despliegue; no hay copia. Los de ahora viven fuera y sobreviven.',
      });
    }

    if (objeto.tipo)   res.set('Content-Type', objeto.tipo);
    if (objeto.tamano) res.set('Content-Length', String(objeto.tamano));
    // `X-Content-Type-Options: nosniff` NO se pone aquí: helmet ya lo pone en
    // TODAS las respuestas (`app.js`). Llegué a escribirlo, y mi propia prueba
    // lo daba por bueno sin que la línea existiera — o sea, medía helmet y no
    // esta ruta. Una defensa duplicada que nadie mide es una creencia.
    objeto.cuerpo.pipe(res);
  } catch (err) {
    next(err);
  }
};

// Mantener alias para compatibilidad con index.js / app.js
module.exports = {
  uploadImage: uploadFile,
  deleteImage: deleteFile,
  uploadFile,
  deleteFile,
  serveFile,
  DIR_TEMPORAL,
  // Exportados para tests
  ALLOWED_MIME,
  FORBIDDEN_MIME,
  FORBIDDEN_EXT,
};
