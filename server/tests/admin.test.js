const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
        listUsers: jest.fn(),
      },
      resetPasswordForEmail: jest.fn(),
    },
  },
  createAdminClient: jest.fn(),
}));

const { supabaseAdmin, createAdminClient } = require('../utils/supabase');
const app = require('../index');

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'admin-1', email: 'admin@aglaya.biz', role: 'superadmin', organizationId: 'org-1', ...overrides },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

function makeChain(resolver) {
  const state = {
    filters: {},
    payload: null,
  };

  const chain = {
    select() {
      return chain;
    },
    insert(payload) {
      state.payload = payload;
      return chain;
    },
    update(payload) {
      state.payload = payload;
      return chain;
    },
    delete() {
      return chain;
    },
    eq(column, value) {
      state.filters[column] = value;
      return chain;
    },
    order() {
      return chain;
    },
    maybeSingle() {
      return Promise.resolve(resolver(state));
    },
    single() {
      return Promise.resolve(resolver(state));
    },
    then(resolve, reject) {
      return Promise.resolve(resolver(state)).then(resolve, reject);
    },
  };

  return chain;
}

let mockState;

beforeEach(() => {
  jest.clearAllMocks();
  createAdminClient.mockReturnValue(supabaseAdmin);

  mockState = {
    usersById: {
      'admin-1': {
        id: 'admin-1',
        email: 'admin@aglaya.biz',
        name: 'Admin User',
        role: 'superadmin',
        organization_id: 'org-1',
      },
      'user-2': {
        id: 'user-2',
        email: 'target@other.biz',
        name: 'Target User',
        role: 'colaborador',
        organization_id: 'org-9',
      },
    },
    usersByEmail: {},
    authUsers: [],
    profileInsertError: null,
    workspaceOwnerships: [],
  };

  supabaseAdmin.auth.admin.createUser.mockResolvedValue({
    data: { user: { id: 'user-2' } },
    error: null,
  });
  supabaseAdmin.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  supabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ error: null });
  supabaseAdmin.auth.admin.listUsers.mockImplementation(async () => ({
    data: { users: mockState.authUsers, lastPage: 1 },
    error: null,
  }));

  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'users') {
      return makeChain((state) => {
        if (state.payload) {
          if (mockState.profileInsertError) {
            return { data: null, error: mockState.profileInsertError };
          }

          const row = state.payload;
          mockState.usersById[row.id] = {
            ...row,
            created_at: row.created_at ?? new Date().toISOString(),
          };
          mockState.usersByEmail[row.email] = mockState.usersById[row.id];
          return { data: row, error: null };
        }

        if (state.filters.email) {
          return { data: mockState.usersByEmail[state.filters.email] ?? null, error: null };
        }

        if (state.filters.id) {
          return { data: mockState.usersById[state.filters.id] ?? null, error: null };
        }

        return { data: Object.values(mockState.usersById), error: null };
      });
    }

    if (table === 'workspace_members') {
      return makeChain(() => ({ data: mockState.workspaceOwnerships, error: null }));
    }

    return makeChain(() => ({ data: null, error: null }));
  });
});

describe('POST /api/admin/users/invite', () => {
  it('rejects workspace-only guest role from the global admin panel', async () => {
    const res = await request(app)
      .post('/api/admin/users/invite')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ email: 'guest@aglaya.biz', name: 'Guest User', role: 'guest' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Rol no válido/i);
  });

  it('uses the organization from the database even if the JWT carries a stale organization id', async () => {
    const res = await request(app)
      .post('/api/admin/users/invite')
      .set('Authorization', `Bearer ${makeToken({ organizationId: 'stale-org' })}`)
      .send({ email: 'fresh@aglaya.biz', name: 'Fresh User', role: 'colaborador' });

    expect(res.status).toBe(201);
    expect(mockState.usersByEmail['fresh@aglaya.biz'].organization_id).toBe('org-1');
  });

  it('rebuilds the public profile when the auth user exists but the profile row is missing', async () => {
    mockState.authUsers = [
      { id: 'auth-only-user', email: 'partial@aglaya.biz' },
    ];

    const res = await request(app)
      .post('/api/admin/users/invite')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ email: 'partial@aglaya.biz', name: 'Partial User', role: 'colaborador' });

    expect(res.status).toBe(201);
    expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(mockState.usersByEmail['partial@aglaya.biz']).toMatchObject({
      id: 'auth-only-user',
      email: 'partial@aglaya.biz',
      name: 'Partial User',
      role: 'colaborador',
      organization_id: 'org-1',
    });
  });

  it('returns 409 instead of 500 when the public profile email already exists', async () => {
    mockState.usersByEmail['existing@aglaya.biz'] = {
      id: 'existing-profile',
      email: 'existing@aglaya.biz',
      name: 'Existing User',
      role: 'colaborador',
      organization_id: 'org-1',
    };

    const res = await request(app)
      .post('/api/admin/users/invite')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ email: 'existing@aglaya.biz', name: 'Existing User', role: 'colaborador' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Ya existe un perfil|Ya existe un usuario/i);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('lets superadmin delete users outside their own organization scope', async () => {
    const res = await request(app)
      .delete('/api/admin/users/user-2')
      .set('Authorization', `Bearer ${makeToken({ organizationId: null })}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
