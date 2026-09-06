/**
 * Traduce un patrón de `LIKE` de Postgres a una expresión regular.
 *
 * Existe porque los dobles de `supabaseAdmin` tienen que aplicar `ilike` DE
 * VERDAD: un doble que devuelva todas las filas convierte cualquier caso de
 * búsqueda en una tautología sobre la fixture.
 *
 * Semántica implementada, que es la de Postgres:
 *   · `%`  → cualquier cosa
 *   · `_`  → un carácter
 *   · `\x` → `x` literal (la barra invertida es el escape POR DEFECTO, sin
 *            cláusula `ESCAPE`; es de ahí de donde la ruta saca que puede
 *            escapar los comodines del usuario)
 *
 * ⚠️ Lo que este helper NO es: una prueba de que PostgREST se comporte así. Es
 * la misma semántica escrita dos veces —aquí y en la ruta—, y por eso los casos
 * que dependen de ella lo dicen en su propio comentario. Lo que sí mide de
 * verdad, sin depender de esto, es la FORMA de la consulta.
 */
function likeARegExp(patron) {
  let re = '';
  for (let i = 0; i < patron.length; i += 1) {
    const c = patron[i];
    if (c === '\\') {
      i += 1;
      if (i < patron.length) re += patron[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      continue;
    }
    if (c === '%') { re += '[\\s\\S]*'; continue; }
    if (c === '_') { re += '[\\s\\S]'; continue; }
    re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

module.exports = { likeARegExp };
