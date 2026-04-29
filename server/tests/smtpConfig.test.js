/**
 * Tests para utils/smtpConfig.js
 *
 * validateSmtpConfig — comprueba que RESEND_API_KEY y SMTP_FROM estén definidas
 * validateDigestSchedules — parsea horas de cron y advierte si coinciden
 */
const { validateSmtpConfig, validateDigestSchedules } = require('../utils/smtpConfig');

describe('validateSmtpConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Asegurar estado limpio de las vars relevantes
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_FROM;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('lanza error si RESEND_API_KEY no está definida', () => {
    process.env.SMTP_FROM = 'noreply@aglaya.biz';
    expect(() => validateSmtpConfig()).toThrow('RESEND_API_KEY');
  });

  test('lanza error si SMTP_FROM no está definida', () => {
    process.env.RESEND_API_KEY = 're_test_key';
    expect(() => validateSmtpConfig()).toThrow('SMTP_FROM');
  });

  test('lanza error si ambas variables faltan', () => {
    expect(() => validateSmtpConfig()).toThrow();
  });

  test('no lanza error cuando ambas variables están presentes', () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.SMTP_FROM = 'noreply@aglaya.biz';
    expect(() => validateSmtpConfig()).not.toThrow();
  });
});

describe('validateDigestSchedules', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('devuelve horas por defecto si no hay vars de entorno', () => {
    delete process.env.DIGEST_HOUR;
    delete process.env.USER_DIGEST_HOUR;

    const schedules = validateDigestSchedules();

    expect(schedules.adminHour).toBe(7);
    expect(schedules.userHour).toBe(8);
  });

  test('usa las vars de entorno si están definidas', () => {
    process.env.DIGEST_HOUR = '9';
    process.env.USER_DIGEST_HOUR = '10';

    const schedules = validateDigestSchedules();

    expect(schedules.adminHour).toBe(9);
    expect(schedules.userHour).toBe(10);
  });

  test('emite warn si admin digest y user digest coinciden en hora y minuto', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.DIGEST_HOUR      = '7';
    process.env.DIGEST_MINUTE    = '0';
    process.env.USER_DIGEST_HOUR   = '7';
    process.env.USER_DIGEST_MINUTE = '0';

    validateDigestSchedules();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('misma hora'));
    warnSpy.mockRestore();
  });
});
