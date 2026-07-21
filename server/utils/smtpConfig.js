// Variables sin las que el servidor no puede ni construir sus clientes.
// DEBE llamarse ANTES de require('./app'): supabase-js revienta en carga de
// módulo con "supabaseUrl is required", un stack trace de librería que no le
// dice a nadie qué hacer. Encontrado siguiendo el README en un clon limpio.
function validateCoreConfig() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Configuración incompleta. Faltan variables:\n${missing.map(k => `  · ${k}`).join('\n')}\n\n` +
      `Cópialas de .env.example a .env y rellénalas:  cp .env.example .env\n` +
      `La plantilla completa, con qué es obligatorio y qué opcional, está en .env.example.`
    );
  }
}

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

module.exports = { validateCoreConfig, validateSmtpConfig, validateDigestSchedules };
