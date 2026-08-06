/**
 * POST /api/internal/create-card — cómo se resuelve el responsable.
 *
 * Segunda mitad de la tarjeta «Una tarjeta sin responsable y sin prioridad es
 * invisible». La primera mitad —que el campo sea obligatorio—
 * vive en `internal-create-card-required-fields.test.js`. Están separadas porque
 * `/api/internal` va detrás de `internalLimiter`, 10 peticiones por minuto: es
 * una compuerta del contrato y no se afloja para que quepan pruebas. Cada
 * archivo de Jest estrena registro de módulos y con él su propio contador.
 *
 * QUÉ VIGILA ESTA MITAD. Exigir el campo sin resolverlo daría sensación de
 * control sin control — la misma frase que ya está escrita sobre `workspace_id`
 * en el riel. Un `assignee` que no resuelve tiene que dejar la tarjeta SIN
 * CREAR: si se creara y fallara después al asignar, el guardián del campo habría
 * fabricado él mismo la tarjeta huérfana que existe para impedir. Por eso las
 * pruebas de fallo miran `__inserted`, no el código de estado.
 *
 * Y el match aquí es EXACTO, al revés que el de espacio y tablero. Allí el
 * parcial se tolera para no pelear con los emojis del título; aquí no hay nada
 * que tolerar y un parcial engancharía a la persona de al lado. El mock aplica
 * ILIKE fiel —sin comodines es igualdad— porque un doble que trate las dos
 * formas igual no puede distinguir dos decisiones que son opuestas a propósito.
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
      // Dos filas con el MISMO nombre y emails distintos. No es rebuscado: el
      // email es único en la tabla y el nombre no, así que resolver por nombre
      // es el único camino que puede casar con varios.
      { id: 'user-ibai-1', name: 'Ibai Fernández', email: 'info@ibaifernandez.com' },
      { id: 'user-ibai-2', name: 'Ibai Fernández', email: 'ibai@aglaya.biz' },
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
};

beforeEach(() => { __inserted.length = 0; });

describe('el responsable se resuelve por sus tres nombres', () => {
  it('por email, y el acuse devuelve el nombre canónico, no la entrada', async () => {
    // Se manda el email y se espera el NOMBRE de vuelta, para que «resuelto» y
    // «tal como entró» sean strings distintos. Si la ruta devolviera la entrada
    // —el defecto que el acuse ya pagó con `workspace` en v2.0.0— esto se pone
    // rojo. Un acuse que repite lo que le dijiste no permite comprobar nada.
    const res = await post({ ...BASE, assignee: 'kanban-rail@aglaya.biz' });

    expect(res.status).toBe(201);
    expect(__inserted[0].assignee_id).toBe(RAIL_UUID);
    expect(res.body.card.assignee_id).toBe(RAIL_UUID);
    expect(res.body.card.assignee).toBe('Kanban Rail');
    expect(res.body.card.assignee).not.toBe('kanban-rail@aglaya.biz');
  });

  it('por nombre exacto', async () => {
    const res = await post({ ...BASE, assignee: 'Kanban Rail' });
    expect(res.status).toBe(201);
    expect(__inserted[0].assignee_id).toBe(RAIL_UUID);
  });

  it('por id', async () => {
    const res = await post({ ...BASE, assignee: RAIL_UUID });
    expect(res.status).toBe(201);
    expect(__inserted[0].assignee_id).toBe(RAIL_UUID);
  });
});

describe('un responsable que no resuelve no escribe nada', () => {
  it('desconocido: 404 y cero inserciones', async () => {
    const res = await post({ ...BASE, assignee: 'nadie@ejemplo.com' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/responsable/i);

    // Sin esta línea, un orden de operaciones que creara la tarjeta y fallara
    // después al asignar seguiría pasando en verde — y habría dejado
    // exactamente la tarjeta huérfana que este campo existe para impedir.
    expect(__inserted).toHaveLength(0);
  });

  it('un email a medias, sin comodines, no engancha', async () => {
    // `kanban-rail` es prefijo de `kanban-rail@aglaya.biz`. Si la ruta buscara
    // con `%valor%` —como sí hace con espacio y tablero— esto devolvería 201
    // sobre una persona que nadie nombró, y el acuse diría que todo fue bien.
    //
    // ⚠️ Esta prueba se llamaba «el match es EXACTO» y sobreafirmaba. Cubre la
    // entrada SIN comodines, que es la mitad que el código sí resuelve bien. NO
    // cubre una entrada CON `%` o `_`: `ilike` los interpreta, así que
    // `"%aglaya.biz"` casa. Lo midió el vigilante y tiene tarjeta propia; el
    // nombre se corrige ya para que la suite no jure lo que no vigila.
    const res = await post({ ...BASE, assignee: 'kanban-rail' });
    expect(res.status).toBe(404);
    expect(__inserted).toHaveLength(0);
  });

  it('un nombre que casa con varios: 400 con candidatos y cero inserciones', async () => {
    const res = await post({ ...BASE, assignee: 'Ibai Fernández' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ambig/i);
    expect(__inserted).toHaveLength(0);

    // `candidates` es la mitad útil del 400: un error que dice «ambiguo» sin
    // decir entre quiénes obliga a adivinar otra vez. Y lleva el email porque
    // es lo que el propio mensaje pide usar para desambiguar.
    expect(res.body.candidates).toHaveLength(2);
    expect(res.body.candidates.map(c => c.id).sort()).toEqual(['user-ibai-1', 'user-ibai-2']);
    for (const c of res.body.candidates) {
      expect(typeof c.email).toBe('string');
    }
  });

  it('el email desambigua lo que el nombre no', async () => {
    // La salida que propone el 400 tiene que funcionar de verdad. Un error que
    // dice «pasa el email» y luego no resuelve por email es un callejón.
    const res = await post({ ...BASE, assignee: 'ibai@aglaya.biz' });
    expect(res.status).toBe(201);
    expect(__inserted[0].assignee_id).toBe('user-ibai-2');
  });
});
