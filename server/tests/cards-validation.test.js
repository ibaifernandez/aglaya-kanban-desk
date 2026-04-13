/**
 * Card input validation tests.
 * Verifies that invalid inputs are rejected at the validation layer,
 * before any DB call. Uses JWT mock to bypass auth.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

// Mock Supabase
jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const chain = {
        select: () => chain,
        insert: () => chain,
        update: () => chain,
        delete: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        or: () => chain,
        single: () => {
          if (table === 'boards') {
            return Promise.resolve({ data: { id: 'board-1', workspace_id: 'ws-1' }, error: null });
          }
          if (table === 'workspace_members') {
            return Promise.resolve({ data: { workspace_id: 'ws-1', user_id: 'user-1', role: 'owner' }, error: null });
          }
          if (table === 'workspaces') {
            return Promise.resolve({ data: { id: 'ws-1', type: 'interno' }, error: null });
          }
          return Promise.resolve({ data: { id: 'uuid', column_id: 'col', board_id: 'board-1', title: 'Test', priority: 'medium', tags: [], checklist: [], order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, error: null });
        },
        then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  },
}));

const app = require('../index');

// Create a valid JWT for test requests
function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'user-1', email: 'test@aglaya.is', role: 'admin', organizationId: 'org-1', ...overrides },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

describe('PUT /api/cards/:id — validation', () => {
  const token = makeToken();

  it('rejects invalid priority', async () => {
    const res = await request(app)
      .put('/api/cards/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ priority: 'CRITICAL' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority/i);
  });

  it('rejects empty title', async () => {
    const res = await request(app)
      .put('/api/cards/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('rejects invalid dueDate', async () => {
    const res = await request(app)
      .put('/api/cards/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dueDate/i);
  });

  it('accepts valid priority values (including urgent added in v1.1.1)', async () => {
    for (const p of ['urgent', 'high', 'medium', 'low', 'none']) {
      const res = await request(app)
        .put('/api/cards/some-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ priority: p });
      expect(res.status).not.toBe(400);
    }
  });

  it('accepts null dueDate to clear the date', async () => {
    const res = await request(app)
      .put('/api/cards/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ dueDate: null });
    expect(res.status).not.toBe(400);
  });
});

describe('GET /api/cards/search — validation', () => {
  const token = makeToken();

  it('returns empty array for query shorter than 2 chars', async () => {
    const res = await request(app)
      .get('/api/cards/search?q=a')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('DELETE /api/cards/:id — workspace context', () => {
  const token = makeToken();

  it('accepts boardId in the request body to resolve workspace membership', async () => {
    const res = await request(app)
      .delete('/api/cards/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ boardId: 'board-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
