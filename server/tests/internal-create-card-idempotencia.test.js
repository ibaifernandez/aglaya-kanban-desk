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

// ⚠️ POR QUÉ ESTE BANCO ESTÁ PARTIDO EN DOS FICHEROS. `internalLimiter` en
// `server/app.js` corta a 10 peticiones por minuto y por IP, y un banco entero
// de idempotencia gasta más: cada caso son DOS peticiones, porque la repetición
// es el objeto de estudio. Al pasarse, los últimos casos reciben `429` y el
// fallo se lee como un defecto de la ruta que no existe. Cada fichero de jest
// tiene su propio registro de módulos, así que cada uno estrena limitador.
// La forma de la clave vive en `internal-create-card-idempotencia-forma.test.js`.

beforeEach(() => __banco.reset());

describe('POST /api/internal/create-card — clave de idempotencia', () => {
  it('sin clave, dos POST idénticos siguen creando DOS tarjetas', async () => {
    // El comportamiento anterior no cambia: la idempotencia es opt-in. Si esto
    // se pusiera rojo, el cambio habría sido incompatible en vez de aditivo.
    const a = await post(COMANDA);
    const b = await post(COMANDA);

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.card.id).not.toBe(b.body.card.id);
    expect(__banco.TABLES.cards).toHaveLength(2);
  });

  it('con la misma clave, el segundo POST devuelve la que YA existe y con los mismos destinos', async () => {
    const a = await post({ ...COMANDA, idempotencyKey: CLAVE });
    const b = await post({ ...COMANDA, idempotencyKey: CLAVE });

    expect(a.status).toBe(201);
    expect(a.body.idempotent).toBeUndefined();

    expect(b.status).toBe(200);
    expect(b.body.idempotent).toBe(true);
    expect(b.body.card.id).toBe(a.body.card.id);

    // La aserción que de verdad importa: no hay una segunda fila. Comparar los
    // dos acuses no bastaría — con un doble que devuelve siempre el mismo id
    // pasaría igual, que es el defecto que retiró el #16.
    expect(__banco.TABLES.cards).toHaveLength(1);

    // Y el acuse de la repetición se reconstruye desde la fila guardada, así que
    // tiene que traer los mismos destinos resueltos, no un esqueleto.
    for (const campo of [
      'workspace_id', 'workspace', 'board_id', 'board',
      'column_id', 'column', 'assignee_id', 'assignee', 'priority', 'title',
    ]) {
      expect(b.body.card[campo]).toEqual(a.body.card[campo]);
    }
  });

  // Esta prueba existe por una mutación que sobrevivió: quitar el cortocircuito
  // previo dejaba las ocho en verde, porque el `23505` recogía la repetición
  // igual. No era equivalente, y aquí está la diferencia — si la repetición
  // vuelve a resolver el destino desde lo que trae AHORA, un tablero renombrado
  // la convierte en un 404 sobre una tarjeta que existe.
  it('la repetición no falla porque el mundo se haya movido: el tablero ya no casa y sigue devolviendo la suya', async () => {
    const a = await post({ ...COMANDA, idempotencyKey: CLAVE });
    expect(a.status).toBe(201);

    __banco.TABLES.boards[0].title = '📦 Archivo 2026';

    const b = await post({ ...COMANDA, idempotencyKey: CLAVE });

    expect(b.status).toBe(200);
    expect(b.body.idempotent).toBe(true);
    expect(b.body.card.id).toBe(a.body.card.id);
    // Y devuelve dónde ESTÁ, no dónde habría ido: el nombre nuevo del tablero
    // donde la tarjeta sigue viviendo.
    expect(b.body.card.board).toBe('📦 Archivo 2026');
    expect(__banco.TABLES.cards).toHaveLength(1);
  });

  // LA CARRERA. Es el caso que la mirada previa NO puede cubrir, y por el que la
  // garantía vive en el índice único y no en la ruta.
  it('dos reintentos simultáneos: el que pierde la carrera recibe la que ganó, no un 500', async () => {
    await post({ ...COMANDA, idempotencyKey: CLAVE });

    // El segundo mira antes de ver la fila —como haría el que llega a la vez— y
    // llega al insert, donde le espera el índice único.
    __banco.cegarProximaLectura = true;
    const b = await post({ ...COMANDA, idempotencyKey: CLAVE });

    expect(b.status).toBe(200);
    expect(b.body.idempotent).toBe(true);
    expect(b.body.card.id).toBe('card-1');
    expect(__banco.TABLES.cards).toHaveLength(1);
  });
});
