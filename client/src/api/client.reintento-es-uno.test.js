// client.reintento-es-uno.test.js — tras renovar el token se reintenta UNA vez,
// y una sola. Tarjeta `b6adf127`, lateral del capataz al auditar `48946335`.
//
// EL CÓDIGO DE HOY ESTÁ BIEN. Lo que falta es el candado: quitar `!isRetry` de
// `fetchWithAuth` dejaba las 25 pruebas del cliente **en verde**, y lo que eso
// permite en producción no es un fallo visible sino lo contrario —
//
//   servidor que contesta 401 aunque el refresco funcione (una cuenta
//   desactivada, un token rechazado por otro motivo) → renovar, reintentar,
//   401, renovar, reintentar, 401… sin fin, machacando `/auth/refresh`, y **sin
//   ningún error que el usuario pueda ver**. Solo que nada avanza.
//
// LO QUE ESTE FICHERO AÑADE, Y POR QUÉ NO BASTABA LO QUE YA HABÍA. Ya estaba
// fijado que un refresco **fallido** no reintenta, y que el reintento va con el
// token nuevo (`client.subir-con-sesion-viva.test.js`). Ninguno de los dos mira
// el caso de en medio: refresco que **funciona** y ruta que sigue dando 401.
//
// ⚠️ Y SE CUENTAN LAS PETICIONES, que es el fondo del asunto: sin el recuento,
// un mutante que reintentara tres veces —o treinta— pasaría igual de verde que
// el bueno. «Terminó con error» no distingue rendirse de entrar en bucle; sólo
// el número lo hace.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './client.js';
import { setAuthToken, clearAuthToken } from '../utils/session.js';

// ⚠️ TOPE, y está aquí por una razón concreta: con el mutante puesto esto es un
// bucle infinito, y una batería colgada no es un fallo — es una batería que
// nadie sabe leer. Con el tope, el mutante da un rojo que se explica solo: la
// cuenta de peticiones no es 2.
const TOPE_LLAMADAS = 12;

function respuesta(estado, cuerpo) {
  return { ok: estado >= 200 && estado < 300, status: estado, json: async () => cuerpo };
}

function servidorQueSiempreContesta401() {
  const cuenta = { ruta: 0, refresco: 0, total: 0 };
  let nuevo = 0;

  global.fetch = vi.fn(async (url) => {
    cuenta.total += 1;
    if (cuenta.total > TOPE_LLAMADAS) {
      throw new Error(
        `BUCLE: ${cuenta.total} peticiones (${cuenta.ruta} a la ruta, ${cuenta.refresco} al refresco). ` +
        'El reintento dejó de ser uno solo.',
      );
    }
    if (String(url).includes('/auth/refresh')) {
      cuenta.refresco += 1;
      // El refresco FUNCIONA, y cada vez devuelve un token distinto: así, si
      // algo reintentara, lo haría con credencial fresca — no se puede achacar
      // el 401 siguiente a un token rancio.
      nuevo += 1;
      return respuesta(200, { token: `token-nuevo-${nuevo}` });
    }
    cuenta.ruta += 1;
    return respuesta(401, { error: 'token expirado' });
  });

  return cuenta;
}

beforeEach(async () => {
  // El mutex de refresco vive en el MÓDULO y se libera en la siguiente
  // microtarea; sin esta espera, la prueba anterior se lo deja puesto a ésta.
  await new Promise((r) => setTimeout(r, 0));
  clearAuthToken();
  setAuthToken('token-viejo');
});

afterEach(() => {
  clearAuthToken();
  vi.restoreAllMocks();
});

describe('con el refresco funcionando y la ruta contestando 401 siempre', () => {
  it('se rinde con error tras UN reintento: la ruta se pide exactamente dos veces', async () => {
    const cuenta = servidorQueSiempreContesta401();

    await expect(api.getWorkspaces()).rejects.toThrow(/token expirado/);

    // Lo que separa «se rindió» de «entró en bucle». Dos: la original y el
    // reintento. Ni una más.
    expect(cuenta.ruta).toBe(2);
    // Y un solo refresco: renovar por cada 401 es la otra mitad del bucle.
    expect(cuenta.refresco).toBe(1);
  }, 5000);

  it('y da igual por qué puerta se entre: subir un fichero se rinde igual', async () => {
    const cuenta = servidorQueSiempreContesta401();
    const fichero = new File(['x'], 'captura.png', { type: 'image/png' });

    await expect(api.uploadFile(fichero)).rejects.toThrow(/token expirado/);

    // `uploadFile` es la que se saltaba el envoltorio hasta `48946335`. Si
    // alguien la volviera a sacar de aquí, se llevaría el reintento y también
    // este tope.
    expect(cuenta.ruta).toBe(2);
    expect(cuenta.refresco).toBe(1);
  }, 5000);
});

// La otra dirección: que el candado no esté fijando «no reintentes nunca». Sin
// esto, borrar el reintento entero —no solo su tope— pasaría los casos de
// arriba tan campante.
describe('y el reintento sigue existiendo', () => {
  it('un 401 que el refresco arregla termina bien, a la segunda', async () => {
    let ruta = 0;
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/auth/refresh')) return respuesta(200, { token: 'token-nuevo' });
      ruta += 1;
      return ruta === 1
        ? respuesta(401, { error: 'token expirado' })
        : respuesta(200, { data: [{ id: 'ws-1' }] });
    });

    await expect(api.getWorkspaces()).resolves.toEqual([{ id: 'ws-1' }]);
    expect(ruta).toBe(2);
  }, 5000);
});
