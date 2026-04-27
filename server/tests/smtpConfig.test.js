const { validateSmtpConfig, validateDigestSchedules } = require('../utils/smtpConfig');

describe('SMTP Configuration Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateSmtpConfig', () => {
    test('throws error if SMTP_HOST is missing', () => {
      delete process.env.SMTP_HOST;
      process.env.SMTP_PORT = '465';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';

      expect(() => validateSmtpConfig()).toThrow('SMTP_HOST');
    });

    test('throws error if SMTP_PORT is missing', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      delete process.env.SMTP_PORT;
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';

      expect(() => validateSmtpConfig()).toThrow('SMTP_PORT');
    });

    test('throws error if SMTP_USER is missing', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      delete process.env.SMTP_USER;
      process.env.SMTP_PASS = 'password';

      expect(() => validateSmtpConfig()).toThrow('SMTP_USER');
    });

    test('throws error if SMTP_PASS is missing', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_USER = 'user@example.com';
      delete process.env.SMTP_PASS;

      expect(() => validateSmtpConfig()).toThrow('SMTP_PASS');
    });

    test('throws error if SMTP_PORT is not numeric', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = 'not-a-number';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';

      expect(() => validateSmtpConfig()).toThrow('SMTP_PORT debe ser un número');
    });

    test('throws error if SMTP_PORT is out of range', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '70000';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';

      expect(() => validateSmtpConfig()).toThrow('entre 1 y 65535');
    });

    test('throws error if SMTP_SECURE is not boolean', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      process.env.SMTP_SECURE = 'maybe';

      expect(() => validateSmtpConfig()).toThrow('debe ser \'true\' o \'false\'');
    });

    test('returns config object when all vars are valid', () => {
      process.env.SMTP_HOST = 'smtp.resend.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_USER = 'resend';
      process.env.SMTP_PASS = 'api-key';
      process.env.SMTP_FROM = 'kanban@aglaya.biz';
      process.env.SMTP_SECURE = 'true';

      const config = validateSmtpConfig();

      expect(config.host).toBe('smtp.resend.com');
      expect(config.port).toBe(465);
      expect(config.user).toBe('resend');
      expect(config.pass).toBe('api-key');
      expect(config.from).toBe('kanban@aglaya.biz');
      expect(config.secure).toBe(true);
    });

    test('uses SMTP_USER as from if SMTP_FROM not set', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      delete process.env.SMTP_FROM;

      const config = validateSmtpConfig();

      expect(config.from).toBe('user@example.com');
    });

    test('parses SMTP_SECURE as boolean', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      process.env.SMTP_SECURE = 'false';

      const config = validateSmtpConfig();

      expect(config.secure).toBe(false);
    });
  });

  describe('validateDigestSchedules', () => {
    test('logs warning if both digest hours are the same', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.DIGEST_HOUR = '7';
      process.env.USER_DIGEST_HOUR = '7';

      validateDigestSchedules();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('misma hora')
      );
      warnSpy.mockRestore();
    });

    test('returns schedule info with default hours', () => {
      delete process.env.DIGEST_HOUR;
      delete process.env.USER_DIGEST_HOUR;

      const schedules = validateDigestSchedules();

      expect(schedules.adminHour).toBe(7);
      expect(schedules.userHour).toBe(8);
    });

    test('uses env vars if provided', () => {
      process.env.DIGEST_HOUR = '9';
      process.env.USER_DIGEST_HOUR = '10';

      const schedules = validateDigestSchedules();

      expect(schedules.adminHour).toBe(9);
      expect(schedules.userHour).toBe(10);
    });
  });
});
