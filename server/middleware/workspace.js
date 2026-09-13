const { supabaseAdmin } = require('../utils/supabase');

async function resolveWorkspaceIdFromBoard(boardId) {
  if (!boardId) return null;

  const { data } = await supabaseAdmin
    .from('boards')
    .select('workspace_id')
    .eq('id', boardId)
    .single();

  return data?.workspace_id ?? null;
}

async function resolveWorkspaceIdFromColumn(columnId) {
  if (!columnId) return null;

  const { data: column } = await supabaseAdmin
    .from('columns')
    .select('board_id')
    .eq('id', columnId)
    .single();

  return resolveWorkspaceIdFromBoard(column?.board_id);
}

async function resolveWorkspaceIdFromCard(cardId) {
  if (!cardId) return null;

  const { data: card } = await supabaseAdmin
    .from('cards')
    .select('board_id')
    .eq('id', cardId)
    .single();

  return resolveWorkspaceIdFromBoard(card?.board_id);
}

/**
 * Resuelve el espacio del recurso SOBRE EL QUE SE ACTÚA, leído de la ruta.
 *
 * Solo mira `req.params`, nunca el cuerpo: lo que se toca lo nombra la URL.
 */
async function resolverEspacioDelRecurso(req) {
  const { id, workspaceId, boardId, columnId, cardId } = req.params;
  const ruta = `${req.baseUrl || ''}${req.path || req.originalUrl || ''}`;

  if (workspaceId) return workspaceId;
  if (ruta.includes('/workspaces') && id) return id;
  if (boardId) return resolveWorkspaceIdFromBoard(boardId);
  if (columnId) return resolveWorkspaceIdFromColumn(columnId);
  if (cardId) return resolveWorkspaceIdFromCard(cardId);
  if (id && ruta.includes('/boards')) return resolveWorkspaceIdFromBoard(id);
  if (id && ruta.includes('/columns')) return resolveWorkspaceIdFromColumn(id);
  if (id && ruta.includes('/cards')) return resolveWorkspaceIdFromCard(id);
  return null;
}

/**
 * Middleware: verifies the authenticated user is a member of EVERY workspace the
 * request touches.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ POR QUÉ YA NO SE LEE PRIMERO `req.body.workspaceId` (tarjeta `05efbd1d`)
 *
 * Aquí decía `let workspaceId = req.params.workspaceId || req.body.workspaceId;`
 * y solo si faltaba se resolvía desde el recurso. Consecuencia: **el papel con el
 * que se juzgaba la petición era el que tuvieras en el espacio que TÚ nombrabas
 * en el cuerpo**, no en el del recurso.
 *
 * Todo el mundo es `owner` de su espacio personal. Mandando ese `workspaceId`,
 * se editaban, movían y borraban tarjetas, columnas y tableros de espacios de los
 * que **no se era ni miembro** — y los manejadores, que sí comprueban el papel,
 * lo comprobaban contra el espacio equivocado. Medido: 200 y 201 donde tocaba 403.
 *
 * Y dos variantes sin `workspaceId`: una tarjeta creada con tablero propio y
 * **columna ajena** se resolvía solo por el tablero, y `moveCard` no miraba el
 * espacio de la **columna de destino**.
 *
 * LA REGLA AHORA, entera:
 *
 *   1. El espacio ACTOR es el del recurso que nombra la URL. Si la URL no nombra
 *      ninguno (crear un tablero, reordenar), es el del cuerpo.
 *   2. **Todo espacio que toque la petición** —el actor, y el de cada `boardId`,
 *      `columnId`, `cardId` o `workspaceId` del cuerpo— **tiene que ser uno del
 *      que el usuario es miembro.** Uno solo que no, y 403.
 *   3. El papel que ven los manejadores (`req.workspaceMember.role`) es el del
 *      espacio actor. Los papeles en los demás van en `req.workspaceRoles`, para
 *      quien necesite exigir algo en un destino (mover un tablero).
 *
 * Lo que NO decide esto: qué papel hace falta en un destino. La matriz lo pide
 * solo para mover tableros, y lo comprueba `updateBoard`.
 */
async function requireWorkspaceMember(req, res, next) {
  const body = req.body || {};

  const actor = (await resolverEspacioDelRecurso(req)) || body.workspaceId || null;

  // Los espacios de lo que el cuerpo nombra. Uno que no existe resuelve a null y
  // se ignora aquí: no hay nada que escribir en él, y el manejador contestará 404.
  const delCuerpo = await Promise.all([
    body.boardId  ? resolveWorkspaceIdFromBoard(body.boardId)   : null,
    body.columnId ? resolveWorkspaceIdFromColumn(body.columnId) : null,
    body.cardId   ? resolveWorkspaceIdFromCard(body.cardId)     : null,
  ]);

  // Sin recurso en la URL, el primer espacio nombrado en el cuerpo hace de actor
  // (crear una tarjeta: `boardId` + `columnId`).
  const workspaceId = actor || delCuerpo.find(Boolean) || null;
  if (!workspaceId) return res.status(400).json({ error: 'Contexto de workspace no encontrado' });

  const tocados = [...new Set([workspaceId, body.workspaceId, ...delCuerpo].filter(Boolean))];

  // 🛡️ GOD MODE: Superadmin bypasses membership checks
  if (req.user.role === 'superadmin') {
    req.workspaceMember = {
      workspace_id: workspaceId,
      user_id:      req.user.id,
      role:         'owner' // Virtual power
    };
    req.workspaceRoles = Object.fromEntries(tocados.map((w) => [w, 'owner']));
    return next();
  }

  // Una consulta por espacio tocado, con la MISMA forma que tenía esto antes
  // (`eq` + `eq` + `single`). Casi siempre son uno o dos. Se hizo así a propósito
  // y no con un `in`: la forma anterior es la que llevaba meses probada contra la
  // base, y cambiarla a la vez que la regla habría mezclado dos cambios en uno.
  const comprobaciones = await Promise.all(tocados.map(async (w) => {
    const [memberRes, wsRes] = await Promise.all([
      supabaseAdmin
        .from('workspace_members')
        .select('workspace_id, user_id, role')
        .eq('workspace_id', w)
        .eq('user_id', req.user.id)
        .single(),
      supabaseAdmin
        .from('workspaces')
        .select('type')
        .eq('id', w)
        .single(),
    ]);
    return { w, miembro: memberRes.error ? null : memberRes.data, tipo: wsRes.data?.type };
  }));

  // ⚠️ La regla 2. Basta con UNO que no.
  if (comprobaciones.some((c) => !c.miembro)) {
    return res.status(403).json({ error: 'Sin acceso a este workspace' });
  }

  // Clients can only access external workspaces — en TODOS los que toca.
  if (req.user.role === 'cliente' && comprobaciones.some((c) => c.tipo !== 'externo')) {
    return res.status(403).json({ error: 'Sin acceso a este workspace' });
  }

  req.workspaceMember = comprobaciones.find((c) => c.w === workspaceId).miembro;
  req.workspaceRoles = Object.fromEntries(comprobaciones.map((c) => [c.w, c.miembro.role]));
  next();
}

/**
 * Middleware factory: restricts access to specific workspace roles.
 * Must be used after requireWorkspaceMember.
 * Usage: requireWorkspaceRole('owner', 'admin')
 */
function requireWorkspaceRole(...roles) {
  return (req, res, next) => {
    if (!req.workspaceMember) {
      return res.status(401).json({ error: 'No autenticado en este workspace' });
    }
    if (!roles.includes(req.workspaceMember.role)) {
      return res.status(403).json({ error: 'Rol insuficiente para esta acción' });
    }
    next();
  };
}

module.exports = { requireWorkspaceMember, requireWorkspaceRole };
