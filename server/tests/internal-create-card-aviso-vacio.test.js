/**
 * POST /api/internal/create-card — una tarjeta sin contenido lo dice.
 *
 * Tarjeta: «La puerta HTTP crea una tarjeta sin contenido y no avisa; el riel
 * sí avisa» (`93483810`).
 *
 * QUÉ ASIMETRÍA CIERRA. El riel devuelve un `warning` cuando la comanda sale
 * sin brief. Esta puerta la creaba igual **y callaba** — `internalRoute.js` no
 * contenía la palabra `warning` ni una vez. Misma regla, dos comportamientos:
 * quien probara una puerta creería conocer la otra.
 *
 * Y pesa más aquí que en el riel: **la Puerta 2 es la que usan las naves de
 * fuera de esta máquina.** El contrato delega la verificación en el llamante
 * —«verificar en la UI sigue siendo del llamante»— y esa frase se escribió para
 * un humano. Una nave no abre la interfaz nunca.
 *
 * POR QUÉ AVISO Y NO `400`. Era la otra opción de la tarjeta. Una tarjeta
 * solo-título es legítima a veces, así que un `400` rechazaría trabajo bueno
 * para tapar un caso dudoso — e impedir que el trabajo entre es peor que pedir
 * que alguien mire. Además `400` sería incompatible y obligaría a cambiar
 * también el riel, que hoy avisa.
 *
 * LO QUE ESTE BANCO NO PUEDE DEMOSTRAR: que el riel siga avisando. Es otro
 * lenguaje y otro proceso; su caso vive en `kanban-mcp/test_validation.py`
 * (`empty_brief_notice`). Que las dos digan lo mismo lo sostiene el contrato,
 * no una prueba — y por eso está escrito ahí.
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
    columns: [{ id: 'col-backlog', board_id: 'board-1', title: 'Backlog', order: 1 }],
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
              // Devuelve la fila TAL COMO SE ESCRIBIÓ. Importa: el aviso mira el
              // resultado —la tarjeta salió sin contenido—, no el parámetro que
              // vino, así que un doble que inventara una descripción taparía
              // justo lo que se está midiendo.
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

const SECRET = 'test-task-secret';
const post = (body) =>
  request(app)
    .post('/api/internal/create-card')
    .set('x-task-secret', SECRET)
    .send({
      title: 'Tarea',
      boardName: 'Operaciones',
      workspaceName: 'AGLAYA Kanban',
      priority: 'medium',
      assignee: 'kanban-rail@aglaya.biz',
      ...body,
    });

beforeEach(() => __banco.reset());

describe('POST /api/internal/create-card — una tarjeta sin contenido lo dice', () => {
  it('sin brief: crea la tarjeta y AVISA', async () => {
    const res = await post({});

    expect(res.status).toBe(201);
    expect(res.body.warning).toMatch(/brief vac/i);
    // La tarjeta se crea igual. Avisar no es rechazar, y esa diferencia es la
    // decisión de esta tarjeta.
    expect(res.body.card.id).toBeTruthy();
    expect(__banco.TABLES.cards).toHaveLength(1);
  });

  it('un brief de solo espacios cuenta como vacío', async () => {
    const res = await post({ description: '   \n  ' });

    expect(res.status).toBe(201);
    expect(res.body.warning).toMatch(/brief vac/i);
  });

  it('con brief de verdad, NO avisa', async () => {
    const res = await post({ description: '# Brief\n\nLo que hay que hacer.' });

    expect(res.status).toBe(201);
    expect(res.body.warning).toBeUndefined();
  });

  // El aviso del riel manda a mirar `description_md` y su alias. Aquí esos
  // nombres NO existen: copiarlo mandaría a arreglar donde no está.
  it('el aviso nombra el campo de ESTA puerta, no el de la otra', async () => {
    const res = await post({});

    expect(res.body.warning).toMatch(/`description`/);
    expect(res.body.warning).not.toMatch(/description_md/);
  });

  it('y dice por qué se avisa: el éxito no distingue una tarjeta con brief de una sin él', async () => {
    const res = await post({});

    expect(res.body.warning).toMatch(/no distingue/);
  });
});
