/**
 * Auth route tests — input validation y sistema sin restricción de dominio.
 * Desde v1.1.0 la plataforma acepta cualquier email; no hay restricción de dominio corporativo.
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
      admin: {
        createUser: (opts) => {
          console.log('[MOCK] createUser called for:', opts.email);
          if (opts.email === 'test@aglaya.biz') {
            return Promise.resolve({ data: { user: { id: 'uuid-1', email: opts.email } }, error: null });
          }
          return Promise.resolve({ data: null, error: { message: 'Supabase error' } });
        },
      },
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          single: () => {
            console.log('[MOCK] select/eq/single called for table:', table);
            return Promise.resolve({ data: { id: 'uuid-1', email: 'test@aglaya.biz', name: 'Test User', role: 'admin' }, error: null });
          }
        }),
        in: () => Promise.resolve({ data: [], error: null }),
      }),
      insert: (data) => {
        console.log('[MOCK] insert called for table:', table, data);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'uuid-ws-1', ...data }, error: null })
          })
        };
      }
    }),
    auth: {
      signInWithPassword: (creds) => {
        console.log('[MOCK] signInWithPassword called for:', creds.email);
        if (creds.email === 'test@aglaya.biz') {
          return Promise.resolve({ data: { user: { id: 'uuid-1', email: creds.email } }, error: null });
        }
        return Promise.resolve({ data: null, error: { message: 'Auth error' } });
      }
    }

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

  it('does not restrict by email domain (no domain restriction since v1.1.0)', async () => {
    // Any domain should reach Supabase auth, not be rejected with a domain error.
    // The mock fails at Supabase level (gmail.com is not mocked to succeed),
    // but the point is: no 403 / "dominio no permitido" error.
    const res = await request(app).post('/api/auth/register').send({
      email: 'user@gmail.com',
      password: 'password123',
      name: 'Test User',
    });
    expect(res.status).not.toBe(403);
    // Should return 400 from Supabase or Success if we mocked it, but not Forbidden
    expect(res.body.error || '').not.toMatch(/dominio/i);
  });

  it('successful registration includes avatarUrl as null', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@aglaya.biz',
      password: 'password123',
      name: 'Test User',
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty('avatarUrl', null);
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
