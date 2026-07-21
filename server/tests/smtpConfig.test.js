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

/**
 * validateCoreConfig — la red de seguridad que faltaba.
 *
 * Encontrado siguiendo el README en un clon limpio (2026-07-21): tras `cp
 * .env.example .env` sin rellenar, arrancar el servidor no daba el mensaje
 * amistoso de validateSmtpConfig sino un stack trace de dentro de supabase-js
 * ("supabaseUrl is required"). La validación existía, pero corría DESPUÉS de
 * `require('./app')`, que revienta en carga de módulo. La red estaba puesta
 * detrás del agujero.
 */
describe('validateCoreConfig', () => {
  const originalEnv = { ...process.env };
  const CORE = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];

  beforeEach(() => {
    process.env = { ...originalEnv };
    CORE.forEach((k) => delete process.env[k]);
  });

  afterAll(() => { process.env = originalEnv; });

  it('lanza si falta alguna variable esencial', () => {
    const { validateCoreConfig } = require('../utils/smtpConfig');
    expect(() => validateCoreConfig()).toThrow();
  });

  it('el error nombra TODAS las que faltan, no solo la primera', () => {
    const { validateCoreConfig } = require('../utils/smtpConfig');
    try {
      validateCoreConfig();
      throw new Error('debería haber lanzado');
    } catch (err) {
      CORE.forEach((k) => expect(err.message).toContain(k));
    }
  });

  it('el error apunta a .env.example, que es de donde se copia', () => {
    const { validateCoreConfig } = require('../utils/smtpConfig');
    expect(() => validateCoreConfig()).toThrow(/\.env\.example/);
  });

  it('no lanza cuando están todas', () => {
    CORE.forEach((k) => { process.env[k] = 'x'; });
    const { validateCoreConfig } = require('../utils/smtpConfig');
    expect(() => validateCoreConfig()).not.toThrow();
  });
});
