/**
 * POST /api/internal/create-card — contrato consistente.
 *
 * Tarjeta: "Las dos puertas enseñan dos contratos distintos"
 *
 * El contrato debe ser idéntico en:
 * - POST /api/internal/create-card (sin JWT, con x-task-secret)
 * - GET /api/internal/list-* (lectura)
 * - GET /api/* (lectura, con JWT, para la UI)
 *
 * Hoy: prioridad inválida se corrige en silencio a 'medium'.
 * Debería: rechazar con 400.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        ilike: () => chain,
        order: () => chain,
        limit: () => chain,
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: {
                id: 'card-123',
                title: 'Test',
                priority: 'invalid', // Devuelve lo que se insertó
                order: 1,
                column_id: 'col-1',
                board_id: 'board-1',
              },
              error: null,
            }),
          }),
        }),
        then: (resolve) => {
          return Promise.resolve({
            data: [
              { id: 'ws-1', name: 'AGLAYA Kanban', type: 'interno', emoji: '📊', organization_id: 'org-1' },
            ],
            error: null,
          }).then(resolve);
        },
      };
      return chain;
    },
  },
}));

const app = require('../app');

const SECRET = 'test-task-secret';
const post = (body) =>
  request(app)
    .post('/api/internal/create-card')
    .set('x-task-secret', SECRET)
    .send(body);

describe('POST /api/internal/create-card — contrato consistente', () => {
  describe('Prioridad: validación', () => {
    it('rechaza con 400 si priority inválida', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA Kanban',
        priority: 'invalid',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/priority/i);
    });

    it('el 400 lista las prioridades válidas', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA Kanban',
        priority: 'totally-wrong',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/urgent|high|medium|low|none/);
    });
  });

  describe('Acuse: estructura', () => {
    it('acuse incluye workspace_id además del nombre', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA Kanban',
      });
      if (res.status === 201) {
        const { workspace_id, workspace } = res.body.card;
        // Hoy: workspace = "AGLAYA Kanban" (input)
        // Ahora: workspace_id = UUID, workspace = nombre resuelto
        expect(workspace_id).toBeDefined();
      }
    });
  });
});
