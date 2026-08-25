/**
 * POST /api/internal/create-card — apuntar por IDENTIFICADOR.
 *
 * Tarjeta: «La puerta externa apunta por nombre, y por eso puede aterrizar donde
 * no era» (`46b9b2c2`).
 *
 * QUÉ CIERRA. La puerta exigía `workspaceName` y **no aceptaba el
 * identificador**. El nombre es comodidad humana; el identificador es lo único
 * que no cambia cuando alguien renombra un espacio desde la interfaz. Y el
 * emparejamiento por nombre es parcial: medido contra la base real, **7 de 13
 * espacios casaban con `%AGLAYA%`**.
 *
 * El hueco era «media conversación»: la puerta ya sabía DEVOLVER identificadores
 * —`list-workspaces` y `list-boards` los dan— y quien leía el id correcto no
 * tenía dónde metérselo.
 *
 * EL CASO QUE MANDA es el tercero: **un `boardId` de otro espacio no se escribe**.
 * Sin esa guarda, aceptar identificadores habría abierto un camino nuevo para
 * aterrizar donde no era — el defecto que esta tarjeta viene a cerrar, con otra
 * cara y estrenado por el arreglo.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

const WS_A    = '11111111-1111-4111-8111-111111111111';
const WS_B    = '22222222-2222-4222-8222-222222222222';
const BOARD_A = '33333333-3333-4333-8333-333333333333';
const BOARD_B = '44444444-4444-4444-8444-444444444444';
const NO_EXISTE = '99999999-9999-4999-8999-999999999999';

jest.mock('../utils/supabase', () => {
  const WS_A    = '11111111-1111-4111-8111-111111111111';
  const WS_B    = '22222222-2222-4222-8222-222222222222';
  const BOARD_A = '33333333-3333-4333-8333-333333333333';
  const BOARD_B = '44444444-4444-4444-8444-444444444444';

  const TABLES = {
    // Los dos nombres se solapan A PROPÓSITO: `%AGLAYA%` casa con los dos, que
    // es exactamente la tirada de moneda que el identificador elimina.
    workspaces: [
      { id: WS_A, name: 'AGLAYA Kanban', type: 'interno', emoji: '📊', organization_id: 'org-1' },
      { id: WS_B, name: 'AGLAYA Docs',   type: 'interno', emoji: '📚', organization_id: 'org-1' },
    ],
    boards: [
      { id: BOARD_A, workspace_id: WS_A, title: '🛠 Operaciones', order: 1 },
      { id: BOARD_B, workspace_id: WS_B, title: '🛠 Operaciones', order: 1 },
    ],
    columns: [
      { id: 'col-a', board_id: BOARD_A, title: 'Backlog', order: 1 },
      { id: 'col-b', board_id: BOARD_B, title: 'Backlog', order: 1 },
    ],
    users: [{ id: 'user-rail', name: 'Kanban Rail', email: 'kanban-rail@aglaya.biz' }],
    cards: [],
  };

  const banco = { TABLES, reset() { TABLES.cards.length = 0; } };

  const supabaseAdmin = {
    from: (table) => {
      let data = JSON.parse(JSON.stringify(TABLES[table] ?? []));
      const chain = {
        select: () => chain,
        eq: (col, val) => { data = data.filter(r => r[col] === val); return chain; },
        ilike: (col, pattern) => {
          const p = String(pattern);
          const needle = p.replace(/%/g, '').toLowerCase();
          const abreIzq = p.startsWith('%');
          const abreDer = p.endsWith('%');
          data = data.filter(r => {
            const s = String(r[col] ?? '').toLowerCase();
            if (abreIzq && abreDer) return s.includes(needle);
            if (abreIzq)            return s.endsWith(needle);
            if (abreDer)            return s.startsWith(needle);
            return s === needle;
          });
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        insert: (row) => ({
          select: () => ({
            single: () => {
              const creada = { id: `card-${TABLES.cards.length + 1}`, ...row };
              TABLES.cards.push(creada);
              return Promise.resolve({ data: creada, error: null });
            },
          }),
        }),
        then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject),
      };
      return chain;
    },
  };

  return { supabaseAdmin, __banco: banco };
});

const { __banco } = require('../utils/supabase');
const app = require('../app');

const post = (body) =>
  request(app)
    .post('/api/internal/create-card')
    .set('x-task-secret', 'test-task-secret')
    .send({
      title: 'Tarea',
      priority: 'medium',
      assignee: 'kanban-rail@aglaya.biz',
      description: 'brief',
      ...body,
    });

beforeEach(() => __banco.reset());

describe('POST /api/internal/create-card — apuntar por identificador', () => {
  it('con workspaceId y boardId, aterriza exactamente ahí', async () => {
    const res = await post({ workspaceId: WS_A, boardId: BOARD_A });

    expect(res.status).toBe(201);
    expect(res.body.card.workspace_id).toBe(WS_A);
    expect(res.body.card.board_id).toBe(BOARD_A);
    expect(res.body.card.column_id).toBe('col-a');
  });

  // El nombre puede haber caducado —lo renombraron— y el identificador no. Si
  // vienen los dos y discrepan, la lectura que no depende de un renombrado es la
  // buena.
  it('si vienen id y nombre y apuntan a sitios distintos, gana el id', async () => {
    const res = await post({
      workspaceId: WS_B, workspaceName: 'AGLAYA Kanban',
      boardId: BOARD_B,  boardName: 'Operaciones',
    });

    expect(res.status).toBe(201);
    expect(res.body.card.workspace_id).toBe(WS_B);
    expect(res.body.card.board_id).toBe(BOARD_B);
  });

  // EL CASO QUE MANDA. Sin esta guarda, aceptar identificadores estrenaría un
  // camino nuevo para aterrizar donde no era.
  it('un boardId de OTRO espacio se rechaza y NO escribe nada', async () => {
    const res = await post({ workspaceId: WS_A, boardId: BOARD_B });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no pertenece al workspace/);
    expect(res.body.board_workspace_id).toBe(WS_B);
    expect(res.body.workspace_id).toBe(WS_A);
    expect(__banco.TABLES.cards).toHaveLength(0);
  });

  it('un workspaceId que no existe da 404, no cae al nombre', async () => {
    const res = await post({
      workspaceId: NO_EXISTE, workspaceName: 'AGLAYA Kanban', boardName: 'Operaciones',
    });

    expect(res.status).toBe(404);
    expect(__banco.TABLES.cards).toHaveLength(0);
  });

  it('un boardId que no existe da 404', async () => {
    const res = await post({ workspaceId: WS_A, boardId: NO_EXISTE });

    expect(res.status).toBe(404);
    expect(__banco.TABLES.cards).toHaveLength(0);
  });

  // Tragarse un identificador roto y resolver por el nombre sería el destino a
  // ciegas que esta puerta existe para impedir: el llamante creería haber
  // apuntado con precisión.
  it('un workspaceId mal formado da 400 y NO cae al nombre', async () => {
    const res = await post({
      workspaceId: 'no-es-un-uuid', workspaceName: 'AGLAYA Kanban', boardName: 'Operaciones',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workspaceId/);
    expect(res.body.error).toMatch(/UUID/);
    expect(__banco.TABLES.cards).toHaveLength(0);
  });

  it('sin espacio —ni id ni nombre— sigue siendo 400', async () => {
    const res = await post({ boardId: BOARD_A });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workspaceId/);
    expect(__banco.TABLES.cards).toHaveLength(0);
  });

  it('sin tablero —ni id ni nombre— es 400', async () => {
    const res = await post({ workspaceId: WS_A });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/boardId/);
    expect(__banco.TABLES.cards).toHaveLength(0);
  });
});
