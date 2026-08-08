/**
 * El verde de un guardián que pregunta FUERA del repositorio va fechado.
 *
 * QUÉ CIERRA. Los invariantes de esta casa —«la aprobación pertenece al commit»,
 * «el verde tiene que ser del commit que se va a mergear»— valen **mientras lo
 * medido esté DENTRO del commit**. Un guardián que consulta la base de datos
 * rompe ese supuesto: **su verde caduca sin que cambie una línea de código, y
 * nadie se entera**.
 *
 * Medido el 8-ago-2026 sobre el MISMO commit y el mismo esquema: `10:15:10Z`
 * verde, `10:23:09Z` rojo. Lo único que cambió en esos ocho minutos fue la base.
 *
 * QUÉ VIGILA ESTA PRUEBA, y por qué es una regla y no una lista. No lleva
 * escritos los nombres de los guardianes: **los deriva**. Un guardián «pregunta
 * fuera» si construye una conexión a la base (`conn="${DATABASE_URL:-}"`), y eso
 * se lee del propio script. Una lista escrita a mano estaría completa el día que
 * se escribe — y el guardián que se añada mañana no aparecería en ella.
 *
 * Lo que exige a cada uno de los derivados:
 *
 *   1. que **imprima su verde fechado**, con la fórmula que dice qué significa;
 *   2. que su cabecera **declare qué significa su verde y qué no**;
 *   3. que su cabecera **declare la ventana de aplicar-antes-de-mergear**, para
 *      que ese rojo no se descubra cada vez.
 *
 * LO QUE **NO** COMPRUEBA, y hay que decirlo porque su verde se leerá como más:
 *
 *   · **No comprueba que la fecha sea correcta**, solo que se imprima. Una fecha
 *     falsa pasaría. Lo que cierra es la ausencia, que es el caso real.
 *   · **No obliga a nadie a leerla.** Quien mergea sigue teniendo que volver a
 *     mirar; el guardián no sabe cuándo se mergea y no puede medir por él. Esto
 *     cierra la mitad que sí es del repositorio: que su verde **no se pueda
 *     confundir** con una propiedad del commit.
 *   · **No cubre los guardianes que viven en otra rama.** `schema-drift-guard`
 *     (PR #43) pregunta a la misma base y tendrá que adoptar esto al entrar;
 *     mientras no esté en `main`, esta prueba no lo ve. Queda dicho aquí porque
 *     un hueco declarado es distinto de uno olvidado.
 */

const fs = require('fs');
const path = require('path');

const SCRIPTS = path.join(__dirname, '..', '..', 'scripts');

/** Un guardián «pregunta fuera» si construye una conexión a la base. */
const preguntanFuera = () =>
  fs
    .readdirSync(SCRIPTS)
    .filter((f) => f.endsWith('.sh') && !f.endsWith('.test.sh') && !f.endsWith('.mutation.sh'))
    .filter((f) => /conn="\$\{DATABASE_URL:-\}"/.test(fs.readFileSync(path.join(SCRIPTS, f), 'utf8')));

describe('los guardianes que preguntan fuera del repo fechan su verde', () => {
  const guardianes = preguntanFuera();

  test('se deriva al menos uno — si no, la regla dejó de reconocerlos', () => {
    // Sin esto, cambiar la forma de construir la conexión dejaría la lista vacía
    // y las pruebas de abajo pasarían sin comprobar nada. Un `describe` sobre
    // cero elementos es verde y no mide.
    expect(guardianes.length).toBeGreaterThan(0);
  });

  test('la regla no se deja fuera a ninguno que EJECUTE psql', () => {
    // La comprobación de arriba no basta y lo sé por mutación: con dos
    // guardianes derivados, cambiar la forma de la conexión en UNO lo saca de la
    // lista y el otro mantiene el `length > 0` en verde. El guardián dejaría de
    // estar vigilado **en silencio**, que es justo la avería que este repo
    // persigue.
    //
    // Se cruza con una señal INDEPENDIENTE: quien ejecuta `psql "…"` pregunta
    // fuera, lo diga como lo diga. Si las dos señales dejan de coincidir, es que
    // una de las dos se rompió — y eso es rojo, no un detalle.
    const ejecutanPsql = fs
      .readdirSync(SCRIPTS)
      .filter((f) => f.endsWith('.sh') && !f.endsWith('.test.sh') && !f.endsWith('.mutation.sh'))
      .filter((f) => /psql "/.test(fs.readFileSync(path.join(SCRIPTS, f), 'utf8')));

    expect(ejecutanPsql.length).toBeGreaterThan(0);
    for (const f of ejecutanPsql) {
      expect(guardianes).toContain(f);
    }
  });

  describe.each(preguntanFuera())('%s', (fichero) => {
    const src = fs.readFileSync(path.join(SCRIPTS, fichero), 'utf8');

    test('imprime su verde FECHADO, con la fórmula que dice qué significa', () => {
      // Se mira una VENTANA alrededor del marcador, no una línea suelta: en
      // `grants-guard` la frase va partida en dos líneas de Python, y exigirla
      // en una sola la daba por ausente estando puesta. La ventana es corta a
      // propósito —200 caracteres— para que no case con letras de sitios sin
      // relación, que es el fallo que ya pagué en otra tarjeta con un comodín
      // sobre el fichero entero.
      const i = src.indexOf('[medido ');
      expect(i).toBeGreaterThan(-1);
      const ventana = src.slice(i, i + 200);

      // Las tres piezas, por separado: el instante, la fuente, y la negación.
      expect(ventana).toMatch(/contra la base real/);
      expect(ventana).toMatch(/este verde es de ese instante/);
      expect(ventana).toMatch(/no una propiedad del commit/);
    });

    test('su cabecera declara qué significa su verde y qué NO', () => {
      const cabecera = src.split('\nset -').shift();
      expect(cabecera).toMatch(/QUÉ SIGNIFICA SU VERDE/);
      expect(cabecera).toMatch(/caduca sin que cambie una línea/);
    });

    test('su cabecera declara la ventana de aplicar-antes-de-mergear', () => {
      // Es el rojo legítimo que más se confunde con un defecto. Declararlo donde
      // se lee es la condición 3 de la tarjeta.
      const cabecera = src.split('\nset -').shift();
      expect(cabecera).toMatch(/APLICAR ANTES DE MERGEAR/);
      expect(cabecera).toMatch(/rojo con razón|rojo se cierra mergeando/);
    });
  });
});
