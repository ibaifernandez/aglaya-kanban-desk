const express = require('express');
const cors    = require('cors');
const path    = require('path');
const helmet  = require('helmet');
require('dotenv').config();

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
const { requireAuth }         = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3003;

// ── Security headers ───────────────────────────────────────
app.use(helmet({
  // Allow Vite dev server to load resources in development
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: [
    'http://localhost:5175',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://myboardlfi.netlify.app',
    'https://myboardlfi.ibaifernandez.com',
  ],
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Auth ──────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ── Digest ────────────────────────────────────────────────
app.use('/api/digest', digestRouter);

// ── Boards ────────────────────────────────────────────────
app.get('/api/boards',          requireAuth, getBoards);
app.post('/api/boards',         requireAuth, createBoard);
app.put('/api/boards/reorder',  requireAuth, reorderBoards);   // must come before /:id
app.put('/api/boards/:id',      requireAuth, updateBoard);
app.delete('/api/boards/:id',   requireAuth, deleteBoard);

// ── Columns ───────────────────────────────────────────────
app.get('/api/boards/:boardId/columns',  requireAuth, getColumns);
app.post('/api/boards/:boardId/columns', requireAuth, createColumn);
app.put('/api/columns/:id',              requireAuth, updateColumn);
app.delete('/api/columns/:id',           requireAuth, deleteColumn);

// ── Cards ─────────────────────────────────────────────────
app.get('/api/cards/search',              requireAuth, searchCards);   // must come before /:id routes
app.get('/api/boards/:boardId/cards',     requireAuth, getCardsByBoard);
app.get('/api/columns/:columnId/cards',   requireAuth, getCardsByColumn);
app.post('/api/cards',                    requireAuth, createCard);
app.put('/api/cards/:id/move',            requireAuth, moveCard);      // must come before /:id
app.put('/api/cards/:id',                 requireAuth, updateCard);
app.delete('/api/cards/:id',              requireAuth, deleteCard);

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

app.listen(PORT, () => {
  console.log(`MyBoardLFi server → http://localhost:${PORT}`);
  // Digest automático solo en desarrollo local — en producción se envía
  // bajo demanda desde el botón "Enviarme mis tareas" del Toolbar.
  // Reactivar cuando la migración a Supabase esté completa y cada
  // usuario tenga sus propias tareas.
  if (process.env.NODE_ENV !== 'production') {
    require('./digest').startDigestScheduler();
  }
});
