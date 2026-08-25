/**
 * La nave no manda correo — y la aplicación tampoco lo ofrece.
 *
 * Decisión de Ibai, 25-ago-2026: «Cero mails». Se retiraron los dos digests,
 * su reloj, sus rutas, el envoltorio de envío y la preferencia de hora.
 *
 * POR QUÉ ESTO ES UNA PRUEBA Y NO SOLO UN BORRADO. Un borrado se deshace sin
 * ruido: basta con volver a montar el router. `scripts/correo-cero-guard.sh`
 * vigila el árbol —que no vuelva la dependencia ni el envoltorio—, pero eso mira
 * TEXTO. Esto mira la aplicación levantada: qué contesta de verdad si alguien
 * llama a las puertas que existían.
 *
 * Un 404 aquí no es «no encontrado»: es la superficie retirada.
 */
const request = require('supertest');

process.env.JWT_SECRET               = 'test-secret';
process.env.SUPABASE_URL             = 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_role';
process.env.SUPABASE_ANON_KEY        = 'test_anon_key';

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: { from: () => ({}) },
  createAdminClient: () => ({ from: () => ({}) }),
  createPublicClient: () => ({ auth: {} }),
}));

const app = require('../app');

describe('No queda superficie de correo', () => {
  // Las tres puertas que existían. Se prueban por su ruta literal a propósito:
  // si alguien remonta el router, aquí no hay nada que actualizar — se pone
  // rojo solo.
  const PUERTAS = [
    ['POST', '/api/digest/send-me',          'el digest de administrador'],
    ['POST', '/api/digest/send-my-digest',   'el digest personal desde la GUI'],
    ['POST', '/api/digest/cron-trigger',     'el disparo por reloj'],
  ];

  test.each(PUERTAS)('%s %s ya no existe (%s)', async (metodo, ruta) => {
    const res = await request(app)[metodo.toLowerCase()](ruta).send({});
    expect(res.status).toBe(404);
  });

  // Y el listado de digests, que era la puerta de lectura.
  it('GET /api/digest/logs ya no existe', async () => {
    const res = await request(app).get('/api/digest/logs');
    expect(res.status).toBe(404);
  });

  // La preferencia de hora se va con el digest: elegir hora para un correo que
  // nadie manda es una promesa falsa dentro de la GUI, no una opción inocua.
  it('PATCH /api/auth/me/preferences ya no existe', async () => {
    const res = await request(app)
      .patch('/api/auth/me/preferences')
      .send({ digestHour: 11 });
    expect(res.status).toBe(404);
  });

  // ⚠️ Lo que NO se fue, y por eso está aquí: sin este caso, «cero correo» y
  // «cero avisos» se confunden. La campana in-app es lo que hace que asignar
  // una tarjeta se note, y el contrato la declara.
  it('la superficie de notificaciones in-app sigue en pie', async () => {
    const res = await request(app).get('/api/notifications');
    // Sin token da 401 — que es exactamente la prueba de que la ruta EXISTE y
    // está protegida. Un 404 aquí significaría que se llevaron por delante los
    // avisos junto con el correo.
    expect(res.status).toBe(401);
  });
});
