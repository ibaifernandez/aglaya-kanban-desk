/**
 * POST /api/internal/create-card — validación de entrada.
 *
 * Fija el contrato del riel de comandas. El caso que importa y que motivó este
 * fichero: `workspaceName` es OBLIGATORIO y no tiene default.
 *
 * Historia (2026-07-21): el default era `"Ibai Fernández"` — que existe y es el
 * workspace PERSONAL de Ibai, zona intocable. Omitir el campo no fallaba: devolvía
 * 201 y la card aterrizaba ahí. Una fuga silenciosa hacia un espacio privado.
 * `docs/runbooks/key-rotation.md` lo omitía en su paso de verificación.
 *
 * Sin este test el default vuelve el día que alguien lo "arregle" por comodidad,
 * y volverá silencioso, que es como llegó.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

// Mock Supabase: cualquier lookup devuelve vacío. Basta para separar lo que se
// rechaza en la capa de validación (400, sin tocar DB) de lo que llega al lookup.
jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: () => {
      const chain = {
        select: () => chain,
        insert: () => chain,
        update: () => chain,
        delete: () => chain,
        eq:     () => chain,
        in:     () => chain,
        ilike:  () => chain,
        order:  () => chain,
        limit:  () => chain,
        single: () => Promise.resolve({ data: null, error: null }),
        then:   (resolve, reject) =>
          Promise.resolve({ data: [], error: null }).then(resolve, reject),
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

describe('POST /api/internal/create-card — workspaceName obligatorio', () => {
  it('rechaza con 400 si falta workspaceName', async () => {
    const res = await post({ title: 'tarea', boardName: 'Backlog' });
    expect(res.status).toBe(400);
  });

  it('el 400 nombra la causa: el campo y que no hay default por diseño', async () => {
    const res = await post({ title: 'tarea', boardName: 'Backlog' });

    // Quien se coma este error viene de un runbook viejo o de un doc heredado.
    // Debe entender por qué desapareció el default, no creer que algo se rompió.
    expect(res.body.error).toMatch(/workspaceName/);
    expect(res.body.error).toMatch(/default/i);
  });

  it('rechaza con 400 si workspaceName viene vacío o en blanco', async () => {
    const res = await post({ title: 'tarea', boardName: 'Backlog', workspaceName: '   ' });
    expect(res.status).toBe(400);
  });

  it('con workspaceName pasa la validación y llega al lookup (404 con DB vacía)', async () => {
    const res = await post({
      title: 'tarea',
      boardName: 'Backlog',
      workspaceName: '⭐ AGLAYA 2.0',
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/internal/create-card — resto del contrato', () => {
  it('exige title', async () => {
    const res = await post({ boardName: 'Backlog', workspaceName: '⭐ AGLAYA 2.0' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it('exige boardName', async () => {
    const res = await post({ title: 'tarea', workspaceName: '⭐ AGLAYA 2.0' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/boardName/);
  });

  it('rechaza con 401 si el x-task-secret no coincide', async () => {
    const res = await request(app)
      .post('/api/internal/create-card')
      .set('x-task-secret', 'secreto-incorrecto')
      .send({ title: 'tarea', boardName: 'Backlog', workspaceName: '⭐ AGLAYA 2.0' });
    expect(res.status).toBe(401);
  });
});
