/**
 * El historial de descripciones no se declara borrable por quien lo genera.
 *
 * POR QUÉ ESTA PRUEBA EXISTE Y NO UN GUARDIÁN. Lo que de verdad hay que vigilar
 * —los privilegios de `authenticated` sobre `card_description_history` en la
 * base viva— hoy NO se puede vigilar sin nacer rojo: la base conserva `UPDATE` y
 * `DELETE` hasta que el Operador aplique
 * `docs/schema/migration-historial-append-only.sql`. Y en esta casa un guardián
 * que nace rojo se normaliza hasta que deja de mirarse.
 *
 * Lo que sí puede estrenar verde hoy es la DECLARACIÓN, y no es un premio de
 * consolación: **la vía de regresión real es documental**. El bloque de GRANTs
 * del esquema recorre todas las tablas de `public` y concede escritura a
 * `authenticated`; la única razón de que esta tabla se salve es una condición
 * `<>` dentro de ese bucle. Quien la borre —o quien vuelva a meter la tabla en
 * el bucle— reabre el agujero con una línea, y el recorte aplicado a la base
 * quedaría deshecho la próxima vez que alguien corra el esquema. Eso es
 * exactamente lo que avisaba `migration-card-description-history.sql`: «una
 * protección que un bloque documentado retira es una protección que no está pero
 * lo parece».
 *
 * LO QUE ESTA PRUEBA NO COMPRUEBA, y hay que decirlo porque su verde se leerá
 * como más de lo que es:
 *
 *   · **No mira la base.** Que el fichero lo declare no significa que esté
 *     aplicado. Mientras la migración esté pendiente, esto está verde y la base
 *     sigue abierta. La comprobación contra el servidor va escrita dentro de la
 *     propia migración, con `aclexplode`, y la ejecuta quien no la aplicó.
 *   · **No comprueba la RLS.** Hoy la política de SELECT es la única que hay, y
 *     es lo que hace que el privilegio no alcance nada. Si mañana aparece una
 *     política de escritura, esto sigue verde.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const ESQUEMA = path.join(RAIZ, 'docs', 'schema', 'supabase-schema.sql');
const MIGRACION = path.join(RAIZ, 'docs', 'schema', 'migration-historial-append-only.sql');
const TABLA = 'card_description_history';

/** Quita los comentarios de línea: lo que se declara es el SQL, no la prosa. */
const soloSql = (texto) =>
  texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');

describe('el historial de descripciones se declara append-only para authenticated', () => {
  const esquema = soloSql(fs.readFileSync(ESQUEMA, 'utf8'));

  test('el bucle de GRANTs del esquema excluye la tabla de historial', () => {
    // El bucle concede `UPDATE, DELETE` a `authenticated` sobre toda tabla que
    // recorra. La condición que la deja fuera es la protección entera.
    const bucle = esquema.match(/FOR t IN SELECT tablename FROM pg_tables[\s\S]*?LOOP/);
    expect(bucle).not.toBeNull();
    expect(bucle[0]).toMatch(new RegExp(`tablename\\s*<>\\s*'${TABLA}'`));
  });

  test('el esquema le concede a authenticated SELECT e INSERT, y nada más', () => {
    const linea = esquema
      .split('\n')
      .find((l) => /GRANT/.test(l) && l.includes(TABLA) && /TO authenticated/.test(l));

    expect(linea).toBeDefined();

    const privilegios = linea
      .slice(linea.indexOf('GRANT') + 'GRANT'.length, linea.indexOf(' ON '))
      .split(',')
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean)
      .sort();

    expect(privilegios).toEqual(['INSERT', 'SELECT']);
  });

  test('ninguna línea del esquema le da UPDATE o DELETE a authenticated sobre el historial', () => {
    // La red de seguridad de las dos pruebas de arriba: da igual por qué forma
    // vuelva a entrar —otro bucle, otra línea suelta, otro orden—, si aparece se
    // ve aquí.
    const culpables = esquema
      .split('\n')
      .filter(
        (l) =>
          /GRANT/.test(l) &&
          l.includes(TABLA) &&
          /TO [^;]*authenticated/.test(l) &&
          /\bUPDATE\b|\bDELETE\b/.test(l.slice(0, l.indexOf(' ON ')))
      );

    expect(culpables).toEqual([]);
  });

  test('service_role conserva la escritura completa: la poda futura sigue siendo posible', () => {
    const linea = esquema
      .split('\n')
      .find((l) => /GRANT/.test(l) && l.includes(TABLA) && /TO service_role/.test(l));

    expect(linea).toBeDefined();
    expect(linea).toMatch(/UPDATE/);
    expect(linea).toMatch(/DELETE/);
  });

  test('existe la migración que lo aplica, y retira UPDATE y DELETE', () => {
    expect(fs.existsSync(MIGRACION)).toBe(true);

    const migracion = soloSql(fs.readFileSync(MIGRACION, 'utf8'));
    const revoke = migracion
      .split('\n')
      .find((l) => /REVOKE/.test(l) && l.includes(TABLA) && /FROM authenticated/.test(l));

    expect(revoke).toBeDefined();
    expect(revoke).toMatch(/UPDATE/);
    expect(revoke).toMatch(/DELETE/);
  });

  test('la migración lleva dentro la consulta con la que se comprueba después', () => {
    // Sin esto, «aplicada» sería una afirmación de quien la aplicó. La consulta
    // va en comentario a propósito: es para quien mide, no para ejecutarse sola.
    //
    // Se exige la CONSULTA, no la palabra `aclexplode` suelta. Comprobado por
    // mutación: la palabra aparece dos veces en el fichero —una en la medición
    // que lo motivó y otra en la consulta—, así que buscarla se puede satisfacer
    // sin que la consulta exista. Un test que se contenta con la palabra mide la
    // prosa, no el procedimiento.
    const crudo = fs.readFileSync(MIGRACION, 'utf8');

    // Se exigen PIEZAS CONCRETAS, cada una en su línea, y no un patrón con
    // comodines sobre el fichero entero. Comprobado por mutación: un
    // `SELECT[\s\S]*aclexplode[\s\S]*card_description_history` daba verde con la
    // consulta BORRADA, porque casaba el `SELECT` de un `GRANT SELECT`, el
    // `aclexplode` de la prosa de la cabecera y el nombre de la tabla de
    // cualquier otra línea. Un comodín que cruza todo el fichero no comprueba
    // que algo exista: comprueba que sus letras existan en alguna parte.
    const piezas = [
      /SELECT\s+grantee/,                        // qué se pregunta
      /aclexplode\(\s*c\.relacl\s*\)/,           // por dónde se mira: la ACL de verdad
      /relname\s*=\s*'card_description_history'/, // sobre qué tabla
      /GROUP BY grantee/,                        // agrupado por rol, que es como se lee
    ];
    for (const pieza of piezas) {
      expect(crudo.split('\n').some((l) => pieza.test(l))).toBe(true);
    }

    // Los tres roles cuyo resultado hay que leer tienen que estar nombrados: una
    // consulta que solo mire `authenticated` no detecta que se recortó de más.
    for (const rol of ['anon', 'authenticated', 'service_role']) {
      expect(crudo).toMatch(new RegExp(`'${rol}'`));
    }
  });
});
