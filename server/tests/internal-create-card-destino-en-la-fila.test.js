/**
 * POST /api/internal/create-card — el destino de la FILA que se escribe.
 *
 * Tarjeta: «Nadie mira la fila que escribe la puerta interna: puede nacer sin
 * tablero ni columna y devolver 201» (`bc1a8905`).
 *
 * POR QUÉ HACE FALTA UN BANCO PARA ESTO, si el acuse ya trae los destinos.
 * **Son dos superficies distintas y solo una estaba vigilada.** El `201` no se
 * construye a partir de la fila escrita: sale de las variables locales `board` y
 * `targetColumn`. Así que **el acuse sigue diciendo la verdad aunque la fila ya
 * no la tenga** — y una tarjeta en `cards` sin `board_id` ni `column_id` existe,
 * devuelve `201`, y no aparece en ningún tablero.
 *
 * Es la familia «nace invisible» que esta puerta ya documenta para `assignee` y
 * `priority`, un piso más abajo: no aterriza mal, **no aterriza**.
 *
 * ⚠️ Y POR QUÉ NO BASTABA LO QUE YA HABÍA. Medido el 25-ago-2026: quitar
 * `column_id` del `insert` **sí** pone roja la suite hoy… pero por
 * `internal-create-card-idempotencia.test.js`, que reconstruye el acuse de una
 * REPETICIÓN leyendo la fila guardada. Es cobertura **de rebote**:
 *
 *   · depende de que exista la idempotencia — quítala y el agujero vuelve;
 *   · y el rojo dice «la repetición no devuelve los mismos destinos», que manda
 *     a mirar el camino de la repetición, no el `insert`.
 *
 * Un test que se pone rojo por un motivo distinto del que nombra manda a
 * arreglar otra cosa. Este banco mira **la fila**, directamente, y su rojo lo
 * dice.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

jest.mock('../utils/supabase', () => {
  const TABLES = {
    workspaces: [
      { id: 'ws-1', name: 'AGLAYA Kanban', type: 'interno', emoji: '📊', organization_id: 'org-1' },
    ],
    boards:  [{ id: 'board-1', workspace_id: 'ws-1', title: '🛠 Operaciones', order: 1 }],
    // Dos columnas para que elegir la de Backlog sea una decisión y no la única
    // opción: si la ruta dejara de elegir, se vería.
    columns: [
      { id: 'col-backlog', board_id: 'board-1', title: 'Backlog',  order: 1 },
      { id: 'col-hecho',   board_id: 'board-1', title: '✅ Hecho', order: 2 },
    ],
    users:   [{ id: 'user-rail', name: 'Kanban Rail', email: 'kanban-rail@aglaya.biz' }],
    cards:   [],
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
              // La fila se guarda TAL COMO LLEGÓ. Un doble que rellenara huecos
              // taparía justo lo que se mide: el `id` es lo único que pone la
              // base, y por eso es lo único que se añade aquí.
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
      boardName: 'Operaciones',
      workspaceName: 'AGLAYA Kanban',
      priority: 'medium',
      assignee: 'kanban-rail@aglaya.biz',
      description: 'brief',
      ...body,
    });

const fila = () => __banco.TABLES.cards[0];

beforeEach(() => __banco.reset());

describe('POST /api/internal/create-card — la fila escrita lleva su destino', () => {
  it('la fila insertada trae board_id', async () => {
    const res = await post({});

    expect(res.status).toBe(201);
    expect(fila().board_id).toBe('board-1');
  });

  it('la fila insertada trae column_id', async () => {
    const res = await post({});

    expect(res.status).toBe(201);
    expect(fila().column_id).toBe('col-backlog');
  });

  // Que sea la de Backlog, no una cualquiera: la ruta elige entre varias, y una
  // tarjeta que naciera en «Hecho» tampoco sería trabajo que entra.
  it('y la columna es la de Backlog, que es una decisión y no la única opción', async () => {
    await post({});

    expect(fila().column_id).not.toBe('col-hecho');
  });

  // EL PUNTO DE LA TARJETA, dicho como aserción: el acuse no vale de testigo.
  // Sale de las variables locales, así que seguiría diciendo la verdad con la
  // fila vacía. Si esto se rompe, el acuse NO se entera.
  it('el acuse y la fila coinciden — y el acuse no basta como prueba de la fila', async () => {
    const res = await post({});

    expect(res.body.card.board_id).toBe(fila().board_id);
    expect(res.body.card.column_id).toBe(fila().column_id);
    // Ninguno de los dos puede ser indefinido: comparar dos ausencias también
    // «coincide», y eso es exactamente el 201 que miente.
    expect(fila().board_id).toBeTruthy();
    expect(fila().column_id).toBeTruthy();
  });

  it('el espacio también viaja en la fila: sin organization_id la tarjeta queda huérfana', async () => {
    await post({});

    expect(fila().organization_id).toBe('org-1');
  });
});
