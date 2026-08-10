/**
 * POST /api/internal/create-card — clave de idempotencia.
 *
 * Tarjeta: «Repetir una comanda crea otra tarjeta: no hay clave de idempotencia».
 *
 * ⚠️ LA TRAMPA QUE ESTA TARJETA DEJÓ ESCRITA, Y POR QUÉ ESTE DOBLE ES ASÍ.
 * Hubo una prueba que afirmaba en verde esta misma idempotencia. Pasaba **solo
 * porque el doble devolvía el literal `card-123` en toda inserción**: dos
 * inserciones daban «la misma tarjeta» sin que la ruta hiciera nada. La retiró
 * el #16.
 *
 * Por eso este doble hace las tres cosas que aquella no hacía:
 *   · **id distinto por inserción** (`card-1`, `card-2`, …). Si la ruta creara
 *     dos, esta prueba lo vería.
 *   · **persiste** lo insertado, así que la segunda petición puede encontrarlo.
 *   · **ejerce el índice único**: una segunda fila con la misma clave devuelve
 *     `{ code: '23505' }`, que es lo que devuelve PostgreSQL. Sin eso, la rama
 *     de la carrera no la ejecuta nadie y su verde sería otra tautología.
 *
 * Este fichero cubre la FORMA de la clave y lo que queda escrito en la fila.
 * El comportamiento —repetir, carrera, claves distintas— vive en
 * `internal-create-card-idempotencia.test.js`, partido por el limitador de
 * peticiones de la puerta (10/min): ver la nota de allí.
 *
 * Lo que este banco NO puede demostrar: que el índice único EXISTA en la base.
 * Eso lo aplica el Operador y se comprueba contra la base, no aquí.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

const CLAVE   = '11111111-2222-4333-8444-555555555555';
const CLAVE_B = '99999999-8888-4777-8666-555555555555';

jest.mock('../utils/supabase', () => {
  const TABLES = {
    workspaces: [
      { id: 'ws-1', name: 'AGLAYA Kanban', type: 'interno', emoji: '📊', organization_id: 'org-1' },
    ],
    boards: [
      { id: 'board-1', workspace_id: 'ws-1', title: '🛠 Operaciones', order: 1 },
    ],
    columns: [
      { id: 'col-backlog', board_id: 'board-1', title: 'Backlog',  order: 1 },
      { id: 'col-hecho',   board_id: 'board-1', title: '✅ Hecho', order: 2 },
    ],
    users: [
      { id: 'user-rail', name: 'Kanban Rail', email: 'kanban-rail@aglaya.biz' },
    ],
    cards: [],
  };

  // Copia intacta: hay pruebas que renombran un tablero para ver qué hace una
  // repetición cuando el mundo se ha movido, y sin restaurar eso se filtraría a
  // la prueba siguiente como un fallo que no es suyo.
  const PRISTINO = JSON.parse(JSON.stringify(TABLES));

  // Estado del banco, alcanzable desde la prueba por `__banco`.
  const banco = {
    TABLES,
    siguienteId: 1,
    // Para la carrera: hace que la PRÓXIMA lectura de `cards` salga vacía
    // aunque la fila exista. Es exactamente lo que le pasa al segundo reintento
    // simultáneo: mira antes de que el primero haya escrito.
    cegarProximaLectura: false,
    reset() {
      for (const t of Object.keys(PRISTINO)) {
        TABLES[t].length = 0;
        TABLES[t].push(...JSON.parse(JSON.stringify(PRISTINO[t])));
      }
      banco.siguienteId = 1;
      banco.cegarProximaLectura = false;
    },
  };

  const supabaseAdmin = {
    from: (table) => {
      let data = JSON.parse(JSON.stringify(TABLES[table] ?? []));

      if (table === 'cards' && banco.cegarProximaLectura) {
        banco.cegarProximaLectura = false;
        data = [];
      }

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
              // El índice único de migration-idempotency-key.sql, ejercido.
              const choca =
                row.idempotency_key != null &&
                TABLES.cards.some(c => c.idempotency_key === row.idempotency_key);

              if (choca) {
                return Promise.resolve({
                  data: null,
                  error: {
                    code: '23505',
                    message: 'duplicate key value violates unique constraint "idx_cards_idempotency_key"',
                  },
                });
              }

              // ID DISTINTO POR INSERCIÓN. Es la línea que impide que esta
              // prueba vuelva a ser una tautología.
              const creada = { id: `card-${banco.siguienteId++}`, ...row };
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

const SECRET = 'test-task-secret';
const post = (body) =>
  request(app)
    .post('/api/internal/create-card')
    .set('x-task-secret', SECRET)
    .send(body);

const COMANDA = {
  title: 'Tarea repetible',
  boardName: 'Operaciones',
  workspaceName: 'AGLAYA Kanban',
  priority: 'medium',
  assignee: 'kanban-rail@aglaya.biz',
};

beforeEach(() => __banco.reset());

describe('POST /api/internal/create-card — forma de la clave de idempotencia', () => {
  it('claves distintas crean tarjetas distintas', async () => {
    const a = await post({ ...COMANDA, idempotencyKey: CLAVE });
    const b = await post({ ...COMANDA, idempotencyKey: CLAVE_B });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.card.id).not.toBe(b.body.card.id);
    expect(__banco.TABLES.cards).toHaveLength(2);
  });

  it('rechaza con 400 una clave que no es UUID, y sin escribir nada', async () => {
    const res = await post({ ...COMANDA, idempotencyKey: 'mi-clave-de-siempre' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/idempotencyKey/);
    expect(res.body.error).toMatch(/UUID/);
    expect(__banco.TABLES.cards).toHaveLength(0);
  });

  // Mandar el campo vacío es haber decidido usarlo. Tragárselo devolvería una
  // tarjeta nueva por reintento mientras el llamante se cree protegido — la
  // familia del 201 que miente.
  it('rechaza con 400 una clave vacía en vez de tratarla como ausente', async () => {
    const res = await post({ ...COMANDA, idempotencyKey: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/idempotencyKey/);
    // Entra por la misma puerta que cualquier clave inservible: la vacía
    // tampoco es un UUID. Tener una rama aparte para ella era código que no
    // podía fallar — medido por mutación.
    expect(res.body.error).toMatch(/UUID/);
    expect(__banco.TABLES.cards).toHaveLength(0);
  });

  it('la clave se guarda en la fila, que es lo que hace única a la tarjeta', async () => {
    await post({ ...COMANDA, idempotencyKey: CLAVE });
    expect(__banco.TABLES.cards[0].idempotency_key).toBe(CLAVE);
  });

  // Sin clave el campo NO viaja en el insert, y eso es deliberado: si esto se
  // desplegara antes de aplicar la migración, mandarlo siempre haría fallar
  // todas las creaciones —la columna no existe— incluidas las de quien no usa
  // idempotencia. La columna es NULL por defecto, así que el resultado en la
  // base es el mismo.
  it('sin clave, el campo no viaja en el insert', async () => {
    await post(COMANDA);
    expect('idempotency_key' in __banco.TABLES.cards[0]).toBe(false);
  });
});
