/**
 * La migración de `invited_by` y el esquema documentado dicen lo mismo. Tarjeta `ab86481d`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ MIDE ESTO, Y QUÉ NO
 *
 * **No mide la clave foránea.** Las pruebas de esta casa simulan el cliente de
 * Supabase y no pueden ver una restricción de Postgres. Eso lo mide
 * `docs/schema/pruebas/invitador-puede-irse.sh`, con Postgres real en Docker: con
 * `NO ACTION` el borrado de quien invitó falla; con la migración, termina y la
 * membresía de la persona invitada se conserva.
 *
 * **Lo que sí mide:** que los dos documentos no se separen, y que la migración no
 * vuelva a la forma que parecía funcionar y no funcionaba.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const MIGRACION = path.join(RAIZ, 'docs', 'schema', 'migration-invitador-puede-irse.sql');
const ESQUEMA = path.join(RAIZ, 'docs', 'schema', 'supabase-schema.sql');
const leer = (p) => fs.readFileSync(p, 'utf8');
// El SQL que se EJECUTA, sin comentarios. La cabecera de la migración cita la
// versión ingenua para explicar por qué no se usa, y una prueba sobre el texto
// entero la mordería a ella.
const sinComentarios = (sql) => sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');

/** La línea de `invited_by` dentro de `CREATE TABLE public.workspace_members`. */
function lineaInvitadoPor() {
  const esquema = leer(ESQUEMA);
  const inicio = esquema.indexOf('CREATE TABLE IF NOT EXISTS public.workspace_members');
  const fin = esquema.indexOf(');', inicio);
  if (inicio < 0 || fin < 0) {
    throw new Error('invitador-puede-irse: no encuentro workspace_members en el esquema — no medir NO es verde');
  }
  const linea = esquema.slice(inicio, fin).split('\n').find((l) => /^\s*invited_by\s/.test(l));
  if (!linea) throw new Error('invitador-puede-irse: no encuentro la columna invited_by — no medir NO es verde');
  return linea;
}

describe('invited_by no bloquea la eliminación de quien invitó', () => {
  it('el esquema documentado declara ON DELETE SET NULL', () => {
    expect(lineaInvitadoPor()).toMatch(/REFERENCES public\.users\(id\) ON DELETE SET NULL/);
  });

  it('y la migración pone exactamente eso', () => {
    expect(sinComentarios(leer(MIGRACION))).toMatch(/FOREIGN KEY \(invited_by\) REFERENCES public\.users\(id\) ON DELETE SET NULL/);
  });

  // ⚠️ EL CASO CARO. La versión natural —`DROP CONSTRAINT IF EXISTS
  // workspace_members_invited_by_fkey`— se midió con Postgres real y un nombre de
  // restricción distinto: sale con código 0, deja DOS claves (una en NO ACTION) y
  // el borrado sigue fallando. Esto impide volver a ella.
  it('la migración busca la clave por columna, no por nombre', () => {
    const sql = sinComentarios(leer(MIGRACION));
    expect(sql).toMatch(/FROM pg_constraint/);
    expect(sql).toMatch(/a\.attname\s*=\s*'invited_by'/);
    expect(sql).not.toMatch(/DROP CONSTRAINT IF EXISTS workspace_members_invited_by_fkey/);
  });

  // La cabecera tiene un estado y uno solo. Una migración marcada como aplicada
  // que no lo está —o al revés— hace planificar sobre una base que no existe.
  it('la cabecera dice NO APLICADA o APLICADA, y no las dos', () => {
    const cabecera = leer(MIGRACION).split('\n').slice(0, 8).join('\n');
    const pendiente = /NO APLICADA/.test(cabecera);
    const aplicada = /✅\s*APLICADA/.test(cabecera);
    expect(pendiente !== aplicada).toBe(true);
  });
});
