const { supabaseAdmin } = require('../utils/supabase');

// ── Checklist notification helper ─────────────────────────────────────────────

async function createChecklistNotifications(cardId, boardId, cardTitle, oldChecklist, newChecklist, authorId) {
  const { data: board } = await supabaseAdmin
    .from('boards')
    .select('workspace_id')
    .eq('id', boardId)
    .single();

  if (!board?.workspace_id) return;

  const oldAssigneeMap = {};
  for (const item of (oldChecklist || [])) {
    oldAssigneeMap[item.id] = new Set(item.assignees || []);
  }

  const toInsert = [];

  for (const item of (newChecklist || [])) {
    const oldSet  = oldAssigneeMap[item.id] || new Set();
    const added   = (item.assignees || []).filter((a) => !oldSet.has(a));
    if (!added.length) continue;

    let userIds;
    if (added.includes('__all__')) {
      const { data: members } = await supabaseAdmin
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', board.workspace_id);
      userIds = (members || []).map((m) => m.user_id).filter((id) => id !== authorId);
    } else {
      userIds = added.filter((id) => id !== authorId);
    }

    const payload = { cardId, cardTitle, boardId, workspaceId: board.workspace_id, checklistText: item.text, mentionedBy: authorId };
    for (const userId of userIds) {
      toInsert.push({ user_id: userId, type: 'checklist_mention', payload, read: false });
    }
  }

  if (toInsert.length) {
    const { error } = await supabaseAdmin.from('notifications').insert(toInsert);
    if (error) console.error('[notifications] insert:', error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const toCard = (row) => ({
  id:             row.id,
  columnId:       row.column_id,
  boardId:        row.board_id,
  title:          row.title,
  description:    row.description    || '',
  category:       row.category       || null,
  priority:       row.priority       || 'medium',
  dueDate:        row.due_date       || null,
  tags:           row.tags           || [],
  checklist:      row.checklist      || [],
  checklistTitle: row.checklist_title || '',
  assigneeId:     row.assignee_id    || null,
  assignee:       row.assignee       || null,
  order:          row.order,
  createdAt:      row.created_at,
  updatedAt:      row.updated_at,
});

const getCardsByBoard = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select('*, assignee:users!assignee_id(id, name, email)')
    .eq('board_id', req.params.boardId)
    .order('order', { ascending: true });

  if (error) { console.error('[cards] getCardsByBoard:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: (data || []).map(toCard) });
};

const getCardsByColumn = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select('*')
    .eq('column_id', req.params.columnId)
    .order('order', { ascending: true });

  if (error) { console.error('[cards] getCardsByColumn:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: (data || []).map(toCard) });
};

const createCard = async (req, res) => {
  const { columnId, boardId, title, description, category, priority, dueDate, tags, checklist, checklistTitle, assigneeId } = req.body;
  if (!columnId || !boardId || !title?.trim()) {
    return res.status(400).json({ error: 'columnId, boardId and title are required' });
  }

  const { data: existing } = await supabaseAdmin
    .from('cards')
    .select('order')
    .eq('column_id', columnId)
    .order('order', { ascending: false })
    .limit(1);

  const maxOrder = existing?.[0]?.order ?? 0;

  const { data, error } = await supabaseAdmin
    .from('cards')
    .insert({
      column_id:       columnId,
      board_id:        boardId,
      organization_id: req.user.organizationId,
      title:           title.trim(),
      description:     description     || '',
      category:        category        || null,
      priority:        priority        || 'medium',
      due_date:        dueDate         || null,
      tags:            Array.isArray(tags)      ? tags      : [],
      checklist:       Array.isArray(checklist) ? checklist : [],
      checklist_title: checklistTitle  || '',
      assignee_id:     assigneeId      || null,
      order:           maxOrder + 1,
    })
    .select()
    .single();

  if (error) { console.error('[cards] createCard:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.status(201).json({ data: toCard(data) });
};

const VALID_PRIORITIES = new Set(['urgent', 'high', 'medium', 'low', 'none']);

const updateCard = async (req, res) => {
  const { title, description, category, priority, dueDate, tags, checklist, checklistTitle, assigneeId } = req.body;

  // Input validation
  if (priority !== undefined && !VALID_PRIORITIES.has(priority)) {
    return res.status(400).json({ error: 'priority must be low, medium, high, or none' });
  }
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 255)) {
    return res.status(400).json({ error: 'title must be a non-empty string under 255 chars' });
  }
  if (dueDate !== undefined && dueDate !== null && isNaN(Date.parse(dueDate))) {
    return res.status(400).json({ error: 'dueDate must be a valid date string' });
  }

  // Fetch previous state for notification diff when checklist is being updated
  let prevCard = null;
  if (checklist !== undefined) {
    const { data: prev } = await supabaseAdmin
      .from('cards')
      .select('checklist, board_id, title')
      .eq('id', req.params.id)
      .single();
    prevCard = prev;
  }

  const update = { updated_at: new Date().toISOString() };
  if (title          !== undefined) update.title           = title.trim();
  if (description    !== undefined) update.description     = description;
  if (category       !== undefined) update.category        = category;
  if (priority       !== undefined) update.priority        = priority;
  if (dueDate        !== undefined) update.due_date        = dueDate || null;
  if (tags           !== undefined) update.tags            = Array.isArray(tags) ? tags : [];
  if (checklist      !== undefined) update.checklist       = Array.isArray(checklist) ? checklist : [];
  if (checklistTitle !== undefined) update.checklist_title = checklistTitle;
  if (assigneeId     !== undefined) update.assignee_id     = assigneeId || null;

  const { data, error } = await supabaseAdmin
    .from('cards')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { console.error('[cards] updateCard:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  // Fire-and-forget: create notifications for newly assigned checklist users
  if (checklist !== undefined && prevCard) {
    createChecklistNotifications(
      req.params.id,
      prevCard.board_id,
      data.title,
      prevCard.checklist,
      checklist,
      req.user.id,
    ).catch((err) => console.error('[notifications] diff failed:', err.message));
  }

  res.json({ data: toCard(data) });
};

const moveCard = async (req, res) => {
  const { columnId, order } = req.body;
  if (!columnId || order === undefined) {
    return res.status(400).json({ error: 'columnId and order are required' });
  }

  const { data: card, error: fetchError } = await supabaseAdmin
    .from('cards')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (fetchError || !card) return res.status(404).json({ error: 'Card not found' });

  const { data: destCol } = await supabaseAdmin
    .from('columns')
    .select('board_id')
    .eq('id', columnId)
    .single();

  if (!destCol) return res.status(404).json({ error: 'Column not found' });

  const srcColumnId = card.column_id;
  const srcOrder    = card.order;
  const destOrder   = order;

  if (srcColumnId === columnId) {
    const { data: siblings } = await supabaseAdmin
      .from('cards')
      .select('id, order')
      .eq('column_id', columnId)
      .neq('id', card.id);

    await Promise.all(
      (siblings || []).flatMap((c) => {
        if (srcOrder < destOrder && c.order > srcOrder && c.order <= destOrder)
          return [supabaseAdmin.from('cards').update({ order: c.order - 1 }).eq('id', c.id)];
        if (srcOrder > destOrder && c.order >= destOrder && c.order < srcOrder)
          return [supabaseAdmin.from('cards').update({ order: c.order + 1 }).eq('id', c.id)];
        return [];
      })
    );
  } else {
    const { data: srcSiblings } = await supabaseAdmin
      .from('cards').select('id, order').eq('column_id', srcColumnId).gt('order', srcOrder);
    const { data: destSiblings } = await supabaseAdmin
      .from('cards').select('id, order').eq('column_id', columnId).gte('order', destOrder);

    await Promise.all([
      ...(srcSiblings  || []).map((c) => supabaseAdmin.from('cards').update({ order: c.order - 1 }).eq('id', c.id)),
      ...(destSiblings || []).map((c) => supabaseAdmin.from('cards').update({ order: c.order + 1 }).eq('id', c.id)),
    ]);
  }

  const { data: updated, error } = await supabaseAdmin
    .from('cards')
    .update({ column_id: columnId, board_id: destCol.board_id, order: destOrder, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { console.error('[cards] moveCard:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: toCard(updated) });
};

const deleteCard = async (req, res) => {
  const { role: wsRole } = req.workspaceMember;
  
  // Biblia matrix: Borrar tarjetas ✅ for owner, admin, member. ❌ for guest/cliente
  if (!['owner', 'admin', 'member'].includes(wsRole)) {
    return res.status(403).json({ error: 'Rol insuficiente para eliminar tarjetas' });
  }

  const { error } = await supabaseAdmin
    .from('cards')
    .delete()
    .eq('id', req.params.id);

  if (error) { console.error('[cards] deleteCard:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ success: true });
};

const searchCards = async (req, res) => {
  const raw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (raw.length < 2) return res.json({ data: [] });
  const q = raw.slice(0, 100); // cap at 100 chars to prevent abuse

  const { data: cards, error } = await supabaseAdmin
    .from('cards')
    .select('*')
    .eq('organization_id', req.user.organizationId)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(15);

  if (error) { console.error('[cards] searchCards:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  if (!cards?.length) return res.json({ data: [] });

  const columnIds = [...new Set(cards.map((c) => c.column_id))];
  const boardIds  = [...new Set(cards.map((c) => c.board_id))];

  const [{ data: cols }, { data: boards }] = await Promise.all([
    supabaseAdmin.from('columns').select('id, title').in('id', columnIds),
    supabaseAdmin.from('boards').select('id, title').in('id', boardIds),
  ]);

  const colMap   = Object.fromEntries((cols   || []).map((c) => [c.id, c.title]));
  const boardMap = Object.fromEntries((boards || []).map((b) => [b.id, b.title]));

  res.json({
    data: cards.map((c) => ({
      ...toCard(c),
      columnTitle: colMap[c.column_id]   ?? '?',
      boardTitle:  boardMap[c.board_id]  ?? '?',
    })),
  });
};

module.exports = {
  getCardsByBoard,
  getCardsByColumn,
  createCard,
  updateCard,
  moveCard,
  deleteCard,
  searchCards,
};
