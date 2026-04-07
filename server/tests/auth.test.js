/**
 * Auth route tests — input validation.
 * Uses mocked Supabase; no real DB connection needed.
 */
const request = require('supertest');

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const chain = {
        select: () => chain,
        insert: () => chain,
        update: () => chain,
        delete: () => chain,
        eq: () => chain,
        single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
      };
      return chain;
    },
    auth: {
      admin: {
        createUser: (opts) => {
          if (opts.email === 'test@empresa.com') {
            return Promise.resolve({ data: { user: { id: 'uuid-1', email: opts.email } }, error: null });
          }
          return Promise.resolve({ data: null, error: { message: 'Supabase error' } });
        },
      },
    },
  },
}));

const app = require('../index');

describe('POST /api/auth/register', () => {
  it('rejects missing fields with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
  });

  it('rejects missing password with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'user@empresa.com',
      name: 'Test User',
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing name with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'user@empresa.com',
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('rejects missing credentials with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
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
