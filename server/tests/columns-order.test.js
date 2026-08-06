/**
 * Columnas: renombrar, borrar y el orden que chocaba.
 *
 * Tarjeta: «Las columnas no se pueden renombrar ni borrar, y al insertarlas
 * chocan los números».
 *
 * QUÉ DEFECTO VIGILA. Las columnas de un tablero dejan de ser decoración cuando
 * el tablero ES el protocolo: cada una es un estado con dueño. `PUT /columns/:id`
 * escribía el número pedido a pelo, sin mirar quién lo ocupaba ni reordenar al
 * resto. Montando el protocolo de obra en el tablero de Operaciones se pidieron
 * las posiciones 4, 5 y 6 sobre un tablero que ya tenía 4 y 5, y **dos columnas
 * acabaron compartiendo número**. A partir de ahí el orden visual lo decidía el
 * desempate de la interfaz, no lo que se pidió.
 *
 * Y la otra mitad, que es la peligrosa: `cards.column_id` es **ON DELETE
 * CASCADE** (medido en la base, `confdeltype = 'c'`). Borrar una columna se
 * lleva sus tarjetas por delante y responde éxito. No molestaba mientras solo se
 * borraba desde la interfaz, donde quien borra ve lo que hay dentro — pero este
 * cambio le da la herramienta al riel, que no ve nada. La guarda entra en el
 * mismo commit que la herramienta, no después.
 *
 * POR QUÉ EL DOBLE TIENE ESTADO. Renumerar es una secuencia de escrituras cuyo
 * resultado solo se ve al final. Un doble que devuelva fixtures fijas no puede
 * distinguir «renumeró bien» de «no renumeró»: haría falta creerse el código de
 * estado, que es justo lo que no vale. Este doble guarda las columnas y las
 * muta, así que las pruebas leen el tablero DESPUÉS y comprueban el efecto.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../utils/supabase', () => {
  const state = { columns: [], cards: [], nextId: 1 };

  const supabaseAdmin = {
    from: (table) => {
      let mode = 'select';
      let patch = null;
      let inserted = null;
      const filters = {};
      const sorts = [];

      const rowsOf = () => (table === 'columns' ? state.columns : table === 'cards' ? state.cards : []);

      const matching = () =>
        rowsOf().filter((r) => Object.entries(filters).every(([c, v]) => r[c] === v));

      const chain = {
        select: () => chain,
        eq: (col, val) => { filters[col] = val; return chain; },
        in: () => chain,
        order: (col, opts = {}) => { sorts.push([col, opts.ascending !== false]); return chain; },
        limit: (n) => { chain.__limit = n; return chain; },

        update: (p) => { mode = 'update'; patch = p; return chain; },
        delete: () => { mode = 'delete'; return chain; },

        insert: (row) => {
          mode = 'insert';
          inserted = { id: `col-${state.nextId++}`, created_at: `2026-08-06T00:00:0${state.nextId}Z`, ...row };
          if (table === 'columns') state.columns.push(inserted);
          return chain;
        },

        single: () => {
          if (mode === 'insert') return Promise.resolve({ data: inserted, error: null });
          if (table === 'boards') {
            return Promise.resolve({ data: { id: 'board-1', workspace_id: 'ws-1' }, error: null });
          }
          if (table === 'workspace_members') {
            return Promise.resolve({ data: { workspace_id: 'ws-1', user_id: 'u-1', role: 'owner' }, error: null });
          }
          if (table === 'workspaces') {
            return Promise.resolve({ data: { id: 'ws-1', type: 'interno' }, error: null });
          }
          const hit = matching()[0];
          return Promise.resolve({ data: hit ?? null, error: hit ? null : { message: 'not found' } });
        },

        then: (resolve, reject) => {
          let rows = matching();

          if (mode === 'update') {
            for (const r of rows) Object.assign(r, patch);
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          }
          if (mode === 'delete') {
            const kill = new Set(rows.map((r) => r.id));
            state.columns = state.columns.filter((r) => !kill.has(r.id));
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }

          for (const [col, asc] of [...sorts].reverse()) {
            rows = [...rows].sort((a, b) => {
              const x = a[col], y = b[col];
              return x === y ? 0 : (x > y ? 1 : -1) * (asc ? 1 : -1);
            });
          }
          if (chain.__limit) rows = rows.slice(0, chain.__limit);
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
  };

  return { supabaseAdmin, __state: state };
});

const { __state } = require('../utils/supabase');
const app = require('../app');

const token = jwt.sign(
  { id: 'u-1', email: 'test@aglaya.biz', role: 'admin', organizationId: 'org-1' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' },
);

const auth = (r) => r.set('Authorization', `Bearer ${token}`);
const crear    = (body) => auth(request(app).post('/api/boards/board-1/columns')).send(body);
const editar   = (id, body) => auth(request(app).put(`/api/columns/${id}`)).send(body);
const borrar   = (id) => auth(request(app).delete(`/api/columns/${id}`));
// Filtra por tablero A PROPÓSITO: el doble guarda también una columna de otro
// tablero, y leer sin filtrar convertiría la prueba de aislamiento en ruido de
// fondo en todas las demás.
const tablero  = () => __state.columns.filter((c) => c.board_id === 'board-1')
                                      .sort((a, b) => a.order - b.order);
const titulos  = () => tablero().map((c) => c.title);
const numeros  = () => tablero().map((c) => c.order);

beforeEach(() => {
  __state.nextId = 1;
  __state.cards = [];
  __state.columns = [
    { id: 'c-a', board_id: 'board-1', title: 'A', order: 1, created_at: '2026-08-01T00:00:00Z' },
    { id: 'c-b', board_id: 'board-1', title: 'B', order: 2, created_at: '2026-08-01T00:00:01Z' },
    { id: 'c-c', board_id: 'board-1', title: 'C', order: 3, created_at: '2026-08-01T00:00:02Z' },
    // Columna de OTRO tablero: si renumerar pierde su filtro, se cuela aquí.
    { id: 'x-1', board_id: 'board-9', title: 'Ajena', order: 1, created_at: '2026-08-01T00:00:03Z' },
  ];
});

describe('insertar en una posición ocupada reordena a las demás', () => {
  it('la columna nueva queda donde se pidió y las otras se corren', async () => {
    const res = await crear({ title: 'NUEVA', order: 2 });
    expect(res.status).toBe(201);
    expect(titulos()).toEqual(['A', 'NUEVA', 'B', 'C']);
    expect(res.body.data.order).toBe(2);
  });

  it('los números quedan 1..N, contiguos y sin repetir', async () => {
    await crear({ title: 'NUEVA', order: 2 });
    expect(numeros()).toEqual([1, 2, 3, 4]);
    expect(new Set(numeros()).size).toBe(numeros().length);
  });

  it('dos creaciones seguidas pidiendo la MISMA posición no comparten número', async () => {
    // La prueba que la propia tarjeta dejó escrita: es la mutación exacta que
    // destapó el defecto. Antes las dos se escribían con el número pedido y el
    // tablero acababa con dos columnas en el mismo sitio.
    await crear({ title: 'P', order: 2 });
    await crear({ title: 'Q', order: 2 });

    expect(numeros()).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(numeros()).size).toBe(5);
    expect(titulos()).toEqual(['A', 'Q', 'P', 'B', 'C']);
  });

  it('sin `order` se añade al final, como antes', async () => {
    const res = await crear({ title: 'ÚLTIMA' });
    expect(res.status).toBe(201);
    expect(titulos()).toEqual(['A', 'B', 'C', 'ÚLTIMA']);
  });

  it('un `order` que no es entero positivo se rechaza con 400', async () => {
    expect((await crear({ title: 'X', order: 0 })).status).toBe(400);
    expect((await crear({ title: 'X', order: 'primera' })).status).toBe(400);
  });

  it('renumerar NO toca las columnas de otro tablero', async () => {
    await crear({ title: 'NUEVA', order: 1 });
    const ajena = __state.columns.find((c) => c.id === 'x-1');
    expect(ajena.order).toBe(1);
    expect(ajena.board_id).toBe('board-9');
  });
});

describe('renombrar y mover una columna', () => {
  it('renombra sin tocar el orden', async () => {
    const res = await editar('c-b', { title: 'B renombrada' });
    expect(res.status).toBe(200);
    expect(titulos()).toEqual(['A', 'B renombrada', 'C']);
    expect(numeros()).toEqual([1, 2, 3]);
  });

  it('mover a una posición ocupada reordena en vez de pisar el número', async () => {
    // El defecto original en una línea: se escribía `order` en el parche. Con
    // esto, mover C al 1 dejaba dos columnas con el 1.
    const res = await editar('c-c', { order: 1 });
    expect(res.status).toBe(200);
    expect(titulos()).toEqual(['C', 'A', 'B']);
    expect(numeros()).toEqual([1, 2, 3]);
  });

  it('el acuse trae la posición REAL, no la pedida', async () => {
    // Pedir "la 99" en un tablero de tres es una intención legítima —la última—
    // y el acuse tiene que decir dónde acabó de verdad, no repetir la entrada.
    const res = await editar('c-a', { order: 99 });
    expect(res.status).toBe(200);
    expect(res.body.data.order).toBe(3);
    expect(titulos()).toEqual(['B', 'C', 'A']);
  });

  it('renombrar y mover a la vez', async () => {
    const res = await editar('c-a', { title: 'A movida', order: 3 });
    expect(res.status).toBe(200);
    expect(titulos()).toEqual(['B', 'C', 'A movida']);
  });

  it('un `order` inválido se rechaza con 400 y no cambia nada', async () => {
    const res = await editar('c-c', { order: -1 });
    expect(res.status).toBe(400);
    expect(titulos()).toEqual(['A', 'B', 'C']);
  });
});

describe('borrar una columna no se lleva tarjetas por delante', () => {
  it('con tarjetas dentro devuelve 409 y NO borra', async () => {
    // `cards.column_id` es ON DELETE CASCADE: sin esta guarda, el borrado se
    // llevaba las tarjetas y respondía éxito. Lo que se pierde en este tablero
    // no está en ningún otro sitio.
    __state.cards = [{ id: 'card-1', column_id: 'c-b' }, { id: 'card-2', column_id: 'c-b' }];

    const res = await borrar('c-b');
    expect(res.status).toBe(409);
    expect(res.body.cards).toBe(2);
    expect(titulos()).toEqual(['A', 'B', 'C']);
  });

  it('el 409 dice cuántas hay y qué hacer', async () => {
    __state.cards = [{ id: 'card-1', column_id: 'c-b' }];
    const res = await borrar('c-b');
    expect(res.body.error).toMatch(/1 tarjeta/);
    expect(res.body.error).toMatch(/mueve|muévelas/i);
  });

  it('vacía se borra y el hueco se cierra', async () => {
    const res = await borrar('c-b');
    expect(res.status).toBe(200);
    expect(titulos()).toEqual(['A', 'C']);
    expect(numeros()).toEqual([1, 2]);
  });
});
