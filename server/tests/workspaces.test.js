const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

const mockFreshAdmin = { from: jest.fn() };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockFreshAdmin),
}));

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const { supabaseAdmin } = require('../utils/supabase');
const app = require('../index');

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'user-1', email: 'user@empresa.com', role: 'admin', organizationId: 'org-1', ...overrides },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

function makeChain(resolver) {
  const state = {
    filters: {},
    inFilters: {},
    payload: null,
    selectFields: null,
  };

  const chain = {
    select(fields) {
      state.selectFields = fields;
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
      state.payload = null;
      return chain;
    },
    eq(column, value) {
      state.filters[column] = value;
      return chain;
    },
    in(column, values) {
      state.inFilters[column] = values;
      return chain;
    },
    order() {
      return chain;
    },
    limit() {
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

function configureMocks({
  workspace = { id: 'ws-1', type: 'externo', organization_id: 'org-1' },
  memberByUserId = { 'user-1': { workspace_id: 'ws-1', user_id: 'user-1', role: 'owner' } },
  usersById = {
    'user-1': { id: 'user-1', name: 'Owner User', email: 'owner@aglaya.biz', role: 'admin', organization_id: 'org-1', created_at: '2026-01-01T00:00:00Z' },
    'user-2': { id: 'user-2', name: 'Member User', email: 'member@aglaya.biz', role: 'colaborador', organization_id: 'org-1', created_at: '2026-01-02T00:00:00Z' },
  },
} = {}) {
  const workspaceRows = Object.values(memberByUserId)
    .filter((member) => member.workspace_id === workspace.id)
    .map((member) => ({ user_id: member.user_id }));

  supabaseAdmin.from.mockImplementation((table) => {
    if (table === 'workspace_members') {
      return makeChain((state) => {
        if (state.payload) {
          return { data: state.payload, error: null };
        }

        if (state.selectFields === 'user_id') {
          return { data: workspaceRows, error: null };
        }

        return { data: memberByUserId[state.filters.user_id] ?? null, error: memberByUserId[state.filters.user_id] ? null : { message: 'not found' } };
      });
    }

    if (table === 'workspaces') {
      return makeChain((state) => {
        if (state.payload) {
          return { data: { id: 'ws-new', ...state.payload }, error: null };
        }

        return { data: workspace, error: workspace ? null : { message: 'not found' } };
      });
    }

    if (table === 'users') {
      return makeChain((state) => {
        if (state.filters.id) {
          const user = usersById[state.filters.id] ?? null;
          return { data: user, error: user ? null : { message: 'not found' } };
        }

        const users = Object.values(usersById).filter((user) => {
          if (!state.filters.organization_id) return true;
          return user.organization_id === state.filters.organization_id;
        });

        return { data: users, error: null };
      });
    }

    return makeChain(() => ({ data: null, error: null }));
  });

  mockFreshAdmin.from.mockImplementation((table) => {
    if (table === 'workspaces') {
      return makeChain((state) => ({ data: { id: 'ws-new', ...state.payload }, error: null }));
    }

    if (table === 'workspace_members') {
      return makeChain((state) => ({ data: state.payload, error: null }));
    }

    if (table === 'users') {
      return makeChain((state) => {
        const user = usersById[state.filters.id] ?? null;
        return { data: user, error: user ? null : { message: 'not found' } };
      });
    }

    return makeChain(() => ({ data: null, error: null }));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  configureMocks();
});

describe('POST /api/workspaces — tipos y permisos', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/workspaces').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('blocks cliente users from creating workspaces', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken({ role: 'cliente' })}`)
      .send({ name: 'Cliente WS', type: 'externo' });

    expect(res.status).toBe(403);
  });

  it('forces colaboradores to personal when requesting interno', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken({ role: 'colaborador' })}`)
      .send({ name: 'Mi espacio', type: 'interno' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('personal');
  });

  it('forces colaboradores to personal when requesting externo', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken({ role: 'colaborador' })}`)
      .send({ name: 'Proyecto cliente', type: 'externo' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('personal');
  });

  it('allows admin to create interno workspace', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken({ role: 'admin' })}`)
      .send({ name: 'Equipo interno', type: 'interno' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('interno');
  });

  it('allows admin to create externo workspace', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken({ role: 'admin' })}`)
      .send({ name: 'Cliente externo', type: 'externo' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('externo');
  });
});

describe('GET /api/workspaces/:workspaceId/available-users', () => {
  it('lists organization users not yet present in the workspace', async () => {
    const res = await request(app)
      .get('/api/workspaces/ws-1/available-users')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('user-2');
  });
});

describe('POST /api/workspaces/:workspaceId/members', () => {
  it('rejects owner as assignable member role', async () => {
    const res = await request(app)
      .post('/api/workspaces/ws-1/members')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ userId: 'user-2', role: 'owner' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/role/i);
  });

  it('rejects users from another organization', async () => {
    configureMocks({
      usersById: {
        'user-1': { id: 'user-1', name: 'Owner User', email: 'owner@aglaya.biz', role: 'admin', organization_id: 'org-1', created_at: '2026-01-01T00:00:00Z' },
        'user-2': { id: 'user-2', name: 'External User', email: 'external@other.biz', role: 'colaborador', organization_id: 'org-9', created_at: '2026-01-02T00:00:00Z' },
      },
    });

    const res = await request(app)
      .post('/api/workspaces/ws-1/members')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ userId: 'user-2', role: 'member' });

    expect(res.status).toBe(403);
  });

  it('rejects cliente users for non-external workspaces', async () => {
    configureMocks({
      workspace: { id: 'ws-1', type: 'personal', organization_id: 'org-1' },
      usersById: {
        'user-1': { id: 'user-1', name: 'Owner User', email: 'owner@aglaya.biz', role: 'admin', organization_id: 'org-1', created_at: '2026-01-01T00:00:00Z' },
        'user-2': { id: 'user-2', name: 'Client User', email: 'client@aglaya.biz', role: 'cliente', organization_id: 'org-1', created_at: '2026-01-02T00:00:00Z' },
      },
    });

    const res = await request(app)
      .post('/api/workspaces/ws-1/members')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ userId: 'user-2', role: 'guest' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cliente/i);
  });
});

describe('Workspace owner invariants', () => {
  beforeEach(() => {
    configureMocks({
      memberByUserId: {
        'user-1': { workspace_id: 'ws-1', user_id: 'user-1', role: 'owner' },
        'user-2': { workspace_id: 'ws-1', user_id: 'user-2', role: 'owner' },
      },
    });
  });

  it('prevents changing the owner role', async () => {
    const res = await request(app)
      .patch('/api/workspaces/ws-1/members/user-2')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/owner/i);
  });

  it('prevents removing the owner', async () => {
    const res = await request(app)
      .delete('/api/workspaces/ws-1/members/user-2')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/owner/i);
  });
});
