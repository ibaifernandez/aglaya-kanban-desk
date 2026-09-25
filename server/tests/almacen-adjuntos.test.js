// almacen-adjuntos.test.js — qué cuenta como «el adjunto no está», y qué no.
// Tarjeta `4f4e6e2b`, devolución del vigilante.
//
// POR QUÉ ESTE FICHERO EXISTE APARTE. `adjuntos-que-quedan.test.js` sustituye el
// almacén entero por un doble, así que **no ejecuta ni una línea de
// `almacen-adjuntos.js`**: el doble decide él mismo entre devolver `null` y
// lanzar, que es justo la decisión que aquí hay que medir. Aquí se usa el almacén
// DE VERDAD y lo que se sustituye es el cliente de S3, una capa más abajo.
//
// LO QUE SE FIJA, Y LA ASIMETRÍA QUE LO GOBIERNA. Solo «esa clave no existe» se
// traduce a ausencia. Todo lo demás se propaga y acaba en un 500:
//
//   · equivocarse hacia el 500 cuesta un susto y un vistazo a los registros;
//   · equivocarse hacia el 410 le dice a alguien que su trabajo desapareció, y
//     **calla el diagnóstico**, porque la aplicación ya dio una explicación
//     convincente.
//
// El caso que lo destapó: `NoSuchBucket` **también es un 404**. Con la versión
// anterior —que miraba `httpStatusCode === 404`—, una errata en `R2_BUCKET` hacía
// que todos los adjuntos intactos contestaran «perdido». Lo encontró el
// vigilante, no esta batería.
'use strict';

const { crearAlmacen } = require('../utils/almacen-adjuntos');

function fallo(nombre, estado) {
  const err = new Error(nombre);
  err.name = nombre;
  err.$metadata = { httpStatusCode: estado };
  return err;
}

function almacenQueFalla(err) {
  return crearAlmacen({
    bucket: 'bucket-de-mentira',
    cliente: { send: async () => { throw err; } },
  });
}

describe('leer(): solo la clave ausente significa «no está»', () => {
  it('NoSuchKey → null, que la ruta traduce a «adjunto perdido»', async () => {
    await expect(almacenQueFalla(fallo('NoSuchKey', 404)).leer('x.png')).resolves.toBeNull();
  });

  it('NotFound → null (el nombre que usa HeadObject)', async () => {
    await expect(almacenQueFalla(fallo('NotFound', 404)).leer('x.png')).resolves.toBeNull();
  });

  // El corazón de la devolución.
  it('NoSuchBucket NO es «no está», aunque sea un 404: propaga', async () => {
    await expect(almacenQueFalla(fallo('NoSuchBucket', 404)).leer('x.png')).rejects.toThrow('NoSuchBucket');
  });

  it('un 404 sin nombre de clave tampoco: propaga', async () => {
    await expect(almacenQueFalla(fallo('AlgoRaro', 404)).leer('x.png')).rejects.toThrow('AlgoRaro');
  });

  it.each([
    ['AccessDenied', 403],
    ['ServiceUnavailable', 503],
    ['InternalError', 500],
  ])('%s (%i) propaga: credencial o almacén no son ausencia', async (nombre, estado) => {
    await expect(almacenQueFalla(fallo(nombre, estado)).leer('x.png')).rejects.toThrow(nombre);
  });

  it('un fallo de red propaga, aunque no traiga metadatos', async () => {
    const err = new Error('getaddrinfo ENOTFOUND');
    err.code = 'ENOTFOUND';
    await expect(almacenQueFalla(err).leer('x.png')).rejects.toThrow('ENOTFOUND');
  });

  it('y cuando el objeto está, devuelve cuerpo, tipo y tamaño', async () => {
    const almacen = crearAlmacen({
      bucket: 'b',
      cliente: { send: async () => ({ Body: 'flujo', ContentType: 'image/png', ContentLength: 7 }) },
    });

    await expect(almacen.leer('x.png')).resolves.toEqual({ cuerpo: 'flujo', tipo: 'image/png', tamano: 7 });
  });
});

describe('guardar() y borrar() hablan con el bucket que se les da', () => {
  it('guardar manda la clave, el cuerpo y el tipo', async () => {
    const enviados = [];
    const almacen = crearAlmacen({ bucket: 'mi-bucket', cliente: { send: async (c) => { enviados.push(c.input); } } });

    await almacen.guardar({ clave: 'k.png', cuerpo: 'datos', tipo: 'image/png' });

    expect(enviados[0]).toMatchObject({ Bucket: 'mi-bucket', Key: 'k.png', Body: 'datos', ContentType: 'image/png' });
  });

  // ⚠️ Y esto es un CAMBIO DE CONTRATO que conviene tener escrito: R2 contesta
  // éxito al borrar una clave que no existe, así que `DELETE /api/uploads/<x>`
  // ya no devuelve 404 cuando el fichero no está — devuelve 200. Antes, con el
  // disco, `unlinkSync` fallaba y la ruta contestaba 404. Lo señaló el vigilante.
  it('borrar una clave ausente NO es un error: el borrado es idempotente', async () => {
    const almacen = crearAlmacen({ bucket: 'b', cliente: { send: async () => ({}) } });

    await expect(almacen.borrar('la-que-no-esta.png')).resolves.toBeUndefined();
  });
});
