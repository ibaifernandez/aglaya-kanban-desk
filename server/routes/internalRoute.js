const express        = require('express');
const { supabaseAdmin } = require('../utils/supabase');

const router = express.Router();

const VALID_PRIORITIES = new Set(['urgent', 'high', 'medium', 'low', 'none']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function verifySecret(req, res, next) {
  const secret = process.env.TASK_SECRET;
  if (!secret) return res.status(500).json({ error: 'TASK_SECRET no configurado.' });
  if (req.headers['x-task-secret'] !== secret) return res.status(401).json({ error: 'No autorizado.' });
  next();
}

// ── GET /api/internal/list-workspaces ──────────────────────────────────────────
// Lee los workspaces (service_role, sin membresía) para que una nave externa
// pueda verificar destinos antes de clavar trabajo.
//
// Excluye `type = 'personal'` POR REGLA, no por lista. Es la tercera superficie
// automática de esta nave que lo hace, y las otras dos ya estaban: el digest los
// excluye (fijado por su propio test) y `scripts/rail-blindspot.sh` los saca de
// su consulta con `WHERE w.type <> 'personal'`. La doctrina está escrita en
// `scripts/rail-blindspot.allowed`: «son intocables por decisión dura y el riel
// no debe escribir ahí nunca. Una regla cubre también los que se creen mañana;
// una lista, no».
//
// Qué cierra en concreto: esta puerta se autentica con TASK_SECRET, que es llave
// maestra y vive FUERA de esta máquina. Sin este filtro entregaba el UUID del
// espacio personal de Ibai a cualquiera que tuviese el secreto — y el UUID es
// justo lo que hace falta para apuntar ahí. El PR original lo listaba: decía
// tener «la misma amplitud que la puerta de escritura», y es cierto para
// escribir, pero enumerar no es escribir. Antes había que adivinar el nombre.
//
// Lo que este filtro NO arregla: la puerta de escritura sigue aceptando un
// `workspaceName` que resuelva a un personal. Ahí queda deuda, con tarjeta.

router.get('/list-workspaces', verifySecret, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, type, emoji, organization_id')
    .neq('type', 'personal')
    .order('name', { ascending: true });

  if (error) {
    console.error('[internal/list-workspaces]', error.message);
    return res.status(500).json({ error: 'Error al listar workspaces.' });
  }

  res.json({ workspaces: data || [] });
});

// ── GET /api/internal/list-boards ─────────────────────────────────────────────
// Lee tableros de un workspace (service_role).

router.get('/list-boards', verifySecret, async (req, res) => {
  const { workspaceId } = req.query;

  if (!workspaceId?.trim()) {
    return res.status(400).json({
      error: 'workspaceId es obligatorio. Usa GET /api/internal/list-workspaces para obtener IDs.',
    });
  }

  const { data, error } = await supabaseAdmin
    .from('boards')
    .select('id, title, workspace_id, order')
    .eq('workspace_id', workspaceId)
    .order('order', { ascending: true });

  if (error) {
    console.error('[internal/list-boards]', error.message);
    return res.status(500).json({ error: 'Error al listar tableros.' });
  }

  res.json({ boards: data || [] });
});

// ── POST /api/internal/create-card ────────────────────────────────────────────
// Crea una card en el Backlog del tablero indicado, sin JWT.
// Autenticado con x-task-secret header.
//
// Body:
//   title        {string}  requerido
//   boardName    {string}  requerido — nombre exacto (case-insensitive) del tablero
//   priority     {string}  REQUERIDO — urgent|high|medium|low|none, sin default (ver abajo)
//   assignee     {string}  REQUERIDO — email, nombre exacto o id del responsable
//   description  {string}  opcional
//   dueDate      {string}  opcional — ISO 8601
//   workspaceName {string} REQUERIDO — sin default, a propósito (ver abajo)

// Por qué workspaceName no tiene default (2026-07-21):
// Lo tuvo: "Ibai Fernández". Ese workspace existe y es el PERSONAL de Ibai — zona
// intocable por regla dura. Omitir el campo no daba error: el lookup por ilike
// resolvía, la card aterrizaba en su espacio privado y la respuesta era 201. Una
// fuga silenciosa, no un fallo. docs/runbooks/key-rotation.md la omitía en su paso
// de verificación tras rotar TASK_SECRET.
// Un default que apunta a un sitio prohibido es peor que no tener default: un 400
// avisa, un 201 miente. Fijado por server/tests/internal-create-card.test.js — si
// alguien repone el default por comodidad, ese test se pone rojo.

// Por qué `priority` y `assignee` tampoco tienen default (2026-08-06, contrato v3.0.0):
// El sistema de trabajo reparte por RESPONSABLE y ordena por PRIORIDAD. A una
// tarjeta que le falte cualquiera de los dos no la coge nadie — y no falla:
// envejece en el backlog pareciendo trabajo pendiente. Es la misma familia que el
// 201 que miente, un piso más arriba: aterrizar mal se nota tarde, nacer invisible
// no se nota nunca, porque no hay error que leer ni tarjeta perdida que buscar.
//
// `priority` tuvo default `medium` y era el caso agudo: quien creía no haber
// decidido había decidido, y su tarjeta se ordenaba contra las demás con un valor
// que nadie eligió. `assignee` no existía siquiera en esta puerta.
//
// Lo que esto comprueba es que los campos VENGAN y que RESUELVAN. Que sean los
// acertados —si esta tarjeta es de un obrero o de un humano, si merece urgent— es
// criterio, y el criterio no vive en una puerta.

router.post('/create-card', verifySecret, async (req, res) => {
  const {
    title,
    boardName,
    priority,
    assignee,
    description  = '',
    dueDate      = null,
    workspaceName,
  } = req.body;

  if (!title?.trim())     return res.status(400).json({ error: 'title es obligatorio.' });
  if (!boardName?.trim()) return res.status(400).json({ error: 'boardName es obligatorio.' });
  if (!workspaceName?.trim()) {
    return res.status(400).json({
      error:
        'workspaceName es obligatorio. No hay default por diseño: el anterior ' +
        '("Ibai Fernández") apuntaba al workspace personal de Ibai, y omitir el ' +
        'campo enviaba la card ahí devolviendo 201. Indica el workspace destino ' +
        'explícitamente — los nombres vivos los da list_workspaces en el MCP ' +
        'aglaya-kanban-desk.',
    });
  }

  // Prioridad: ausente e inválida son el mismo rechazo, no un default y un error.
  // Hasta v2.0.0 la inválida caía a `medium` en silencio; ahora tampoco cae la
  // ausente, que era la mitad callada del mismo defecto.
  if (!priority?.trim()) {
    return res.status(400).json({
      error:
        'priority es obligatoria. No hay default por diseño: antes caía a ' +
        '"medium" sin decirlo, así que quien creía no haber decidido había ' +
        `decidido. Válidas: ${Array.from(VALID_PRIORITIES).join(', ')}`,
    });
  }
  if (!VALID_PRIORITIES.has(priority.trim())) {
    return res.status(400).json({
      error: `priority inválida: "${priority}". Válidas: ${Array.from(VALID_PRIORITIES).join(', ')}`,
    });
  }

  const safePriority = priority.trim();

  if (!assignee?.trim()) {
    return res.status(400).json({
      error:
        'assignee es obligatorio: di de quién es la tarjeta. Sin responsable no ' +
        'la coge nadie, y no falla — envejece pareciendo trabajo pendiente. ' +
        'Acepta email, nombre exacto o id.',
    });
  }

  // 0. Responsable. Se resuelve ANTES de escribir nada: un assignee que no
  // resuelve tiene que dejar la tarjeta sin crear, no crearla sin dueño — que es
  // justo la tarjeta invisible que este campo existe para impedir.
  //
  // La INTENCIÓN es match exacto, al revés que el de workspace y tablero: ahí el
  // parcial se tolera para no pelear con los emojis del título, y aquí un parcial
  // engancharía a la persona de al lado.
  //
  // ⚠️ Y no está conseguido del todo: aquí no se añaden comodines, pero `ilike`
  // interpreta los `%` y `_` que vengan DENTRO de la entrada. Medido contra la
  // base real: `assignee: "%aglaya.biz"` casa. Hoy no colisiona con nadie —hay
  // tres usuarios y ninguno se solapa— así que es latente, no vivo; con más
  // cuentas empieza a elegir por su cuenta y a devolver `201`.
  //
  // Lo encontró el vigilante revisando esto, y **el arreglo (escapar `%` y `_`)
  // va en su propia tarjeta**, no aquí. Lo que sí se corrige en el acto es este
  // comentario, que afirmaba «EXACTO, sin comodines» — una promesa que el código
  // de abajo no cumple. Un comentario que miente sobre su código es peor que no
  // tenerlo: el siguiente lo lee y deja de mirar.
  const assigneeInput = assignee.trim();
  let users, userError;

  if (UUID_RE.test(assigneeInput)) {
    ({ data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('id', assigneeInput));
  } else {
    ({ data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .ilike('email', assigneeInput));

    if (!userError && !users?.length) {
      ({ data: users, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, name, email')
        .ilike('name', assigneeInput));
    }
  }

  if (userError || !users?.length) {
    return res.status(404).json({ error: `Responsable "${assignee}" no encontrado.` });
  }

  // Los emails son únicos en la tabla; los nombres no. Un nombre repetido casa
  // con varios y aterrizaría en uno arbitrario — el mismo defecto que el 400 de
  // ambigüedad de workspace cierra un piso más arriba.
  if (users.length > 1) {
    return res.status(400).json({
      error: `Ambigüedad: "${assignee}" casó con varios usuarios. Pasa el email o el id.`,
      candidates: users.map(u => ({ id: u.id, name: u.name, email: u.email })),
    });
  }

  const assigneeUser = users[0];

  // 1. Workspace por nombre (partial match para tolerar emojis en el título)
  const { data: workspaces, error: wsError } = await supabaseAdmin
    .from('workspaces')
    .select('id, organization_id, name')
    .ilike('name', `%${workspaceName}%`);

  if (wsError || !workspaces?.length) {
    return res.status(404).json({ error: `Workspace "${workspaceName}" no encontrado.` });
  }

  // Detectar ambigüedad: si hay múltiples matches, rechazar
  if (workspaces.length > 1) {
    return res.status(400).json({
      error: `Ambigüedad: "${workspaceName}" casó con múltiples workspaces. Sé explícito.`,
      candidates: workspaces.map(w => ({ id: w.id, name: w.name })),
    });
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
      assignee_id:     assigneeUser.id,
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

  console.log(
    `[internal/create-card] "${card.title}" → ${board.title} / ${targetColumn.title} ` +
    `· ${assigneeUser.name} · ${safePriority}`,
  );

  res.status(201).json({
    ok:    true,
    card: {
      id:           card.id,
      title:        card.title,
      priority:     card.priority,
      workspace_id: workspace.id,
      workspace:    workspace.name,
      board_id:     board.id,
      board:        board.title,
      column_id:    targetColumn.id,
      column:       targetColumn.title,
      assignee_id:  assigneeUser.id,
      assignee:     assigneeUser.name,
    },
  });
});

module.exports = router;
