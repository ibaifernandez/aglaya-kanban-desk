const { supabaseAdmin } = require('../utils/supabase');

const toCard = (row) => ({
  id:             row.id,
  columnId:       row.column_id,
  boardId:        row.board_id,
  title:          row.title,
  description:    row.description    || '',
  category:       row.category       || 'personal',
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

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: (data || []).map(toCard) });
};

const getCardsByColumn = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select('*')
    .eq('column_id', req.params.columnId)
    .order('order', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
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
      category:        category        || 'personal',
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

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ data: toCard(data) });
};

const updateCard = async (req, res) => {
  const fieldMap = {
    title:          'title',
    description:    'description',
    category:       'category',
    priority:       'priority',
    dueDate:        'due_date',
    tags:           'tags',
    checklist:      'checklist',
    checklistTitle: 'checklist_title',
    assigneeId:     'assignee_id',
  };

  const update = { updated_at: new Date().toISOString() };
  Object.entries(fieldMap).forEach(([camel, snake]) => {
    if (req.body[camel] !== undefined) update[snake] = req.body[camel];
  });

  const { data, error } = await supabaseAdmin
    .from('cards')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
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

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: toCard(updated) });
};

const deleteCard = async (req, res) => {
  const { error } = await supabaseAdmin
    .from('cards')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
};

const searchCards = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ data: [] });

  const { data: cards, error } = await supabaseAdmin
    .from('cards')
    .select('*')
    .eq('organization_id', req.user.organizationId)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(15);

  if (error) return res.status(500).json({ error: error.message });
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
