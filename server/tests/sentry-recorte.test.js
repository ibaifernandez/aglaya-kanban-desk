/**
 * Una traza de error provocada a propósito no lleva datos de la petición. Tarjeta `f428d080`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTA PRUEBA PROVOCA EL ERROR DE VERDAD, Y NO COMPRUEBA LA CONFIGURACIÓN
 *
 * La decisión del Operador lo pidió así, literal: «comprobar con un error
 * provocado a propósito que lo que llega es lo que se espera — no dar por hecho
 * que la opción hace lo que su nombre dice».
 *
 * Y la opción NO lo hacía. Con `sendDefaultPii: false` y el saneador por regex,
 * medido el 2026-09-13, a Sentry le llegaban el CUERPO de la petición (título y
 * descripción de tarjetas), la COOKIE de refresco, la query, el User-Agent, y la
 * query de las peticiones SALIENTES — que en esta nave son las consultas a
 * Supabase, con sus filtros.
 *
 * Una prueba que leyera `sendDefaultPii === false` habría estado en verde con
 * todo eso saliendo.
 *
 * ⚠️ POR QUÉ LANZA OTRO PROCESO. La provocación vive en
 * `helpers/traza-provocada.js` y corre en un `node` normal: bajo jest, Sentry no
 * instrumenta las peticiones salientes, y el caso de la query saliente pasaba
 * **con el recorte quitado**. Medido por mutación antes de moverlo.
 *
 * Y corre con credenciales FALSAS de Supabase, las mismas que usa CI: así la
 * configuración local no entra en el proceso, y la prueba no depende de ella.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const S = (nombre) => ['SONDA', nombre].join('-');

let resultado;

beforeAll(() => {
  const salida = spawnSync(process.execPath, [path.join(__dirname, 'helpers', 'traza-provocada.js')], {
    encoding: 'utf8',
    timeout: 30000,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      // `development` y no `production`: en producción las trazas se muestrean al
      // 10 %, y con eso las transacciones salían o no por azar — el recorte de
      // spans pasaba la prueba sin ejercitarse. Medido por mutación.
      SENTRY_ENVIRONMENT: 'development',
      SUPABASE_URL: 'http://localhost',
      SUPABASE_ANON_KEY: 'test_anon_key',
      SUPABASE_SERVICE_ROLE_KEY: 'test_service_role',
    },
  });
  const marca = (salida.stdout || '').split('@@RESULTADO@@')[1];
  if (!marca) {
    throw new Error(`sentry-recorte: el proceso no devolvió resultado — no medir NO es verde.\n${salida.stderr}`);
  }
  resultado = JSON.parse(marca.trim());
  if (resultado.error) throw new Error(`sentry-recorte: ${resultado.error}`);
}, 40000);

describe('lo que llega a Sentry de un error provocado', () => {
  // ⚠️ La contraparte va PRIMERO a propósito: si no llega nada, todo lo de abajo
  // pasaría en verde por ausencia. Un recorte que tirara el evento entero también.
  it('sí llega el evento, con el mensaje del error y la ruta', () => {
    expect(resultado.status).toBe(500);
    expect(resultado.texto).toContain('fallo provocado a proposito');
    expect(resultado.texto).toContain('__revienta');
  });

  // Y la de la petición saliente: sin ella, el caso de su query pasaría si el SDK
  // dejara de registrar peticiones salientes — que es exactamente lo que pasaba
  // bajo jest. Se exige que la petición CONSTE (su ruta), para que la ausencia de
  // su query signifique recorte y no ceguera.
  //
  // ⚠️ Viaja dentro del EVENTO de error, no en un item de transacción. Aquí se
  // exigía `"type":"transaction"` y cayó: lo supuse sin mirarlo. Medido después.
  it('sí consta la petición saliente, sin su query', () => {
    expect(resultado.texto).toContain('/rest/v1/users');
  });

  // Y la de las transacciones: sin ella, el recorte de spans pasaría si no saliera
  // ninguna — que es lo que ocurría con el muestreo de producción.
  // Contraparte de la lista blanca: el aviso llega, y con lo que SÍ está permitido.
  // Sin esto, un recorte que tirara `extra` y `tags` enteros —o el evento— pasaría.
  it('sí llega el aviso, con el extra y la etiqueta permitidos', () => {
    expect(resultado.texto).toContain('aviso provocado a proposito');
    expect(resultado.texto).toContain('424242');
    expect(resultado.texto).toMatch(/"audit":\s*"B-03"/);
  });

  it('sí sale una transacción', () => {
    expect(resultado.texto).toMatch(/"type":\s*"transaction"/);
  });

  it.each([
    ['el título del cuerpo',       'TITULO'],
    ['la descripción del cuerpo',  'DESCRIPCION'],
    ['la cookie',                  'GALLETA'],
    ['la query de la petición',    'QUERY'],
    ['el User-Agent',              'AGENTE'],
    ['la query de una petición saliente a la base', 'SALIENTE'],
    // ⚠️ Los de la devolución del vigilante: la política ya decía «no recibe IP ni
    // User-Agent», y por estas tres vías llegaban.
    ['la IP de una línea de log (miga de consola)',     'IP-MIGA'],
    ['el agente de una línea de log (miga de consola)', 'UA-MIGA'],
    ['una IP en `extra`',                               'IP-EXTRA'],
    ['un agente en `extra`',                            'UA-EXTRA'],
    ['una etiqueta no permitida',                       'TAG-LIBRE'],
    ['el usuario, ni su IP',                            'IP-USUARIO'],
    ['el identificador de usuario',                     'USUARIO'],
  ])('NO llega %s', (_, sonda) => {
    expect(resultado.texto).not.toContain(S(sonda));
  });
});
