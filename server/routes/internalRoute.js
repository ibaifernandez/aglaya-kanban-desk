const express        = require('express');
const { supabaseAdmin } = require('../utils/supabase');
const { createAssigneeNotification } = require('../utils/assigneeNotification');
const { VALID_PRIORITY_SET: VALID_PRIORITIES, priorityList } = require('../constants/priorities');

const router = express.Router();

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
//   workspaceId  {string}  UUID del espacio — RECOMENDADO desde v3.8.0
//   boardId      {string}  UUID del tablero — RECOMENDADO desde v3.8.0
//   workspaceName {string} nombre del espacio; alternativa a workspaceId
//   boardName    {string}  nombre del tablero; alternativa a boardId
//   priority     {string}  REQUERIDO — urgent|high|medium|low|none, sin default (ver abajo)
//   assignee     {string}  REQUERIDO — email, nombre exacto o id del responsable
//   description  {string}  opcional
//   dueDate      {string}  opcional — ISO 8601
//   idempotencyKey {string} opcional — UUID; repetirlo devuelve 200 con la que ya existe
//
// EL DESTINO SIGUE SIENDO OBLIGATORIO: hace falta el espacio (por id o por
// nombre) y el tablero (por id o por nombre). Lo que cambia en v3.8.0 no es la
// obligatoriedad, es que ya hay una forma de apuntar que no caduca.

// Por qué la clave de idempotencia es UUID y su espacio de nombres es global
// (2026-08-10, contrato v3.6.0):
// Sin clave, dos POST idénticos creaban dos tarjetas y devolvían 201 las dos
// veces. Un humano ve el duplicado; una nave que reintenta al vencer el tiempo
// de espera, no — y no puede distinguir «se creó y perdí la respuesta» de «no se
// creó».
//
// NO se acota por llamante a propósito: el nombre del llamante lo declara quien
// tiene el secreto, así que acotar por él daría una separación que esta puerta
// no puede verificar. Lo que sí se puede verificar es la FORMA de la clave, y
// por eso se exige UUID: con UUID la colisión entre naves deja de ser un
// problema de coordinación y pasa a ser improbable por construcción.
//
// Y LA GARANTÍA NO ESTÁ AQUÍ: está en el índice único de
// docs/schema/migration-idempotency-key.sql. Mirar antes de insertar deja una
// ventana entre las dos consultas, y esa ventana es justo el defecto — dos
// reintentos simultáneos la pasan los dos. Por eso el `23505` se trata como
// repetición y no como error: es el caso que la comprobación previa no ve.

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

// Reconstruye el acuse de una tarjeta que YA existe, resolviendo sus destinos
// desde la fila guardada y NO desde lo que trae la petición de ahora.
//
// La diferencia importa: una repetición puede traer nombres que hoy resuelven a
// otro sitio —los tableros se renombran— y devolver los de ahora junto al id de
// entonces sería un acuse que miente sobre dónde está esa tarjeta. Lo que se
// devuelve es dónde está, no dónde habría ido.
//
// Devuelve null si la fila referencia algo que ya no existe: quien llama decide
// qué hacer con eso, y aquí no se inventa un nombre para tapar el hueco.
async function acusePorClave(clave) {
  const { data: filas, error } = await supabaseAdmin
    .from('cards')
    .select('id, title, priority, board_id, column_id, assignee_id')
    .eq('idempotency_key', clave)
    .limit(1);

  if (error) return { error };
  const card = filas?.[0];
  if (!card) return { card: null };

  const { data: boards }  = await supabaseAdmin
    .from('boards').select('id, title, workspace_id').eq('id', card.board_id).limit(1);
  const board = boards?.[0];

  const { data: columns } = await supabaseAdmin
    .from('columns').select('id, title').eq('id', card.column_id).limit(1);
  const column = columns?.[0];

  const { data: workspaces } = board
    ? await supabaseAdmin
        .from('workspaces').select('id, name').eq('id', board.workspace_id).limit(1)
    : { data: [] };
  const workspace = workspaces?.[0];

  const { data: users } = card.assignee_id
    ? await supabaseAdmin
        .from('users').select('id, name').eq('id', card.assignee_id).limit(1)
    : { data: [] };
  const user = users?.[0];

  return {
    card: {
      id:           card.id,
      title:        card.title,
      priority:     card.priority,
      workspace_id: workspace?.id   ?? board?.workspace_id ?? null,
      workspace:    workspace?.name ?? null,
      board_id:     card.board_id,
      board:        board?.title    ?? null,
      column_id:    card.column_id,
      column:       column?.title   ?? null,
      assignee_id:  card.assignee_id,
      assignee:     user?.name      ?? null,
    },
  };
}

router.post('/create-card', verifySecret, async (req, res) => {
  const {
    title,
    boardName,
    priority,
    assignee,
    description  = '',
    dueDate      = null,
    workspaceName,
    workspaceId,
    boardId,
    idempotencyKey,
  } = req.body;

  // ── Apuntar por IDENTIFICADOR es el camino principal desde v3.8.0 ───────────
  //
  // El nombre es comodidad humana; el identificador es lo único que NO cambia
  // cuando alguien renombra un espacio desde la interfaz. Y el emparejamiento por
  // nombre es parcial (`ilike`): medido contra la base real, **7 de 13 espacios
  // casaban con `%AGLAYA%`**. Cada destino por nombre es una tirada; cada destino
  // por identificador es determinista.
  //
  // El hueco que esto cierra era «media conversación»: la puerta ya sabía
  // DEVOLVER identificadores —`GET /list-workspaces` y `GET /list-boards` los
  // dan— y una nave que leía el id correcto **no tenía dónde metérselo**.
  //
  // EL NOMBRE SE QUEDA, y no por nostalgia: quitarlo sería incompatible, y el
  // contrato prohíbe destinos implícitos a propósito. Lo que cambia es cuál es el
  // camino recomendado y cuál el de compatibilidad.
  //
  // GANA EL IDENTIFICADOR si vienen los dos, porque es el que no caduca. No se
  // rechaza la pareja: un llamante que manda ambos no está en conflicto consigo
  // mismo, está siendo redundante — y de las dos formas de leerlo, la que no
  // depende de un renombrado es la buena.
  const idWorkspace = typeof workspaceId === 'string' ? workspaceId.trim() : workspaceId;
  const idBoard     = typeof boardId     === 'string' ? boardId.trim()     : boardId;

  const idMalFormado = (valor, campo) => {
    if (valor === undefined || valor === null) return null;
    if (typeof valor !== 'string' || !UUID_RE.test(valor)) {
      return (
        `${campo} inválido: "${valor}". Tiene que ser un UUID. Los identificadores ` +
        'vivos los dan GET /api/internal/list-workspaces y GET /api/internal/list-boards. ' +
        `Si querías apuntar por nombre, usa ${campo === 'workspaceId' ? 'workspaceName' : 'boardName'} ` +
        'y omite este campo — mandarlo mal no cae al nombre: un identificador ' +
        'roto que se traga sería exactamente el destino a ciegas que esta puerta impide.'
      );
    }
    return null;
  };

  for (const [valor, campo] of [[idWorkspace, 'workspaceId'], [idBoard, 'boardId']]) {
    const err = idMalFormado(valor, campo);
    if (err) return res.status(400).json({ error: err });
  }

  if (!title?.trim())     return res.status(400).json({ error: 'title es obligatorio.' });
  if (!idBoard && !boardName?.trim()) {
    return res.status(400).json({
      error:
        'Falta el tablero destino: manda boardId (recomendado) o boardName. ' +
        'El identificador no cambia cuando alguien renombra el tablero; el nombre, sí.',
    });
  }
  if (!idWorkspace && !workspaceName?.trim()) {
    return res.status(400).json({
      error:
        'Falta el espacio destino: manda workspaceId (recomendado) o ' +
        'workspaceName. No hay default por diseño: el anterior ("Ibai ' +
        'Fernández") apuntaba al workspace personal de Ibai, y omitir el campo ' +
        'enviaba la card ahí devolviendo 201. Los identificadores vivos los da ' +
        'GET /api/internal/list-workspaces; los nombres, list_workspaces en el ' +
        'MCP aglaya-kanban-desk.',
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
        `decidido. Válidas: ${priorityList()}`,
    });
  }
  if (!VALID_PRIORITIES.has(priority.trim())) {
    return res.status(400).json({
      error: `priority inválida: "${priority}". Válidas: ${priorityList()}`,
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

  // Clave de idempotencia. Opcional: sin ella la puerta se comporta como
  // siempre. Si viene, se valida ANTES de resolver nada — una clave mal formada
  // tiene que fallar igual que un payload mal formado, no después de haber
  // gastado cuatro consultas.
  //
  // Una clave presente y vacía NO se trata como ausente: quien manda el campo ha
  // decidido usarlo, y tragárselo devolvería una tarjeta nueva por cada
  // reintento mientras el llamante cree estar protegido. Es la familia del 201
  // que miente.
  const claveIdem = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : idempotencyKey;

  // `null` sí cuenta como ausente: es lo que manda un cliente que serializa un
  // campo opcional sin valor. La cadena vacía NO — ver arriba.
  if (claveIdem !== undefined && claveIdem !== null) {
    // Una sola puerta para «no es una clave usable», y la vacía entra por ella.
    // Hubo dos ramas —una para vacía y otra para no-UUID— y la primera era
    // inalcanzable en la práctica: la vacía tampoco es un UUID. Medido por
    // mutación: desactivarla no ponía roja ni una prueba. Una rama que no puede
    // fallar no protege nada y hace creer que sí.
    if (typeof claveIdem !== 'string' || !UUID_RE.test(claveIdem)) {
      return res.status(400).json({
        error:
          `idempotencyKey inválida: "${claveIdem}". Tiene que ser un UUID, y la ` +
          'cadena vacía no vale: mandar el campo es haber decidido usarlo, así ' +
          'que tragárselo devolvería una tarjeta nueva por reintento mientras ' +
          'crees estar protegido. Omítelo para no usar idempotencia. El espacio ' +
          'de nombres es global —no se acota por llamante, porque el llamante se ' +
          'autodeclara— y el UUID es lo que hace improbable que dos naves se ' +
          'pisen la clave.',
      });
    }

    // Mirada previa. NO es la garantía —eso es el índice único, ver el comentario
    // de arriba—: es para no gastar un insert fallido en el caso normal.
    const previo = await acusePorClave(claveIdem);
    if (previo.error) {
      console.error('[internal/create-card] idempotencia', previo.error.message);
      return res.status(500).json({ error: 'Error al comprobar la clave de idempotencia.' });
    }
    if (previo.card) {
      console.log(`[internal/create-card] repetición de ${claveIdem} → ${previo.card.id}`);
      return res.status(200).json({ ok: true, idempotent: true, card: previo.card });
    }
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

  // 1. Espacio. Por identificador si vino; por nombre si no.
  //
  // La rama del identificador NO pasa por `ilike` y por eso no tiene ambigüedad
  // que resolver: no hay «casó con varios», hay o no hay.
  let workspace;

  if (idWorkspace) {
    const { data: porId, error: wsIdError } = await supabaseAdmin
      .from('workspaces')
      .select('id, organization_id, name')
      .eq('id', idWorkspace)
      .limit(1);

    if (wsIdError || !porId?.length) {
      return res.status(404).json({
        error:
          `Workspace con id "${idWorkspace}" no encontrado. Un identificador no ` +
          'se adivina: si lo copiaste de una lista vieja, vuelve a pedirla con ' +
          'GET /api/internal/list-workspaces.',
      });
    }
    workspace = porId[0];
  } else {
    // Camino de compatibilidad: nombre con emparejamiento parcial, para tolerar
    // emojis en el título. Es el que puede aterrizar donde no era, y por eso el
    // identificador es el recomendado desde v3.8.0.
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
        error: `Ambigüedad: "${workspaceName}" casó con múltiples workspaces. Sé explícito — o pasa workspaceId, que no tiene ambigüedad posible.`,
        candidates: workspaces.map(w => ({ id: w.id, name: w.name })),
      });
    }

    workspace = workspaces[0];
  }

  // 2. Tablero. Por identificador si vino; por nombre dentro del espacio si no.
  let board;

  if (idBoard) {
    const { data: porId, error: bIdError } = await supabaseAdmin
      .from('boards')
      .select('id, title, workspace_id')
      .eq('id', idBoard)
      .limit(1);

    if (bIdError || !porId?.length) {
      return res.status(404).json({
        error:
          `Tablero con id "${idBoard}" no encontrado. Los identificadores vivos ` +
          'los da GET /api/internal/list-boards.',
      });
    }

    board = porId[0];

    // ⚠️ EL TABLERO TIENE QUE SER DEL ESPACIO QUE SE PIDIÓ. Sin esto, un
    // `boardId` de otro espacio aterrizaría ahí y devolvería `201`: el destino
    // habría dejado de ser el que se declaró, en silencio. Es la misma guarda
    // que la Puerta 1 aplica entre espacio y columna, y existe por lo mismo —
    // exigir un destino sin comprobarlo da sensación de control sin control.
    //
    // Por el camino del nombre esto no hace falta: allí el tablero se busca ya
    // acotado con `.eq('workspace_id', …)`, así que no puede salir de otro sitio.
    if (board.workspace_id !== workspace.id) {
      return res.status(400).json({
        error:
          `El tablero "${board.title}" no pertenece al workspace "${workspace.name}". ` +
          'No se escribe nada: el destino declarado y el real no son el mismo, y ' +
          'aterrizar en otro espacio devolviendo 201 es exactamente lo que esta ' +
          'puerta impide.',
        board_workspace_id: board.workspace_id,
        workspace_id: workspace.id,
      });
    }
  } else {
    const { data: boards, error: boardError } = await supabaseAdmin
      .from('boards')
      .select('id, title')
      .eq('workspace_id', workspace.id)
      .ilike('title', `%${boardName}%`);

    board = boards?.[0];

    if (boardError || !board) {
      return res.status(404).json({ error: `Tablero "${boardName}" no encontrado en workspace "${workspace.name}".` });
    }
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
      // El campo SOLO viaja si hay clave, y no es cosmética: si esto se
      // desplegara antes de aplicar `migration-idempotency-key.sql`, mandarlo
      // siempre haría fallar **todas** las creaciones —la columna no existe—,
      // incluidas las de quien no usa idempotencia. Así, sin migración, lo único
      // que falla es lo que de verdad depende de ella, y falla diciéndolo.
      ...(claveIdem ? { idempotency_key: claveIdem } : {}),
    })
    .select()
    .single();

  // El `23505` NO es un error: es la carrera que la mirada previa no puede ver.
  // Dos reintentos simultáneos pasan los dos la comprobación y llegan aquí; el
  // índice único deja pasar uno y el otro tiene que recibir la MISMA respuesta
  // que habría recibido llegando un segundo más tarde. Tratarlo como 500 sería
  // decirle «no se creó» a quien acaba de crearla.
  if (cardError?.code === '23505' && claveIdem) {
    const previo = await acusePorClave(claveIdem);
    if (previo.card) {
      console.log(`[internal/create-card] carrera en ${claveIdem} → ${previo.card.id}`);
      return res.status(200).json({ ok: true, idempotent: true, card: previo.card });
    }
  }

  if (cardError) {
    console.error('[internal/create-card]', cardError.message);
    return res.status(500).json({ error: 'Error al crear la card.' });
  }

  console.log(
    `[internal/create-card] "${card.title}" → ${board.title} / ${targetColumn.title} ` +
    `· ${assigneeUser.name} · ${safePriority}`,
  );

  // Una tarjeta sin contenido se creó igual, pero deja de PARECERSE a una que
  // salió bien. Es lo único que distingue el 201 honesto del 201 que miente.
  //
  // POR QUÉ AVISO Y NO `400`, que era la otra opción sobre la mesa. Una tarjeta
  // solo-título es legítima a veces —lo dice el riel desde que existe—, así que
  // un `400` rechazaría trabajo bueno para tapar un caso dudoso. Rechazar lo
  // legítimo es peor que avisar de lo dudoso: lo primero impide que el trabajo
  // entre, y lo segundo solo pide mirar.
  //
  // POR QUÉ NO SE COPIA EL TEXTO DEL RIEL, aunque la regla sea la misma: aquel
  // manda a mirar `description_md` y su alias, y **esos nombres no existen en
  // esta puerta**. Un aviso que nombra un campo inexistente manda a arreglar
  // donde no está. Se comparte la regla; el texto es de cada puerta.
  //
  // Y NO mira el NOMBRE que vino, mira el RESULTADO: la tarjeta salió sin
  // contenido. Enumerar nombres de parámetro es el vicio, no el remedio — quien
  // invente `brief` o `body` seguiría perdiendo el texto igual.
  // ── Asignar suena, también por esta puerta ──────────────────────────────────
  //
  // Decisión de Ibai, 25-ago-2026 (tarjeta `b0a46770`). Hasta hoy una comanda
  // que entraba por aquí **existía, tenía dueño y no avisaba a nadie**: su
  // responsable solo se enteraba abriendo el tablero. No era un incumplimiento
  // —el contrato declaraba esta puerta «en crudo, sin notificaciones»— sino una
  // asimetría que dejó de tener sentido: desde el #56 la Puerta 1 y la UI avisan
  // al nacer asignadas, y **esta es justo la puerta por la que entra el trabajo
  // de fuera de esta máquina**.
  //
  // VA DESPUÉS DE LA ESCRITURA Y NO LA BLOQUEA. La tarjeta ya está creada y el
  // llamante va a recibir su `201` pase lo que pase con la campana: un aviso que
  // falla no puede convertir en error una escritura que salió bien.
  //
  // ⚠️ LAS DOS GUARDAS DE LA PUERTA 1 NO CABEN IGUAL AQUÍ, y decirlo importa
  // más que copiarlas:
  //
  //   · «Sin responsable no hay a quién avisar» **no puede darse**: `assignee`
  //     es obligatorio en esta puerta y se resuelve contra `users` antes de
  //     escribir nada. La comprobación se deja igualmente, porque una
  //     obligatoriedad es una regla de hoy y una guarda es barata.
  //   · «A uno mismo no se le notifica» **no se puede aplicar**: por aquí NO HAY
  //     identidad de llamante. Quien entra trae `x-task-secret`, no un usuario,
  //     así que no existe el «uno mismo» con el que comparar. Eso tiene tarjeta
  //     propia en este tablero, y el día que el llamante tenga identidad, esta
  //     guarda entra aquí sola.
  //
  // CONSECUENCIA ACEPTADA, dicha en voz alta: buena parte del tráfico de esta
  // puerta se asigna **al propio riel**, así que le llegarán avisos que nadie
  // lee. Es ruido barato en una tabla, y el remedio —callar según a quién se
  // asigne— exigiría reconocer cuentas de servicio por su email dentro del
  // código, que es la copia que envejece sola.
  if (assigneeUser?.id) {
    createAssigneeNotification(
      card.id,
      card.board_id,
      card.title,
      assigneeUser.id,
      null,   // no se sabe quién asignó, y no se inventa
    ).catch((err) => console.error('[internal/create-card] la campana falló:', err.message));
  }

  const acuse = {
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
  };

  if (!card.description || !String(card.description).trim()) {
    acuse.warning =
      'brief vacío: la tarjeta se creó SIN contenido. Si esperabas texto, el ' +
      'nombre del parámetro no llegó — el brief va en `description`. ' +
      'Compruébalo en el tablero: la respuesta de éxito no distingue una ' +
      'tarjeta con brief de una sin él, y por eso se avisa aquí.';
  }

  res.status(201).json(acuse);
});

module.exports = router;
