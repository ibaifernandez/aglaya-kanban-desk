/**
 * Portadas y avatares: la URL debe cambiar en cada subida.
 *
 * Bug reportado por Ibai (2026-07-22): «no puedo actualizar las imágenes
 * ilustrativas de los workspaces una vez puestas por primera vez».
 *
 * Causa: la ruta en Storage es determinista (`workspace-covers/<id><ext>`,
 * `avatars/<id><ext>`) y la subida usa `upsert: true`. El fichero SÍ se
 * sobrescribe — pero `getPublicUrl()` devuelve exactamente la misma URL, y
 * `cover_url` se reescribe con el mismo string. El navegador y el CDN sirven la
 * imagen cacheada, así que el usuario ve la vieja y concluye que no se guardó.
 *
 * No fallaba nada: subida OK, DB OK, respuesta 200. Otra vez la peor forma de
 * fallar, la que responde éxito.
 *
 * Predicción falsable que confirmó el diagnóstico: subir la MISMA imagen con
 * otra extensión (.jpg → .png) sí funcionaba, porque cambia la ruta y por tanto
 * la URL.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

const BASE = 'https://x.supabase.co/storage/v1/object/public/media';

jest.mock('../utils/supabase', () => {
  const chain = {
    update: () => chain,
    eq:     () => Promise.resolve({ error: null }),
  };
  return {
    supabaseAdmin: {
      from: () => chain,
      storage: {
        from: () => ({
          upload:       () => Promise.resolve({ error: null }),
          getPublicUrl: (p) => ({
            data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/media/${p}` },
          }),
        }),
      },
    },
    createAdminClient:  jest.fn(),
    createPublicClient: jest.fn(),
  };
});

const app = require('../app');
const { withCacheBuster } = require('../utils/mediaUrl');

const token = jwt.sign(
  { id: 'user-1', email: 'test@aglaya.is', role: 'admin', organizationId: 'org-1' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]);

const uploadAvatar = () =>
  request(app)
    .post('/api/media/users/me/avatar')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', PNG, 'foto.png');

describe('withCacheBuster', () => {
  it('añade un parámetro de versión a una URL desnuda', () => {
    expect(withCacheBuster(`${BASE}/avatars/u1.png`)).toMatch(/\?v=\d+/);
  });

  it('conserva la URL base intacta', () => {
    const url = withCacheBuster(`${BASE}/avatars/u1.png`);
    expect(url.split('?')[0]).toBe(`${BASE}/avatars/u1.png`);
  });

  it('devuelve una URL distinta en llamadas sucesivas', () => {
    const a = withCacheBuster(`${BASE}/avatars/u1.png`, 1000);
    const b = withCacheBuster(`${BASE}/avatars/u1.png`, 2000);
    expect(a).not.toBe(b);
  });

  it('no duplica el separador si la URL ya trae query', () => {
    const url = withCacheBuster(`${BASE}/a.png?token=abc`, 1234);
    expect(url).toBe(`${BASE}/a.png?token=abc&v=1234`);
    expect((url.match(/\?/g) || []).length).toBe(1);
  });

  it('tolera valores vacíos sin romper', () => {
    expect(withCacheBuster('')).toBe('');
    expect(withCacheBuster(null)).toBe(null);
  });
});

describe('POST /api/media/users/me/avatar', () => {
  it('la URL devuelta lleva rompe-caché', async () => {
    const res = await uploadAvatar();
    expect(res.status).toBe(200);
    expect(res.body.data.avatarUrl).toMatch(/\?v=\d+/);
  });

  it('dos subidas seguidas devuelven URLs distintas (el síntoma del bug)', async () => {
    const a = await uploadAvatar();
    await new Promise((r) => setTimeout(r, 5));
    const b = await uploadAvatar();
    expect(a.body.data.avatarUrl).not.toBe(b.body.data.avatarUrl);
  });
});
