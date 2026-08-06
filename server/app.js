/**
 * app.js — Express application (sin listen).
 *
 * Exporta la app configurada para que pueda ser importada
 * por los tests sin arrancar el servidor TCP.
 * El punto de entrada real es index.js.
 */
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

const { getBoards, createBoard, updateBoard, deleteBoard, reorderBoards } = require('./routes/boards');
const { getColumns, createColumn, updateColumn, deleteColumn } = require('./routes/columns');
const {
  getCardsByBoard,
  getCardsByColumn,
  createCard,
  updateCard,
  moveCard,
  deleteCard,
  searchCards,
  getCardHistory,
} = require('./routes/cards');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('./routes/categories');
const { uploadImage, deleteImage } = require('./routes/uploads');
const authRouter              = require('./routes/auth');
const digestRouter            = require('./routes/digestRoute');
const adminRouter             = require('./routes/admin');
const workspacesRouter        = require('./routes/workspaces');
const mediaRouter             = require('./routes/media');
const notificationsRouter     = require('./routes/notifications');
const internalRouter          = require('./routes/internalRoute');
const { requireAuth }         = require('./middleware/auth');
const { requireWorkspaceMember } = require('./middleware/workspace');

const app = express();
app.set('trust proxy', 1);

// ── Security headers ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy:      isProd,
  crossOriginEmbedderPolicy:  isProd,
}));

// ── CORS ───────────────────────────────────────────────────
// allowlist incluye api.kanban.aglaya.biz para cuando el custom domain
// esté setup (ver docs/runbooks/railway-custom-domain.md — B-03).
const allowedOrigins = isProd
  ? ['https://kanban.aglaya.biz', 'https://api.kanban.aglaya.biz']
  : ['http://localhost:5175'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());

// ── B-03 host monitor — detecta acceso directo a Railway URL ──
// Si request entra con Host: web-production-*.up.railway.app → log a
// Sentry como signal de bypass intentado del proxy Netlify.
// Cuando custom domain api.kanban.aglaya.biz esté setup, esto detecta
// tráfico fuera del path esperado.
if (isProd) {
  const { Sentry, enabled: sentryEnabled } = require('./utils/sentry');
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    // Skip health (uptime monitors pueden tocar URL directa) e internal cron
    if (req.path === '/api/health' || req.path.startsWith('/api/digest/cron-trigger')) {
      return next();
    }
    if (host.includes('.railway.app') || host.includes('.up.railway.app')) {
      const ua = req.headers['user-agent'] || '';
      const forwardedFor = req.headers['x-forwarded-for'] || req.ip || '';
      console.warn(`[B-03 monitor] direct railway access: host=${host} path=${req.path} ua=${ua.slice(0,80)} ip=${forwardedFor}`);
      if (sentryEnabled) {
        Sentry.captureMessage('B-03 direct railway access detected', {
          level: 'warning',
          tags: { audit: 'B-03', host, path: req.path },
          extra: { user_agent: ua, ip: forwardedFor },
        });
      }
      // NO bloqueamos todavía — solo loggeamos. Cambiar a 403 cuando
      // el patrón de tráfico legítimo esté confirmado (≥1 semana data).
    }
    next();
  });
}

// ── Rate limiting (B-06 audit Mariana) ─────────────────────
//
// 3 limiters por tipo de endpoint, todos por IP:
//   - globalLimiter: baseline para todos los /api/* (anti-DoS, generous)
//   - authLimiter: estricto en /api/auth (anti-brute-force, vs. login spam)
//   - internalLimiter: muy estricto en /api/internal (token guessing — B-09)

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,         // 15 min
  max: 300,                          // 300 req per IP per 15min → 20 req/min sostenido
  message: { error: 'Demasiadas peticiones. Espera unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limit en healthcheck (uptime monitors) y workflow_dispatch internos
  skip: (req) => req.path === '/api/health',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const internalLimiter = rateLimit({
  windowMs: 60 * 1000,              // 1 min ventana
  max: 10,                          // 10 req/min absolute — secret-guess detection
  message: { error: 'Internal route rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Request timing ─────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (ms > 500) console.warn(`[SLOW] ${req.method} ${req.path} → ${ms}ms`);
    else          console.log(`[req]  ${req.method} ${req.path} → ${ms}ms`);
  });
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Global rate limit baseline (B-06 audit Mariana) ────────
// Aplica a TODAS las rutas /api/* salvo /api/health.
// Más estricto sobre /api/auth (authLimiter) y /api/internal (internalLimiter).
app.use('/api', globalLimiter);

// ── Auth (rate-limited extra) ──────────────────────────────
app.use('/api/auth', authLimiter, authRouter);

// ── Digest ────────────────────────────────────────────────
app.use('/api/digest', digestRouter);

// ── Admin ─────────────────────────────────────────────────
app.use('/api/admin', adminRouter);

// ── Workspaces ────────────────────────────────────────────
app.use('/api/workspaces', workspacesRouter);

// ── Media (Supabase Storage) ───────────────────────────────
app.use('/api/media', mediaRouter);

// ── Notifications ─────────────────────────────────────────
app.use('/api/notifications', notificationsRouter);

// ── Boards ────────────────────────────────────────────────
app.get('/api/boards',          requireAuth, getBoards);
app.post('/api/boards',         requireAuth, requireWorkspaceMember, createBoard);
app.put('/api/boards/reorder',  requireAuth, requireWorkspaceMember, reorderBoards);   // must come before /:id
app.put('/api/boards/:id',      requireAuth, requireWorkspaceMember, updateBoard);
app.delete('/api/boards/:id',   requireAuth, requireWorkspaceMember, deleteBoard);

// ── Columns ───────────────────────────────────────────────
app.get('/api/boards/:boardId/columns',  requireAuth, requireWorkspaceMember, getColumns);
app.post('/api/boards/:boardId/columns', requireAuth, requireWorkspaceMember, createColumn);
app.put('/api/columns/:id',              requireAuth, requireWorkspaceMember, updateColumn);
app.delete('/api/columns/:id',           requireAuth, requireWorkspaceMember, deleteColumn);

// ── Cards ─────────────────────────────────────────────────
app.get('/api/cards/search',              requireAuth, searchCards);   // must come before /:id routes
app.get('/api/cards/:id/history',         requireAuth, requireWorkspaceMember, getCardHistory);
app.get('/api/boards/:boardId/cards',     requireAuth, requireWorkspaceMember, getCardsByBoard);
app.get('/api/columns/:columnId/cards',   requireAuth, requireWorkspaceMember, getCardsByColumn);
app.post('/api/cards',                    requireAuth, requireWorkspaceMember, createCard);
app.put('/api/cards/:id/move',            requireAuth, requireWorkspaceMember, moveCard);      // must come before /:id
app.put('/api/cards/:id',                 requireAuth, requireWorkspaceMember, updateCard);
app.delete('/api/cards/:id',              requireAuth, requireWorkspaceMember, deleteCard);

// ── Uploads ───────────────────────────────────────────────
app.post('/api/uploads',             requireAuth, uploadImage);
app.delete('/api/uploads/:filename', requireAuth, deleteImage);

// ── Categories ────────────────────────────────────────────
app.get('/api/categories',        requireAuth, getCategories);
app.post('/api/categories',       requireAuth, createCategory);
app.put('/api/categories/:id',    requireAuth, updateCategory);
app.delete('/api/categories/:id', requireAuth, deleteCategory);

// ── Internal (secret-authenticated, no JWT) ───────────────
// internalLimiter es ADICIONAL al globalLimiter (more strict) — anti-secret-guessing (B-09).
app.use('/api/internal', internalLimiter, internalRouter);

// ── Health ────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── Upload error handler ──────────────────────────────────
// Captura errores específicos de multer (fileFilter, limits) antes del
// global handler para devolver 4xx con mensaje claro en vez de 500.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, next) => {
  if (err && typeof err.message === 'string' && err.message.startsWith('FILE_TYPE_')) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'FILE_TOO_LARGE' });
  }
  next(err);
});

// ── 404 — ruta no encontrada ──────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Global error handler ──────────────────────────────────
// Captura cualquier error no manejado en rutas y middlewares.
// Sin esto, Express devuelve HTML en lugar de JSON al cliente.
// Sentry captura errores 500+ para observabilidad (D-01 audit Mariana).
const { Sentry, enabled: sentryEnabled } = require('./utils/sentry');
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[unhandled error]', err?.message ?? err);
  const status = err?.status ?? 500;
  // Solo reportar 5xx + 4xx críticos a Sentry (no 4xx triviales)
  if (sentryEnabled && status >= 500) {
    Sentry.captureException(err);
  }
  res.status(status).json({
    error: isProd ? 'Error interno del servidor' : (err?.message ?? 'Error desconocido'),
  });
});

module.exports = app;
