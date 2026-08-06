/**
 * GET /api/internal/list-workspaces — lectura de destinos.
 * GET /api/internal/list-boards — lectura de tableros dentro de workspace.
 *
 * Contrato: responden con acceso `service_role` (sin membresía), sin JWT,
 * autenticadas con x-task-secret como POST /api/internal/create-card. Permiten a
 * una nave externa verificar destinos antes de clavar trabajo, y obtener IDs
 * resueltos en lugar de confiar en nombres parciales.
 *
 * POR QUÉ EL MOCK ES FIEL Y NO CÓMODO (2026-08-06).
 * El mock original de este archivo ignoraba `.select()` y `.eq()`: devolvía sus
 * fixtures enteras pasara lo que pasara. Con él, dos de las siete pruebas no
 * medían el código sino la fixture — comprobado por mutación:
 *
 *   · quitar `emoji` del `.select()` de la ruta      → las 7 seguían verdes
 *   · quitar el `.eq('workspace_id', …)` de la ruta  → las 7 seguían verdes
 *
 * Esa segunda es fuga entre espacios, que es de lo peor que puede hacer esta
 * puerta, y la prueba que decía vigilarla («cada tablero incluye … workspace_id»)
 * la habría dejado pasar. Un mock que no aplica la proyección ni los filtros
 * convierte cualquier aserción sobre la forma en una tautología sobre sí mismo.
 *
 * Este mock aplica `select` (proyección real), `eq`, `neq` y `order`. Las tres
 * mutaciones de arriba, más quitar el `neq('type','personal')`, ahora se ponen
 * rojas.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

jest.mock('../utils/supabase', () => {
  const TABLES = {
    workspaces: [
      { id: 'ws-1', name: 'AGLAYA Kanban', type: 'interno',  emoji: '📊', organization_id: 'org-1' },
      { id: 'ws-2', name: 'AGLAYA.biz',    type: 'interno',  emoji: '🚀', organization_id: 'org-1' },
      { id: 'ws-3', name: 'Ibai Fernández', type: 'personal', emoji: '🏠', organization_id: 'org-1' },
    ],
    boards: [
      { id: 'board-1', workspace_id: 'ws-1', title: '🛠 Operaciones', order: 1 },
      { id: 'board-2', workspace_id: 'ws-1', title: '📋 Docs',        order: 2 },
      // Tablero de OTRO espacio: si la ruta pierde su `.eq`, se cuela aquí.
      { id: 'board-9', workspace_id: 'ws-2', title: '🚀 Web',         order: 1 },
    ],
  };

  return {
    supabaseAdmin: {
      from: (table) => {
        let rows = JSON.parse(JSON.stringify(TABLES[table] ?? []));
        let projection = null;

        const chain = {
          // Proyección real: solo sobreviven las columnas pedidas.
          select: (cols) => {
            if (typeof cols === 'string' && cols.trim() && cols !== '*') {
              projection = cols.split(',').map(c => c.trim());
            }
            return chain;
          },
          eq:  (col, val) => { rows = rows.filter(r => r[col] === val); return chain; },
          neq: (col, val) => { rows = rows.filter(r => r[col] !== val); return chain; },
          order: (col, opts = {}) => {
            const dir = opts.ascending === false ? -1 : 1;
            rows.sort((a, b) => (a[col] > b[col] ? dir : a[col] < b[col] ? -dir : 0));
            return chain;
          },
          then: (resolve, reject) => {
            const out = projection
              ? rows.map(r => Object.fromEntries(projection.filter(c => c in r).map(c => [c, r[c]])))
              : rows;
            return Promise.resolve({ data: out, error: null }).then(resolve, reject);
          },
        };
        return chain;
      },
    },
  };
});

const app = require('../app');

const SECRET = 'test-task-secret';
const get = (endpoint) =>
  request(app).get(endpoint).set('x-task-secret', SECRET);

describe('GET /api/internal/list-workspaces', () => {
  it('devuelve lista de workspaces con IDs', async () => {
    const res = await get('/api/internal/list-workspaces');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.workspaces)).toBe(true);
    expect(res.body.workspaces.length).toBeGreaterThan(0);
  });

  it('rechaza con 401 si x-task-secret no coincide', async () => {
    const res = await request(app)
      .get('/api/internal/list-workspaces')
      .set('x-task-secret', 'secreto-incorrecto');
    expect(res.status).toBe(401);
  });

  it('cada workspace incluye id, name, type, emoji', async () => {
    const res = await get('/api/internal/list-workspaces');
    expect(res.status).toBe(200);
    // Se comprueba en TODAS las filas, no solo en la primera: una proyección
    // rota no tiene por qué romper solo la de arriba.
    for (const ws of res.body.workspaces) {
      expect(ws).toHaveProperty('id');
      expect(ws).toHaveProperty('name');
      expect(ws).toHaveProperty('type');
      expect(ws).toHaveProperty('emoji');
    }
  });

  // Regla dura, no preferencia. Un espacio `personal` es zona intocable, y esta
  // puerta se autentica con una llave maestra que vive fuera de esta máquina:
  // enumerar su UUID es entregar exactamente lo que hace falta para apuntar ahí.
  // Las otras dos superficies automáticas de esta nave ya los excluyen — el
  // digest por test propio, `rail-blindspot.sh` por `WHERE type <> 'personal'`.
  it('NO lista los workspaces de tipo personal', async () => {
    const res = await get('/api/internal/list-workspaces');
    expect(res.status).toBe(200);
    expect(res.body.workspaces.map(w => w.type)).not.toContain('personal');
    expect(res.body.workspaces.map(w => w.name)).not.toContain('Ibai Fernández');
  });
});

describe('GET /api/internal/list-boards', () => {
  it('devuelve lista de tableros cuando se pasa workspaceId', async () => {
    const res = await get('/api/internal/list-boards?workspaceId=ws-1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.boards)).toBe(true);
    expect(res.body.boards.length).toBeGreaterThan(0);
  });

  // La que faltaba. Sin ella, perder el `.eq('workspace_id', …)` de la ruta
  // —fuga de tableros entre espacios— pasaba en verde.
  it('solo devuelve tableros del workspace pedido', async () => {
    const res = await get('/api/internal/list-boards?workspaceId=ws-1');
    expect(res.status).toBe(200);
    expect(res.body.boards.length).toBe(2);
    for (const board of res.body.boards) {
      expect(board.workspace_id).toBe('ws-1');
    }
    expect(res.body.boards.map(b => b.id)).not.toContain('board-9');
  });

  it('rechaza con 400 si falta workspaceId', async () => {
    const res = await get('/api/internal/list-boards');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workspaceId/);
  });

  it('rechaza con 401 si x-task-secret no coincide', async () => {
    const res = await request(app)
      .get('/api/internal/list-boards?workspaceId=ws-1')
      .set('x-task-secret', 'secreto-incorrecto');
    expect(res.status).toBe(401);
  });

  it('cada tablero incluye id, title, workspace_id, order', async () => {
    const res = await get('/api/internal/list-boards?workspaceId=ws-1');
    expect(res.status).toBe(200);
    for (const board of res.body.boards) {
      expect(board).toHaveProperty('id');
      expect(board).toHaveProperty('title');
      expect(board).toHaveProperty('workspace_id');
      expect(board).toHaveProperty('order');
    }
  });
});
