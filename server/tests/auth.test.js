/**
 * Auth route tests — input validation and domain restriction.
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
          if (opts.email === 'test@lfi.la') {
            return Promise.resolve({ data: { user: { id: 'uuid-1', email: opts.email } }, error: null });
          }
          return Promise.resolve({ data: null, error: { message: 'Email not allowed' } });
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

  it('rejects non-corporate email with 403', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'user@gmail.com',
      password: 'password123',
      name: 'Test User',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/corporat/i);
  });

  it('rejects missing password with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'user@lfi.la',
      name: 'Test User',
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
