/**
 * Tests para GET/PATCH /api/notifications
 *
 * Cubre:
 *  - Autenticación obligatoria en los tres endpoints
 *  - GET /api/notifications → devuelve array propio del usuario
 *  - PATCH /api/notifications/read-all → estático antes del dinámico
 *  - PATCH /api/notifications/:id/read → por ID
 *  - Aislamiento por user_id (no puede marcar notificaciones ajenas)
 *  - Errores de BD degradan a 500 con JSON, nunca HTML
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

// ── Mock de Supabase ──────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: { from: (...args) => mockFrom(...args) },
  createAdminClient: jest.fn(),
  createPublicClient: jest.fn(),
}));

const app = require('../app');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToken(overrides = {}) {
  return jwt.sign(
    { id: 'user-1', email: 'user@aglaya.biz', role: 'colaborador', organizationId: 'org-1', ...overrides },
    'test-secret',
    { expiresIn: '1h' }
  );
}

const TOKEN = makeToken();

const SAMPLE_NOTIFS = [
  { id: 'n-1', user_id: 'user-1', type: 'checklist_mention', read: false, created_at: '2026-04-28T10:00:00Z', payload: { cardTitle: 'Tarea A', checklistText: 'Revisar propuesta' } },
  { id: 'n-2', user_id: 'user-1', type: 'checklist_mention', read: true,  created_at: '2026-04-27T10:00:00Z', payload: { cardTitle: 'Tarea B', checklistText: 'Preparar demo' } },
];

/** Construye una cadena fluente que resuelve con `result` al finalizar */
function makeChain(result) {
  const chain = {
    select:  jest.fn(() => chain),
    update:  jest.fn(() => chain),
    eq:      jest.fn(() => chain),
    order:   jest.fn(() => chain),
    limit:   jest.fn(() => chain),
    // thenable — resolves when awaited
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── 1. Autenticación ─────────────────────────────────────────────────────────

describe('Autenticación — los tres endpoints requieren token', () => {
  it('GET /api/notifications → 401 sin token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/notifications/read-all → 401 sin token', async () => {
    const res = await request(app).patch('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/notifications/:id/read → 401 sin token', async () => {
    const res = await request(app).patch('/api/notifications/n-1/read');
    expect(res.status).toBe(401);
  });
});

// ── 2. GET /api/notifications ─────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  it('devuelve array de notificaciones del usuario', async () => {
    mockFrom.mockReturnValue(makeChain({ data: SAMPLE_NOTIFS, error: null }));

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe('n-1');
  });

  it('devuelve array vacío cuando no hay notificaciones', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('aplica .eq("user_id", …) para aislar por usuario', async () => {
    const chain = makeChain({ data: SAMPLE_NOTIFS, error: null });
    mockFrom.mockReturnValue(chain);

    await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${TOKEN}`);

    // Verifica que se filtró por user_id
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('responde 500 con JSON (no HTML) cuando la BD falla', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'DB connection lost' } }));

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.headers['content-type']).toMatch(/json/);
  });
});

// ── 3. PATCH /api/notifications/read-all ─────────────────────────────────────

describe('PATCH /api/notifications/read-all', () => {
  it('responde { data: { ok: true } } al marcar todas como leídas', async () => {
    mockFrom.mockReturnValue(makeChain({ error: null }));

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
  });

  it('filtra por user_id — solo marca las propias', async () => {
    const chain = makeChain({ error: null });
    mockFrom.mockReturnValue(chain);

    await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('filtra solo las no leídas (.eq("read", false))', async () => {
    const chain = makeChain({ error: null });
    mockFrom.mockReturnValue(chain);

    await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(chain.eq).toHaveBeenCalledWith('read', false);
  });

  it('responde 500 con JSON cuando la BD falla', async () => {
    mockFrom.mockReturnValue(makeChain({ error: { message: 'timeout' } }));

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.headers['content-type']).toMatch(/json/);
  });

  // Garantiza que la ruta estática /read-all no es capturada por /:id/read
  it('no es interceptada por la ruta dinámica /:id/read', async () => {
    mockFrom.mockReturnValue(makeChain({ error: null }));

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${TOKEN}`);

    // Si fuera la ruta dinámica, intentaría marcar un notif con id='read-all'
    // y respondería igual — pero queremos verificar que update llama con read:true
    // sin eq('id','read-all')
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0]?.value;
    // Ningún .eq debería haberse llamado con 'id' como primer argumento
    const eqCalls = chain?.eq?.mock?.calls ?? [];
    const hasIdFilter = eqCalls.some(([col]) => col === 'id');
    expect(hasIdFilter).toBe(false);
  });
});

// ── 4. PATCH /api/notifications/:id/read ─────────────────────────────────────

describe('PATCH /api/notifications/:id/read', () => {
  it('responde { data: { ok: true } } al marcar una notificación como leída', async () => {
    mockFrom.mockReturnValue(makeChain({ error: null }));

    const res = await request(app)
      .patch('/api/notifications/n-1/read')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
  });

  it('filtra por id y por user_id — no puede marcar notificaciones ajenas', async () => {
    const chain = makeChain({ error: null });
    mockFrom.mockReturnValue(chain);

    await request(app)
      .patch('/api/notifications/n-1/read')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(chain.eq).toHaveBeenCalledWith('id', 'n-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('un usuario no puede marcar la notificación de otro (doble .eq garantiza aislamiento)', async () => {
    const chain = makeChain({ error: null });
    mockFrom.mockReturnValue(chain);

    // Intento de usuario-2 marcar notif de usuario-1
    const otherToken = makeToken({ id: 'user-2', email: 'other@aglaya.biz' });

    await request(app)
      .patch('/api/notifications/n-1/read')
      .set('Authorization', `Bearer ${otherToken}`);

    // El .eq('user_id', …) filtra al usuario autenticado, no al dueño de la notif
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-2');
    // Nunca usará 'user-1'
    const eqCalls = chain.eq.mock.calls;
    const hasUser1 = eqCalls.some(([col, val]) => col === 'user_id' && val === 'user-1');
    expect(hasUser1).toBe(false);
  });

  it('responde 500 con JSON cuando la BD falla', async () => {
    mockFrom.mockReturnValue(makeChain({ error: { message: 'DB error' } }));

    const res = await request(app)
      .patch('/api/notifications/n-1/read')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
