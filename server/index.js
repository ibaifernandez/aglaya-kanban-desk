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

// La validación de config va ANTES de require('./app'): app.js construye los
// clientes de Supabase en carga de módulo y, sin credenciales, revienta con
// "supabaseUrl is required" desde dentro de la librería. Poner la red de
// seguridad detrás del agujero es no tenerla.
const { validateCoreConfig } = require('./utils/config');

try {
  validateCoreConfig();
} catch (err) {
  console.error(`❌ Startup failed: ${err.message}`);
  if (sentryEnabled) Sentry.captureException(err);
  process.exit(1);
}

const app  = require('./app');
const PORT = process.env.PORT || 3003;

// Errores fuera de la cadena de middleware de Express: se registran, se avisa, y
// el proceso SE MUERE para que la plataforma levante uno sano (tarjeta `3e2f6a84`).
//
// Aquí se atrapaban y NO se salía, con un comentario que decía que «Railway
// reinicia el contenedor automáticamente». Railway lo reinicia cuando el proceso
// muere; si nadie sale, no hay nada que reiniciar y el servidor sigue contestando
// con la memoria en un estado que Node llama indefinido.
//
// El porqué de cada pieza —y por qué el aviso se espera con tope— está en
// `utils/salida-limpia.js`.
const { registrarSalidaLimpia } = require('./utils/salida-limpia');

registrarSalidaLimpia({
  sentry: sentryEnabled ? Sentry : null,
});

app.listen(PORT, () => {
  console.log(`AGLAYA Kanban Desk server → http://localhost:${PORT}`);
  if (sentryEnabled) {
    console.log('[sentry] activo — errores se reportan a Sentry');
  } else {
    console.log('[sentry] inactivo — SENTRY_DSN no configurado, errores solo en stdout');
  }
});
