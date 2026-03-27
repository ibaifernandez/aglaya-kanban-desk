/**
 * Health & smoke tests — no auth required, no DB calls.
 * These run without a real Supabase connection.
 */
const request = require('supertest');

// Mock Supabase before loading the app so no real DB calls happen
jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    auth: {
      admin: {
        createUser: () => Promise.resolve({ data: { user: null }, error: null }),
        getUserById: () => Promise.resolve({ data: { user: null }, error: null }),
      },
    },
  },
}));

const app = require('../index');

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
