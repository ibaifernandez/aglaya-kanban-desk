/**
 * sentry.js — Error tracking + observability (D-01 audit Mariana 2026-05-27).
 *
 * Si SENTRY_DSN está en env vars, inicializa @sentry/node con sampling
 * conservador y captura automática de uncaught exceptions / unhandled
 * promise rejections + Express request handler/error handler.
 *
 * Si SENTRY_DSN NO está, exporta no-op stubs para que el código consumer
 * no necesite checks.
 *
 * ACTIVO en producción desde mayo de 2026 (SENTRY_DSN en Railway). Aquí decía
 * «configurar cuando esté listo»: ya lo estaba, y los documentos legales llegaron
 * a negar que existiera. Sin DSN —en local y en tests—, todo va a stdout.
 */
'use strict';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.SENTRY_RELEASE || process.env.GIT_SHA;

let Sentry = null;
let enabled = false;

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ EL RECORTE — tarjeta `f428d080`, decisión del Operador del 2026-09-12:
// «primero recortar lo que se le manda, y comprobarlo con un error provocado a
// propósito — no dar por hecho que la opción hace lo que su nombre dice».
//
// Y NO lo hacía. Medido el 2026-09-13 con la configuración de abajo
// (`sendDefaultPii: false` + el saneador por regex), un error provocado dentro de
// una petición mandaba a Sentry:
//
//   · `request.data`          → EL CUERPO ENTERO: título y descripción de la
//                               tarjeta, y cualquier campo sensible que no se
//                               llamara literalmente `password`;
//   · `request.cookies` y `request.headers.cookie` → la cookie de refresco;
//   · `request.query_string` y la query dentro de `request.url`;
//   · `request.headers.user-agent`;
//   · y en la transacción, `http.query` de las peticiones SALIENTES — que en esta
//     nave son las consultas a Supabase, con sus filtros (`email=eq.…`).
//
// Lo que `sendDefaultPii: false` sí quitaba: la IP y la cabecera Authorization.
// El nombre de la opción promete bastante más de lo que hace.
//
// Por eso el recorte no se fía de opciones del SDK: se queda con lo MÍNIMO para
// saber qué falló y dónde —método y ruta sin query— y tira todo lo demás. Cuanto
// menos viaja, menos hay que declarar como encargado del tratamiento.
//
// Lo sostiene `server/tests/sentry-recorte.test.js`, que provoca el error de
// verdad y mira lo que sale del SDK.
// ─────────────────────────────────────────────────────────────────────────────
const sinQuery = (url) => (typeof url === 'string' ? url.split('?')[0] : url);

// Claves de datos de span y de miga de pan que llevan la query o la URL completa.
const CLAVES_CON_QUERY = ['http.query', 'url.query', 'http.url', 'url.full', 'http.target', 'url'];

// Atributos de traza que llevan cabeceras de la petición. Medido: en las
// TRANSACCIONES —no en los eventos de error— la cookie y el User-Agent viajaban
// en `contexts.trace.data` como `http.request.header.cookie.*`,
// `http.request.header.user_agent` y `http.user_agent`. En producción las trazas
// se muestrean al 10 %: una de cada diez peticiones mandaba su cookie de refresco.
const PREFIJOS_DE_CABECERA = ['http.request.header.', 'http.response.header.'];
const CLAVES_DE_AGENTE = ['http.user_agent', 'user_agent.original'];

function recortarDatos(datos) {
  if (!datos || typeof datos !== 'object') return datos;
  for (const clave of Object.keys(datos)) {
    if (PREFIJOS_DE_CABECERA.some((p) => clave.startsWith(p)) || CLAVES_DE_AGENTE.includes(clave)) {
      delete datos[clave];
    }
  }
  for (const clave of CLAVES_CON_QUERY) {
    if (!(clave in datos)) continue;
    if (clave === 'http.query' || clave === 'url.query') delete datos[clave];
    else datos[clave] = sinQuery(datos[clave]);
  }
  return datos;
}

// Las únicas claves de `extra` y `tags` que salen. Todas sin dato personal: la
// FORMA de la ruta y recuentos del monitor B-03, y el nombre de host (un dominio
// de la casa, no del usuario).
const EXTRA_PERMITIDOS = new Set(['path_ejemplo', 'host_esperado', 'repeticiones_en_ventana_anterior', 'ventana_minutos']);
const TAGS_PERMITIDOS = new Set(['audit', 'host', 'ruta']);

function soloPermitidas(objeto, permitidas) {
  if (!objeto || typeof objeto !== 'object') return objeto;
  const limpio = Object.fromEntries(Object.entries(objeto).filter(([k]) => permitidas.has(k)));
  return Object.keys(limpio).length ? limpio : undefined;
}

function recortar(event) {
  if (!event || typeof event !== 'object') return event;

  // 1. La petición: método y ruta. Nada de cuerpo, cabeceras, cookies ni query.
  if (event.request) {
    event.request = {
      ...(event.request.method ? { method: event.request.method } : {}),
      ...(event.request.url ? { url: sinQuery(event.request.url) } : {}),
    };
  }

  // 2. Las migas de pan. Las de CONSOLA fuera enteras —llevan cada `console.*`
  //    del servidor, incluidas líneas con `ip=… ua=…` y con identificadores—, y
  //    de las demás, fuera el `message`, que es texto libre. Queda su `data`
  //    (método, ruta, estado), recortada de query.
  //
  //    La integración de consola ya va desactivada en `init`; esto es la segunda
  //    capa, por si alguien la vuelve a activar. Lo encontró el vigilante al
  //    revisar `f428d080`: la política ya decía «no recibe IP ni User-Agent».
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.filter((m) => m.category !== 'console');
    for (const miga of event.breadcrumbs) {
      delete miga.message;
      recortarDatos(miga.data);
    }
  }

  // 3. Los spans de una transacción, y el contexto de traza.
  for (const span of event.spans || []) recortarDatos(span.data);
  recortarDatos(event.contexts?.trace?.data);

  // 4. `extra` y `tags`: LISTA BLANCA, no lista negra. Quien llama a
  //    `captureMessage` puede meter cualquier cosa, y una lista de claves
  //    prohibidas se queda corta el día que alguien invente otra. Lo que no está
  //    aquí, no sale. Hoy el único emisor es el monitor B-03.
  event.extra = soloPermitidas(event.extra, EXTRA_PERMITIDOS);
  event.tags = soloPermitidas(event.tags, TAGS_PERMITIDOS);

  // 5. Y el usuario: nada en esta nave lo fija, pero la política dice que Sentry
  //    no recibe IP — y `user.ip_address` es exactamente eso.
  delete event.user;

  return event;
}

if (SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      release: SENTRY_RELEASE,
      tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
      // PII redaction (RGPD Art. 5(1)(c) minimización + D-02 audit Mariana):
      // sendDefaultPii=false evita que Sentry inyecte automatically headers,
      // cookies o user IPs. Solo capturamos lo que añadimos manualmente.
      sendDefaultPii: false,
      // Sin migas de consola: llevaban cada `console.*` del servidor —con IPs,
      // agentes e identificadores— como texto libre. `recortar` las quita también.
      integrations: (porDefecto) => porDefecto.filter((i) => i.name !== 'Console'),
      // Las transacciones llevan los spans de las peticiones salientes: mismo recorte.
      beforeSendTransaction: (event) => recortar(event),
      beforeSend(event) {
        // Primero el recorte estructural; después, como segunda capa, el saneo
        // por patrón de lo que pudiera quedar en mensajes y trazas de pila.
        recortar(event);
        // Sanea email/JWT/password de cualquier string en breadcrumbs/exceptions
        try {
          const json = JSON.stringify(event);
          const sanitized = json
            .replace(/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<redacted-email>')
            .replace(/Bearer\s+[A-Za-z0-9._\-+/=]{20,}/g, 'Bearer <redacted-token>')
            .replace(/"password"\s*:\s*"[^"]*"/g, '"password":"<redacted>"');
          return JSON.parse(sanitized);
        } catch (_) {
          return event;
        }
      },
    });
    enabled = true;
    console.log(`[sentry] enabled — env=${SENTRY_ENVIRONMENT} release=${SENTRY_RELEASE ?? 'unset'}`);
  } catch (err) {
    console.error('[sentry] init failed:', err.message);
    Sentry = null;
    enabled = false;
  }
} else {
  // No-op stubs — code consumer no necesita check
  Sentry = {
    captureException: () => {},
    captureMessage: () => {},
    setUser: () => {},
    setContext: () => {},
    setTag: () => {},
    addBreadcrumb: () => {},
    Handlers: {
      requestHandler: () => (_req, _res, next) => next(),
      errorHandler: () => (err, _req, _res, next) => next(err),
    },
  };
}

module.exports = { Sentry, enabled, recortar };
