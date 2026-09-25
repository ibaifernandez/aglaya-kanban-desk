// proceso-que-revienta.js — un proceso de verdad para medir que MUERE.
// Lo lanza `server/tests/salida-limpia.test.js`. Tarjeta `3e2f6a84`.
//
// No es un simulacro: se registra el manejador real, se deja el proceso VIVO con
// un servidor escuchando —que es lo que impedía que muriera solo— y se provoca
// la avería. Si el manejador no sale, este proceso se queda colgado, y eso es
// exactamente lo que la prueba tiene que poder ver.
//
// Argumentos:
//   uncaught | unhandled   qué avería se provoca
//   [--sentry-colgado]     simula un aviso que nunca termina de enviarse
'use strict';

const http = require('http');
const { registrarSalidaLimpia } = require('../../utils/salida-limpia');

const tipo = process.argv[2];
const sentryColgado = process.argv.includes('--sentry-colgado');

const servidor = http.createServer(() => {});
servidor.listen(0); // mantiene el bucle de eventos vivo, como el servidor real

registrarSalidaLimpia({
  sentry: sentryColgado
    ? { captureException() {}, flush: () => new Promise(() => {}) }  // nunca resuelve
    : null,
  registrar: () => {},   // sin ruido en la salida de la prueba
  esperaMs: 300,
});

setTimeout(() => {
  if (tipo === 'uncaught') {
    throw new Error('revienta a propósito');
  }
  if (tipo === 'unhandled') {
    Promise.reject(new Error('promesa rota a propósito'));
  }
}, 10);

// Red de seguridad del propio ensayo: si nadie sale, esto lo delata con un
// código distinto en vez de dejar la prueba colgada hasta el tiempo límite.
setTimeout(() => {
  console.log('SIGO-VIVO');
  process.exit(42);
}, 4000);
