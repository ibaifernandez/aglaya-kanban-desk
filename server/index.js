/**
 * index.js — Punto de entrada del servidor.
 *
 * Solo arranca el servidor TCP. Toda la configuración de Express
 * vive en app.js para que los tests puedan importarla sin abrir
 * handles de red.
 */
const app  = require('./app');
const PORT = process.env.PORT || 3003;

const { validateSmtpConfig, validateDigestSchedules } = require('./utils/smtpConfig');

try {
  validateSmtpConfig();
  validateDigestSchedules();
} catch (err) {
  console.error(`❌ Startup failed: ${err.message}`);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`AGLAYA Kanban Desk server → http://localhost:${PORT}`);
});
