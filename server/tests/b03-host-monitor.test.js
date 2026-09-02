/**
 * El monitor B-03 deja de inundar, y no por silenciarlo.
 *
 * Tarjeta `4ae4ffe1` (`urgent`). Aviso de la nave `legal-reg-tech`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ PASÓ
 *
 * `B-03` existía para detectar **bypass**: tráfico entrando por la URL de
 * Railway en vez de por el dominio propio de la API. Ese dominio **nunca se
 * creó** —medido contra la API de Railway: `customDomains: []`— así que la
 * condición «el Host es de railway.app» la cumplía **todo el tráfico**.
 *
 * Un evento de Sentry por petición, tres meses. La cuota es de la
 * ORGANIZACIÓN: se agotó el segundo día del periodo, con el 42% de los eventos
 * viniendo de aquí, y Sentry empezó a descartar errores nuevos **de toda la
 * flota**. El daño no lo sufría esta nave: lo causaba.
 *
 * LO QUE ESTAS PRUEBAS FIJAN, y por qué cada una:
 *
 *   · **Sin dominio propio, el monitor no emite NADA** — pero tampoco calla:
 *     dice por el registro que está inerte y por qué. Un guardián apagado en
 *     silencio es peor que no tenerlo, porque alguien contará con él.
 *   · **Con dominio propio, sí detecta** — si no, esto sería silenciar con
 *     ceremonia.
 *   · **Y agrega**: un evento por (host, ruta) y ventana, no por petición.
 *     Aunque el bypass sea real, un evento por petición reabre el mismo agujero
 *     por la otra puerta.
 */

const { crearHostMonitor, plantillaDeRuta, MAX_CLAVES } = require('../middleware/hostMonitor');

const ESPERADO = 'api.kanban.aglaya.biz';
const RAILWAY = 'web-production-099a0.up.railway.app';

/** Petición mínima con lo que el monitor mira. */
const peticion = (host, path = '/api/cards') => ({
  headers: { host, 'user-agent': 'jest' },
  path,
  ip: '1.2.3.4',
});

// ⚠️ `hostEsperado` NO lleva valor por defecto en la desestructuración, y es a
// propósito: con `{ hostEsperado = ESPERADO }`, pasar `undefined` —que es
// exactamente el estado que se quiere probar, «no hay dominio configurado»—
// activaba el defecto y el banco medía lo contrario de lo que decía. Pasó en la
// primera versión de este fichero: dos casos rojos que acusaban al módulo
// cuando el error estaba aquí.
function banco(opciones = {}) {
  const hostEsperado = 'hostEsperado' in opciones ? opciones.hostEsperado : ESPERADO;
  const { ventanaMs } = opciones;
  const eventos = [];
  const avisos = [];
  let reloj = 1_000_000;

  const monitor = crearHostMonitor({
    hostEsperado,
    capturar: (mensaje, contexto) => eventos.push({ mensaje, contexto }),
    avisar: (linea) => avisos.push(linea),
    ahora: () => reloj,
    ventanaMs,
  });

  return {
    eventos,
    avisos,
    tamano: () => monitor.tamanoAcumulado(),
    avanzar: (ms) => { reloj += ms; },
    // `next` se cuenta: el monitor NO puede tragarse una petición pase lo que
    // pase. Es un observador, y un observador que corta tráfico es un fallo
    // peor que el que vino a vigilar.
    llamar(req) {
      let siguio = false;
      monitor(req, {}, () => { siguio = true; });
      return siguio;
    },
  };
}

describe('sin dominio propio configurado, el monitor no emite', () => {
  // ⚠️ EL CASO DE LA TARJETA. Éste es el estado real de producción hoy.
  it('no manda ni un evento aunque el Host sea el de Railway', () => {
    const b = banco({ hostEsperado: undefined });

    for (let i = 0; i < 50; i += 1) b.llamar(peticion(RAILWAY, `/api/cards/${i}`));

    expect(b.eventos).toHaveLength(0);
  });

  // Y no calla: lo dice UNA vez, al construirse. Sin esto, quedaría un monitor
  // que no mira sin que nadie lo sepa — que es cómo se pierde un guardián.
  it('pero declara por el registro que está inerte, y por qué', () => {
    const b = banco({ hostEsperado: undefined });

    expect(b.avisos).toHaveLength(1);
    expect(b.avisos[0]).toMatch(/INERTE/);
    expect(b.avisos[0]).toMatch(/dominio propio/);
  });

  it('y deja pasar el tráfico igual', () => {
    const b = banco({ hostEsperado: '' });
    expect(b.llamar(peticion(RAILWAY))).toBe(true);
  });
});

describe('con dominio propio, la alarma vuelve sola', () => {
  // Si esto no pasara, lo de arriba sería silenciar con ceremonia.
  it('un Host que no es el esperado sí genera evento', () => {
    const b = banco();

    b.llamar(peticion(RAILWAY));

    expect(b.eventos).toHaveLength(1);
    expect(b.eventos[0].contexto.tags).toMatchObject({ audit: 'B-03', host: RAILWAY });
    expect(b.eventos[0].contexto.extra.host_esperado).toBe(ESPERADO);
  });

  it('el tráfico por el dominio esperado NO genera nada', () => {
    const b = banco();

    b.llamar(peticion(ESPERADO));
    b.llamar(peticion(`${ESPERADO}:443`));

    expect(b.eventos).toHaveLength(0);
  });

  // La comparación es contra el host ESPERADO, no contra una lista de dominios
  // de proveedor. Si mañana se cambia de Railway a otra cosa, esto sigue siendo
  // correcto; una lista de dominios ajenos habría envejecido en silencio.
  it('cualquier host ajeno cuenta, no solo los de railway.app', () => {
    const b = banco();

    b.llamar(peticion('kanban-desk.fly.dev'));

    expect(b.eventos).toHaveLength(1);
  });

  it('y sigue sin mirar /api/health, que los monitores tocan a propósito', () => {
    const b = banco();

    b.llamar(peticion(RAILWAY, '/api/health'));

    expect(b.eventos).toHaveLength(0);
  });
});

describe('agrega: un evento por ventana, no por petición', () => {
  // ⚠️ Esto NO es opcional aunque el bypass sea real. Un atacante —o un cliente
  // mal configurado— generaría un evento por petición y volveríamos al mismo
  // agujero por la otra puerta.
  it('mil peticiones iguales son UN evento', () => {
    const b = banco();

    for (let i = 0; i < 1000; i += 1) b.llamar(peticion(RAILWAY));

    expect(b.eventos).toHaveLength(1);
  });

  it('rutas distintas son señales distintas y se cuentan aparte', () => {
    const b = banco();

    b.llamar(peticion(RAILWAY, '/api/cards'));
    b.llamar(peticion(RAILWAY, '/api/boards'));

    expect(b.eventos).toHaveLength(2);
  });

  it('pasada la ventana, vuelve a emitir: la señal es «sigue pasando»', () => {
    const b = banco({ ventanaMs: 1000 });

    b.llamar(peticion(RAILWAY));
    b.avanzar(1500);
    b.llamar(peticion(RAILWAY));

    expect(b.eventos).toHaveLength(2);
  });

  // Sin esto, agregar sería perder información: «uno» y «mil» se leerían igual,
  // y la agregación pasaría de ahorrar cuota a ocultar el volumen.
  it('el segundo evento dice cuántas veces pasó mientras callaba', () => {
    const b = banco({ ventanaMs: 1000 });

    for (let i = 0; i < 42; i += 1) b.llamar(peticion(RAILWAY));
    b.avanzar(1500);
    b.llamar(peticion(RAILWAY));

    expect(b.eventos[1].contexto.extra.repeticiones_en_ventana_anterior).toBe(42);
  });
});

describe('lo que el monitor no puede hacer nunca', () => {
  it('deja pasar la petición, emita o no emita', () => {
    const b = banco();

    expect(b.llamar(peticion(RAILWAY))).toBe(true);
    expect(b.llamar(peticion(ESPERADO))).toBe(true);
    expect(b.llamar(peticion(RAILWAY, '/api/health'))).toBe(true);
  });

  // Sin Sentry configurado no hay a quién emitir, y eso no puede reventar la
  // petición: el observador es opcional, el tráfico no.
  it('sin `capturar` no revienta', () => {
    const monitor = crearHostMonitor({ hostEsperado: ESPERADO, avisar: () => {} });
    let siguio = false;

    expect(() => monitor(peticion(RAILWAY), {}, () => { siguio = true; })).not.toThrow();
    expect(siguio).toBe(true);
  });

  it('una petición sin Host no se inventa un bypass', () => {
    const b = banco();

    b.llamar({ headers: {}, path: '/api/cards', ip: '1.2.3.4' });

    expect(b.eventos).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta `b9b58f10`: la agregación NO agregaba el tráfico del riel.
//
// La primera versión —mía, de ayer— agrupaba por `req.path` LITERAL. El tráfico
// del riel lleva identificadores dentro (`/api/boards/<uuid>/columns`), así que
// **cada petición producía una clave nueva**: mil peticiones, mil eventos. La
// ventana funcionaba; lo que no funcionaba era la clave.
//
// Y el acumulador **no se podaba nunca**: ni un `delete`, ni un `clear`.
//
// Hoy no hacía daño —el monitor está inerte sin dominio propio— pero el runbook
// del dominio manda encender esa variable. **Era una mecha con la instrucción de
// encenderla ya escrita.**
// ─────────────────────────────────────────────────────────────────────────────

const UNO = '11111111-2222-4333-8444-555555555555';
const OTRO = '99999999-8888-4777-8666-555555555555';

describe('agrega por la FORMA de la ruta, no por la ruta', () => {
  it('mil peticiones a la misma forma con identificadores distintos son UN evento', () => {
    const b = banco();

    for (let i = 0; i < 1000; i += 1) {
      const id = `${i.toString(16).padStart(8, '0')}-2222-4333-8444-555555555555`;
      b.llamar(peticion(RAILWAY, `/api/boards/${id}/columns`));
    }

    expect(b.eventos).toHaveLength(1);
  });

  it('formas distintas siguen siendo señales distintas', () => {
    const b = banco();

    b.llamar(peticion(RAILWAY, `/api/boards/${UNO}/columns`));
    b.llamar(peticion(RAILWAY, `/api/columns/${OTRO}/cards`));

    expect(b.eventos).toHaveLength(2);
  });

  // Los identificadores numéricos cuentan igual: si solo se normalizara el UUID,
  // una API con ids enteros volvería a tener el mismo defecto.
  it('también normaliza identificadores numéricos', () => {
    const b = banco();

    b.llamar(peticion(RAILWAY, '/api/cards/17/history'));
    b.llamar(peticion(RAILWAY, '/api/cards/948/history'));

    expect(b.eventos).toHaveLength(1);
  });

  it('la etiqueta que agrupa es la forma; la ruta concreta va como ejemplo', () => {
    const b = banco();

    b.llamar(peticion(RAILWAY, `/api/boards/${UNO}/columns`));

    const { tags, extra } = b.eventos[0].contexto;
    expect(tags.ruta).toBe('/api/boards/:id/columns');
    expect(extra.path_ejemplo).toBe(`/api/boards/${UNO}/columns`);
    // Y la ruta con el identificador NO puede ser etiqueta: en Sentry, una
    // etiqueta distinta por petición es exactamente el defecto de ayer.
    expect(JSON.stringify(tags)).not.toContain(UNO);
  });

  it('y la plantilla es una función aparte, medible sola', () => {
    expect(plantillaDeRuta(`/api/boards/${UNO}/columns`)).toBe('/api/boards/:id/columns');
    expect(plantillaDeRuta('/api/cards/42')).toBe('/api/cards/:n');
    expect(plantillaDeRuta('/api/cards')).toBe('/api/cards');
  });
});

describe('el acumulador no crece sin límite', () => {
  // La otra mitad del defecto: agregar bien y no podar deja un `Map` que solo
  // crece. Se mide por COMPORTAMIENTO —cuántas claves quedan vivas— y no por
  // memoria: la cifra de MB que se citó en el hallazgo no se pudo reproducir, y
  // esto no depende de ella.
  it('poda lo que ya no puede agrupar nada al pasar la ventana', () => {
    const b = banco({ ventanaMs: 1000 });

    for (let i = 0; i < 50; i += 1) b.llamar(peticion(RAILWAY, `/api/cosa-${i}`));
    expect(b.tamano()).toBe(50);

    b.avanzar(1500);
    b.llamar(peticion(RAILWAY, '/api/otra'));

    // Las 50 viejas ya no agrupan nada: se van. Queda la nueva.
    expect(b.tamano()).toBe(1);
  });

  it('con formas sin límite, se queda en el techo en vez de crecer', () => {
    const b = banco();

    for (let i = 0; i < MAX_CLAVES * 3; i += 1) b.llamar(peticion(RAILWAY, `/api/forma-${i}`));

    expect(b.tamano()).toBeLessThanOrEqual(MAX_CLAVES);
  });

  // Y no lo hace en silencio: vaciar el recuento pierde información, así que
  // tiene que quedar dicho — y además ESO es el hallazgo, no el tamaño.
  it('y avisa cuando reinicia el recuento por llegar al techo', () => {
    const b = banco();

    for (let i = 0; i < MAX_CLAVES * 2; i += 1) b.llamar(peticion(RAILWAY, `/api/forma-${i}`));

    expect(b.avisos.some((l) => /se reinicia el recuento/.test(l))).toBe(true);
  });
});
