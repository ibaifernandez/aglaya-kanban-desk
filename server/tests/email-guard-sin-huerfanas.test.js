/**
 * Ninguna declaración `sha256` de `email-guard` sobrevive a la dirección que la justificaba.
 * Tarjeta `dc93d7f3`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ DEFECTO CIERRA
 *
 * `scripts/email-guard.allowed` autorizaba por `sha256` el gmail personal del
 * Operador «en docs/INCIDENTS.md». Esa aparición se redactó en `9dbfbd0d`, y la
 * declaración **se quedó huérfana**: no protegía ninguna aparición legítima, y
 * dejaba pasar esa dirección **en verde** si alguien la volvía a escribir.
 *
 * Una declaración es una PUERTA ABIERTA. Mientras justifica una dirección que
 * existe, es una decisión; cuando la dirección se va, es una puerta sin motivo.
 *
 * POR QUÉ ESTA PRUEBA NO NOMBRA LA HUELLA DEL GMAIL
 *
 * Lo inmediato era fijar «esta huella concreta no puede volver». Eso obligaba a
 * copiar la huella del correo personal del Operador a un fichero nuevo de un
 * repositorio público — lo contrario de lo que se retiraba. Esta prueba no
 * necesita saber de quién es ninguna declaración: **exige que cada una tenga, hoy,
 * al menos una dirección en el árbol que la use**.
 *
 * LO QUE NO CUBRE, dicho: las declaraciones por `dominio`. Un dominio de ejemplo
 * sin uso no abre nada peligroso —`example.com` es de nadie—, y exigirles uso
 * convertiría esto en un rojo por limpieza. Tampoco impide declarar una dirección
 * JUNTO con una aparición nueva: eso es el camino legítimo, y lo juzga quien revisa.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');
const ALLOWED = path.join(RAIZ, 'scripts', 'email-guard.allowed');

// La misma forma de dirección y los mismos ficheros excluidos que el guardián:
// dos criterios distintos darían dos respuestas distintas.
const PATRON = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LOCKFILES = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']);

function huellasEnElArbol() {
  const ficheros = execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter(Boolean);
  const huellas = new Set();
  for (const f of ficheros) {
    if (LOCKFILES.has(path.basename(f))) continue;
    let texto;
    try { texto = fs.readFileSync(path.join(RAIZ, f), 'utf8'); } catch { continue; }
    for (const d of texto.match(PATRON) || []) {
      huellas.add(crypto.createHash('sha256').update(d.toLowerCase()).digest('hex'));
    }
  }
  return huellas;
}

function declaracionesSha256() {
  return fs.readFileSync(ALLOWED, 'utf8').split('\n')
    .map((l) => l.split('#', 1)[0].trim().split(/\s+/))
    .filter(([clase, valor]) => clase === 'sha256' && valor);
}

describe('email-guard no guarda declaraciones huérfanas', () => {
  it('cada declaración sha256 tiene al menos una dirección en el árbol que la use', () => {
    const enArbol = huellasEnElArbol();
    const huerfanas = declaracionesSha256()
      .map(([, h]) => h.toLowerCase())
      .filter((h) => !enArbol.has(h))
      // Solo el prefijo en el mensaje: suficiente para encontrarla, sin repetir la huella entera.
      .map((h) => `${h.slice(0, 12)}…`);

    expect(huerfanas).toEqual([]);
  });

  // ⚠️ La contraparte: sin ella, lo de arriba pasaría con un fichero vacío, una
  // ruta mal escrita o un árbol que no se leyera. Exige que haya al menos una
  // declaración y que esté en uso de verdad.
  it('y se están leyendo declaraciones reales, con al menos una en uso', () => {
    const decls = declaracionesSha256();
    const enArbol = huellasEnElArbol();

    expect(decls.length).toBeGreaterThan(0);
    expect(decls.some(([, h]) => enArbol.has(h.toLowerCase()))).toBe(true);
  });
});
