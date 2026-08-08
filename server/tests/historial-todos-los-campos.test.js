/**
 * El historial se declara capaz de guardar cualquier campo, no solo la descripción.
 *
 * QUÉ VIGILA, Y QUÉ NO. Vigila la DECLARACIÓN —el esquema y la migración—, no la
 * base. Mientras la migración esté pendiente de aplicar, esto está verde y la
 * base sigue con un solo campo. Esa comprobación va dentro de la propia
 * migración y la ejecuta quien no la aplicó.
 *
 * POR QUÉ MERECE UNA PRUEBA SIENDO SOLO DECLARACIÓN. Porque hay tres decisiones
 * aquí que se pueden deshacer sin querer con una línea, y las tres tienen
 * consecuencia:
 *
 *   · **`description` tiene que dejar de ser NOT NULL.** Si alguien la repone,
 *     la tabla vuelve a no poder guardar el historial de ningún otro campo —una
 *     fila de `priority` no tiene descripción que poner— y el síntoma sería un
 *     `500` en cada edición, no un error legible.
 *   · **`old_value` tiene que ser NULLABLE.** Si alguien la pone NOT NULL «por
 *     limpieza», se pierde la diferencia entre «no tenía responsable» y «tenía
 *     uno vacío», que es justo lo que un historial existe para conservar.
 *   · **`field` tiene que traer default.** Sin él, la migración no puede
 *     aplicarse sobre una tabla con filas dentro sin decidir qué poner en ellas.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const ESQUEMA = path.join(RAIZ, 'docs', 'schema', 'supabase-schema.sql');
const MIGRACION = path.join(RAIZ, 'docs', 'schema', 'migration-historial-todos-los-campos.sql');
const TABLA = 'card_description_history';

const sinComentarios = (t) =>
  t.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

/** El bloque `CREATE TABLE …( … );` de una tabla, ya sin comentarios. */
const bloqueTabla = (sql, tabla) => {
  const m = sql.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${tabla}\\s*\\(([\\s\\S]*?)\\n\\);`)
  );
  return m ? m[1] : null;
};

describe('el historial se declara para cualquier campo, no solo la descripción', () => {
  const esquema = sinComentarios(fs.readFileSync(ESQUEMA, 'utf8'));
  const bloque = bloqueTabla(esquema, TABLA);

  test('el esquema declara la tabla y se puede leer su bloque', () => {
    expect(bloque).not.toBeNull();
  });

  test('declara la columna «field», y con default', () => {
    // Sin default, la migración no puede aplicarse sobre una tabla con filas
    // dentro sin decidir a mano qué poner en cada una.
    const linea = bloque.split('\n').find((l) => /^\s*field\b/.test(l));
    expect(linea).toBeDefined();
    expect(linea).toMatch(/NOT NULL/);
    expect(linea).toMatch(/DEFAULT\s+'description'/);
  });

  test('declara «old_value» y la deja NULLABLE', () => {
    const linea = bloque.split('\n').find((l) => /^\s*old_value\b/.test(l));
    expect(linea).toBeDefined();
    expect(linea).not.toMatch(/NOT NULL/);
  });

  test('«description» ya NO es NOT NULL', () => {
    // Si vuelve a serlo, la tabla no puede guardar ningún otro campo.
    const linea = bloque.split('\n').find((l) => /^\s*description\b/.test(l));
    expect(linea).toBeDefined();
    expect(linea).not.toMatch(/NOT NULL/);
  });

  test('el esquema declara el índice por campo', () => {
    expect(esquema).toMatch(
      new RegExp(`idx_card_description_history_card_field[\\s\\S]{0,120}${TABLA}\\(card_id, field, changed_at DESC\\)`)
    );
  });

  describe('la migración que lo aplica', () => {
    const crudo = fs.readFileSync(MIGRACION, 'utf8');
    const migracion = sinComentarios(crudo);
    const lineas = migracion.split('\n');

    test('existe y añade las dos columnas de forma idempotente', () => {
      for (const col of ['field', 'old_value']) {
        const linea = lineas.find(
          (l) => /ADD COLUMN IF NOT EXISTS/.test(l) && new RegExp(`\\b${col}\\b`).test(l)
        );
        expect(linea).toBeDefined();
      }
    });

    test('afloja el NOT NULL de description', () => {
      expect(lineas.some((l) => /ALTER COLUMN description DROP NOT NULL/.test(l))).toBe(true);
    });

    test('traslada las filas que ya existen, sin pisarlas al reaplicar', () => {
      // El `WHERE old_value IS NULL` es lo que la hace idempotente. Sin él,
      // reaplicarla sobre filas ya escritas por el código nuevo las machacaría
      // con la descripción — que para una fila de `priority` es NULL.
      const bloqueUpdate = migracion.match(/UPDATE public\.card_description_history[\s\S]*?;/);
      expect(bloqueUpdate).not.toBeNull();
      expect(bloqueUpdate[0]).toMatch(/SET\s+old_value\s*=\s*description/);
      expect(bloqueUpdate[0]).toMatch(/WHERE\s+old_value IS NULL/);
    });

    test('lleva dentro la consulta con la que se comprueba después', () => {
      // Sin esto, «aplicada» sería una afirmación de quien la aplicó. Se exigen
      // piezas concretas y no una palabra suelta: comprobado en otra tarjeta que
      // un patrón con comodines sobre el fichero entero da verde con la consulta
      // borrada, porque casa letras sueltas de sitios sin relación.
      const piezas = [
        /SELECT column_name, is_nullable/,
        /information_schema\.columns/,
        /table_name\s*=\s*'card_description_history'/,
        /WHERE old_value IS NULL AND description IS NOT NULL/,
      ];
      for (const pieza of piezas) {
        expect(crudo.split('\n').some((l) => pieza.test(l))).toBe(true);
      }
    });

    test('avisa de que va ANTES que el código, y por qué', () => {
      // No es formalismo: mergear el código antes de aplicar esto tumba TODAS
      // las ediciones de tarjeta, porque el fallo al escribir el historial
      // aborta el update. Y este repo despliega al empujar a `main`.
      expect(crudo).toMatch(/PENDIENTE DE APLICAR/);
      expect(crudo).toMatch(/500/);
      expect(crudo).toMatch(/#28/);
    });
  });
});
