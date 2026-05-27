/**
 * index.js — Punto de entrada del servidor.
 *
 * Solo arranca el servidor TCP. Toda la configuración de Express
 * vive en app.js para que los tests puedan importarla sin abrir
 * handles de red.
 */

// IMPORTANTE: Sentry require() debe ser ANTES de cualquier otro require
// (de app.js, etc.) para capturar errores during module load.
const { Sentry, enabled: sentryEnabled } = require('./utils/sentry');

const app  = require('./app');
const PORT = process.env.PORT || 3003;

const { validateSmtpConfig, validateDigestSchedules } = require('./utils/smtpConfig');

try {
  validateSmtpConfig();
  validateDigestSchedules();
} catch (err) {
  console.error(`❌ Startup failed: ${err.message}`);
  if (sentryEnabled) Sentry.captureException(err);
  process.exit(1);
}

// Global error handlers — capturan errores fuera del Express middleware chain
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  if (sentryEnabled) Sentry.captureException(err);
  // No exit — dejamos que el sistema decida (Railway reinicia container automático)
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  if (sentryEnabled) Sentry.captureException(reason);
});

app.listen(PORT, () => {
  console.log(`AGLAYA Kanban Desk server → http://localhost:${PORT}`);
  if (sentryEnabled) {
    console.log('[sentry] activo — errores se reportan a Sentry');
  } else {
    console.log('[sentry] inactivo — SENTRY_DSN no configurado, errores solo en stdout');
  }
});
