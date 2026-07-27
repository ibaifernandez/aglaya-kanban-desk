/**
 * Security tests — verify auth protection on all protected routes.
 */
const request = require('supertest');

// El mock tiene que exponer lo MISMO que `utils/supabase`. Cuando el código de
// producción se refactorizó a `createAdminClient` / `createPublicClient`, este
// mock se quedó exportando solo `supabaseAdmin`: cualquier ruta que llamara a
// las factorías reventaba con un TypeError al cargar. En vez de arreglarlo, el
// test que lo destapaba se apagó — y con él dejó de comprobarse que el login
// público sigue siendo alcanzable.
// La fábrica va DENTRO del `jest.mock`: jest lo iza por encima de todo lo que
// haya en el módulo, así que una función declarada fuera todavía no existe
// cuando el mock se construye.
jest.mock('../utils/supabase', () => {
  const makeChain = () => {
    const chain = {
      select: () => chain, insert: () => chain, update: () => chain,
      delete: () => chain, eq: () => chain, in: () => chain,
      order: () => chain, limit: () => chain, or: () => chain, single: () => chain,
    };
    return chain;
  };
  const client = {
    from: () => makeChain(),
    auth: {
      signInWithPassword: jest.fn(async () => ({ data: { user: null }, error: null })),
      admin: { listUsers: jest.fn(async () => ({ data: { users: [] }, error: null })) },
    },
  };
  return {
    supabase: client,
    supabaseAdmin: client,
    createAdminClient: () => client,
    createPublicClient: () => client,
  };
});

const app = require('../app');

const PROTECTED_ROUTES = [
  { method: 'get',    path: '/api/boards' },
  { method: 'post',   path: '/api/boards' },
  { method: 'get',    path: '/api/boards/uuid/columns' },
  { method: 'get',    path: '/api/boards/uuid/cards' },
  { method: 'post',   path: '/api/cards' },
  { method: 'put',    path: '/api/cards/uuid' },
  { method: 'delete', path: '/api/cards/uuid' },
  { method: 'get',    path: '/api/workspaces' },
  { method: 'post',   path: '/api/workspaces' },
  { method: 'get',    path: '/api/auth/me' },
  { method: 'get',    path: '/api/categories' },
];

describe('Protected routes return 401 without token', () => {
  PROTECTED_ROUTES.forEach(({ method, path }) => {
    it(`${method.toUpperCase()} ${path}`, async () => {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
    });
  });
});

describe('Public routes are accessible', () => {
  it('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  // Reactivado 2026-07-27. Estuvo apagado desde el audit de 2026-05-27 porque el
  // mock no exportaba `createPublicClient`. Lo que fija: el login es PÚBLICO, y
  // sin cuerpo contesta 400 (falta un campo), no 401 (no eres nadie). Si alguna
  // vez cae detrás de `requireAuth`, nadie podría entrar y el síntoma sería un
  // 401 en la puerta — que se lee como «credenciales mal», no como «la puerta
  // está tapiada».
  it('POST /api/auth/login is accessible (returns 400 without body, not 401)', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400); // validation error, not auth error
  });
});

describe('404 handler — rutas inexistentes devuelven JSON', () => {
  it('GET /api/ruta-que-no-existe → 404 con JSON', async () => {
    const res = await request(app).get('/api/ruta-que-no-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/ruta-que-no-existe → 404 con JSON', async () => {
    const res = await request(app).post('/api/ruta-que-no-existe').send({});
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
