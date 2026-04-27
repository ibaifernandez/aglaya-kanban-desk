const { logDigestAttempt, queryDigestLogs } = require('../utils/digestLogging');

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

const { supabaseAdmin } = require('../utils/supabase');

describe('Digest Logging Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logDigestAttempt', () => {
    test('inserts a successful digest log', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValueOnce({
          select: jest.fn().mockResolvedValueOnce({ data: [{ id: 'log-id-1' }], error: null }),
        }),
      });

      const result = await logDigestAttempt({
        type: 'admin',
        recipient: 'admin@example.com',
        status: 'sent',
      });

      expect(result.ok).toBe(true);
      expect(result.logId).toBe('log-id-1');
    });

    test('inserts a failed digest log with error message', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValueOnce({
          select: jest.fn().mockResolvedValueOnce({ data: [{ id: 'log-id-2' }], error: null }),
        }),
      });

      const result = await logDigestAttempt({
        type: 'user',
        userId: 'user-123',
        recipient: 'user@example.com',
        status: 'failed',
        errorMsg: 'SMTP connection timeout',
      });

      expect(result.ok).toBe(true);
      expect(result.logId).toBe('log-id-2');
      expect(supabaseAdmin.from).toHaveBeenCalledWith('digest_logs');
    });

    test('rejects invalid type', async () => {
      const result = await logDigestAttempt({
        type: 'invalid',
        recipient: 'test@example.com',
        status: 'sent',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid type');
    });

    test('rejects invalid status', async () => {
      const result = await logDigestAttempt({
        type: 'admin',
        recipient: 'test@example.com',
        status: 'unknown',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid status');
    });

    test('rejects missing recipient', async () => {
      const result = await logDigestAttempt({
        type: 'admin',
        status: 'sent',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('recipient');
    });

    test('handles database errors gracefully', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValueOnce({
          select: jest.fn().mockResolvedValueOnce({
            data: null,
            error: { message: 'Database constraint violation' },
          }),
        }),
      });

      const result = await logDigestAttempt({
        type: 'admin',
        recipient: 'admin@example.com',
        status: 'sent',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Database constraint');
    });
  });

  describe('queryDigestLogs', () => {
    test('queries all logs without filters', async () => {
      const mockLogs = [
        { id: '1', type: 'admin', recipient: 'admin@ex.com', status: 'sent', created_at: '2026-04-27T07:15:00Z' },
        { id: '2', type: 'user', recipient: 'user@ex.com', status: 'sent', created_at: '2026-04-27T08:10:00Z' },
      ];

      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnValueOnce({
            range: jest.fn().mockResolvedValueOnce({
              data: mockLogs,
              count: 2,
              error: null,
            }),
          }),
        }),
      });

      const result = await queryDigestLogs();

      expect(result.ok).toBe(true);
      expect(result.total).toBe(2);
      expect(result.logs).toHaveLength(2);
    });

    test('filters by type', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            gte: jest.fn().mockReturnThis(),
            lt: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnValueOnce({
              range: jest.fn().mockResolvedValueOnce({
                data: [],
                count: 0,
                error: null,
              }),
            }),
          }),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockResolvedValueOnce({ data: [], count: 0, error: null }),
        }),
      });

      const result = await queryDigestLogs({ type: 'admin' });

      expect(result.ok).toBe(true);
    });

    test('respects pagination limits', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnValueOnce({
            range: jest.fn().mockResolvedValueOnce({
              data: [],
              count: 100,
              error: null,
            }),
          }),
        }),
      });

      const result = await queryDigestLogs({ limit: 500, offset: 10 });

      expect(result.ok).toBe(true);
      expect(result.limit).toBe(500); // Clamped to max 500
      expect(result.offset).toBe(10);
    });

    test('clamps limit to maximum 500', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnValueOnce({
            range: jest.fn().mockResolvedValueOnce({
              data: [],
              count: 1000,
              error: null,
            }),
          }),
        }),
      });

      const result = await queryDigestLogs({ limit: 1000 });

      expect(result.limit).toBe(500);
    });

    test('handles database errors gracefully', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnValueOnce({
            range: jest.fn().mockResolvedValueOnce({
              data: null,
              count: null,
              error: { message: 'Connection failed' },
            }),
          }),
        }),
      });

      const result = await queryDigestLogs();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Connection failed');
    });
  });
});
