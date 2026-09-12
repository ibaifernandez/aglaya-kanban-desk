/**
 * Los dominios personales del Operador no vuelven a declararse enteros. Tarjeta `9dbfbd0d`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ DEFECTO CIERRA, Y NO ES EL QUE LA TARJETA CREÍA
 *
 * La dirección personal del Operador vivía en **once ubicaciones** del árbol de
 * un repositorio público, y `email-guard` —que mira TODOS los ficheros
 * versionados— estaba **en verde**. No por un hueco de alcance: porque
 * `ibaifernandez.com` y `lfi.la` estaban **declarados como dominios enteros**,
 * con su motivo escrito («publicar su propia dirección es decisión suya y ya la
 * tomó»).
 *
 * Un `dominio` abre ese dominio **para siempre y para cualquier dirección
 * futura**. Eso es exactamente lo que pasó: cada vez que alguien escribía la
 * dirección en un documento nuevo, entraba en silencio.
 *
 * El 2026-09-12 el Operador decidió lo contrario y las dos declaraciones se
 * retiraron. **Lo que este caso impide es que vuelvan.** Sin él, una línea de
 * tres palabras en `email-guard.allowed` reabre las once ubicaciones de golpe y
 * el guardián sigue verde — que es precisamente cómo se llegó aquí.
 *
 * POR QUÉ AQUÍ Y NO EN EL SELLO DE `email-guard`. Su sello prueba la LÓGICA del
 * guardián con declaraciones de mentira, y hace bien: así no depende de lo que
 * este repositorio declare hoy. Lo que se fija aquí es otra cosa — **la decisión
 * concreta de esta casa**, que vive en su fichero de declaraciones real.
 *
 * LO QUE NO COMPRUEBA: que no haya OTRO dominio personal declarado. «Personal»
 * no se puede derivar de un nombre de dominio; lo que se puede fijar es una
 * decisión tomada, y son estas dos.
 */

const fs = require('fs');
const path = require('path');

const ALLOWED = path.join(__dirname, '..', '..', 'scripts', 'email-guard.allowed');

// Los dos dominios que estuvieron abiertos enteros hasta el 2026-09-12. El
// dominio en sí no es dato personal —está en la URL del propio repositorio—; lo
// que era dato personal es la dirección, y por eso no aparece en este fichero.
const DOMINIOS_RETIRADOS = ['ibaifernandez.com', 'lfi.la'];

/** Las declaraciones de verdad: sin comentarios y sin líneas vacías. */
function declaraciones() {
  return fs.readFileSync(ALLOWED, 'utf8')
    .split('\n')
    .map((l) => l.split('#', 1)[0].trim())
    .filter(Boolean)
    .map((l) => l.split(/\s+/));
}

describe('el fichero de declaraciones no reabre los dominios personales', () => {
  it.each(DOMINIOS_RETIRADOS)('«%s» no está declarado como dominio entero', (dominio) => {
    const abiertos = declaraciones()
      .filter(([clase]) => clase === 'dominio')
      .map(([, valor]) => valor.toLowerCase());

    expect(abiertos).not.toContain(dominio);
  });

  // ⚠️ La contraparte, y sin ella lo de arriba pasaría con el fichero vacío o
  // con la ruta mal escrita: un caso que solo comprueba ausencias se satisface
  // no leyendo nada. Esto exige que se esté leyendo el fichero correcto.
  it('y se está leyendo el fichero real, no un vacío', () => {
    const decls = declaraciones();

    expect(decls.length).toBeGreaterThan(5);
    expect(decls.map(([clase]) => clase)).toContain('dominio');
    expect(decls.map(([, valor]) => valor)).toContain('example.com');
  });
});
