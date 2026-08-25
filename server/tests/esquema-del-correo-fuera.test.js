/**
 * El esquema del correo se retira de la base, y la declaración va DETRÁS.
 *
 * Tarjeta `6d2801b5`. Decisión de Ibai, 25-ago-2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ VIGILA ESTE FICHERO, que no es lo que parece
 *
 * El `DROP` lo ejecuta el Operador. Lo que se puede vigilar desde aquí es **el
 * orden entre dos cosas que tienen que viajar juntas y no pueden salir a la vez**:
 *
 *   1. la migración se aplica sobre la base, y
 *   2. el esquema documentado deja de declarar las columnas y la tabla.
 *
 * Si (2) va primero, `schema-drift-guard` se pone rojo **con razón** y se queda
 * rojo en `main` hasta que alguien ejecute (1). Un guardián que vive en rojo se
 * normaliza hasta que deja de mirarse.
 *
 * Si (1) va primero y (2) se olvida, el esquema documentado declara columnas que
 * ya no existen — y esta casa tiene una factura con ese defecto exacto: la
 * cabecera de `migration-historial-append-only.sql` dijo «PENDIENTE DE APLICAR»
 * **diecisiete días después de aplicarse**, y una tarjeta entera se planificó
 * sobre esa línea.
 *
 * LO QUE ESTE FICHERO NO COMPRUEBA: **la base.** Nunca. Que el documento lo diga
 * no significa que esté aplicado — eso lo contesta `schema-drift-guard` en su
 * corrida, con credencial y con la hora firmada, o las tres consultas que van
 * dentro de la propia migración y que ejecuta quien no la aplicó.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const ESQUEMA = path.join(RAIZ, 'docs', 'schema', 'supabase-schema.sql');
const MIGRACION = path.join(RAIZ, 'docs', 'schema', 'migration-retirar-esquema-del-correo.sql');

const leer = (p) => fs.readFileSync(p, 'utf8');

/** Lo que se declara es el SQL, no la prosa que lo explica. */
const soloSql = (texto) =>
  texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');

// ⚠️ Y en JavaScript hay que quitar los comentarios TAMBIÉN, porque este cambio
// deja prosa que nombra lo retirado —explicando por qué se fue— y una prueba que
// mordiera esa prosa obligaría a borrar la explicación para pasar. Medido: la
// primera versión de este fichero se puso roja contra un comentario de `auth.js`
// y contra su propia aserción de ausencia.
const soloCodigo = (texto) =>
  texto
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

const RASTROS = [
  { que: 'la columna digest_hour',    re: /\bdigest_hour\b/ },
  { que: 'la columna digest_enabled', re: /\bdigest_enabled\b/ },
  { que: 'la tabla digest_logs',      re: /\bdigest_logs\b/ },
];

describe('la migración que retira el esquema del correo', () => {
  it('existe', () => {
    expect(fs.existsSync(MIGRACION)).toBe(true);
  });

  it('retira las dos columnas y la tabla, y de forma idempotente', () => {
    const sql = soloSql(leer(MIGRACION));

    expect(sql).toMatch(/ALTER TABLE public\.users\s+DROP COLUMN IF EXISTS digest_hour;/);
    expect(sql).toMatch(/ALTER TABLE public\.users\s+DROP COLUMN IF EXISTS digest_enabled;/);
    expect(sql).toMatch(/DROP TABLE IF EXISTS public\.digest_logs;/);
  });

  // Sin `CASCADE` a propósito: si algo dependiera de esa tabla sin que nadie lo
  // haya contado, el `DROP` tiene que **fallar y decirlo**, no arrastrarlo.
  it('no usa CASCADE: un dependiente desconocido tiene que doler, no desaparecer', () => {
    expect(soloSql(leer(MIGRACION))).not.toMatch(/CASCADE/i);
  });

  // Lo irreversible se declara dentro del fichero, no solo en una tarjeta que
  // quien ejecute puede no estar leyendo.
  it('dice dentro que se borra sin volcado y que es decisión tomada', () => {
    const crudo = leer(MIGRACION);
    expect(crudo).toMatch(/SIN volcado previo/i);
    expect(crudo).toMatch(/Decisión de Ibai/i);
    // Y que nadie contó las filas: se dice en vez de insinuar que eran pocas.
    expect(crudo).toMatch(/no se sabe/i);
  });

  it('lleva dentro las consultas con las que se comprueba después', () => {
    const crudo = leer(MIGRACION);
    for (const pieza of [
      /information_schema\.columns/,
      /FROM pg_tables/,
      /FROM pg_indexes/,
    ]) {
      expect(crudo.split('\n').some((l) => pieza.test(l))).toBe(true);
    }
  });
});

describe('el orden entre aplicar y declarar no se puede olvidar', () => {
  const aplicada = () => /^--\s*✅\s*APLICADA/m.test(leer(MIGRACION));

  // ⚠️ LA prueba de este fichero. Hoy pasa por la rama de «pendiente»; el día
  // que alguien aplique y ponga «APLICADA» sin limpiar el esquema, cae.
  it('si la migración dice APLICADA, el esquema ya NO puede declarar nada del correo', () => {
    const esquema = soloSql(leer(ESQUEMA));

    for (const { que, re } of RASTROS) {
      const sigue = re.test(esquema);
      if (aplicada()) {
        expect(`${que}: ${sigue ? 'sigue declarada' : 'fuera'}`).toBe(`${que}: fuera`);
      } else {
        // Mientras esté pendiente, el documento tiene que seguir declarando lo
        // que la base tiene de verdad — o `schema-drift-guard` se pone rojo en
        // `main` sin que haya nada que arreglar en el código.
        expect(`${que}: ${sigue ? 'declarada' : 'ya no está'}`).toBe(`${que}: declarada`);
      }
    }
  });

  it('la cabecera dice PENDIENTE o APLICADA, y no las dos', () => {
    const crudo = leer(MIGRACION);
    const pendiente = /^--\s*⏳\s*PENDIENTE DE APLICAR/m.test(crudo);
    expect(pendiente || aplicada()).toBe(true);
    expect(pendiente && aplicada()).toBe(false);
  });

  it('la migración dice explícitamente que el esquema se cambia DESPUÉS', () => {
    const crudo = leer(MIGRACION);
    expect(crudo).toMatch(/supabase-schema\.sql/);
    expect(crudo).toMatch(/DESPUÉS/);
  });
});

describe('el código ya no lee lo que va a desaparecer', () => {
  // Esta parte NO espera al Operador: quitar el lector es seguro antes del
  // `DROP` y obligatorio antes de él. Un `SELECT` contra una tabla que ya no
  // existe no devuelve vacío: devuelve error.
  it('el export de portabilidad no consulta digest_logs', () => {
    const auth = soloCodigo(leer(path.join(RAIZ, 'server', 'routes', 'auth.js')));
    expect(auth).not.toMatch(/digest_logs/);
    expect(auth).not.toMatch(/\bdigest_hour\b/);
    expect(auth).not.toMatch(/\bdigest_enabled\b/);
  });

  // La red de seguridad: da igual por dónde vuelva a entrar. Se mira CÓDIGO, no
  // comentarios: lo que rompe contra una tabla inexistente es un `SELECT`, no
  // una frase que cuenta que la tabla se fue.
  it('ningún fichero de server/ ni de client/src USA esas columnas', () => {
    const { execFileSync } = require('child_process');

    const versionados = execFileSync('git', ['ls-files', '--', 'server', 'client/src'], {
      cwd: RAIZ, encoding: 'utf8',
    }).trim().split('\n').filter(Boolean);

    // Este fichero y el del export las nombran para PROHIBIRLAS. Excluirlos por
    // ruta exacta, no por carpeta: eximir `server/tests/` entero abriría el
    // agujero para cualquier prueba futura que sí las usara de verdad.
    const declarados = [
      'server/tests/esquema-del-correo-fuera.test.js',
      'server/tests/auth-self-service.test.js',
      // Vigila que la política publicada NO ofrezca el `toggle` de
      // `digest_enabled`, así que tiene que nombrarlo para prohibirlo — igual
      // que los dos de arriba (tarjeta `ff792a8b`).
      'server/tests/politica-publicada.test.js',
    ];

    // ⚠️ Si esta lista sigue creciendo, deja de ser una excepción y pasa a ser
    // un agujero: cada entrada es un fichero donde el guardián NO mira. Tres son
    // los tres que nombran lo retirado para prohibirlo. El cuarto habría que
    // mirarlo con lupa antes de añadirlo.

    const culpables = versionados
      .filter((rel) => !declarados.includes(rel))
      .filter((rel) => /\.(js|jsx)$/.test(rel))
      .filter((rel) =>
        /digest_hour|digest_enabled|digest_logs/.test(
          soloCodigo(leer(path.join(RAIZ, rel))),
        ),
      );

    expect(culpables).toEqual([]);
  });
});
