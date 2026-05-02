const express        = require('express');
const { supabaseAdmin } = require('../utils/supabase');

const router = express.Router();

const VALID_PRIORITIES = new Set(['urgent', 'high', 'medium', 'low', 'none']);

function verifySecret(req, res, next) {
  const secret = process.env.TASK_SECRET;
  if (!secret) return res.status(500).json({ error: 'TASK_SECRET no configurado.' });
  if (req.headers['x-task-secret'] !== secret) return res.status(401).json({ error: 'No autorizado.' });
  next();
}

// ── POST /api/internal/create-card ────────────────────────────────────────────
// Crea una card en el Backlog del tablero indicado, sin JWT.
// Autenticado con x-task-secret header.
//
// Body:
//   title        {string}  requerido
//   boardName    {string}  requerido — nombre exacto (case-insensitive) del tablero
//   priority     {string}  opcional — urgent|high|medium|low|none (default: medium)
//   description  {string}  opcional
//   dueDate      {string}  opcional — ISO 8601
//   workspaceName {string} opcional — default "Ibai Fernández"

router.post('/create-card', verifySecret, async (req, res) => {
  const {
    title,
    boardName,
    priority     = 'medium',
    description  = '',
    dueDate      = null,
    workspaceName = 'Ibai Fernández',
  } = req.body;

  if (!title?.trim())     return res.status(400).json({ error: 'title es obligatorio.' });
  if (!boardName?.trim()) return res.status(400).json({ error: 'boardName es obligatorio.' });

  const safePriority = VALID_PRIORITIES.has(priority) ? priority : 'medium';

  // 1. Workspace por nombre (partial match para tolerar emojis en el título)
  const { data: workspaces, error: wsError } = await supabaseAdmin
    .from('workspaces')
    .select('id, organization_id, name')
    .ilike('name', `%${workspaceName}%`);

  if (wsError || !workspaces?.length) {
    return res.status(404).json({ error: `Workspace "${workspaceName}" no encontrado.` });
  }
  const workspace = workspaces[0];

  // 2. Tablero por nombre dentro del workspace (partial match para tolerar emojis)
  const { data: boards, error: boardError } = await supabaseAdmin
    .from('boards')
    .select('id, title')
    .eq('workspace_id', workspace.id)
    .ilike('title', `%${boardName}%`);

  const board = boards?.[0];
  const boardError2 = boardError || !board;

  if (boardError2) {
    return res.status(404).json({ error: `Tablero "${boardName}" no encontrado en workspace "${workspace.name}".` });
  }

  // 3. Columna Backlog (o primera columna del tablero)
  const { data: columns, error: colError } = await supabaseAdmin
    .from('columns')
    .select('id, title')
    .eq('board_id', board.id)
    .order('order', { ascending: true });

  if (colError || !columns?.length) {
    return res.status(404).json({ error: `No hay columnas en el tablero "${board.title}".` });
  }

  const targetColumn = columns.find(c => /backlog/i.test(c.title)) ?? columns[0];

  // 4. Orden al final de la columna
  const { data: existing } = await supabaseAdmin
    .from('cards')
    .select('order')
    .eq('column_id', targetColumn.id)
    .order('order', { ascending: false })
    .limit(1);

  const maxOrder = existing?.[0]?.order ?? 0;

  // 5. Insertar card
  const { data: card, error: cardError } = await supabaseAdmin
    .from('cards')
    .insert({
      column_id:       targetColumn.id,
      board_id:        board.id,
      organization_id: workspace.organization_id,
      title:           title.trim(),
      description:     description || '',
      priority:        safePriority,
      due_date:        dueDate || null,
      tags:            [],
      checklist:       [],
      checklist_title: '',
      order:           maxOrder + 1,
    })
    .select()
    .single();

  if (cardError) {
    console.error('[internal/create-card]', cardError.message);
    return res.status(500).json({ error: 'Error al crear la card.' });
  }

  console.log(`[internal/create-card] "${card.title}" → ${board.title} / ${targetColumn.title}`);

  res.status(201).json({
    ok:    true,
    card: {
      id:        card.id,
      title:     card.title,
      priority:  card.priority,
      column:    targetColumn.title,
      board:     board.title,
      workspace: workspaceName,
    },
  });
});

module.exports = router;
