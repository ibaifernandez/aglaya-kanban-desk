/**
 * almacen-adjuntos.js — dónde viven los adjuntos. Tarjeta `4f4e6e2b`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ DEFECTO CIERRA, Y NO ES PREVENCIÓN
 *
 * Los adjuntos se guardaban en `server/uploads`, o sea, **en el disco del
 * contenedor**. Railway no tiene volumen montado en este servicio (medido el
 * 24-sep-2026: `volumes: []`), así que cada despliegue arranca un contenedor
 * nuevo y vacío — y esta nave despliega en cada empujón a `main`.
 *
 * No era un riesgo futuro: **ya había pasado**. Los cinco adjuntos que la base
 * tenía registrados daban `404` en producción, incluido el informe preliminar de
 * la auditoría Ley 21.719. La copia diaria no los cubría: `db-backup.yml` solo
 * vuelca la base.
 *
 * Y era silencioso, que es lo peor: la tarjeta seguía enseñando el nombre del
 * fichero, así que el enlace fingía funcionar hasta que alguien lo pulsaba.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DÓNDE VIVEN AHORA
 *
 * En Cloudflare R2 (S3-compatible), que ya estaba en la casa para las copias de
 * la base. El bucket **no es público**: los ficheros los sirve este servidor, que
 * es lo que permite seguir aplicando las capas anti-XSS de `routes/uploads.js`.
 *
 * ⚠️ EL TOKEN ES «Object Read & Write» ACOTADO AL BUCKET: no puede crear ni
 * borrar buckets. Nada de este código intenta crearlo; si el bucket no existe,
 * la subida falla y se ve, que es lo correcto.
 *
 * ⚠️ Y LOS ADJUNTOS SIGUEN FUERA DE LA COPIA DIARIA. Es decisión del Operador,
 * escrita en la tarjeta: R2 los hace sobrevivir a los despliegues, no los hace
 * respaldados. Quien lea esto y necesite una copia, que no la dé por hecha.
 *
 * Las costuras (`cliente`, `bucket`) existen para poder medir esto sin red.
 */
'use strict';

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

let clientePorDefecto = null;

function configurado() {
  return Boolean(
    process.env.R2_ENDPOINT
    && process.env.R2_BUCKET
    && process.env.R2_ACCESS_KEY_ID
    && process.env.R2_SECRET_ACCESS_KEY,
  );
}

function clienteR2() {
  if (clientePorDefecto) return clientePorDefecto;
  clientePorDefecto = new S3Client({
    region: 'auto',                       // R2 no usa regiones; 'auto' es lo que documenta Cloudflare
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return clientePorDefecto;
}

function crearAlmacen({ cliente = null, bucket = process.env.R2_BUCKET } = {}) {
  const s3 = () => cliente || clienteR2();

  return {
    configurado,

    async guardar({ clave, cuerpo, tipo }) {
      await s3().send(new PutObjectCommand({
        Bucket: bucket,
        Key: clave,
        Body: cuerpo,
        ContentType: tipo,
      }));
    },

    /**
     * Devuelve `{ cuerpo, tipo, tamano }`, o `null` si el objeto NO ESTÁ.
     *
     * La distinción importa: «no está» se contesta al usuario como un adjunto
     * perdido, con su explicación; cualquier otro fallo —R2 caído, credencial
     * mala— **se propaga**, porque decirle «perdido» a alguien cuando lo que
     * pasa es que el almacén no contesta es mentirle sobre su trabajo.
     */
    async leer(clave) {
      try {
        const r = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: clave }));
        return { cuerpo: r.Body, tipo: r.ContentType, tamano: r.ContentLength };
      } catch (err) {
        const codigo = err?.name || err?.Code;
        const estado = err?.$metadata?.httpStatusCode;
        if (codigo === 'NoSuchKey' || codigo === 'NotFound' || estado === 404) return null;
        throw err;
      }
    },

    async borrar(clave) {
      await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: clave }));
    },
  };
}

module.exports = { crearAlmacen, configurado };
