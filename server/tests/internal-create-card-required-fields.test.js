/**
 * POST /api/internal/create-card — responsable y prioridad OBLIGATORIOS.
 *
 * Tarjeta: «Una tarjeta sin responsable y sin prioridad es invisible: la puerta
 * no debería dejar crearla». La versión del contrato la custodia el propio
 * contrato: `docs/contracts/CONTRACT.md`.
 *
 * QUÉ DEFECTO VIGILA, dicho en la forma en que muerde. El sistema de trabajo
 * reparte por RESPONSABLE y ordena por PRIORIDAD. A una tarjeta a la que le
 * falte cualquiera de los dos no la coge nadie — y no falla: envejece en el
 * backlog pareciendo trabajo pendiente. Es la peor variante del `201` que
 * miente, porque aterrizar mal se nota tarde y nacer invisible no se nota nunca:
 * no hay error que leer ni tarjeta perdida que buscar, hay una fila correcta que
 * ningún proceso mira. Pasó de verdad el 6-ago-2026 con tres tarjetas.
 *
 * POR QUÉ EL MOCK CAPTURA LAS INSERCIONES. Las aserciones sobre el acuse no
 * bastan para este defecto: el acuse puede decir la verdad sobre una fila que se
 * escribió mal, y sobre todo puede faltar mientras la fila SÍ se escribe. Lo que
 * hay que poder afirmar es «no se escribió nada», y eso solo se ve mirando lo
 * que llegó al `insert`. Sin `__inserted`, la prueba mediría el código de estado
 * y no el efecto — que es justo la familia de prueba que esta casa ya pagó por
 * creerse.
 *
 * POR QUÉ ESTE ARCHIVO NO CRECE, y por qué la resolución del responsable vive en
 * `internal-create-card-assignee-resolution.test.js`: `/api/internal` está
 * detrás de `internalLimiter`, 10 peticiones por minuto (anti-adivinación del
 * secreto, y es una compuerta del contrato — no se afloja para que quepan más
 * pruebas). Cada archivo de Jest estrena su propio registro de módulos y con él
 * su propio contador, así que la forma de tener más pruebas es más archivos. Si
 * juntas los dos, la número 11 devuelve 429 y parecerá un fallo de la ruta.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

const RAIL_UUID = '11111111-2222-3333-4444-555555555555';

jest.mock('../utils/supabase', () => {
  const TABLES = {
    workspaces: [
      { id: 'ws-1', name: 'AGLAYA Kanban', type: 'interno', emoji: '📊', organization_id: 'org-1' },
    ],
    boards: [
      { id: 'board-1', workspace_id: 'ws-1', title: '🛠 Operaciones', order: 1 },
    ],
    columns: [
      { id: 'col-backlog', board_id: 'board-1', title: '🗂 Backlog', order: 1 },
    ],
    users: [
      { id: '11111111-2222-3333-4444-555555555555', name: 'Kanban Rail', email: 'kanban-rail@aglaya.biz' },
    ],
    cards: [],
  };

  const inserted = [];

  return {
    __inserted: inserted,
    supabaseAdmin: {
      from: (table) => {
        let data = JSON.parse(JSON.stringify(TABLES[table] ?? []));
        let projection = null;

        const chain = {
          select: (cols) => {
            if (typeof cols === 'string' && cols.trim() && cols !== '*') {
              projection = cols.split(',').map(c => c.trim());
            }
            return chain;
          },
          eq: (col, val) => { data = data.filter(r => r[col] === val); return chain; },
          ilike: (col, pattern) => {
            const p = String(pattern);
            const needle = p.replace(/%/g, '').toLowerCase();
            const openStart = p.startsWith('%');
            const openEnd   = p.endsWith('%');
            data = data.filter(r => {
              const s = String(r[col] ?? '').toLowerCase();
              if (openStart && openEnd) return s.includes(needle);
              if (openStart)            return s.endsWith(needle);
              if (openEnd)              return s.startsWith(needle);
              return s === needle;
            });
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          insert: (row) => {
            inserted.push(row);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'card-123', ...row }, error: null }),
              }),
            };
          },
          then: (resolve, reject) => {
            const out = projection
              ? data.map(r => Object.fromEntries(projection.filter(c => c in r).map(c => [c, r[c]])))
              : data;
            return Promise.resolve({ data: out, error: null }).then(resolve, reject);
          },
        };
        return chain;
      },
    },
  };
});

const { __inserted } = require('../utils/supabase');
const app = require('../app');

const SECRET = 'test-task-secret';
const post = (body) =>
  request(app)
    .post('/api/internal/create-card')
    .set('x-task-secret', SECRET)
    .send(body);

const BASE = {
  title:         'Tarea',
  boardName:     'Operaciones',
  workspaceName: 'AGLAYA Kanban',
  priority:      'high',
  assignee:      'kanban-rail@aglaya.biz',
  caller: 'banco-de-pruebas',
};

const sin = (...campos) => {
  const body = { ...BASE };
  for (const campo of campos) delete body[campo];
  return body;
};

beforeEach(() => { __inserted.length = 0; });

describe('priority es obligatoria y no tiene default', () => {
  it('ausente: 400, sin escribir, y el error explica el cambio', async () => {
    const res = await post(sin('priority'));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority/i);

    // La aserción que de verdad importa. Un 400 que además hubiera insertado
    // sería el defecto entero con cara de arreglo.
    expect(__inserted).toHaveLength(0);

    // Quien se coma este error viene de v2.0.0 y creerá que la puerta se rompió.
    // Tiene que entender que el default desapareció a propósito.
    expect(res.body.error).toMatch(/default/i);
    expect(res.body.error).toMatch(/medium/);

    // Y un error que prohíbe sin decir qué vale obliga a ir a leer el código.
    for (const p of ['urgent', 'high', 'medium', 'low', 'none']) {
      expect(res.body.error).toMatch(new RegExp(p));
    }
  });

  it('en blanco cuenta como ausente: 400, sin escribir', async () => {
    const res = await post({ ...BASE, priority: '   ' });
    expect(res.status).toBe(400);
    expect(__inserted).toHaveLength(0);
  });

  it('la prioridad que se manda es la que se escribe', async () => {
    // Vigila que el default no vuelva por otra vía: si alguien repusiera un
    // `|| 'medium'` DESPUÉS de la guarda, la guarda seguiría verde y esto no.
    const res = await post({ ...BASE, priority: 'low' });
    expect(res.status).toBe(201);
    expect(__inserted[0].priority).toBe('low');
    expect(res.body.card.priority).toBe('low');
  });
});

describe('assignee es obligatorio y no tiene default', () => {
  it('ausente: 400, sin escribir, y el error dice por qué duele', async () => {
    const res = await post(sin('assignee'));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/i);
    expect(__inserted).toHaveLength(0);

    // «Falta un campo» no explica nada. Lo que hay que transmitir es que la
    // tarjeta no fallaría: se quedaría quieta, que es peor.
    expect(res.body.error).toMatch(/responsable|nadie/i);
  });

  it('en blanco cuenta como ausente: 400, sin escribir', async () => {
    const res = await post({ ...BASE, assignee: '   ' });
    expect(res.status).toBe(400);
    expect(__inserted).toHaveLength(0);
  });

  it('con responsable, la tarjeta se escribe CON su assignee_id', async () => {
    // El acuse puede decir la verdad sobre una fila escrita sin dueño. Esto
    // mira la fila, no el acuse.
    const res = await post(BASE);
    expect(res.status).toBe(201);
    expect(__inserted).toHaveLength(1);
    expect(__inserted[0]).toHaveProperty('assignee_id', RAIL_UUID);
  });
});
