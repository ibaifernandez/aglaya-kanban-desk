/**
 * Task 2026-07-13: el digest diario NO debe incluir workspaces de tipo 'personal'.
 * Unit test de buildUserCards con supabaseAdmin mockeado.
 */

// mailer instancia Resend al cargar → necesita una key (placeholder en test).
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_test_placeholder';

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
  createAdminClient: jest.fn(),
}));

const { supabaseAdmin } = require('../utils/supabase');
const { buildUserCards } = require('../services/digest/user');

// Builder encadenable + thenable (imita el query builder de supabase-js).
function chain(data) {
  const result = { data, error: null };
  const c = {
    select: () => c,
    eq: () => c,
    in: () => c,
    not: () => c,
    single: () => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error: null }),
    then: (res, rej) => Promise.resolve(result).then(res, rej),
  };
  return c;
}

describe('buildUserCards — exclusión de workspace personal (digest diario)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('excluye los workspaces de tipo personal y conserva el resto', async () => {
    const byTable = {
      workspace_members: [
        { workspace: { id: 'ws-p', name: 'Personal', emoji: '🏠', type: 'personal' } },
        { workspace: { id: 'ws-i', name: 'Interno', emoji: '📋', type: 'interno' } },
      ],
      boards: [
        { id: 'b-i', title: 'Board Interno', workspace_id: 'ws-i' },
        { id: 'b-p', title: 'Board Personal', workspace_id: 'ws-p' },
      ],
      columns: [
        { id: 'c-i', title: 'Backlog', board_id: 'b-i' },
        { id: 'c-p', title: 'Backlog', board_id: 'b-p' },
      ],
      cards: [
        { id: 'card-i', title: 'Interno card', priority: 'high', due_date: null, column_id: 'c-i', board_id: 'b-i', checklist: [] },
        { id: 'card-p', title: 'Personal card', priority: 'high', due_date: null, column_id: 'c-p', board_id: 'b-p', checklist: [] },
      ],
    };
    supabaseAdmin.from.mockImplementation((table) => chain(byTable[table] ?? []));

    const result = await buildUserCards('user-1');

    // El grupo 'personal' queda vacío.
    expect(result.personal).toEqual([]);

    // El workspace interno y su card sí entran.
    const internoTitles = result.interno
      .flatMap((w) => w.boards)
      .flatMap((b) => b.cards)
      .map((c) => c.title);
    expect(internoTitles).toContain('Interno card');
    expect(internoTitles).not.toContain('Personal card');
  });
});
