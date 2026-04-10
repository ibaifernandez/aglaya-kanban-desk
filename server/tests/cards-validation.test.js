/**
 * Card input validation tests.
 * Verifies that invalid inputs are rejected at the validation layer,
 * before any DB call. Uses JWT mock to bypass auth.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

// Mock Supabase
jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: () => {
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
        single: () => Promise.resolve({ data: { id: 'uuid', column_id: 'col', board_id: 'board', title: 'Test', priority: 'medium', tags: [], checklist: [], order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, error: null }),
      };
      return chain;
    },
  },
}));

const app = require('../index');

// Create a valid JWT for test requests
function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'user-1', email: 'test@lfi.la', role: 'admin', organizationId: 'org-1', ...overrides },
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
