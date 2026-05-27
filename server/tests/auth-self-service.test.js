/**
 * Self-service auth endpoints — RGPD Art. 17 + Art. 20.
 * Mitigación audit Mariana C-04 (self-delete) + C-05 (self-export).
 *
 * Tests focused en authorization + happy path. Cascading FK behavior
 * cubierto por schema constraints (no requiere mock detallado).
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

// Mock Supabase admin client
const mockUserProfile = {
  id: 'user-1',
  email: 'test@aglaya.biz',
  name: 'Test User',
  role: 'colaborador',
  organization_id: 'org-1',
  avatar_url: null,
  digest_hour: 8,
  digest_enabled: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

jest.mock('../utils/supabase', () => {
  // Default chainable mock
  function makeChain(table) {
    const chain = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      not: jest.fn(() => chain),
      single: jest.fn(() => {
        if (table === 'users') {
          return Promise.resolve({ data: mockUserProfile, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      delete: jest.fn(() => chain),
      insert: jest.fn(() => chain),
      update: jest.fn(() => chain),
      then: (resolve, reject) => {
        // For non-.single() queries — return arrays
        if (table === 'workspace_members') {
          return Promise.resolve({ data: [{ workspace_id: 'ws-1', role: 'member' }], error: null }).then(resolve, reject);
        }
        if (table === 'cards') {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
        if (table === 'notifications') {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
        if (table === 'digest_logs') {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
    return chain;
  }

  const adminClient = {
    from: jest.fn((table) => makeChain(table)),
    auth: {
      admin: {
        deleteUser: jest.fn(() => Promise.resolve({ data: null, error: null })),
        getUserById: jest.fn(() => Promise.resolve({
          data: {
            user: {
              id: 'user-1',
              email: 'test@aglaya.biz',
              email_confirmed_at: '2026-01-01T00:00:00.000Z',
              last_sign_in_at: '2026-05-27T00:00:00.000Z',
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-05-27T00:00:00.000Z',
            },
          },
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

const app = require('../app');

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'user-1', email: 'test@aglaya.biz', role: 'colaborador', organizationId: 'org-1', ...overrides },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('GET /api/auth/me/export — RGPD Art. 20 portabilidad', () => {
  it('rejects sin auth con 401', async () => {
    const res = await request(app).get('/api/auth/me/export');
    expect(res.status).toBe(401);
  });

  it('returns JSON con todos los datos del usuario autenticado', async () => {
    const res = await request(app)
      .get('/api/auth/me/export')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=.*aglaya-kanban-export.*\.json/);

    const body = JSON.parse(res.text);
    expect(body._meta).toBeDefined();
    expect(body._meta.user_id).toBe('user-1');
    expect(body._meta.export_subject).toMatch(/RGPD Art\. 20/);
    expect(body.profile).toBeDefined();
    expect(body.profile.email).toBe('test@aglaya.biz');
    expect(body.auth).toBeDefined();
    expect(body.memberships).toBeInstanceOf(Array);
    expect(body.owned_cards).toBeInstanceOf(Array);
    expect(body.notifications).toBeInstanceOf(Array);
    expect(body.digest_logs).toBeInstanceOf(Array);
    expect(body.assigned_checklist_items).toBeInstanceOf(Array);
  });
});

describe('DELETE /api/auth/me — RGPD Art. 17 supresión', () => {
  it('rejects sin auth con 401', async () => {
    const res = await request(app).delete('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 400 CONFIRMATION_MISMATCH si confirm_email no coincide', async () => {
    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ confirm_email: 'wrong@email.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('CONFIRMATION_MISMATCH');
  });

  it('borra cuenta cuando auth válido + sin confirm_email (opcional)', async () => {
    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toMatch(/Cuenta eliminada/i);
  });

  it('borra cuenta cuando confirm_email coincide con email del JWT', async () => {
    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ confirm_email: 'test@aglaya.biz' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
