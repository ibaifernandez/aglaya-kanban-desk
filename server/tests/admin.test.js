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
      },
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

const { supabaseAdmin } = require('../utils/supabase');
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
    single() {
      return Promise.resolve(resolver(state));
    },
    then(resolve, reject) {
      return Promise.resolve(resolver(state)).then(resolve, reject);
    },
  };

  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();

  supabaseAdmin.auth.admin.createUser.mockResolvedValue({
    data: { user: { id: 'user-2' } },
    error: null,
  });
  supabaseAdmin.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  supabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ error: null });

  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'users') {
      return makeChain((state) => {
        if (state.payload) {
          return { data: state.payload, error: null };
        }

        const user = {
          id: state.filters.id || 'user-2',
          email: 'target@other.biz',
          name: 'Target User',
          role: 'colaborador',
          organization_id: 'org-9',
        };

        return { data: user, error: null };
      });
    }

    if (table === 'workspace_members') {
      return makeChain(() => ({ data: [], error: null }));
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
