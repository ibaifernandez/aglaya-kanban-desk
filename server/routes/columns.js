const { supabaseAdmin } = require('../utils/supabase');

const toColumn = (row) => ({
  id:          row.id,
  boardId:     row.board_id,
  title:       row.title,
  order:       row.order,
  defaultSort: row.default_sort || null,
  createdAt:   row.created_at,
});

const getColumns = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('columns')
    .select('*')
    .eq('board_id', req.params.boardId)
    .order('order', { ascending: true });

  if (error) { console.error('[columns] getColumns:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: (data || []).map(toColumn) });
};

const createColumn = async (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  const { data: existing } = await supabaseAdmin
    .from('columns')
    .select('order')
    .eq('board_id', req.params.boardId)
    .order('order', { ascending: false })
    .limit(1);

  const maxOrder = existing?.[0]?.order ?? 0;

  const { data, error } = await supabaseAdmin
    .from('columns')
    .insert({ board_id: req.params.boardId, title: title.trim(), order: maxOrder + 1 })
    .select()
    .single();

  if (error) { console.error('[columns] createColumn:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.status(201).json({ data: toColumn(data) });
};

const updateColumn = async (req, res) => {
  const { title, order, defaultSort } = req.body;
  const update = {};
  if (title?.trim())         update.title        = title.trim();
  if (order !== undefined)   update.order        = order;
  if (defaultSort !== undefined) update.default_sort = defaultSort;

  const { data, error } = await supabaseAdmin
    .from('columns')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { console.error('[columns] updateColumn:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: toColumn(data) });
};

const deleteColumn = async (req, res) => {
  const { error } = await supabaseAdmin
    .from('columns')
    .delete()
    .eq('id', req.params.id);

  if (error) { console.error('[columns] deleteColumn:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ success: true });
};

module.exports = { getColumns, createColumn, updateColumn, deleteColumn };
