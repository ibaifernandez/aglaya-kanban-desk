/**
 * Workspace route tests — tipos personal/interno/externo y control de acceso.
 *
 * Cubre:
 *   - POST /api/workspaces: name requerido, coerción de tipo según rol
 *   - requireWorkspaceMember: bloquea no-miembros y clientes en workspaces no externos
 *   - Gestión de miembros: validación de rol, protección auto-cambio
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

// ── Mock Supabase con jest.fn() para configuración por test ────────────────────
jest.mock('../utils/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const { supabaseAdmin } = require('../utils/supabase');
const app = require('../index');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'user-1', email: 'user@empresa.com', role: 'admin', organizationId: 'org-1', ...overrides },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

/**
 * Crea una cadena Supabase mockeable.
 * .single() resuelve con { data, error }; el resto devuelve la cadena (para queries de lista).
 */
function dbChain({ data = null, error = null } = {}) {
  const c = {};
  ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit', 'or', 'gte'].forEach((m) => {
    c[m] = () => c;
  });
  c.single = () => Promise.resolve({ data, error });
  return c;
}

const WORKSPACE_ROW = {
  id: 'ws-1', name: 'Test WS', emoji: '📋', description: '',
  type: 'externo', cover_url: null,
  organization_id: 'org-1', created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
};

// ── POST /api/workspaces — validación de entrada ──────────────────────────────

describe('POST /api/workspaces — validación de entrada', () => {
  beforeEach(() => {
    supabaseAdmin.from.mockImplementation(() =>
      dbChain({ data: { ...WORKSPACE_ROW } })
    );
  });

  it('requiere autenticación — 401 sin token', async () => {
    const res = await request(app).post('/api/workspaces').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('requiere name — 400 sin name', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('requiere name — 400 con name vacío', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/workspaces — control de tipo por rol ────────────────────────────

describe('POST /api/workspaces — coerción de tipo según rol', () => {
  it('admin puede crear workspace personal', async () => {
    supabaseAdmin.from.mockImplementation(() =>
      dbChain({ data: { ...WORKSPACE_ROW, type: 'personal' } })
    );
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken({ role: 'admin' })}`)
      .send({ name: 'Personal', type: 'personal' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('personal');
  });

  it('admin puede crear workspace interno', async () => {
    supabaseAdmin.from.mockImplementation(() =>
      dbChain({ data: { ...WORKSPACE_ROW, type: 'interno' } })
    );
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken({ role: 'admin' })}`)
      .send({ name: 'Interno', type: 'interno' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('interno');
  });

  it('colaborador solicitando tipo personal recibe externo (coerción)', async () => {
    // La ruta fuerza wsType='externo' para roles no-admin; el mock devuelve el tipo real de DB
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'workspaces') return dbChain({ data: { ...WORKSPACE_ROW, type: 'externo' } });
      return dbChain();
    });
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken({ role: 'colaborador' })}`)
      .send({ name: 'Test', type: 'personal' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('externo');
  });

  it('cliente solicitando tipo interno recibe externo (coerción)', async () => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'workspaces') return dbChain({ data: { ...WORKSPACE_ROW, type: 'externo' } });
      return dbChain();
    });
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${makeToken({ role: 'cliente' })}`)
      .send({ name: 'Test', type: 'interno' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('externo');
  });
});

// ── requireWorkspaceMember — control de acceso ────────────────────────────────

describe('requireWorkspaceMember — control de acceso por tipo', () => {
  it('bloquea no-miembros con 403', async () => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'workspace_members')
        return dbChain({ data: null, error: { message: 'not found' } });
      return dbChain();
    });
    const res = await request(app)
      .get('/api/workspaces/ws-1/members')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(403);
  });

  it('bloquea a cliente en workspace personal con 403', async () => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'workspace_members')
        return dbChain({ data: { workspace_id: 'ws-1', user_id: 'user-1', role: 'member' } });
      if (table === 'workspaces')
        return dbChain({ data: { type: 'personal' } });
      return dbChain();
    });
    const res = await request(app)
      .get('/api/workspaces/ws-1/members')
      .set('Authorization', `Bearer ${makeToken({ role: 'cliente' })}`);
    expect(res.status).toBe(403);
  });

  it('bloquea a cliente en workspace interno con 403', async () => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'workspace_members')
        return dbChain({ data: { workspace_id: 'ws-1', user_id: 'user-1', role: 'member' } });
      if (table === 'workspaces')
        return dbChain({ data: { type: 'interno' } });
      return dbChain();
    });
    const res = await request(app)
      .get('/api/workspaces/ws-1/members')
      .set('Authorization', `Bearer ${makeToken({ role: 'cliente' })}`);
    expect(res.status).toBe(403);
  });

  it('permite a cliente acceder a workspace externo (no 403)', async () => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'workspace_members')
        return dbChain({ data: { workspace_id: 'ws-1', user_id: 'user-1', role: 'member' } });
      if (table === 'workspaces')
        return dbChain({ data: { type: 'externo' } });
      return dbChain();
    });
    const res = await request(app)
      .get('/api/workspaces/ws-1/members')
      .set('Authorization', `Bearer ${makeToken({ role: 'cliente' })}`);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it('colaborador puede acceder a workspace personal (no 403)', async () => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'workspace_members')
        return dbChain({ data: { workspace_id: 'ws-1', user_id: 'user-1', role: 'member' } });
      if (table === 'workspaces')
        return dbChain({ data: { type: 'personal' } });
      return dbChain();
    });
    const res = await request(app)
      .get('/api/workspaces/ws-1/members')
      .set('Authorization', `Bearer ${makeToken({ role: 'colaborador' })}`);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});

// ── Gestión de miembros — validación ─────────────────────────────────────────

describe('Workspace member management — validación', () => {
  // Mock: usuario ES miembro con rol owner (supera requireWorkspaceMember + requireWorkspaceRole)
  beforeEach(() => {
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'workspace_members')
        return dbChain({ data: { workspace_id: 'ws-1', user_id: 'user-1', role: 'owner' } });
      if (table === 'workspaces')
        return dbChain({ data: { type: 'externo' } });
      return dbChain();
    });
  });

  it('POST /members requiere userId — 400', async () => {
    const res = await request(app)
      .post('/api/workspaces/ws-1/members')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ role: 'member' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId/i);
  });

  it('POST /members rechaza rol inválido — 400', async () => {
    const res = await request(app)
      .post('/api/workspaces/ws-1/members')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ userId: 'user-2', role: 'superadmin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/role/i);
  });

  it('PATCH /members/:userId rechaza rol inválido — 400', async () => {
    const res = await request(app)
      .patch('/api/workspaces/ws-1/members/user-2')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ role: 'owner' }); // 'owner' no es editable vía PATCH members
    expect(res.status).toBe(400);
  });

  it('PATCH /members/:userId previene auto-cambio de rol — 400', async () => {
    const res = await request(app)
      .patch('/api/workspaces/ws-1/members/user-1') // mismo id que el token
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/propio/i);
  });

  it('DELETE /members/:userId previene auto-eliminación — 400', async () => {
    const res = await request(app)
      .delete('/api/workspaces/ws-1/members/user-1') // mismo id que el token
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(400);
  });
});
