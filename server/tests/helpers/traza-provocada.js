/**
 * Provoca un error dentro de una petición real con Sentry activo, y escribe por
 * stdout lo que el SDK habría enviado. Lo lanza `server/tests/sentry-recorte.test.js`.
 *
 * ⚠️ POR QUÉ ES UN PROCESO APARTE Y NO CÓDIGO DENTRO DE LA PRUEBA
 *
 * Sentry instrumenta el módulo `http` enganchándose a `require`, y **bajo jest ese
 * enganche no llega**: jest carga los módulos con su propio sistema. Medido: con
 * la provocación dentro de jest, la query de las peticiones SALIENTES no llegaba
 * nunca a Sentry — **ni con el recorte ni sin él** — así que ese caso pasaba por
 * ausencia. En un `node` normal sí llegaba sin recorte. Por eso esto corre fuera.
 *
 * Las sondas se construyen en tiempo de ejecución: Sentry manda líneas de código
 * fuente de cada marco de la pila, y una sonda literal aparecería como código.
 */
'use strict';

const http = require('http');
const zlib = require('zlib');
const path = require('path');

const S = (nombre) => ['SONDA', nombre].join('-');
const SERVER = path.join(__dirname, '..', '..');

const sobres = [];
const receptor = http.createServer((req, res) => {
  const trozos = [];
  req.on('data', (c) => trozos.push(c));
  req.on('end', () => {
    let buf = Buffer.concat(trozos);
    if (req.headers['content-encoding'] === 'gzip') buf = zlib.gunzipSync(buf);
    sobres.push(buf.toString('utf8'));
    res.writeHead(200); res.end('{}');
  });
});

receptor.listen(0, async () => {
  const puerto = receptor.address().port;
  const salir = (obj) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(obj)}\n`); process.exit(0); };

  try {
    process.env.SENTRY_DSN = `http://clavepublica@127.0.0.1:${puerto}/1`;

    const { Sentry, enabled } = require(path.join(SERVER, 'utils', 'sentry'));
    if (!enabled) return salir({ error: 'el SDK no se inicializó' });

    const app = require(path.join(SERVER, 'app'));
    const express = require('express');
    const request = require('supertest');

    const r = express.Router();
    r.post('/__revienta', async (_req, _res, next) => {
      await new Promise((ok) => http.get(
        `http://127.0.0.1:${puerto}/rest/v1/users?email=eq.${S('SALIENTE')}`,
        (s) => { s.resume(); s.on('end', ok); },
      ).on('error', ok));
      next(new Error('fallo provocado a proposito'));
    });
    app.use(r);
    const pila = app._router.stack;
    const capa = pila.pop();
    const i404 = pila.findIndex((l) => l.handle && /Ruta no encontrada/.test(l.handle.toString()));
    if (i404 < 0) return salir({ error: 'no encuentro el manejador 404' });
    pila.splice(i404, 0, capa);

    const res = await request(app)
      .post(`/__revienta?busqueda=${S('QUERY')}`)
      .set('Cookie', `refresco=${S('GALLETA')}`)
      .set('User-Agent', `${S('AGENTE')}/1.0`)
      .send({ title: S('TITULO'), description: S('DESCRIPCION') });

    await Sentry.flush(3000);
    receptor.close();
    salir({ status: res.status, sobres: sobres.length, texto: sobres.join('\n') });
  } catch (e) {
    salir({ error: String(e && e.stack || e) });
  }
});
