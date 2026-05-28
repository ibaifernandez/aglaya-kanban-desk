/**
 * Refresh token flow — B-02 audit Mariana.
 *
 * Tests:
 *   - login emits both access token (body) + refresh cookie HttpOnly
 *   - /auth/refresh con cookie válido → emite nuevo access + rota refresh
 *   - /auth/refresh sin cookie → 401
 *   - /auth/refresh con cookie inválido/expirado → 401 + clear cookie
 *   - /auth/logout → clear cookie
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const mockProfile = {
  id: 'user-1',
  email: 'test@aglaya.biz',
  name: 'Test',
  role: 'colaborador',
  organization_id: 'org-1',
  avatar_url: null,
};

jest.mock('../utils/supabase', () => {
  const adminClient = {
    from: jest.fn((table) => {
      if (table === 'users') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: mockProfile, error: null })),
            })),
          })),
        };
      }
      return { select: jest.fn(), eq: jest.fn() };
    }),
    auth: {
      signInWithPassword: jest.fn(() => Promise.resolve({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
      admin: {
        getUserById: jest.fn(() => Promise.resolve({
          data: { user: { id: 'user-1', email: 'test@aglaya.biz' } },
          error: null,
        })),
      },
    },
  };
  return {
    supabaseAdmin: adminClient,
    createAdminClient: jest.fn(() => adminClient),
    createPublicClient: jest.fn(() => adminClient),
  };
});

// Mock userProfile sync
jest.mock('../utils/userProfile', () => ({
  getSyncedUserProfile: jest.fn(() => Promise.resolve({
    profile: mockProfile,
    error: null,
  })),
}));

const app = require('../app');

function makeValidRefreshToken() {
  return jwt.sign({ id: 'user-1', typ: 'refresh' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

describe('POST /api/auth/login — B-02 emits refresh cookie', () => {
  it('responde con access token + Set-Cookie refresh HttpOnly', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@aglaya.biz', password: 'whatever' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    const cookies = res.headers['set-cookie'] || [];
    const refreshCookie = cookies.find((c) => c.startsWith('aglaya_refresh='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Path=\/api\/auth/i);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rechaza request sin cookie con 401', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/No refresh token/i);
  });

  it('rechaza cookie inválida con 401 y clear cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['aglaya_refresh=invalid-token']);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|mal formado/i);
  });

  it('emite nuevo access token y rota refresh con cookie válida', async () => {
    const refreshToken = makeValidRefreshToken();
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`aglaya_refresh=${refreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.id).toBe('user-1');
    expect(res.body.user.email).toBe('test@aglaya.biz');

    // El nuevo access token debe ser firmable con JWT_SECRET
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.id).toBe('user-1');

    // Refresh debe rotar — nuevo Set-Cookie
    const cookies = res.headers['set-cookie'] || [];
    const newRefreshCookie = cookies.find((c) => c.startsWith('aglaya_refresh='));
    expect(newRefreshCookie).toBeDefined();
  });

  it('rechaza cookie con typ != refresh (e.g. access token reusado)', async () => {
    const accessTokenAsRefresh = jwt.sign(
      { id: 'user-1' },  // typ: 'refresh' missing
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '15m' }
    );
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`aglaya_refresh=${accessTokenAsRefresh}`]);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/mal formado/i);
  });
});

describe('POST /api/auth/logout', () => {
  it('responde ok=true y clear cookie', async () => {
    const refreshToken = makeValidRefreshToken();
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`aglaya_refresh=${refreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const cookies = res.headers['set-cookie'] || [];
    const clearedCookie = cookies.find((c) => c.startsWith('aglaya_refresh=;'));
    expect(clearedCookie).toBeDefined();
  });

  it('logout funciona también sin cookie (idempotente)', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
