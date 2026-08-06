/**
 * GET /api/internal/list-workspaces — lectura de destinos.
 * GET /api/internal/list-boards — lectura de tableros dentro de workspace.
 *
 * Contrato: responden con acceso `service_role` (sin membresía, alcance total),
 * sin JWT (autenticadas con x-task-secret como POST /api/internal/create-card).
 *
 * Permiten a una nave externa verificar destinos antes de clavar trabajo, y
 * obtener IDs resueltos en lugar de confiar en nombres parciales.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

// Mock Supabase con respuestas reales para lectura
jest.mock('../utils/supabase', () => {
  const mockWorkspaces = [
    { id: 'ws-1', name: 'AGLAYA Kanban', type: 'interno', emoji: '📊', organization_id: 'org-1' },
    { id: 'ws-2', name: 'AGLAYA.biz', type: 'interno', emoji: '🚀', organization_id: 'org-1' },
  ];

  const mockBoards = [
    { id: 'board-1', workspace_id: 'ws-1', title: '🛠 Operaciones', order: 1 },
    { id: 'board-2', workspace_id: 'ws-1', title: '📋 Docs', order: 2 },
  ];

  return {
    supabaseAdmin: {
      from: (table) => {
        let data = [];
        if (table === 'workspaces') data = mockWorkspaces;
        if (table === 'boards') data = mockBoards;

        const chain = {
          select: () => chain,
          eq: (col, val) => {
            if (col === 'workspace_id') {
              data = data.filter(b => b.workspace_id === val);
            }
            return chain;
          },
          order: () => chain,
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
const get = (endpoint) =>
  request(app)
    .get(endpoint)
    .set('x-task-secret', SECRET);

describe('GET /api/internal/list-workspaces', () => {
  it('devuelve lista de workspaces con IDs', async () => {
    const res = await get('/api/internal/list-workspaces');
    expect(res.status).toBe(200);
    expect(res.body.workspaces).toBeDefined();
    expect(Array.isArray(res.body.workspaces)).toBe(true);
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
    const ws = res.body.workspaces[0];
    expect(ws.id).toBeDefined();
    expect(ws.name).toBeDefined();
    expect(ws.type).toBeDefined();
    expect(ws.emoji).toBeDefined();
  });
});

describe('GET /api/internal/list-boards', () => {
  it('devuelve lista de tableros cuando se pasa workspaceId', async () => {
    const res = await get('/api/internal/list-boards?workspaceId=ws-1');
    expect(res.status).toBe(200);
    expect(res.body.boards).toBeDefined();
    expect(Array.isArray(res.body.boards)).toBe(true);
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
    const board = res.body.boards[0];
    expect(board.id).toBeDefined();
    expect(board.title).toBeDefined();
    expect(board.workspace_id).toBeDefined();
    expect(board.order).toBeDefined();
  });
});
