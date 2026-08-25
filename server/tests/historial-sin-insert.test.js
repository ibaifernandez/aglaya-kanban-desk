/**
 * El historial de descripciones deja de ser escribible por quien lo genera.
 *
 * Tarjeta `cc37dc3a`. Hermana de `historial-append-only.test.js`, que cubre
 * `UPDATE` y `DELETE`; aquí se cubre `INSERT`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ VIGILA DE VERDAD ESTE FICHERO, porque no es lo que parece
 *
 * El recorte lo hace la base, y aplicarlo es acción del Operador. Lo que se
 * puede vigilar desde aquí es **el orden entre dos cosas que tienen que viajar
 * juntas y no pueden salir a la vez**:
 *
 *   1. la migración se aplica sobre la base, y
 *   2. el esquema documentado deja de declarar `INSERT`.
 *
 * Si (2) va primero, `scripts/grants-guard.sh` —que compara EXACTO la base
 * contra el esquema— se pone rojo con razón y **se queda rojo en `main`** hasta
 * que alguien ejecute (1). Un guardián que vive en rojo se normaliza hasta que
 * deja de mirarse, y entonces se pierde el que sí avisa.
 *
 * Si (1) va primero y (2) se olvida, el esquema promete un privilegio que la
 * base ya no da: la declaración vuelve a mentir. **Que es exactamente lo que
 * pasó al lado, y por eso este fichero existe.**
 *
 * ⚠️ EL PRECEDENTE, medido el 25-ago-2026: la cabecera de
 * `migration-historial-append-only.sql` decía «PENDIENTE DE APLICAR» **diecisiete
 * días después de haberse aplicado**. Nadie mintió: se aplicó y nadie volvió al
 * fichero. Y la tarjeta `cc37dc3a` planificó su trabajo sobre esa línea —«mientras
 * no esté aplicada, las dos caben en una sola ejecución del Operador»—, así que
 * una cabecera caduca costó una decisión mal tomada.
 *
 * De ahí la prueba central de abajo: **en cuanto la cabecera diga «APLICADA», el
 * esquema tiene que haber dejado de declarar `INSERT`**. No se puede aplicar y
 * olvidar el otro lado.
 *
 * LO QUE ESTO NO COMPRUEBA, dicho antes de que su verde se lea como más:
 *
 *   · **No mira la base.** Nunca. Quien quiera saber qué concede la base mira
 *     `grants-guard` en el CI, que corre con credenciales y firma la hora.
 *   · **No comprueba la RLS.** Hoy la única política es de `SELECT`, y es eso lo
 *     que hace que el privilegio no alcance nada. Si mañana aparece una política
 *     de escritura, esto sigue verde.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const ESQUEMA = path.join(RAIZ, 'docs', 'schema', 'supabase-schema.sql');
const MIGRACION = path.join(RAIZ, 'docs', 'schema', 'migration-historial-sin-insert.sql');
const TABLA = 'card_description_history';

/** Quita los comentarios de línea: lo que se declara es el SQL, no la prosa. */
const soloSql = (texto) =>
  texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');

const crudoMigracion = () => fs.readFileSync(MIGRACION, 'utf8');

/** Los privilegios que el esquema le concede a un rol sobre la tabla. */
function privilegiosDeclarados(rol) {
  const esquema = soloSql(fs.readFileSync(ESQUEMA, 'utf8'));
  const linea = esquema
    .split('\n')
    .find((l) => /GRANT/.test(l) && l.includes(TABLA) && new RegExp(`TO ${rol}\\b`).test(l));

  if (!linea) return null;

  return linea
    .slice(linea.indexOf('GRANT') + 'GRANT'.length, linea.indexOf(' ON '))
    .split(',')
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean)
    .sort();
}

describe('la migración que retira INSERT existe y es ejecutable tal cual', () => {
  it('existe', () => {
    expect(fs.existsSync(MIGRACION)).toBe(true);
  });

  it('retira INSERT a authenticated sobre el historial', () => {
    const revoke = soloSql(crudoMigracion())
      .split('\n')
      .find((l) => /REVOKE/.test(l) && l.includes(TABLA) && /FROM authenticated/.test(l));

    expect(revoke).toBeDefined();
    expect(revoke).toMatch(/\bINSERT\b/);
  });

  it('deja a authenticated en SELECT y nada más', () => {
    const grant = soloSql(crudoMigracion())
      .split('\n')
      .find((l) => /GRANT/.test(l) && l.includes(TABLA) && /TO authenticated/.test(l));

    expect(grant).toBeDefined();
    const privs = grant
      .slice(grant.indexOf('GRANT') + 'GRANT'.length, grant.indexOf(' ON '))
      .split(',')
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);

    expect(privs).toEqual(['SELECT']);
  });

  // Sin esto, la poda futura desde el servidor deja de ser posible y el
  // historial se vuelve inmutable también para quien tiene que administrarlo.
  it('service_role conserva la escritura completa', () => {
    const grant = soloSql(crudoMigracion())
      .split('\n')
      .find((l) => /GRANT/.test(l) && l.includes(TABLA) && /TO service_role/.test(l));

    expect(grant).toBeDefined();
    expect(grant).toMatch(/INSERT/);
    expect(grant).toMatch(/UPDATE/);
    expect(grant).toMatch(/DELETE/);
  });

  // La misma exigencia que su hermana, y por el mismo motivo: sin la consulta
  // dentro, «aplicada» sería la palabra de quien la aplicó. Se piden piezas
  // concretas por línea, no un comodín sobre el fichero — un
  // `SELECT[\s\S]*aclexplode[\s\S]*tabla` da verde con la consulta borrada.
  it('lleva dentro la consulta con la que se comprueba después, y con aclexplode', () => {
    const crudo = crudoMigracion();
    const piezas = [
      /SELECT\s+grantee/,
      /aclexplode\(\s*c\.relacl\s*\)/,
      new RegExp(`relname\\s*=\\s*'${TABLA}'`),
      /GROUP BY grantee/,
    ];
    for (const pieza of piezas) {
      expect(crudo.split('\n').some((l) => pieza.test(l))).toBe(true);
    }

    // Los tres roles nombrados: una consulta que solo mire `authenticated` no
    // detecta que se recortó de más.
    for (const rol of ['anon', 'authenticated', 'service_role']) {
      expect(crudo).toMatch(new RegExp(`'${rol}'`));
    }
  });
});

describe('el orden entre aplicar y declarar no se puede olvidar', () => {
  const aplicada = () => /^--\s*✅\s*APLICADA/m.test(crudoMigracion());

  // ⚠️ ÉSTA es la prueba que justifica el fichero. Hoy pasa por la rama de
  // «pendiente»; el día que alguien aplique la migración y ponga «APLICADA» sin
  // tocar el esquema, cae.
  it('si la migración dice APLICADA, el esquema ya NO puede declarar INSERT', () => {
    const authenticated = privilegiosDeclarados('authenticated');
    expect(authenticated).not.toBeNull();

    if (aplicada()) {
      expect(authenticated).toEqual(['SELECT']);
    } else {
      // Mientras esté pendiente, la declaración tiene que seguir diciendo lo que
      // la base da de verdad — o `grants-guard` se pone rojo en `main` sin que
      // haya nada que arreglar en el código.
      expect(authenticated).toEqual(['INSERT', 'SELECT']);
    }
  });

  // La cabecera es un estado escrito a mano, o sea la clase de dato que aquí
  // envejece. Que solo pueda decir una de dos cosas evita el tercer estado
  // —«medio aplicada», «aplicada en parte»— que nadie sabría leer.
  it('la cabecera dice PENDIENTE o APLICADA, y no las dos', () => {
    const crudo = crudoMigracion();
    const pendiente = /^--\s*⏳\s*PENDIENTE DE APLICAR/m.test(crudo);
    expect(pendiente || aplicada()).toBe(true);
    expect(pendiente && aplicada()).toBe(false);
  });

  // Y que no se pierda el camino de vuelta: quien aplique tiene que encontrar
  // dentro del fichero qué más hay que tocar.
  it('la migración dice explícitamente que el esquema se cambia DESPUÉS', () => {
    expect(crudoMigracion()).toMatch(/supabase-schema\.sql/);
    expect(crudoMigracion()).toMatch(/DESPUÉS/);
  });
});
