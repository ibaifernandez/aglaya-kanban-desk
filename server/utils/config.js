// config.js — lo que el servidor necesita para poder arrancar.
//
// Se llamaba `smtpConfig.js` y validaba tres cosas: el núcleo, el correo y las
// horas de los dos digests. **De correo ya no queda nada** —la nave no manda
// ninguno— así que el fichero se queda solo con lo que sí decide si se arranca
// o no, y con el nombre de lo que hace. Un fichero llamado `smtpConfig` sin
// SMTP dentro es una pista falsa para el siguiente que busque por dónde sale un
// correo.

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

module.exports = { validateCoreConfig };
