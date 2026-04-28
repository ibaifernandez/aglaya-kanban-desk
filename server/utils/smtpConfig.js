function validateSmtpConfig() {
  const missing = ['RESEND_API_KEY', 'SMTP_FROM'].filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Email no configurado. Faltan variables:\n${missing.join('\n')}\n\nVerifica .env o variables de entorno.`
    );
  }
}

function validateDigestSchedules() {
  const adminHour   = parseInt(process.env.DIGEST_HOUR,   10) || 7;
  const adminMinute = parseInt(process.env.DIGEST_MINUTE, 10) || 0;
  const userHour    = parseInt(process.env.USER_DIGEST_HOUR,   10) || 8;
  const userMinute  = parseInt(process.env.USER_DIGEST_MINUTE, 10) || 0;

  if (adminHour === userHour && adminMinute === userMinute) {
    console.warn(
      `⚠️  ADVERTENCIA: Admin digest y User digest están programados a la misma hora exacta` +
      ` (${String(adminHour).padStart(2,'0')}:${String(adminMinute).padStart(2,'0')}).` +
      `\n   Recomendación: separa al menos 5 minutos entre ambos.`
    );
  }

  return { adminHour, adminMinute, userHour, userMinute };
}

module.exports = { validateSmtpConfig, validateDigestSchedules };
