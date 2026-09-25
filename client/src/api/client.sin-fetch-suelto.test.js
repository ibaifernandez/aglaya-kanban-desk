// client.sin-fetch-suelto.test.js — la REGLA, no los cuatro nombres.
// Tarjeta `48946335`, alcance ampliado por el delineante.
//
// POR QUÉ UNA REGLA Y NO CUATRO CASOS. Esta tarjeta nació por una llamada que se
// saltaba el envoltorio; el vigilante encontró dos más y yo una cuarta. Un caso
// por nombre cierra las cuatro de hoy y deja abierta la quinta que alguien
// escriba mañana — y esa quinta nacerá igual de rota, porque nada se lo dirá.
//
// Así que lo que se fija es la propiedad: **en este fichero, solo el envoltorio
// habla con la red.** Quien escriba `fetch(` fuera de él se encuentra esto en
// rojo y tiene que explicarse.
//
// ⚠️ Y su límite, dicho: mira el FUENTE, no lo que ocurre en ejecución. Una
// llamada que construya su petición de otra forma —`XMLHttpRequest`, una
// biblioteca nueva— pasaría por aquí. Lo que cierra es la repetición del camino
// que ya se pagó cuatro veces.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FUENTE = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8');

// Sin comentarios: el fichero EXPLICA el defecto citando `fetch` a pelo, y esa
// prosa no es una llamada. Contarla sería el mismo error que ya cometí en la
// prueba de la política, que daba por bueno un comentario como si fuera código.
const CODIGO = FUENTE
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

describe('solo el envoltorio habla con la red', () => {
  it('no hay más de dos llamadas a fetch, y son las del propio envoltorio', () => {
    const llamadas = [...CODIGO.matchAll(/\bfetch\s*\(/g)];

    expect(llamadas).toHaveLength(2);

    // Y están donde deben: una en el refresco del token, otra en el envoltorio.
    const refresco = CODIGO.indexOf('async function refreshAccessToken');
    const envoltorio = CODIGO.indexOf('async function fetchWithAuth');
    const fin = CODIGO.indexOf('export const api');
    for (const { index } of llamadas) {
      expect(index).toBeGreaterThan(Math.min(refresco, envoltorio));
      expect(index).toBeLessThan(fin);
    }
  });

  it('y ninguna función del objeto `api` construye su petición por su cuenta', () => {
    const api = CODIGO.slice(CODIGO.indexOf('export const api'));

    expect(api).not.toMatch(/\bfetch\s*\(/);
    // `Authorization` a mano era la señal de la avería: significaba que esa
    // llamada se estaba fabricando su propia sesión.
    expect(api).not.toMatch(/Authorization/);
  });
});
