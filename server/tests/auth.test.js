const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn(),
        getUserById: jest.fn(),
      },
      signInWithPassword: jest.fn(),
    },
  },
  createAdminClient: jest.fn(),
  createPublicClient: jest.fn(),
}));

const { supabaseAdmin, createAdminClient, createPublicClient } = require('../utils/supabase');
const app = require('../app');

const TEST_PROFILE = {
  id: 'user-1',
  email: 'test@aglaya.biz',
  name: 'Test User',
  role: 'admin',
  organization_id: 'org-1',
  avatar_url: null,
};

let profileState;

function makeUsersTable() {
  return {
    insert: jest.fn(() => Promise.resolve({ error: null })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: profileState, error: null })),
      })),
    })),
    update: jest.fn((payload) => ({
      eq: jest.fn(() => {
        profileState = { ...profileState, ...payload };
        return Promise.resolve({ data: profileState, error: null });
      }),
    })),
  };
}

function makeWorkspacesTable() {
  return {
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: { id: 'ws-1' }, error: null })),
      })),
    })),
  };
}

function makeWorkspaceMembersTable() {
  return {
    insert: jest.fn(() => Promise.resolve({ error: null })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  profileState = { ...TEST_PROFILE };
  createAdminClient.mockReturnValue(supabaseAdmin);
  createPublicClient.mockReturnValue(supabaseAdmin);

  supabaseAdmin.auth.admin.createUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: TEST_PROFILE.email } },
    error: null,
  });
  supabaseAdmin.auth.admin.getUserById.mockResolvedValue({
    data: { user: { id: 'user-1', email: TEST_PROFILE.email } },
    error: null,
  });

  supabaseAdmin.auth.signInWithPassword.mockResolvedValue({
    data: { user: { id: 'user-1', email: TEST_PROFILE.email } },
    error: null,
  });

  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'users') return makeUsersTable();
    if (table === 'workspaces') return makeWorkspacesTable();
    if (table === 'workspace_members') return makeWorkspaceMembersTable();

    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    };
  });
});

describe('POST /api/auth/register', () => {
  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
  });

  it('rejects non-corporate domains with 403', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'user@gmail.com',
      password: 'password123',
      name: 'Test User',
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Dominio/i);
  });

  it('returns avatarUrl as null on successful registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@aglaya.biz',
      password: 'password123',
      name: 'Test User',
      organizationId: 'org-1',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual(expect.objectContaining({
      email: 'test@aglaya.biz',
      avatarUrl: null,
    }));
  });
});

describe('POST /api/auth/login', () => {
  it('rejects missing credentials with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns the authenticated profile on success', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@aglaya.biz',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(expect.objectContaining({
      email: TEST_PROFILE.email,
      role: TEST_PROFILE.role,
      organizationId: TEST_PROFILE.organization_id,
    }));
  });

  // Reactivado 2026-07-27, sin tocar el comportamiento. Estuvo apagado desde el
  // audit de 2026-05-27 esperando una decisión de producto: ¿debería el login
  // filtrar por dominio, como hace el registro?
  //
  // Decisión de Ibai: NO. El candado está donde se crean las cuentas, no donde
  // se entra. Para llegar al login hay que tener ya una cuenta confirmada en
  // Supabase Auth, y esas las da él. Filtrar aquí por dominio no habría añadido
  // defensa —hay que pasar por el registro igualmente— y sí habría dejado fuera
  // a Món, cuyo correo es de gmail: el dominio nunca fue la regla, la regla es
  // la lista de cuentas autorizadas.
  //
  // Lo que este test fija, entonces, es lo que HOY es verdad, para que si alguien
  // añade el filtro «por higiene» salte antes de dejar a alguien en la calle.
  it('does NOT restrict login by domain — any email can authenticate', async () => {
    profileState = { ...TEST_PROFILE, email: 'user@gmail.com' };
    supabaseAdmin.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@gmail.com' } },
      error: null,
    });
    // Supabase Auth es la autoridad sobre el email: el login repara la deriva de
    // `public.users` contra ella (`getSyncedUserProfile`). Sin mockear también
    // esto, el mock decía que la cuenta era corporativa y «reparaba» el gmail
    // hasta hacerlo desaparecer — el test fallaba por su propio montaje, no por
    // el comportamiento. El 200 ya demostraba que el dominio no bloquea nada.
    supabaseAdmin.auth.admin.getUserById.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@gmail.com' } },
      error: null,
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'user@gmail.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('user@gmail.com');
  });

  it('repairs stale public.users email from Supabase Auth on login', async () => {
    profileState = { ...profileState, email: 'legacy@lfi.la' };

    const res = await request(app).post('/api/auth/login').send({
      email: 'test@aglaya.biz',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@aglaya.biz');
    expect(profileState.email).toBe('test@aglaya.biz');
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
  });
});
