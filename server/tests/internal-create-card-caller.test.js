/**
 * POST /api/internal/create-card — quién dice ser el que llama.
 *
 * Tarjeta: «El riel no sabe quién le habla: una identidad de llamante en cada
 * petición».
 *
 * QUÉ DEFECTO VIGILA. Esta puerta se autentica con UN secreto compartido. Con
 * dos llamantes conocidos no molesta; con N naves, **todo lo clavado dice lo
 * mismo**, así que cuando algo aparece mal puesto no hay a quién preguntar.
 *
 * LO QUE ESTO NO ES, y el test no puede comprobarlo por su cuenta: **no es
 * autenticación**. Quien tiene el secreto declara el nombre que quiera, incluido
 * el de otro. Sirve para saber quién DICE ser. Atarlo a credenciales por nave es
 * la otra mitad y vive en su propia tarjeta.
 *
 * LA ASERCIÓN QUE PIDE LA TARJETA, literal: «con prueba que se ponga roja si
 * alguien deja el campo pasar vacío». Por eso no basta con mirar el `400`: hay
 * que mirar que **no se escribió nada**. Un rechazo que ya ha insertado la fila
 * deja exactamente la tarjeta sin rastro que este campo existe para impedir, y
 * desde fuera se ve igual que un rechazo limpio.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

jest.mock('../utils/supabase', () => {
  const inserted = [];
  const TABLES = {
    workspaces: [{ id: 'ws-1', name: 'AGLAYA Kanban', type: 'interno', emoji: '📊', organization_id: 'org-1' }],
    boards:     [{ id: 'board-1', workspace_id: 'ws-1', title: '🛠 Operaciones', order: 1 }],
    columns:    [{ id: 'col-backlog', board_id: 'board-1', title: 'Backlog', order: 1 }],
    users:      [{ id: 'user-rail', name: 'Kanban Rail', email: 'kanban-rail@aglaya.biz' }],
    cards:      [],
  };

  const supabaseAdmin = {
    from: (table) => {
      let data = JSON.parse(JSON.stringify(TABLES[table] ?? []));
      const chain = {
        select: () => chain,
        eq: (col, val) => { data = data.filter(r => r[col] === val); return chain; },
        ilike: (col, pattern) => {
          const p = String(pattern);
          const needle = p.replace(/%/g, '').toLowerCase();
          const open = p.startsWith('%') && p.endsWith('%');
          data = data.filter(r => {
            const s = String(r[col] ?? '').toLowerCase();
            return open ? s.includes(needle) : s === needle;
          });
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        // El doble CAPTURA las inserciones. Es lo único que distingue «no se
        // escribió nada» de «se escribió y me lo callé», y desde el código de
        // estado esos dos casos se ven idénticos.
        insert: (row) => {
          if (table === 'cards') inserted.push(row);
          return {
            select: () => ({ single: () => Promise.resolve({ data: { id: 'card-1', ...row }, error: null }) }),
          };
        },
        then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject),
      };
      return chain;
    },
  };

  return { supabaseAdmin, __inserted: inserted };
});

const { __inserted } = require('../utils/supabase');
const app = require('../app');

const BASE = {
  title: 'Tarea',
  boardName: 'Operaciones',
  workspaceName: 'AGLAYA Kanban',
  priority: 'medium',
  assignee: 'kanban-rail@aglaya.biz',
  caller: 'aglaya.biz',
};

const post = (over = {}) => {
  const body = { ...BASE, ...over };
  for (const k of Object.keys(over)) if (over[k] === undefined) delete body[k];
  return request(app).post('/api/internal/create-card').set('x-task-secret', 'test-task-secret').send(body);
};

beforeEach(() => { __inserted.length = 0; });

describe('caller — sin él no se escribe nada', () => {
  it('ausente → 400 y CERO inserciones', async () => {
    const res = await post({ caller: undefined });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/caller/i);
    // La aserción que pide la tarjeta: no basta el 400.
    expect(__inserted).toHaveLength(0);
  });

  it('vacío → 400 y CERO inserciones', async () => {
    const res = await post({ caller: '' });
    expect(res.status).toBe(400);
    expect(__inserted).toHaveLength(0);
  });

  it('solo espacios → 400 y CERO inserciones', async () => {
    const res = await post({ caller: '   ' });
    expect(res.status).toBe(400);
    expect(__inserted).toHaveLength(0);
  });

  it('el error dice para qué sirve el campo, no solo que falta', async () => {
    const res = await post({ caller: undefined });
    // Quien recibe este 400 es una nave a las 3 de la mañana. Un «campo
    // obligatorio» a secas la deja adivinando qué poner.
    expect(res.body.error).toMatch(/nave/i);
  });
});

describe('caller — se guarda con la tarjeta, no al lado', () => {
  it('la fila escrita lleva el llamante', async () => {
    const res = await post({ caller: 'legal-reg-tech' });
    expect(res.status).toBe(201);
    expect(__inserted).toHaveLength(1);
    // En el MISMO insert que crea la tarjeta: si se escribiera después, un fallo
    // entre medias dejaría la tarjeta sin rastro — que es el defecto entero.
    expect(__inserted[0].created_by_caller).toBe('legal-reg-tech');
  });

  it('se guarda recortado, no tal cual', async () => {
    await post({ caller: '  capitan  ' });
    expect(__inserted[0].created_by_caller).toBe('capitan');
  });

  it('el acuse lo devuelve, para que el llamante vea con qué quedó registrado', async () => {
    const res = await post({ caller: 'aglaya.biz' });
    expect(res.status).toBe(201);
    expect(res.body.card.caller).toBe('aglaya.biz');
  });
});
