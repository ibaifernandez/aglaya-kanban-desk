const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
  createAdminClient: jest.fn(),
}));

jest.mock('../services/digest/user', () => ({
  buildUserCards: jest.fn(),
  sendUserDigest: jest.fn(),
  sendAllUserDigests: jest.fn(),
}));

const { createAdminClient, supabaseAdmin } = require('../utils/supabase');
const { buildUserCards, sendUserDigest } = require('../services/digest/user');
const app = require('../app');

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'user-1', email: 'legacy@lfi.la', role: 'admin', organizationId: 'org-1', ...overrides },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

let profileState;
const workspaceState = { id: 'ws-1', name: 'NHR', emoji: '📁' };

beforeEach(() => {
  jest.clearAllMocks();

  profileState = {
    id: 'user-1',
    email: 'legacy@lfi.la',
    name: 'Ibai',
    role: 'superadmin',
    organization_id: 'org-1',
    avatar_url: null,
  };

  const adminClient = {
    from: jest.fn((table) => {
      if (table === 'users') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: profileState, error: null })),
            })),
          })),
          update: jest.fn((payload) => ({
            eq: jest.fn(() => {
              profileState = { ...profileState, ...payload };
              return Promise.resolve({ data: profileState, error: null });
            }),
          })),
        };
      }

      if (table === 'workspaces') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: workspaceState, error: null })),
            })),
          })),
        };
      }

      if (table === 'workspace_members') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: { workspace_id: 'ws-1' }, error: null })),
              })),
            })),
          })),
        };
      }

      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      };
    }),
    auth: {
      admin: {
        getUserById: jest.fn(() => Promise.resolve({
          data: { user: { id: 'user-1', email: 'info@ibaifernandez.com' } },
          error: null,
        })),
      },
    },
  };

  createAdminClient.mockReturnValue(adminClient);
  supabaseAdmin.from.mockReturnValue({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: profileState, error: null })),
      })),
    })),
  });

  buildUserCards.mockResolvedValue({ personal: [], interno: [], externo: [], total: 1 });
  sendUserDigest.mockResolvedValue({ ok: true, sent: true, total: 1 });
});

describe('POST /api/digest/send-my-digest', () => {
  it('sends a workspace-scoped digest using the current Auth email', async () => {
    const res = await request(app)
      .post('/api/digest/send-my-digest')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workspaceId: 'ws-1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('NHR');
    expect(res.body.message).toContain('info@ibaifernandez.com');
    expect(buildUserCards).toHaveBeenCalledWith('user-1', { workspaceId: 'ws-1' });
    expect(sendUserDigest).toHaveBeenCalledWith(expect.objectContaining({
      id: 'user-1',
      email: 'info@ibaifernandez.com',
      workspaceId: 'ws-1',
      workspaceName: 'NHR',
    }));
  });

  it('does not enqueue an email when the selected workspace has no actionable cards', async () => {
    buildUserCards.mockResolvedValueOnce({ personal: [], interno: [], externo: [], total: 0 });

    const res = await request(app)
      .post('/api/digest/send-my-digest')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workspaceId: 'ws-1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/No tienes tareas accionables/i);
    expect(sendUserDigest).not.toHaveBeenCalled();
  });

  it('returns error if digest send fails', async () => {
    sendUserDigest.mockRejectedValueOnce(new Error('SMTP connection failed'));

    const res = await request(app)
      .post('/api/digest/send-my-digest')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workspaceId: 'ws-1' });

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('SMTP connection failed');
  });

  it('returns error if digest send exceeds 10s timeout', async () => {
    // Mock sendUserDigest to hang indefinitely
    sendUserDigest.mockImplementationOnce(() =>
      new Promise(() => {}) // Never resolves
    );

    const res = await request(app)
      .post('/api/digest/send-my-digest')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workspaceId: 'ws-1' })
      .timeout(15000); // Give test time to hit 10s timeout

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('expirado');
  }, 20000);

  it('responds with ok=true when digest sends successfully', async () => {
    const res = await request(app)
      .post('/api/digest/send-my-digest')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workspaceId: 'ws-1' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toContain('enviado');
  });
});
