// adjuntos-que-quedan.test.js — los adjuntos sobreviven al despliegue, y los que
// se perdieron lo dicen. Tarjeta `4f4e6e2b`.
//
// Contexto medido, no supuesto: hasta el 25-sep-2026 los adjuntos se escribían en
// `server/uploads`, el disco del contenedor, sin volumen montado. Los cinco que
// la base tenía registrados daban 404 en producción. Ahora van a R2.
//
// Lo que fija cada bloque:
//   · subir escribe en el almacén y NO deja el fichero temporal atrás;
//   · si el almacén falla o no está configurado, **no se contesta una URL**: una
//     tarjeta con el nombre de un fichero que no está en ninguna parte es el
//     defecto entero;
//   · pedir un adjunto que no está da **410 y explica**, no un 404 pelado que se
//     confunde con una ruta mal escrita;
//   · y un fallo del almacén NO se disfraza de «perdido»: decirle a alguien que
//     su trabajo no está, cuando lo que pasa es que R2 no contesta, es mentir.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';
process.env.R2_ENDPOINT = 'https://ejemplo.r2.cloudflarestorage.com';
process.env.R2_BUCKET = 'bucket-de-mentira';
process.env.R2_ACCESS_KEY_ID = 'llave';
process.env.R2_SECRET_ACCESS_KEY = 'secreto';

const mockAlmacen = {
  guardados: new Map(),
  fallaAlGuardar: false,
  fallaAlLeer: false,
};

jest.mock('../utils/almacen-adjuntos', () => ({
  configurado: () => true,
  crearAlmacen: () => ({
    configurado: () => process.env.R2_BUCKET !== '',
    async guardar({ clave, cuerpo, tipo }) {
      if (mockAlmacen.fallaAlGuardar) throw new Error('R2 dijo que no');
      const trozos = [];
      for await (const t of cuerpo) trozos.push(t);
      mockAlmacen.guardados.set(clave, { datos: Buffer.concat(trozos), tipo });
    },
    async leer(clave) {
      if (mockAlmacen.fallaAlLeer) throw new Error('R2 no contesta');
      const o = mockAlmacen.guardados.get(clave);
      if (!o) return null;                       // «no está» ≠ «falló»
      return { cuerpo: require('stream').Readable.from(o.datos), tipo: o.tipo, tamano: o.datos.length };
    },
    async borrar(clave) { mockAlmacen.guardados.delete(clave); },
  }),
}));

jest.mock('../utils/supabase', () => ({
  supabaseAdmin: { from: jest.fn(), auth: { admin: { getUserById: jest.fn() } } },
  createAdminClient: jest.fn(),
  createPublicClient: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.user = { id: 'u-1', role: 'admin' }; next(); },
  requireRole: () => (_req, _res, next) => next(),
  invalidateUserCache: jest.fn(),
}));

const app = require('../app');

// Un PNG de verdad: la ruta valida los magic bytes, así que un Buffer cualquiera
// se rechazaría por el motivo equivocado y el caso pasaría sin medir nada.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// Se lee DEL MÓDULO, no se recalcula: recalcularlo aquí dejaba pasar el mutante
// que devuelve el destino a `server/uploads` —el disco del contenedor, que es
// LA causa de la pérdida—, porque la prueba seguía mirando el temporal del
// sistema y no veía nada. Lo cazó una mutación, no una revisión.
const { DIR_TEMPORAL } = require('../routes/uploads');
const DIR_CONTENEDOR = path.join(__dirname, '..', 'uploads');
const temporales = () => (fs.existsSync(DIR_TEMPORAL) ? fs.readdirSync(DIR_TEMPORAL) : []);

beforeEach(() => {
  // El directorio temporal se limpia ENTRE CASOS. Sin esto, los dos casos que
  // cuentan ficheros temporales heredaban lo que dejó el anterior y podían
  // ponerse rojos por un cambio que no tenía nada que ver — pasó, mutando una
  // cabecera de otra ruta. Un caso que falla por el motivo equivocado no mide.
  for (const f of temporales()) fs.unlinkSync(path.join(DIR_TEMPORAL, f));
  mockAlmacen.guardados.clear();
  mockAlmacen.fallaAlGuardar = false;
  mockAlmacen.fallaAlLeer = false;
});

describe('subir un adjunto lo deja donde sobrevive', () => {
  it('el paso intermedio NO es el disco del contenedor', () => {
    expect(DIR_TEMPORAL.startsWith(os.tmpdir())).toBe(true);
    expect(DIR_TEMPORAL).not.toContain(path.join('server', 'uploads'));
  });

  it('y subir no escribe nada en server/uploads', async () => {
    const antes = fs.existsSync(DIR_CONTENEDOR) ? fs.readdirSync(DIR_CONTENEDOR).length : 0;

    await request(app).post('/api/uploads').attach('file', PNG, 'captura.png');

    const despues = fs.existsSync(DIR_CONTENEDOR) ? fs.readdirSync(DIR_CONTENEDOR).length : 0;
    expect(despues).toBe(antes);
  });

  it('lo guarda en el almacén y devuelve su URL', async () => {
    const res = await request(app).post('/api/uploads').attach('file', PNG, 'captura.png');

    expect(res.status).toBe(200);
    expect(res.body.data.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);
    expect(mockAlmacen.guardados.size).toBe(1);

    const [clave, guardado] = [...mockAlmacen.guardados.entries()][0];
    expect(res.body.data.url).toBe(`/uploads/${clave}`);
    expect(guardado.datos.equals(PNG)).toBe(true);   // el contenido, no solo el nombre
    expect(guardado.tipo).toBe('image/png');
  });

  it('y no deja el fichero temporal en el disco del contenedor', async () => {
    await request(app).post('/api/uploads').attach('file', PNG, 'captura.png');

    expect(temporales()).toHaveLength(0);
  });

  it('si el almacén falla, NO contesta una URL — y tampoco deja basura', async () => {
    mockAlmacen.fallaAlGuardar = true;

    const res = await request(app).post('/api/uploads').attach('file', PNG, 'captura.png');

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.data).toBeUndefined();
    expect(temporales()).toHaveLength(0);
  });
});

describe('pedir un adjunto', () => {
  it('devuelve el fichero que se subió, con su tipo', async () => {
    const subida = await request(app).post('/api/uploads').attach('file', PNG, 'captura.png');

    const res = await request(app).get(subida.body.data.url);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    // Lo pone helmet para todas las respuestas, no esta ruta. Se comprueba
    // igualmente porque el fichero llega al navegador por aquí: si alguien
    // desactiva helmet, un adjunto reinterpretado es la vía del XSS que la
    // lista de tipos permitidos existe para cerrar.
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(res.body).equals(PNG)).toBe(true);
  });

  // El corazón de la tarjeta: los cinco de antes no vuelven, pero dejan de fingir.
  it('uno que ya no está da 410 y EXPLICA qué pasó, no un 404 pelado', async () => {
    const res = await request(app).get('/uploads/320b1e2b-2ab8-410c-a238-5589bc2a6ac8.png');

    expect(res.status).toBe(410);
    expect(res.body.error).toBe('ADJUNTO_PERDIDO');
    expect(res.body.message).toMatch(/se perdieron en un despliegue/i);
  });

  it('y un fallo del almacén NO se disfraza de adjunto perdido', async () => {
    const subida = await request(app).post('/api/uploads').attach('file', PNG, 'captura.png');
    mockAlmacen.fallaAlLeer = true;

    const res = await request(app).get(subida.body.data.url);

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.status).not.toBe(410);   // «no contesta» no es «no está»
  });

  it('rechaza nombres que intentan salirse del almacén', async () => {
    const res = await request(app).get('/uploads/..%2F..%2Fetc%2Fpasswd');

    expect([400, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });
});

describe('borrar un adjunto', () => {
  it('lo quita del almacén', async () => {
    const subida = await request(app).post('/api/uploads').attach('file', PNG, 'captura.png');
    const clave = subida.body.data.url.replace('/uploads/', '');

    const res = await request(app).delete(`/api/uploads/${clave}`);

    expect(res.status).toBe(200);
    expect(mockAlmacen.guardados.has(clave)).toBe(false);
  });
});
