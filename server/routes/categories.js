const { supabaseAdmin } = require('../utils/supabase');

const toCat = (row) => ({
  id:      row.id,
  label:   row.label,
  colorId: row.color_id,
});

const getCategories = async (req, res) => {
  const { boardId } = req.query;

  let query = supabaseAdmin
    .from('categories')
    .select('*')
    .eq('organization_id', req.user.organizationId);

  if (boardId) {
    query = query.eq('board_id', boardId);
  } else {
    query = query.is('board_id', null);
  }

  const { data, error } = await query;
  if (error) { console.error('[categories] getCategories:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: (data || []).map(toCat) });
};

const createCategory = async (req, res) => {
  const { label, colorId, boardId } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: 'label is required' });

  const insert = {
    label:           label.trim(),
    color_id:        colorId || 'blue',
    organization_id: req.user.organizationId,
  };
  if (boardId) insert.board_id = boardId;

  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert(insert)
    .select()
    .single();

  if (error) { console.error('[categories] createCategory:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.status(201).json({ data: toCat(data) });
};

const updateCategory = async (req, res) => {
  const { label, colorId } = req.body;
  const update = {};
  if (label   !== undefined) update.label    = label.trim();
  if (colorId !== undefined) update.color_id = colorId;

  const { data, error } = await supabaseAdmin
    .from('categories')
    .update(update)
    .eq('id', req.params.id)
    .eq('organization_id', req.user.organizationId)
    .select()
    .single();

  if (error) { console.error('[categories] updateCategory:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: toCat(data) });
};

const deleteCategory = async (req, res) => {
  const { error } = await supabaseAdmin
    .from('categories')
    .delete()
    .eq('id', req.params.id)
    .eq('organization_id', req.user.organizationId);

  if (error) { console.error('[categories] deleteCategory:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ success: true });
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
