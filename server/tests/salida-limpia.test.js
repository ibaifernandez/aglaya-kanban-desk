// salida-limpia.test.js — ante una avería, el proceso MUERE. Tarjeta `3e2f6a84`.
//
// Lo que fija, y por qué en dos capas:
//
//   · con procesos DE VERDAD, que es la única forma de ver morir a uno: se lanza
//     un hijo que deja un servidor escuchando —lo que antes lo mantenía vivo y
//     roto—, se provoca la avería, y se exige que salga con código distinto de 0.
//     La contraprueba está en el propio ensayo: si nadie sale, el hijo imprime
//     «SIGO-VIVO» y sale con 42, así que un manejador que no mata se ve;
//
//   · con costuras, para lo que un proceso real no deja mirar: que el aviso a
//     Sentry se mande y se espere ANTES de salir, y que un aviso colgado no
//     impida morir.
'use strict';

const path = require('path');
const { spawn } = require('child_process');
const { registrarSalidaLimpia } = require('../utils/salida-limpia');

const HELPER = path.join(__dirname, 'helpers', 'proceso-que-revienta.js');

function lanzar(...args) {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [HELPER, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = '';
    hijo.stdout.on('data', (d) => { salida += d; });
    hijo.stderr.on('data', (d) => { salida += d; });
    hijo.on('close', (codigo) => resolve({ codigo, salida }));
  });
}

describe('un proceso que ya no es de fiar se muere', () => {
  it('una excepción no capturada lo termina con código distinto de 0', async () => {
    const { codigo, salida } = await lanzar('uncaught');

    expect(salida).not.toContain('SIGO-VIVO');
    expect(codigo).toBe(1);
  }, 10000);

  it('una promesa rechazada sin manejar también lo termina', async () => {
    const { codigo, salida } = await lanzar('unhandled');

    expect(salida).not.toContain('SIGO-VIVO');
    expect(codigo).toBe(1);
  }, 10000);

  // La parte delicada de la tarjeta: que el aviso no pueda secuestrar la muerte.
  it('y si el aviso se cuelga, se muere igual', async () => {
    const { codigo, salida } = await lanzar('uncaught', '--sentry-colgado');

    expect(salida).not.toContain('SIGO-VIVO');
    expect(codigo).toBe(1);
  }, 10000);
});

describe('el aviso sale antes de morir', () => {
  // ⚠️ EL `flush` DEL DOBLE TIENE QUE TARDAR, y ésta es la corrección que trae la
  // tarjeta `ee4993fb`. Antes apuntaba «flush» **en cuanto lo llamaban** y
  // resolvía en el acto, así que el orden salía igual con `await` y sin él:
  // quitar la espera —el mutante que manda el aviso y se muere sin esperarlo—
  // dejaba los 7 casos en verde. Lo midió el capataz.
  //
  // Con un envío que termina más tarde, la diferencia se ve:
  //   con espera: ['captura', 'flush-terminado', 'salir']
  //   sin espera: ['captura', 'salir', 'flush-terminado']  ← el aviso no llega
  function espia({ tardaMs = 20 } = {}) {
    const orden = [];
    const proceso = { on(evento, fn) { (this.manejadores ||= {})[evento] = fn; } };
    const sentry = {
      captureException: jest.fn(() => orden.push('captura')),
      flush: jest.fn(() => new Promise((resolver) => {
        setTimeout(() => { orden.push('flush-terminado'); resolver(true); }, tardaMs);
      })),
    };
    const salir = jest.fn(() => orden.push('salir'));
    registrarSalidaLimpia({ proceso, sentry, salir, registrar: () => {}, esperaMs: 200 });
    return { proceso, sentry, salir, orden };
  }

  it('captura, ESPERA A QUE EL ENVÍO TERMINE, y solo entonces sale con 1', async () => {
    const { proceso, sentry, salir, orden } = espia();

    proceso.manejadores.uncaughtException(new Error('x'));
    await new Promise((r) => setTimeout(r, 80));

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.flush).toHaveBeenCalledWith(200);
    expect(salir).toHaveBeenCalledWith(1);
    // El fondo del asunto: morirse antes de que el envío termine pierde el
    // aviso, y entonces el error no llega a Sentry — que es justo lo que este
    // módulo existe para evitar.
    expect(orden).toEqual(['captura', 'flush-terminado', 'salir']);
  });

  it('sin Sentry configurado no espera a nadie, y sale igual', async () => {
    const proceso = { on(evento, fn) { (this.manejadores ||= {})[evento] = fn; } };
    const salir = jest.fn();
    registrarSalidaLimpia({ proceso, sentry: null, salir, registrar: () => {}, esperaMs: 50 });

    proceso.manejadores.uncaughtException(new Error('x'));
    await new Promise((r) => setTimeout(r, 10));

    expect(salir).toHaveBeenCalledWith(1);
  });

  it('un segundo fallo mientras se muere no vuelve a salir', async () => {
    const { proceso, salir } = espia();

    proceso.manejadores.uncaughtException(new Error('primero'));
    proceso.manejadores.unhandledRejection(new Error('segundo'));
    await new Promise((r) => setTimeout(r, 20));

    expect(salir).toHaveBeenCalledTimes(1);
  });

  // ── Y que el arranque lo ENCHUFE ────────────────────────────────────────
  //
  // Sin esto, el módulo entero se puede desenchufar de `index.js` sin que nada
  // se ponga rojo —dos mutantes del capataz: quitar la llamada, y pasarle
  // `sentry: null`—, y entonces los casos de arriba vigilarían código que ya no
  // corre. Un manejador perfecto que nadie registra no salva ningún proceso.
  //
  // ⚠️ Mira el FUENTE de `index.js`, a propósito: importarlo levantaría el
  // servidor de verdad. Lo que se fija es el cableado, no el arranque — y ésa
  // es la frontera que pidió el delineante.
  it('y el arranque lo registra, pasándole Sentry cuando está activo', () => {
    const fs = require('fs');
    const path = require('path');
    const arranque = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

    expect(arranque).toMatch(/registrarSalidaLimpia\s*\(/);
    // Con Sentry apagado va `null`, y el módulo sale sin esperar a nadie; lo que
    // no puede es no recibirlo nunca, porque entonces el aviso jamás se manda.
    expect(arranque).toMatch(/sentry:\s*sentryEnabled\s*\?\s*Sentry\s*:\s*null/);
  });

  it('registra la avería aunque no haya Sentry: sin rastro no hay diagnóstico', () => {
    const proceso = { on(evento, fn) { (this.manejadores ||= {})[evento] = fn; } };
    const registrar = jest.fn();
    registrarSalidaLimpia({ proceso, sentry: null, salir: () => {}, registrar, esperaMs: 10 });

    proceso.manejadores.uncaughtException(new Error('la que sea'));

    expect(registrar).toHaveBeenCalledWith('[uncaughtException]', expect.any(Error));
  });
});
