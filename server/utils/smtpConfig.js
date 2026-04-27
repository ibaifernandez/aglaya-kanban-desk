/**
 * SMTP Configuration Validation
 * Ensures all required SMTP environment variables are set at startup.
 */

function validateSmtpConfig() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `SMTP no configurado correctamente. Faltan variables:\n${missing.join('\n')}\n\n` +
      `Verifica .env o variables de entorno.`
    );
  }

  // Validate port is numeric
  const port = parseInt(process.env.SMTP_PORT, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`SMTP_PORT debe ser un número válido entre 1 y 65535. Actual: ${process.env.SMTP_PORT}`);
  }

  // Validate SMTP_SECURE is boolean
  const secure = process.env.SMTP_SECURE;
  if (secure && secure !== 'true' && secure !== 'false') {
    throw new Error(`SMTP_SECURE debe ser 'true' o 'false'. Actual: ${secure}`);
  }

  return {
    host: process.env.SMTP_HOST,
    port,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    secure: secure === 'true',
  };
}

/**
 * Validates digest cron schedules to detect conflicts.
 * Logs warning if admin and user digests are scheduled for the same hour.
 */
function validateDigestSchedules() {
  const adminHour = Number.isFinite(parseInt(process.env.DIGEST_HOUR))
    ? parseInt(process.env.DIGEST_HOUR)
    : 7;

  const userHour = Number.isFinite(parseInt(process.env.USER_DIGEST_HOUR))
    ? parseInt(process.env.USER_DIGEST_HOUR)
    : 8;

  if (adminHour === userHour) {
    console.warn(
      `⚠️  ADVERTENCIA: Admin digest y User digest corren a la misma hora (${String(adminHour).padStart(2, '0')}:00).` +
      `\n   Esto puede causar picos de carga SMTP simultáneos.` +
      `\n   Recomendación: DIGEST_HOUR=${adminHour}, USER_DIGEST_HOUR=${userHour + 1}`
    );
  }

  return { adminHour, userHour };
}

module.exports = { validateSmtpConfig, validateDigestSchedules };
