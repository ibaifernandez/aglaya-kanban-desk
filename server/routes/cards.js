const { supabaseAdmin } = require('../utils/supabase');
const { createAssigneeNotification } = require('../utils/assigneeNotification');
const { isValidPriority, priorityList } = require('../constants/priorities');

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

// La campana de asignación vive en `server/utils/assigneeNotification.js` desde
// el 25-ago-2026: la Puerta 2 también avisa (tarjeta `b0a46770`), y dos campanas
// separadas se desincronizan sin que nadie lo note.
//
// Las GUARDAS se quedan aquí, en cada llamada, y no se mudan con ella: dependen
// de saber quién llama, y cada puerta sabe cosas distintas sobre eso.

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Los campos cuyo valor anterior queda en el historial (tarjeta `e198e189`).
//
// `api` es como llega por la puerta; `col` es la columna de `cards`; `field` es
// lo que se guarda en el historial, y se usa el nombre de la COLUMNA a propósito:
// el historial es de la base, y quien lo lea dentro de un año va a mirar el
// esquema, no el cuerpo de un PUT.
//
// `serializa` convierte a texto, porque `old_value` es TEXT: un historial que
// guardara JSON en unos campos y texto en otros obligaría a saber cuál es cuál
// para leerlo.
const CAMPOS_CON_HISTORIAL = [
  { api: 'title',          col: 'title',           field: 'title' },
  { api: 'description',    col: 'description',     field: 'description' },
  { api: 'priority',       col: 'priority',        field: 'priority' },
  { api: 'dueDate',        col: 'due_date',        field: 'due_date' },
  { api: 'category',       col: 'category',        field: 'category' },
  { api: 'assigneeId',     col: 'assignee_id',     field: 'assignee_id' },
  { api: 'tags',           col: 'tags',            field: 'tags',            json: true },
  { api: 'checklist',      col: 'checklist',       field: 'checklist',       json: true },
  { api: 'checklistTitle', col: 'checklist_title', field: 'checklist_title' },
  { api: 'attachments',    col: 'attachments',     field: 'attachments',     json: true },
];

/** A texto, que es lo que `old_value` guarda. `null` se conserva como `null`. */
const aTexto = (valor, json) => {
  if (valor === null || valor === undefined) return null;
  return json ? JSON.stringify(valor) : String(valor);
};

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
  attachments:    row.attachments    || [],
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
  const { columnId, boardId, title, description, category, priority, dueDate, tags, checklist, checklistTitle, attachments, assigneeId } = req.body;
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
      tags:            Array.isArray(tags)        ? tags        : [],
      checklist:       Array.isArray(checklist)   ? checklist   : [],
      checklist_title: checklistTitle  || '',
      attachments:     Array.isArray(attachments) ? attachments : [],
      assignee_id:     assigneeId      || null,
      order:           maxOrder + 1,
    })
    .select()
    .single();

  if (error) { console.error('[cards] createCard:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  // Nacer asignado también avisa. Hasta hoy la notificación de responsable vivía
  // SOLO en `updateCard`, y eso tenía dos consecuencias, las dos malas:
  //
  //   · Quien creaba una tarjeta ya asignada —la UI lo permite, el selector de
  //     responsable está en el modal de creación— **asignaba sin avisar a nadie**.
  //     El responsable no se enteraba salvo que mirara el tablero.
  //   · Y obligaba al riel a crear primero y asignar después, en dos escrituras,
  //     porque la segunda era la única que notificaba. Esa ventana es el defecto
  //     que esta tarjeta cierra: si el segundo paso fallaba, quedaba una tarjeta
  //     escrita y sin dueño — invisible para el sistema de trabajo — y el
  //     llamante recibía una excepción que no decía que ya existía.
  //
  // Con esto, asignar al crear y asignar después notifican igual, así que una
  // sola escritura basta y la ventana deja de existir por construcción, no por
  // compensación.
  //
  // Las mismas dos guardas que en `updateCard`, y por los mismos motivos: sin
  // responsable no hay a quién avisar, y a uno mismo no se le notifica.
  if (data.assignee_id && data.assignee_id !== req.user.id) {
    createAssigneeNotification(
      data.id,
      data.board_id,
      data.title,
      data.assignee_id,
      req.user.id,
    ).catch((err) => console.error('[notifications] assignee al crear falló:', err.message));
  }

  res.status(201).json({ data: toCard(data) });
};

// ── Cómo se pega lo que se añade ──────────────────────────────────────────────
// La descripción es markdown, así que pegar un párrafo al final de la última
// línea NO produce un párrafo: produce una línea más larga. Ese es un daño
// silencioso —se escribe bien y se lee mal— y esta casa los cierra en vez de
// documentarlos. Así que la puerta garantiza al menos una línea en blanco.
//
// ⚠️ EL RELLENO SOLO PUEDE AÑADIR SALTOS, NUNCA RECORTARLOS, y no es estética.
// La compuerta del `409` compara por **contención literal**: el texto nuevo
// tiene que CONTENER el anterior byte a byte. Un relleno que normalizara la
// cola —recortando los saltos que sobran antes de pegar— rompería esa
// contención y pondría la compuerta roja contra la única escritura del sistema
// que por construcción no destruye nada.
const separadorMarkdown = (anterior) => {
  if (anterior.endsWith('\n\n')) return '';
  if (anterior.endsWith('\n'))   return '\n';
  return '\n\n';
};

const updateCard = async (req, res) => {
  const { title, category, priority, dueDate, tags, checklist, checklistTitle, attachments, assigneeId, appendDescription } = req.body;
  // `description` deja de ser `const`: cuando llega `appendDescription`, la
  // calcula el servidor a partir de lo que ya hay. Es el único campo que esta
  // puerta puede componer, porque es el único que se acumula.
  let { description } = req.body;

  // Input validation
  // El mensaje se DERIVA del conjunto. Escribirlo al lado es lo que había, y ya
  // había divergido: el conjunto aceptaba `urgent` y el texto no lo nombraba.
  if (priority !== undefined && !isValidPriority(priority)) {
    return res.status(400).json({ error: `priority must be one of: ${priorityList()}` });
  }
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 255)) {
    return res.status(400).json({ error: 'title must be a non-empty string under 255 chars' });
  }
  if (dueDate !== undefined && dueDate !== null && isNaN(Date.parse(dueDate))) {
    return res.status(400).json({ error: 'dueDate must be a valid date string' });
  }

  // ── AÑADIR sin reenviar ───────────────────────────────────────────────────
  //
  // QUÉ DEFECTO CIERRA. Hasta ahora esta puerta solo sabía SUSTITUIR: para
  // apuntar tres párrafos en una tarjeta había que volver a mandar los quince o
  // veinte mil caracteres anteriores, transcritos a mano y sin fallar en
  // ninguno. Eso no cuesta tiempo, cuesta **trabajo perdido**: el 8-ago-2026 una
  // reconstrucción desde una copia vieja se llevó por delante la medición de
  // otro papel y un hallazgo escrito ahí justamente para viajar entre papeles.
  //
  // POR QUÉ NO BASTABA LA COMPUERTA DEL `409`. Aquella defiende de la
  // reescritura ciega, y muerde — pero deja intacto el gasto y el riesgo de
  // transcripción, porque sigue exigiendo reenviarlo todo. Era un guardián
  // contra un defecto que no tenía por qué existir.
  //
  // POR QUÉ AQUÍ Y NO EN UNA RUTA NUEVA. Añadir ES una edición: tiene que pasar
  // por la misma autenticación, la misma membresía, el mismo historial y la
  // misma compuerta. Una ruta aparte sería una segunda puerta a la descripción,
  // y la segunda puerta es donde se cuela lo que la primera prohíbe.
  //
  // Y NO SE LE ABRE UN ATAJO A LA COMPUERTA: el texto compuesto pasa por la
  // comparación como cualquier otro. Que la supere no está exento, está
  // **garantizado por construcción** — el resultado empieza por el anterior,
  // byte a byte. Si algún día deja de superarla, es que la composición se
  // rompió, y entonces la compuerta es exactamente quien debe decirlo.
  if (appendDescription !== undefined) {
    if (typeof appendDescription !== 'string' || appendDescription.trim().length === 0) {
      return res.status(400).json({
        error: 'appendDescription debe ser texto con contenido. Añadir nada no es '
             + 'una edición: escribiría la misma descripción, sin rastro y sin aviso.',
      });
    }
    // Las dos juntas son dos órdenes que se contradicen —«sustituye por esto» y
    // «añade esto»— y elegir una en silencio es la familia de fallo que este
    // repo ya pagó: obedecer una intención que nadie declaró.
    if (description !== undefined) {
      return res.status(400).json({
        error: 'appendDescription y description son excluyentes: una sustituye y la '
             + 'otra añade. Manda solo la que quieras.',
      });
    }
  }

  // Fetch previous state for notification diff (checklist mentions + assignee
  // change), for the description history below, y —desde que existe
  // `appendDescription`— para poder componer el texto nuevo: no se puede añadir
  // al final de algo que no se ha leído.
  // Se leen TODOS los campos vigilados, no solo los tres de antes: desde
  // `e198e189` el historial cubre cualquier campo, y no se puede guardar el
  // valor anterior de algo que no se leyó.
  let prevCard = null;
  if (appendDescription !== undefined
      || CAMPOS_CON_HISTORIAL.some((c) => req.body[c.api] !== undefined)) {
    const { data: prev } = await supabaseAdmin
      .from('cards')
      .select('checklist, board_id, title, assignee_id, description, priority, '
              + 'due_date, category, tags, checklist_title, attachments')
      .eq('id', req.params.id)
      .single();
    prevCard = prev;
  }

  // Compuesto AQUÍ, entre la lectura y todo lo demás, para que de este punto en
  // adelante «añadir» y «sustituir» sean el mismo camino: mismo historial, misma
  // compuerta, mismo `update`. Un segundo camino sería un segundo sitio donde
  // olvidarse del historial.
  if (appendDescription !== undefined) {
    const anterior = prevCard?.description ?? '';
    description = anterior.trim().length === 0
      // Nada que conservar: no hay separador que poner ni nada que destruir.
      ? appendDescription
      : anterior + separadorMarkdown(anterior) + appendDescription;
  }

  // ── Qué campos deja rastro, y por qué esta lista y no otra ────────────────
  // Son los que esta puerta acepta. Un campo que la puerta no acepta no se puede
  // perder por aquí, y meterlo aquí sería prometer un rastro que nadie escribe.
  //
  // `columna` y `orden` NO están: los mueve `PUT /cards/:id/move`, que es otra
  // puerta y otra tarjeta. Se dice para que su ausencia no se lea como olvido.
  //
  // `appendDescription` tampoco está, y no es olvido: no es un campo, es una
  // FORMA de escribir `description`. Para cuando se llega aquí ya se resolvió a
  // un texto, y el rastro que deja es el de la descripción — que es el que sirve
  // para deshacer.
  const entrantes = {
    title, description, priority, dueDate, category,
    assigneeId, tags, checklist, checklistTitle, attachments,
  };

  // ── Historial de la descripción ────────────────────────────────────────────
  // Esta puerta recibe la descripción COMPLETA y la reemplaza. No hay forma de
  // añadir sin arriesgarse a borrar, así que un llamante que no lea antes de
  // escribir destruye lo que había — y recibe éxito. Pagado el 6-ago-2026: un
  // obrero automático sustituyó la descripción de una tarjeta por el texto de
  // otra, y se recuperó por casualidad porque alguien tenía el original en su
  // contexto. Con naves escribiendo de noche, esa casualidad no se repite.
  //
  // Va ANTES del update, y su fallo ABORTA el update. Es la diferencia entre una
  // garantía y un apaño: un historial "fire-and-forget" puede fallar en silencio
  // justo en la escritura que había que poder deshacer, y entonces no hay
  // historial — hay la sensación de tenerlo, que es peor que no tenerlo.
  //
  // El precio, dicho en voz alta: si esta tabla no está disponible, no se puede
  // editar la descripción de ninguna tarjeta. Se acepta a conciencia — perder la
  // edición es recuperable, perder el texto anterior no.
  const prevDescription = prevCard?.description;
  const descriptionChanges =
    description !== undefined &&
    typeof prevDescription === 'string' &&
    prevDescription.trim().length > 0 &&
    prevDescription !== description;

  // ── Compuerta: sobrescribir texto tiene que costar un acto deliberado ──────
  //
  // QUÉ FALLO CIERRA, y pasó de verdad el 8-ago-2026. Un agente reconstruyó la
  // descripción de una tarjeta desde una copia vieja y la mandó entera. Se
  // perdieron la medición de otro papel y **un hallazgo escrito ahí justamente
  // para viajar de un papel a otro**. Se recuperó porque el historial guarda
  // versiones — y eso es suerte de implementación, no una garantía: nadie mira
  // el historial salvo que ya sospeche.
  //
  // LA ASIMETRÍA QUE HACE QUE ESTO FUNCIONE. Esta puerta la usan dos clases de
  // llamante y **una de ellas ha leído el texto por construcción**:
  //
  //   · el navegador, que trae el texto actual dentro del editor — quien lo
  //     compacta está mirando lo que borra;
  //   · el riel, que manda una cadena que armó en otro sitio y **puede no haber
  //     leído nada**.
  //
  // Así que no se prohíbe reemplazar: se exige **decirlo**. Quien tiene el texto
  // delante lo dice sin coste; quien no lo tiene, se entera de que iba a borrar.
  //
  // POR QUÉ NO ES UN AVISO EN EL ACUSE. Esta casa ya midió que **nadie compara
  // un acuse de éxito** (`5d8a5fd8`). Un aviso que se puede ignorar sin hacer
  // nada no cuesta nada, y lo que no cuesta nada no cambia lo que pasa.
  //
  // QUÉ CUENTA COMO DESTRUIR: que el texto nuevo **no contenga** el anterior. Un
  // añadido lo contiene y pasa sin enterarse — que es el caso normal de un
  // agente que amplía una tarjeta. Una reescritura, no.
  //
  // LO QUE ESTO **NO** CUBRE, y hay que decirlo:
  //   · No protege de quien pasa la bandera sin mirar. Nada puede.
  //   · No mira los demás campos: prioridad o responsable se siguen
  //     sobrescribiendo sin rastro. Eso es `cfeccbc4`.
  //   · Vaciar del todo la descripción también se considera destruir, porque lo
  //     es — y «no mandarla» sigue siendo la forma de no tocarla.
  const reemplazaTextoExistente =
    descriptionChanges && !String(description ?? '').includes(prevDescription);

  if (reemplazaTextoExistente && req.body.replacesDescriptionOnPurpose !== true) {
    return res.status(409).json({
      error:
        'Esta escritura NO añade: sustituye una descripción que ya tenía texto, ' +
        'y parte de lo que hay se perdería. Si es lo que quieres, repite la ' +
        'llamada con `replacesDescriptionOnPurpose: true`. Si no, lee la versión ' +
        'actual antes de escribir.',
      previousLength: prevDescription.length,
      incomingLength: String(description ?? '').length,
      hint:
        'Un texto que CONTIENE el anterior pasa sin bandera: añadir no destruye. ' +
        'Las versiones anteriores están en GET /api/cards/:id/history.',
    });
  }

  // ── Historial de TODOS los campos, no solo de la descripción ──────────────
  // `cfeccbc4` puso las columnas; esto las usa. Una fila por campo que CAMBIA de
  // valor — no por campo aceptado: la puerta acepta diez y una edición típica
  // toca uno o dos. Esa distinción es lo que evita que el historial crezca diez
  // veces más rápido de lo que nadie midió (`244c554e`).
  //
  // `description` se sigue escribiendo en su columna vieja ADEMÁS de en
  // `old_value`, y solo para las filas de descripción. No es duplicación por
  // pereza: `card_history` la lee, y quitarla sería un cambio incompatible que
  // merece su propia decisión.
  const cambios = [];
  if (prevCard) {
    for (const campo of CAMPOS_CON_HISTORIAL) {
      const entrante = entrantes[campo.api];
      if (entrante === undefined) continue;              // no se manda = no se toca
      const antes = aTexto(prevCard[campo.col], campo.json);
      const ahora = aTexto(entrante, campo.json);
      if (antes === ahora) continue;                     // no cambió = no hay rastro que guardar
      // Si no había valor, no se destruye nada. Pasar de vacío a lleno no es una
      // pérdida, y guardarlo llenaría el historial de filas que no sirven para
      // deshacer. Era la regla de la descripción y vale igual para los demás.
      if (antes === null || antes === '') continue;
      cambios.push({
        card_id:     req.params.id,
        field:       campo.field,
        old_value:   antes,
        // La columna vieja solo se rellena para la descripción, que es la única
        // que `card_history` expone hoy por ese nombre.
        description: campo.field === 'description' ? antes : null,
        changed_by:  req.user.id,
      });
    }
  }

  if (cambios.length > 0) {
    const { error: histError } = await supabaseAdmin
      .from('card_description_history')
      .insert(cambios);

    if (histError) {
      console.error('[cards] historial de descripción:', histError.message);
      return res.status(500).json({
        error:
          'No se pudo guardar la versión anterior de los campos que cambian, así ' +
          'que no se ha sobrescrito nada. Reintenta; si persiste, la tarjeta ' +
          'sigue intacta.',
      });
    }
  }

  const update = { updated_at: new Date().toISOString() };
  if (title          !== undefined) update.title           = title.trim();
  if (description    !== undefined) update.description     = description;
  if (category       !== undefined) update.category        = category || null;
  if (priority       !== undefined) update.priority        = priority;
  if (dueDate        !== undefined) update.due_date        = dueDate || null;
  if (tags           !== undefined) update.tags            = Array.isArray(tags) ? tags : [];
  if (checklist      !== undefined) update.checklist       = Array.isArray(checklist) ? checklist : [];
  if (checklistTitle !== undefined) update.checklist_title = checklistTitle;
  if (attachments    !== undefined) update.attachments     = Array.isArray(attachments) ? attachments : [];
  if (assigneeId     !== undefined) update.assignee_id     = assigneeId || null;

  const { data, error } = await supabaseAdmin
    .from('cards')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) { console.error('[cards] updateCard:', error.message); return res.status(500).json({ error: 'Error interno del servidor' }); }

  // Fire-and-forget: notifications for checklist mentions + assignee change
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

  if (assigneeId !== undefined && prevCard) {
    const newAssignee = assigneeId || null;
    const oldAssignee = prevCard.assignee_id || null;
    if (newAssignee && newAssignee !== oldAssignee && newAssignee !== req.user.id) {
      createAssigneeNotification(
        req.params.id,
        prevCard.board_id,
        data.title,
        newAssignee,
        req.user.id,
      ).catch((err) => console.error('[notifications] assignee failed:', err.message));
    }
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

// ── GET /api/cards/:id/history ────────────────────────────────────────────────
// Las versiones anteriores de la descripción, la más reciente primero.
//
// Sin esto el historial es una tabla que nadie puede alcanzar, y «se puede
// deshacer» sería falso: guardar el texto y no dar forma de leerlo es tenerlo
// perdido en otro sitio. Deshacer se hace desde aquí — se lee la versión que
// toca y se vuelve a mandar por `PUT /api/cards/:id`. No hay endpoint de
// restauración aparte a propósito: restaurar ES una edición, y debe dejar su
// propia entrada en el historial como cualquier otra.
const getCardHistory = async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('card_description_history')
    .select('id, field, old_value, description, changed_by, changed_at')
    .eq('card_id', req.params.id)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('[cards] getCardHistory:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  const rows = data || [];

  // Se devuelve el nombre además del id, por el mismo motivo que el acuse de la
  // puerta interna devuelve los destinos resueltos: un id suelto obliga a otra
  // consulta para saber quién fue, y quien lee un historial busca justamente eso.
  const authorIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))];
  let nameById = {};
  if (authorIds.length) {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .in('id', authorIds);
    nameById = Object.fromEntries((users || []).map((u) => [u.id, u.name]));
  }

  res.json({
    data: rows.map((r) => ({
      id:          r.id,
      // QUÉ campo, y su valor anterior. Antes solo había `description`, porque
      // solo se guardaba eso. `field` es el nombre de la COLUMNA de `cards`.
      field:       r.field ?? 'description',
      // `oldValue` es el valor anterior de ESE campo, siempre como texto. Para
      // las filas anteriores a `cfeccbc4` cae a `description`, que es donde
      // estaba: una fila vieja no deja de poder leerse porque el esquema creciera.
      oldValue:    r.old_value ?? r.description ?? null,
      // ⚠️ SE CONSERVA, y a partir de ahora puede venir `null`: solo las filas de
      // descripción la traen. Quien deshaga una descripción puede seguir usándola;
      // quien lea el historial de otro campo tiene que mirar `oldValue`.
      description: r.description,
      changedAt:   r.changed_at,
      changedById: r.changed_by,
      // `null` cuando la cuenta que la sustituyó ya no existe: se pierde el
      // quién, nunca el qué. El texto es lo que hace falta para recuperar.
      changedBy:   r.changed_by ? (nameById[r.changed_by] ?? null) : null,
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
  getCardHistory,
};
