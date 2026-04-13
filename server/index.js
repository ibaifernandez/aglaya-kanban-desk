const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
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
} = require('./routes/cards');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('./routes/categories');
const { uploadImage, deleteImage } = require('./routes/uploads');
const authRouter              = require('./routes/auth');
const digestRouter            = require('./routes/digestRoute');
const adminRouter             = require('./routes/admin');
const workspacesRouter        = require('./routes/workspaces');
const mediaRouter             = require('./routes/media');
const { requireAuth }         = require('./middleware/auth');
const { requireWorkspaceMember } = require('./middleware/workspace');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3003;

// ── Security headers ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy:      isProd,
  crossOriginEmbedderPolicy:  isProd,
}));

// ── CORS ───────────────────────────────────────────────────
const allowedOrigins = isProd
  ? ['https://kanban.aglaya.biz']
  : ['http://localhost:5175'];

app.use(cors({ origin: allowedOrigins }));

// ── Rate limiting ──────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
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

// ── Auth (rate-limited) ────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);

// ── Digest ────────────────────────────────────────────────
app.use('/api/digest', digestRouter);

// ── Admin ─────────────────────────────────────────────────
app.use('/api/admin', adminRouter);

// ── Workspaces ────────────────────────────────────────────
app.use('/api/workspaces', workspacesRouter);

// ── Media (Supabase Storage) ───────────────────────────────
app.use('/api/media', mediaRouter);

// ── Boards ────────────────────────────────────────────────
app.get('/api/boards',          requireAuth, getBoards);
app.post('/api/boards',         requireAuth, requireWorkspaceMember, createBoard);
app.put('/api/boards/reorder',  requireAuth, reorderBoards);   // must come before /:id
app.put('/api/boards/:id',      requireAuth, requireWorkspaceMember, updateBoard);
app.delete('/api/boards/:id',   requireAuth, requireWorkspaceMember, deleteBoard);

// ── Columns ───────────────────────────────────────────────
app.get('/api/boards/:boardId/columns',  requireAuth, requireWorkspaceMember, getColumns);
app.post('/api/boards/:boardId/columns', requireAuth, requireWorkspaceMember, createColumn);
app.put('/api/columns/:id',              requireAuth, requireWorkspaceMember, updateColumn);
app.delete('/api/columns/:id',           requireAuth, requireWorkspaceMember, deleteColumn);

// ── Cards ─────────────────────────────────────────────────
app.get('/api/cards/search',              requireAuth, searchCards);   // must come before /:id routes
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
app.get('/api/categories',     requireAuth, getCategories);
app.post('/api/categories',    requireAuth, createCategory);
app.put('/api/categories/:id', requireAuth, updateCategory);
app.delete('/api/categories/:id', requireAuth, deleteCategory);

// ── Health ────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// Export app for testing; only listen when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AGLAYA Kanban Desk server → http://localhost:${PORT}`);
    require('./digest').startDigestScheduler();
    require('./userDigest').startUserDigestScheduler();
  });
}

module.exports = app;
