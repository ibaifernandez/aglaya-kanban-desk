const { supabaseAdmin } = require('../utils/supabase');

const toColumn = (row) => ({
  id:          row.id,
  boardId:     row.board_id,
  title:       row.title,
  order:       row.order,
  defaultSort: row.default_sort || null,
  createdAt:   row.created_at,
});

// ── Orden de las columnas ─────────────────────────────────────────────────────
// Las columnas de un tablero dejan de ser decoración cuando el tablero ES el
// protocolo: cada una es un estado con dueño. Un tablero con dos columnas
// compartiendo número deja el orden visual en manos del desempate de la
// interfaz, no de lo que se pidió.
//
// La regla que sostiene esto: **después de cualquier cambio, el tablero queda
// numerado 1..N, contiguo y sin repetidos.** No se parchea la fila tocada; se
// renumera el tablero entero. Es más escritura y mucho menos margen: no hay
// estado intermedio que pueda quedarse.
//
// Lo que NO cubre, dicho en voz alta: no hay restricción UNIQUE en la base, así
// que una escritura directa puede volver a romperlo. Sostenerlo de verdad exige
// una función transaccional con la restricción DEFERRABLE — el mismo cambio que
// la tarjeta «Tres formas de aterrizar mal» dejó abierto para el orden de las
// TARJETAS. Ponerla a medias rompería el reordenado legítimo.
async function renumberBoard(boardId, { moveId = null, toPosition = null } = {}) {
  const { data: rows, error } = await supabaseAdmin
    .from('columns')
    .select('id, order, created_at')
    .eq('board_id', boardId)
    .order('order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return { error };

  let ordered = rows || [];

  // Reposicionar: se saca la columna de donde esté y se mete donde se pidió.
  // `toPosition` es 1-based porque es lo que ve quien la pide; fuera de rango se
  // recorta a los extremos en vez de fallar — pedir "la última" con un número
  // grande es una intención legítima, no un error.
  if (moveId && toPosition !== null) {
    const idx = ordered.findIndex((c) => c.id === moveId);
    if (idx !== -1) {
      const [moved] = ordered.splice(idx, 1);
      const target = Math.max(0, Math.min(ordered.length, toPosition - 1));
      ordered.splice(target, 0, moved);
    }
  }

  // Solo se escriben las filas cuyo número cambia de verdad.
  const writes = ordered
    .map((c, i) => ({ id: c.id, order: i + 1, was: c.order }))
    .filter((c) => c.order !== c.was);

  for (const w of writes) {
    const { error: upErr } = await supabaseAdmin
      .from('columns')
      .update({ order: w.order })
      .eq('id', w.id);
    if (upErr) return { error: upErr };
  }

  return { error: null };
}

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
  const { role: wsRole } = req.workspaceMember;
  
  // Biblia matrix: Only owner, admin, member can manage columns (structural)
  if (!['owner', 'admin', 'member'].includes(wsRole)) {
    return res.status(403).json({ error: 'Rol insuficiente para crear columnas' });
  }

  const { title, order } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  if (order !== undefined && (!Number.isInteger(order) || order < 1)) {
    return res.status(400).json({ error: 'order must be a positive integer (1 = first column)' });
  }

  const { data: existing } = await supabaseAdmin
    .from('columns')
    .select('order')
    .eq('board_id', req.params.boardId)
    .order('order', { ascending: false })
    .limit(1);

  const maxOrder = existing?.[0]?.order ?? 0;

  // Nace al final SIEMPRE, y si se pidió una posición se coloca renumerando. Un
  // solo camino para colocar columnas: antes se insertaba con el número pedido
  // y encima de quien lo tuviera, y ese era el defecto.
  const { data, error } = await supabaseAdmin
    .from('columns')
    .insert({ board_id: req.params.boardId, title: title.trim(), order: maxOrder + 1 })
    .select()
    .single();

  if (error) { console.error('[columns] createColumn:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  if (order !== undefined) {
    const { error: reErr } = await renumberBoard(req.params.boardId, { moveId: data.id, toPosition: order });
    if (reErr) { console.error('[columns] createColumn/renumber:', reErr.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

    const { data: fresh } = await supabaseAdmin.from('columns').select('*').eq('id', data.id).single();
    return res.status(201).json({ data: toColumn(fresh || data) });
  }

  res.status(201).json({ data: toColumn(data) });
};

const updateColumn = async (req, res) => {
  const { role: wsRole } = req.workspaceMember;
  
  if (!['owner', 'admin', 'member'].includes(wsRole)) {
    return res.status(403).json({ error: 'Rol insuficiente para modificar columnas' });
  }

  const { title, order, defaultSort } = req.body;

  if (order !== undefined && (!Number.isInteger(order) || order < 1)) {
    return res.status(400).json({ error: 'order must be a positive integer (1 = first column)' });
  }

  // `order` sale del parche a propósito. Escribirlo aquí es el defecto: ponía el
  // número pedido sin mirar quién lo ocupaba, y dos columnas acababan con el
  // mismo. Se reposiciona abajo, renumerando el tablero entero.
  const update = {};
  if (title?.trim())             update.title        = title.trim();
  if (defaultSort !== undefined) update.default_sort = defaultSort;

  if (Object.keys(update).length) {
    const { error } = await supabaseAdmin
      .from('columns')
      .update(update)
      .eq('id', req.params.id);
    if (error) { console.error('[columns] updateColumn:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  }

  if (order !== undefined) {
    const { data: current, error: curErr } = await supabaseAdmin
      .from('columns')
      .select('board_id')
      .eq('id', req.params.id)
      .single();

    if (curErr || !current) {
      console.error('[columns] updateColumn: columna no encontrada');
      return res.status(404).json({ error: 'Columna no encontrada' });
    }

    const { error: reErr } = await renumberBoard(current.board_id, { moveId: req.params.id, toPosition: order });
    if (reErr) { console.error('[columns] updateColumn/renumber:', reErr.message); return res.status(500).json({ error: 'Error interno del servidor' }); }
  }

  const { data, error } = await supabaseAdmin
    .from('columns')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) { console.error('[columns] updateColumn: relectura falló'); return res.status(500).json({ error: 'Error interno del servidor' }); }
  res.json({ data: toColumn(data) });
};

const deleteColumn = async (req, res) => {
  const { role: wsRole } = req.workspaceMember;
  
  if (!['owner', 'admin', 'member'].includes(wsRole)) {
    return res.status(403).json({ error: 'Rol insuficiente para eliminar columnas' });
  }

  // ⚠️ `cards.column_id` tiene ON DELETE CASCADE. Sin esta guarda, borrar una
  // columna se lleva sus tarjetas por delante y devuelve `success: true` — la
  // forma de fallo que esta nave existe para hacer imposible, y la peor de
  // todas: lo que se pierde aquí no está en ningún otro sitio.
  //
  // No molestaba mientras solo se podía borrar desde la interfaz, donde quien
  // borra ve lo que hay dentro. El riel no ve nada, así que la guarda entra en
  // el mismo cambio que la herramienta — no después.
  const { data: cards, error: countError } = await supabaseAdmin
    .from('cards')
    .select('id')
    .eq('column_id', req.params.id);

  if (countError) { console.error('[columns] deleteColumn/count:', countError.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  if ((cards || []).length > 0) {
    return res.status(409).json({
      error:
        `La columna tiene ${cards.length} tarjeta(s) dentro y borrarla se las ` +
        'llevaría por delante. Muévelas antes: esto no las borra por ti a propósito.',
      cards: cards.length,
    });
  }

  const { data: current } = await supabaseAdmin
    .from('columns')
    .select('board_id')
    .eq('id', req.params.id)
    .single();

  const { error } = await supabaseAdmin
    .from('columns')
    .delete()
    .eq('id', req.params.id);

  if (error) { console.error('[columns] deleteColumn:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  // Borrar deja un hueco. Se cierra para que el tablero siga siendo 1..N.
  if (current?.board_id) {
    const { error: reErr } = await renumberBoard(current.board_id);
    if (reErr) console.error('[columns] deleteColumn/renumber:', reErr.message);
  }

  res.json({ success: true });
};

module.exports = { getColumns, createColumn, updateColumn, deleteColumn };
