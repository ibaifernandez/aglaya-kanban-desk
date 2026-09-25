/**
 * salida-limpia.js — qué hacer cuando el proceso ya no es de fiar.
 * Tarjeta `3e2f6a84`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ DEFECTO CIERRA
 *
 * `index.js` atrapaba `uncaughtException` y `unhandledRejection`, los registraba
 * y **no salía**, con este comentario:
 *
 *     // No exit — dejamos que el sistema decida (Railway reinicia container automático)
 *
 * **El comentario decía lo contrario de lo que hacía el código.** Railway
 * reinicia un contenedor cuando el proceso MUERE; si nadie sale, no hay nada que
 * reiniciar. Node se queda en el estado que su propia documentación llama
 * indefinido: el servidor sigue aceptando peticiones con la memoria en un estado
 * desconocido, y la comprobación de salud sigue contestando que todo va bien.
 *
 * Para esta nave eso es lo peor de los dos mundos: el riel **parece** vivo y
 * contesta mal, así que el trabajo se bloquea o se registra torcido y nadie se
 * entera.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA PARTE DELICADA: QUE EL AVISO LLEGUE ANTES DE MORIR
 *
 * Salir de golpe pierde el aviso: Sentry manda por red y el proceso muere antes.
 * Por eso se espera al `flush` —con tope, porque esperar sin tope es lo mismo que
 * no salir— y solo entonces se sale.
 *
 * Y si el `flush` se cuelga, **se sale igual**: hay un temporizador que no
 * depende de que la promesa vuelva. Un proceso que no muere porque no pudo
 * avisar es exactamente la avería que esto cierra.
 *
 * Las costuras (`sentry`, `salir`, `registrar`, `esperaMs`) existen para que esto
 * se pueda medir sin matar al corredor de pruebas.
 */
'use strict';

const ESPERA_POR_DEFECTO_MS = 2000;

function registrarSalidaLimpia({
  proceso = process,
  sentry = null,
  salir = (codigo) => process.exit(codigo),
  registrar = console.error,
  esperaMs = ESPERA_POR_DEFECTO_MS,
} = {}) {
  let muriendo = false;

  async function morir(etiqueta, err) {
    registrar(`[${etiqueta}]`, err);

    // Un segundo fallo mientras se muere no reinicia la cuenta atrás ni duplica
    // la salida: el primero ya decidió, y lo que queda es irse.
    if (muriendo) return;
    muriendo = true;

    if (sentry) {
      try {
        sentry.captureException(err);
        // El tope vive AQUÍ y no en el `flush`: si la librería no cumple su
        // propio plazo, el proceso se va igual.
        await Promise.race([
          sentry.flush(esperaMs),
          new Promise((resolve) => setTimeout(resolve, esperaMs).unref?.()),
        ]);
      } catch (fallo) {
        registrar('[salida-limpia] el aviso no se pudo enviar:', fallo);
      }
    }

    salir(1);
  }

  proceso.on('uncaughtException', (err) => { morir('uncaughtException', err); });
  proceso.on('unhandledRejection', (reason) => { morir('unhandledRejection', reason); });
}

module.exports = { registrarSalidaLimpia, ESPERA_POR_DEFECTO_MS };
