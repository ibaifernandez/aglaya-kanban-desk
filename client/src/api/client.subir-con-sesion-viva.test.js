// client.subir-con-sesion-viva.test.js — subir un adjunto con el token caducado
// termina, igual que cualquier otra llamada. Tarjeta `48946335`.
//
// LO QUE HABÍA: `uploadFile` llamaba a `fetch` directamente. Era **la única
// llamada del fichero** que se saltaba el envoltorio `request`, que es quien
// renueva el token cuando el servidor contesta 401 — `deleteFile`, dos líneas
// más abajo, sí lo usaba. Pasados los 15 minutos que dura el token de acceso, el
// adjunto **no subía**, en una sesión que el usuario creía abierta.
//
// Y EL MOTIVO POR EL QUE SE SALÍA, que es lo que se arregla de raíz: el
// envoltorio imponía `Content-Type: application/json`, y con un fichero eso
// rompe el envío —el navegador tiene que poner el `boundary`—. Duplicar el
// reintento en la subida habría dejado el motivo en pie para la siguiente.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './client.js';
import { setAuthToken, clearAuthToken, getAuthToken } from '../utils/session.js';

function respuesta(estado, cuerpo) {
  return {
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: async () => cuerpo,
  };
}

const FICHERO = new File(['contenido'], 'captura.png', { type: 'image/png' });

beforeEach(async () => {
  // El mutex de refresco vive en el MÓDULO y se libera en la siguiente
  // microtarea (`setTimeout(…, 0)`), así que sin esta espera la prueba anterior
  // se lo deja puesto a la siguiente: el refresco de ésta reutilizaría el
  // resultado de aquélla y el caso pasaría —o caería— por el motivo equivocado.
  // Lo descubrió este fichero al escribirse, no la lectura.
  await new Promise((r) => setTimeout(r, 0));
  clearAuthToken();
  setAuthToken('token-viejo');
  global.fetch = vi.fn();
});

afterEach(() => {
  clearAuthToken();
  vi.restoreAllMocks();
});

describe('subir un adjunto con el token de acceso caducado', () => {
  it('renueva y reintenta: la subida TERMINA', async () => {
    global.fetch
      .mockResolvedValueOnce(respuesta(401, { error: 'token expirado' }))          // la subida
      .mockResolvedValueOnce(respuesta(200, { token: 'token-nuevo' }))             // el refresco
      .mockResolvedValueOnce(respuesta(200, { data: { url: '/uploads/x.png', name: 'captura.png' } }));

    await expect(api.uploadFile(FICHERO)).resolves.toEqual({ url: '/uploads/x.png', name: 'captura.png' });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(getAuthToken()).toBe('token-nuevo');
    // Y el reintento va con el token NUEVO: reintentar con el viejo sería
    // repetir el mismo 401 y llamarlo arreglo.
    const [, opciones] = global.fetch.mock.calls[2];
    expect(opciones.headers.Authorization).toBe('Bearer token-nuevo');
  });

  // El motivo de raíz. Sin esto, la subida iría por el envoltorio y fallaría por
  // otra razón: el servidor no sabría dónde empieza cada parte del formulario.
  it('y NO le pone Content-Type al formulario: lo pone el navegador', async () => {
    global.fetch.mockResolvedValueOnce(respuesta(200, { data: { url: '/uploads/x.png' } }));

    await api.uploadFile(FICHERO);

    const [, opciones] = global.fetch.mock.calls[0];
    expect(opciones.body).toBeInstanceOf(FormData);
    expect(opciones.headers['Content-Type']).toBeUndefined();
  });

  it('pero a una llamada normal sí se lo pone', async () => {
    global.fetch.mockResolvedValueOnce(respuesta(200, { data: [] }));

    await api.getWorkspaces();

    const [, opciones] = global.fetch.mock.calls[0];
    expect(opciones.headers['Content-Type']).toBe('application/json');
  });
});

// Alcance ampliado por el delineante: eran CUATRO llamadas con el mismo defecto.
// Un caso por cada una, con el token caducado, porque cada una tiene su forma:
// dos mandan `FormData`, una manda JSON, y otra devuelve además un `message` que
// la pantalla pinta.
describe('las otras tres que tenían el mismo defecto', () => {
  it('cambiar el avatar termina, y devuelve la URL nueva', async () => {
    global.fetch
      .mockResolvedValueOnce(respuesta(401, { error: 'token expirado' }))
      .mockResolvedValueOnce(respuesta(200, { token: 'token-nuevo' }))
      .mockResolvedValueOnce(respuesta(200, { data: { avatarUrl: '/avatars/yo.png?v=2' } }));

    await expect(api.uploadAvatar(FICHERO)).resolves.toBe('/avatars/yo.png?v=2');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('cambiar la portada de un espacio termina, y devuelve la URL nueva', async () => {
    global.fetch
      .mockResolvedValueOnce(respuesta(401, { error: 'token expirado' }))
      .mockResolvedValueOnce(respuesta(200, { token: 'token-nuevo' }))
      .mockResolvedValueOnce(respuesta(200, { data: { coverUrl: '/covers/ws.png?v=2' } }));

    await expect(api.uploadWorkspaceCover('ws-1', FICHERO)).resolves.toBe('/covers/ws.png?v=2');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  // La que más pesa: desde que se retiró el registro público (`6df9d529`), ésta
  // es la única puerta de altas que queda.
  it('invitar a una persona termina — Y NO SE COME EL MENSAJE que la pantalla pinta', async () => {
    global.fetch
      .mockResolvedValueOnce(respuesta(401, { error: 'token expirado' }))
      .mockResolvedValueOnce(respuesta(200, { token: 'token-nuevo' }))
      .mockResolvedValueOnce(respuesta(200, {
        data: { id: 'u-2', email: 'nueva@aglaya.biz' },
        message: 'Invitación enviada a nueva@aglaya.biz',
      }));

    const res = await api.inviteUser({ email: 'nueva@aglaya.biz', name: 'Nueva', role: 'colaborador' });

    expect(res.data).toEqual({ id: 'u-2', email: 'nueva@aglaya.biz' });
    // `AdminPage.jsx:190-193` lo enseña en un aviso: perderlo dejaría a quien
    // invita sin saber si la invitación salió.
    expect(res.message).toBe('Invitación enviada a nueva@aglaya.biz');
  });

  it('y entrar tampoco se rompió al mover login al envoltorio', async () => {
    global.fetch.mockResolvedValueOnce(respuesta(200, { token: 't', user: { id: 'u-1' } }));

    await expect(api.login({ email: 'x@aglaya.biz', password: 'x' })).resolves.toEqual({
      token: 't', user: { id: 'u-1' },
    });
  });
});

describe('y el fallo de verdad sigue viéndose', () => {
  it('un fichero rechazado por el servidor llega como error, con su motivo', async () => {
    global.fetch.mockResolvedValueOnce(respuesta(400, { error: 'FILE_TYPE_NOT_ALLOWED' }));

    await expect(api.uploadFile(FICHERO)).rejects.toThrow('FILE_TYPE_NOT_ALLOWED');
  });

  it('y si el refresco tampoco vale, no se reintenta para siempre', async () => {
    global.fetch
      .mockResolvedValueOnce(respuesta(401, { error: 'token expirado' }))
      .mockResolvedValueOnce(respuesta(401, { error: 'refresh inválido' }))  // el refresco falla
      .mockResolvedValue(respuesta(401, { error: 'token expirado' }));

    await expect(api.uploadFile(FICHERO)).rejects.toThrow(/token expirado/);
    // Dos llamadas: la subida y el refresco fallido. Sin tercera.
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
