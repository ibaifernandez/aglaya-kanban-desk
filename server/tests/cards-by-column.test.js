/**
 * GET /api/columns/:columnId/cards — pedir una columna devuelve SOLO esa columna.
 *
 * Tarjeta: «list_cards contesta por el tablero a quien pregunta por la columna».
 *
 * QUÉ VIGILA, y por qué está en el servidor y no en el riel. El defecto vivía en
 * `kanban-mcp/server.py`: `column_id` se usaba solo para derivar el tablero y
 * después se tiraba, así que pedir «🔍 Por revisar» y pedir «🛡 Auditado» —vacía—
 * devolvía la MISMA respuesta byte a byte, el tablero entero. 19 tarjetas las dos
 * veces.
 *
 * El arreglo NO fue filtrar en el cliente: fue preguntarle al endpoint que ya
 * filtraba. **Y ese endpoint no tenía ni una prueba.** O sea que el arreglo se
 * apoyaba entero en una pieza que nadie vigilaba — que es la misma forma de fallo
 * un piso más abajo. Esta es la prueba que la tarjeta dejó escrita como sello:
 * tarjetas en dos columnas del mismo tablero, y pedir una no devuelve las de la
 * otra.
 *
 * Por qué importa más que un listado cualquiera: el protocolo de obra arranca los
 * CUATRO papeles con «coge de tal columna». Si esa pregunta contesta con el
 * tablero entero, los cuatro trabajan sobre lo que no es suyo y el tablero deja
 * de repartir nada — sin que nada falle.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../utils/supabase', () => {
  const TABLES = {
    // Dos columnas del MISMO tablero, con tarjetas en las dos. Si la ruta pierde
    // su filtro, las de la vecina se cuelan y esto se pone rojo.
    cards: [
      { id: 'k-1', column_id: 'col-backlog',  board_id: 'board-1', title: 'Pendiente uno', order: 1, priority: 'high',   tags: [], checklist: [] },
      { id: 'k-2', column_id: 'col-backlog',  board_id: 'board-1', title: 'Pendiente dos', order: 2, priority: 'low',    tags: [], checklist: [] },
      { id: 'k-9', column_id: 'col-revisar',  board_id: 'board-1', title: 'Ya revisada',   order: 1, priority: 'medium', tags: [], checklist: [] },
      // Y una de OTRO tablero, por si el filtro se cambiara por uno de board.
      { id: 'x-1', column_id: 'col-ajena',    board_id: 'board-9', title: 'De otra casa',  order: 1, priority: 'none',   tags: [], checklist: [] },
    ],
  };

  return {
    supabaseAdmin: {
      from: (table) => {
        let rows = JSON.parse(JSON.stringify(TABLES[table] ?? []));
        const filters = {};

        const chain = {
          select: () => chain,
          eq: (col, val) => { filters[col] = val; rows = rows.filter(r => r[col] === val); return chain; },
          in: () => chain,
          order: (col, opts = {}) => {
            const dir = opts.ascending === false ? -1 : 1;
            rows.sort((a, b) => (a[col] > b[col] ? dir : a[col] < b[col] ? -dir : 0));
            return chain;
          },
          single: () => {
            if (table === 'boards') {
              return Promise.resolve({ data: { id: 'board-1', workspace_id: 'ws-1' }, error: null });
            }
            if (table === 'workspace_members') {
              return Promise.resolve({ data: { workspace_id: 'ws-1', user_id: 'u-1', role: 'owner' }, error: null });
            }
            if (table === 'workspaces') {
              return Promise.resolve({ data: { id: 'ws-1', type: 'interno' }, error: null });
            }
            if (table === 'columns') {
              return Promise.resolve({ data: { id: filters.id, board_id: 'board-1' }, error: null });
            }
            return Promise.resolve({ data: rows[0] ?? null, error: null });
          },
          then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
        };
        return chain;
      },
    },
  };
});

const app = require('../app');

const token = jwt.sign(
  { id: 'u-1', email: 'test@aglaya.biz', role: 'admin', organizationId: 'org-1' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' },
);

const pedir = (columnId) =>
  request(app).get(`/api/columns/${columnId}/cards`).set('Authorization', `Bearer ${token}`);

describe('pedir una columna devuelve SOLO esa columna', () => {
  it('la columna con dos tarjetas devuelve esas dos', async () => {
    const res = await pedir('col-backlog');
    expect(res.status).toBe(200);
    expect(res.body.data.map(c => c.id).sort()).toEqual(['k-1', 'k-2']);
  });

  it('no se cuela la tarjeta de la columna vecina', async () => {
    // Dicho aparte y en negativo a propósito: el defecto original devolvía un
    // SUPERCONJUNTO, y un superconjunto pasa las aserciones que solo comprueban
    // que «está lo que esperaba». Lo que hay que exigir es que NO esté lo demás.
    const res = await pedir('col-backlog');
    expect(res.body.data.map(c => c.id)).not.toContain('k-9');
  });

  it('dos columnas del mismo tablero NO devuelven lo mismo', async () => {
    // La mutación exacta que destapó el defecto: pedir dos columnas distintas y
    // recibir la misma respuesta byte a byte. Con el filtro puesto, difieren.
    const backlog = await pedir('col-backlog');
    const revisar = await pedir('col-revisar');

    expect(revisar.body.data.map(c => c.id)).toEqual(['k-9']);
    expect(backlog.body.data).not.toEqual(revisar.body.data);
  });

  it('una columna vacía devuelve lista vacía, no el tablero', async () => {
    // Este es el caso que lo hizo visible: «🛡 Auditado» estaba vacía y devolvía
    // 19 tarjetas. Una columna vacía que contesta con contenido es la señal más
    // clara de que el filtro no existe.
    const res = await pedir('col-sin-nada');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('no se cuela una tarjeta de otro tablero', async () => {
    const res = await pedir('col-backlog');
    expect(res.body.data.map(c => c.id)).not.toContain('x-1');
  });

  it('vienen ordenadas por su orden dentro de la columna', async () => {
    const res = await pedir('col-backlog');
    expect(res.body.data.map(c => c.order)).toEqual([1, 2]);
  });
});
