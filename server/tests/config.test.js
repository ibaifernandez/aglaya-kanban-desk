/**
 * Tests para utils/config.js (antes `smtpConfig.js`).
 *
 * Los bloques de `validateSmtpConfig` y `validateDigestSchedules` **se van con
 * el correo**: la nave no manda ninguno, así que `RESEND_API_KEY` y `SMTP_FROM`
 * ya no impiden arrancar y no hay dos digests cuyas horas puedan chocar.
 * Mantenerlos habría dejado pruebas en verde vigilando código que no existe.
 */

/**
 * validateCoreConfig — la red de seguridad que faltaba.
 *
 * Encontrado siguiendo el README en un clon limpio (2026-07-21): tras `cp
 * .env.example .env` sin rellenar, arrancar el servidor no daba un mensaje
 * amistoso sino un stack trace de dentro de supabase-js ("supabaseUrl is
 * required"). La validación existía, pero corría DESPUÉS de `require('./app')`,
 * que revienta en carga de módulo. La red estaba puesta detrás del agujero.
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
    const { validateCoreConfig } = require('../utils/config');
    expect(() => validateCoreConfig()).toThrow();
  });

  it('el error nombra TODAS las que faltan, no solo la primera', () => {
    const { validateCoreConfig } = require('../utils/config');
    try {
      validateCoreConfig();
      throw new Error('debería haber lanzado');
    } catch (err) {
      CORE.forEach((k) => expect(err.message).toContain(k));
    }
  });

  it('el error apunta a .env.example, que es de donde se copia', () => {
    const { validateCoreConfig } = require('../utils/config');
    expect(() => validateCoreConfig()).toThrow(/\.env\.example/);
  });

  it('no lanza cuando están todas', () => {
    CORE.forEach((k) => { process.env[k] = 'x'; });
    const { validateCoreConfig } = require('../utils/config');
    expect(() => validateCoreConfig()).not.toThrow();
  });

  // El correo ya no puede impedir el arranque, y esto lo fija: si alguien
  // vuelve a exigir `RESEND_API_KEY` para levantar el servidor, esta prueba cae.
  it('arranca sin RESEND_API_KEY ni SMTP_FROM: la nave ya no manda correo', () => {
    CORE.forEach((k) => { process.env[k] = 'x'; });
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_FROM;
    const { validateCoreConfig } = require('../utils/config');
    expect(() => validateCoreConfig()).not.toThrow();
  });
});
