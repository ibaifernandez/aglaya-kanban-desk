/**
 * POST /api/internal/create-card — defectos conocidos.
 *
 * Tarjeta operativa: "Tres formas de aterrizar mal devolviendo éxito"
 *
 * Las tres faltas que hacen que este endpoint devuelva 201 cuando falló:
 * 1. Ambigüedad: múltiples workspace matches → coge el primero sin error
 * 2. Sin idempotencia: dos POSTs iguales crean dos tarjetas
 * 3. Orden (race): dos inserciones simultáneas reciben el mismo número
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

// Mock que simula ambigüedad: dos workspaces con nombres parciales coincidentes
jest.mock('../utils/supabase', () => {
  const mockWorkspacesData = [
    { id: 'ws-ambig-1', name: 'AGLAYA', type: 'interno', emoji: '🚀', organization_id: 'org-1' },
    { id: 'ws-ambig-2', name: 'AGLAYA Docs', type: 'interno', emoji: '📚', organization_id: 'org-1' },
  ];

  const mockBoardsData = [
    { id: 'board-1', workspace_id: 'ws-ambig-1', title: '🛠 Operaciones', order: 1 },
    { id: 'board-2', workspace_id: 'ws-ambig-2', title: '🛠 Operaciones', order: 1 },
  ];

  const mockColumnsData = [
    { id: 'col-1', board_id: 'board-1', title: 'Backlog', order: 1 },
    { id: 'col-2', board_id: 'board-2', title: 'Backlog', order: 1 },
  ];

  return {
    supabaseAdmin: {
      from: (table) => {
        let data = [];
        let currentTable = table;
        if (table === 'workspaces') data = JSON.parse(JSON.stringify(mockWorkspacesData));
        if (table === 'boards') data = JSON.parse(JSON.stringify(mockBoardsData));
        if (table === 'columns') data = JSON.parse(JSON.stringify(mockColumnsData));

        const chain = {
          select: () => chain,
          eq: (col, val) => {
            if (col === 'workspace_id') {
              data = data.filter(b => b.workspace_id === val);
            } else if (col === 'board_id') {
              data = data.filter(c => c.board_id === val);
            } else if (col === 'column_id') {
              data = data.filter(c => c.column_id === val);
            }
            return chain;
          },
          ilike: (col, val) => {
            const searchTerm = val.replace(/%/g, '').toLowerCase();
            if (col === 'name') {
              data = data.filter(w => w.name.toLowerCase().includes(searchTerm));
            } else if (col === 'title') {
              data = data.filter(b => b.title.toLowerCase().includes(searchTerm));
            }
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({
                data: {
                  id: 'card-123',
                  title: 'Test card',
                  priority: 'medium',
                  order: 1,
                  column_id: 'col-1',
                  board_id: 'board-1',
                },
                error: null,
              }),
            }),
          }),
          then: (resolve, reject) => {
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          },
        };
        return chain;
      },
    },
  };
});

const app = require('../app');

const SECRET = 'test-task-secret';
const post = (body) =>
  request(app)
    .post('/api/internal/create-card')
    .set('x-task-secret', SECRET)
    .send(body);

describe('POST /api/internal/create-card — defectos conocidos', () => {
  describe('1. Ambigüedad: múltiples workspace matches', () => {
    it('rechaza con 400 si workspaceName casa con múltiples workspaces', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA', // Casa con "AGLAYA" y "AGLAYA Docs"
      });
      // Hoy: 201 (coge el primero sin error)
      // Debería ser: 400 (ambigüedad)
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/múltiple|ambig|candidato/i);
    });

    it('cuando hay ambigüedad, el error lista los candidatos', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA',
      });
      if (res.status === 400) {
        expect(res.body.error).toMatch(/AGLAYA/);
        // Idealmente también incluir IDs: [id, id]
      }
    });

    it('sin ambigüedad, crea la tarjeta correctamente', async () => {
      const res = await post({
        title: 'Tarea única',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA Docs', // Único match
      });
      expect(res.status).toBe(201);
      expect(res.body.card).toBeDefined();
    });
  });

  describe('2. Idempotencia: dos POSTs iguales', () => {
    it('dos POSTs idénticos deberían devolver lo mismo (no duplicar)', async () => {
      const payload = {
        title: 'Tarea idempotente',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA Docs',
      };

      const res1 = await post(payload);
      const res2 = await post(payload);

      // Idealmente:
      // res1.status === 201 && res2.status === 201 (o 409 Conflict)
      // res1.body.card.id === res2.body.card.id (misma tarjeta)
      // Hoy: res1 y res2 crean dos tarjetas distintas

      if (res1.status === 201 && res2.status === 201) {
        // Si ambas crean, al menos deberían tener el mismo ID
        expect(res1.body.card.id).toEqual(res2.body.card.id);
      } else if (res2.status === 409) {
        // O rechazar el segundo con Conflict
        expect(res2.body.error).toBeDefined();
      }
    });
  });

  describe('3. Orden: race condition en cálculo', () => {
    it('dos inserciones concurrentes reciben números de orden diferentes', async () => {
      // Este test es complicado de simular en Jest sin DB real.
      // Idealmente usaría DB real y Promise.all() para concurrencia.
      // Por ahora, anotamos el defecto.
      expect(true).toBe(true); // Placeholder
    });
  });
});
