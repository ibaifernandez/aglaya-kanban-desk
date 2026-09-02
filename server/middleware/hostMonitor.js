// hostMonitor.js — la alarma B-03, con su precondición dicha en voz alta.
//
// ─────────────────────────────────────────────────────────────────────────────
// QUÉ PASÓ, Y POR QUÉ ESTO SE EXTRAE EN VEZ DE PARCHEARSE DENTRO DE `app.js`
//
// `B-03` nació para detectar **bypass**: tráfico que entra por la URL de Railway
// en vez de por el dominio propio de la API. Su propio comentario lo decía:
//
//   «Cuando custom domain api.kanban.aglaya.biz esté setup, esto detecta
//    tráfico fuera del path esperado.»
//
// **Ese dominio nunca se creó.** Medido el 01-sep-2026 contra la API de Railway
// (proyecto `aglaya-kanban-desk`, servicio `web`, entorno `production`):
// `customDomains: []`, y un único `serviceDomains:
// web-production-099a0.up.railway.app`.
//
// Consecuencia: la condición «el Host es de railway.app» **la cumple el 100% del
// tráfico**, porque no hay otra puerta. La alarma no detectaba un bypass:
// **detectaba que existía tráfico**, un evento por petición, durante tres meses.
//
// EL DAÑO NO FUE DE ESTA NAVE. La cuota de Sentry es de la ORGANIZACIÓN. El
// 01-sep-2026 se agotó el segundo día del periodo —**42% de los eventos venían
// de este issue**— y Sentry empezó a descartar errores nuevos **de toda la
// flota**, incluido el escáner de `legal-reg-tech` en producción. Una nave que
// se come la cuota compartida no tiene un problema suyo: se lo crea a las demás.
//
// ⚠️ Y BAJAR EL NIVEL NO ARREGLA NADA: se emitía como `warning`, no como
// `error`, y `captureMessage` consume cuota igual. Lo que arregla es **no
// emitir**.
//
// ─────────────────────────────────────────────────────────────────────────────
// QUÉ CAMBIA, Y QUÉ NO SE DECIDE AQUÍ
//
// La alarma **no se silencia**: se le pone delante la precondición sin la que
// nunca tuvo sentido. Si no hay un host esperado configurado
// (`PUBLIC_API_HOST`), no hay bypass posible que detectar y el monitor queda
// **inerte, diciéndolo por el registro al arrancar**.
//
// Un guardián apagado por ruidoso, sin saber si tenía razón, es la peor salida.
// Éste queda **armado y esperando su precondición**: el día que exista el
// dominio propio, se configura la variable y la alarma vuelve sola, ya sin
// inundar.
//
// **Lo que NO decide este fichero:** si hay que crear ese dominio. Eso es
// arquitectura y es del Operador. Aquí solo se deja de gastar cuota ajena
// mientras tanto.
//
// ─────────────────────────────────────────────────────────────────────────────
// Y AUNQUE LA PRECONDICIÓN SE CUMPLA: UN EVENTO POR PETICIÓN NO ES MONITORIZAR
//
// Es inundar. Aunque mañana exista el dominio y el bypass sea real, un atacante
// —o un cliente mal configurado— generaría un evento por petición y volveríamos
// al mismo agujero por la otra puerta. Por eso el monitor **agrega**: como mucho
// un evento por (host, ruta) y ventana, y el evento lleva **cuántas veces pasó**
// desde el anterior. Se pierde la traza individual; se conserva la señal, que es
// lo que se estaba mirando.
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

/** Una hora. La señal que interesa es «esto sigue pasando», no cada petición. */
const VENTANA_MS = 60 * 60 * 1000;

/**
 * Techo de claves distintas vivas a la vez. Es la segunda mitad de la
 * agregación, y sin ella la primera no basta: un `Map` que solo crece es una
 * fuga, aunque cada clave sea legítima.
 *
 * 500 sobra para el número de formas de ruta que esta API tiene, y deja margen
 * para hosts distintos. Si se llenara, el problema ya no es el tamaño: es que
 * algo está generando formas de ruta sin límite, y eso se dice en vez de
 * tragarse.
 */
const MAX_CLAVES = 500;

/**
 * La ruta, con los identificadores sustituidos por su hueco.
 *
 * ⚠️ ESTO ES EL DEFECTO QUE ESTA FUNCIÓN CIERRA. La primera versión agregaba por
 * `req.path` literal, y el tráfico del riel es justo el que lleva identificadores
 * dentro —`/api/boards/<uuid>/columns`, `/api/columns/<uuid>/cards`—, así que
 * **cada petición producía una clave nueva y la agregación no agregaba nada**.
 * Medido: 1.000 peticiones → 1.000 eventos, contra 1.000 → 1 en una ruta fija.
 *
 * POR QUÉ NO SE USA `req.route`, que sería lo natural: **no existe aquí.**
 * Comprobado, no supuesto — este monitor corre en un `app.use` temprano, antes
 * del enrutado, y en ese punto `req.route` es `undefined` y `req.baseUrl` es
 * cadena vacía. La plantilla hay que derivarla del camino.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function plantillaDeRuta(ruta) {
  return String(ruta || '')
    .split('/')
    .map((seg) => {
      if (UUID_RE.test(seg)) return ':id';
      if (/^\d+$/.test(seg)) return ':n';
      return seg;
    })
    .join('/');
}

/**
 * Construye el middleware del monitor B-03.
 *
 * @param {object}   deps
 * @param {string}   [deps.hostEsperado]  el dominio propio de la API. Sin él, el
 *                                        monitor es inerte: no hay bypass que
 *                                        detectar cuando solo hay una puerta.
 * @param {function} [deps.capturar]      recibe (mensaje, contexto). Normalmente
 *                                        `Sentry.captureMessage`.
 * @param {function} [deps.avisar]        registro local; por defecto `console.warn`.
 * @param {function} [deps.ahora]         reloj inyectable, para poder medir la
 *                                        ventana sin esperar una hora.
 * @param {number}   [deps.ventanaMs]
 * @returns {function} middleware de Express
 */
function crearHostMonitor({
  hostEsperado,
  capturar,
  avisar = console.warn,
  ahora = () => Date.now(),
  ventanaMs = VENTANA_MS,
} = {}) {
  const esperado = (hostEsperado || '').trim().toLowerCase();

  if (!esperado) {
    // Inerte, y **dicho**. Un monitor que no mira sin que nadie lo sepa es peor
    // que no tenerlo: alguien contará con él.
    avisar(
      '[B-03 monitor] INERTE: no hay `PUBLIC_API_HOST` configurado, así que no ' +
      'existe un dominio propio del que este tráfico pueda estar desviándose. ' +
      'Configúralo el día que la API tenga dominio propio y la alarma vuelve sola.',
    );
    return (req, res, next) => next();
  }

  // (host + FORMA de ruta) → { primeraVez, vistas }
  const acumulado = new Map();

  /**
   * Poda lo que ya no puede agrupar nada. Se llama al emitir, que es cuando el
   * `Map` puede crecer — no hace falta un temporizador, y uno que corriera solo
   * mantendría vivo el proceso por un contador de ruido.
   */
  function podar(t) {
    for (const [k, v] of acumulado) {
      if (t - v.primeraVez >= ventanaMs) acumulado.delete(k);
    }

    // Si aun así se pasa del techo, se vacía y se dice. Vaciar pierde algún
    // recuento; no vaciar pierde el proceso. Y callarlo sería lo peor de los
    // dos: un guardián de ruido que se convierte en la fuga.
    if (acumulado.size > MAX_CLAVES) {
      avisar(
        `[B-03 monitor] ${acumulado.size} formas de ruta distintas en una ventana ` +
        `(techo ${MAX_CLAVES}): se reinicia el recuento. Si esto se repite, algo ` +
        'está generando rutas sin límite y eso es el hallazgo, no el tamaño.',
      );
      acumulado.clear();
    }
  }

  function hostMonitor(req, res, next) {
    const host = (req.headers.host || '').toLowerCase();

    // Los monitores de disponibilidad sí tocan la URL directa a propósito.
    if (req.path === '/api/health') return next();

    // Lo que se persigue es tráfico que NO entra por el dominio esperado. Se
    // compara contra el esperado en vez de contra una lista de hosts de
    // proveedor: si mañana se cambia de proveedor, esta condición sigue siendo
    // la correcta, y una lista de dominios ajenos habría envejecido.
    if (!host || host === esperado || host.startsWith(`${esperado}:`)) return next();

    // La clave es la FORMA de la ruta, no la ruta. Ver `plantillaDeRuta`.
    const forma = plantillaDeRuta(req.path);
    const clave = `${host} ${forma}`;
    const t = ahora();
    const previo = acumulado.get(clave);

    if (previo && t - previo.primeraVez < ventanaMs) {
      previo.vistas += 1;
      return next();
    }

    const vistasAnteriores = previo ? previo.vistas : 0;
    acumulado.set(clave, { primeraVez: t, vistas: 1 });
    podar(t);

    const ua = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for'] || req.ip || '';

    avisar(
      `[B-03 monitor] acceso fuera del dominio esperado: host=${host} forma=${forma} path=${req.path} ` +
      `ua=${String(ua).slice(0, 80)} ip=${ip}` +
      (vistasAnteriores ? ` (${vistasAnteriores} más en la ventana anterior)` : ''),
    );

    if (typeof capturar === 'function') {
      capturar('B-03 acceso fuera del dominio esperado', {
        level: 'warning',
        // La etiqueta es la FORMA: es lo que agrupa en Sentry. La ruta concreta
        // va en `extra`, como ejemplo de la que disparó el aviso — un ejemplo,
        // no la lista.
        tags: { audit: 'B-03', host, ruta: forma },
        extra: {
          path_ejemplo: req.path,
          user_agent: ua,
          ip,
          host_esperado: esperado,
          // Sin esto, agregar sería perder información: el evento tiene que
          // decir cuánto tráfico representa, o «uno» y «mil» se leen igual.
          repeticiones_en_ventana_anterior: vistasAnteriores,
          ventana_minutos: Math.round(ventanaMs / 60000),
        },
      });
    }

    return next();
  }

  // Diagnóstico, solo para poder MEDIR la poda desde fuera. Sin esto, «el `Map`
  // no crece» sería una afirmación sin forma de comprobarla — y la retención
  // anterior se detectó justamente por comportamiento, no por una cifra de
  // memoria que nadie pudo reproducir.
  hostMonitor.tamanoAcumulado = () => acumulado.size;

  return hostMonitor;
}

module.exports = { crearHostMonitor, plantillaDeRuta, VENTANA_MS, MAX_CLAVES };
