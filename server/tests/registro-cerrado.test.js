// registro-cerrado.test.js — nadie se da de alta desde internet. Tarjeta `6df9d529`.
//
// Hasta el 24-sep-2026, `POST /api/auth/register` estaba montada sin sesión, aceptaba
// `role` del cuerpo y devolvía tokens: cualquiera podía crearse un `superadmin` con un
// correo `@aglaya.biz` inventado, porque el filtro de dominio solo mira lo que escribes.
//
// Lo que fija este sello no es solo que esa ruta ya no esté —eso lo cerraría un `404` y
// nada impediría que volviera con otro nombre—, sino **la propiedad**: en `/api/auth`, las
// únicas rutas sin sesión son las tres que no pueden tenerla (entrar, renovar, salir), y
// ninguna ruta pública crea cuentas. Una ruta nueva sin `requireAuth` pone esto rojo.
const fs = require('fs');
const path = require('path');
const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: { from: jest.fn(), auth: { admin: { createUser: jest.fn(), getUserById: jest.fn() }, signInWithPassword: jest.fn() } },
  createAdminClient: jest.fn(() => ({ from: jest.fn(), auth: { admin: { createUser: jest.fn() } } })),
  createPublicClient: jest.fn(() => ({ auth: { signInWithPassword: jest.fn() } })),
}));

const app = require('../app');

const RUTA_AUTH = path.join(__dirname, '..', 'routes', 'auth.js');
const fuenteAuth = fs.readFileSync(RUTA_AUTH, 'utf8');

// Cada `router.<método>('<ruta>', …` de auth.js, con lo que lleva hasta el final de la
// línea: ahí se ve si pasa por `requireAuth`.
function rutasDeAuth() {
  return [...fuenteAuth.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'([^\n]*)/g)]
    .map(([, metodo, ruta, resto]) => ({
      metodo: metodo.toUpperCase(),
      ruta,
      conSesion: resto.includes('requireAuth'),
    }));
}

describe('no hay alta de cuentas desde internet', () => {
  it('POST /api/auth/register ya no existe', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'intruso@aglaya.biz',
      password: 'password123',
      name: 'Intruso',
      role: 'superadmin',
    });

    expect(res.status).toBe(404);
    expect(res.body.token).toBeUndefined();
  });

  // La propiedad, no el caso: quien añada mañana `POST /api/auth/signup` sin sesión
  // tendrá que pasar por aquí y explicarse.
  it('en /api/auth, las únicas rutas sin sesión son login, refresh y logout', () => {
    const sinSesion = rutasDeAuth().filter((r) => !r.conSesion).map((r) => `${r.metodo} ${r.ruta}`).sort();

    expect(sinSesion).toEqual(['POST /login', 'POST /logout', 'POST /refresh']);
  });

  // Sobre el CÓDIGO, no sobre los comentarios: la primera versión de este caso
  // casaba con el comentario que explica la retirada, y con `email_confirmed_at`,
  // que /me/export lee legítimamente. Un caso que muerde su propia prosa no mide.
  it('y ninguna ruta de /api/auth crea cuentas ni da un correo por confirmado', () => {
    const codigo = fuenteAuth
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');

    expect(codigo).not.toMatch(/auth\.admin\.createUser\s*\(/);
    expect(codigo).not.toMatch(/email_confirm\s*:/);
  });

  // El alta legítima sigue existiendo y sigue cerrada: sin sesión no pasa. Que
  // funcione con sesión lo fija `admin.test.js`; lo que se comprueba aquí es que
  // retirar el registro no ha dejado la casa sin puerta de altas.
  it('el alta por invitación sigue existiendo, y exige sesión', async () => {
    const res = await request(app)
      .post('/api/admin/users/invite')
      .send({ email: 'alguien@aglaya.biz', name: 'Alguien', role: 'colaborador' });

    expect(res.status).toBe(401);
  });

  it('el router de admin exige sesión y papel para TODAS sus rutas', () => {
    const fuenteAdmin = fs.readFileSync(path.join(__dirname, '..', 'routes', 'admin.js'), 'utf8');

    expect(fuenteAdmin).toMatch(/router\.use\(requireAuth,\s*requireRole\(/);
  });
});
