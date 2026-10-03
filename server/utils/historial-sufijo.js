/**
 * historial-sufijo.js — guardar solo lo añadido, sin perder cómo se reconstruye.
 * Tarjeta `fc38e47f`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ PROBLEMA RESUELVE
 *
 * El historial guardaba el texto anterior ENTERO en cada edición. El 82,5 % de
 * las ediciones de esta casa son añadidos puros al final —se pega un bloque al
 * pie de un acta de decenas de miles de caracteres—, así que cada añadido
 * reescribía todo lo anterior. 2.650 de 3.211 ediciones consecutivas, medido.
 *
 * Guardar solo el trozo nuevo lleva el texto del historial de 43 MB a **9,6**.
 *
 * ⚠️ Ese número fue antes «18 MB», y la corrección importa porque enseña a medir:
 * la primera estimación comparó prefijos con `old_value LIKE prev || '%'`, y en
 * `LIKE` la barra invertida es un escape — las actas de esta casa llevan rutas y
 * fragmentos de código, así que 465 pares que SÍ eran prefijos literales se
 * contaron como si no lo fueran. El predicado honesto es `left(old_value,
 * length(prev)) = prev`, que es lo que hace `startsWith` aquí abajo: **el código
 * siempre estuvo bien; lo que estaba mal era el número que lo acompañaba**, y
 * por debajo. Lo cazó el vigilante midiendo por su cuenta.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ HAY ANCLAS, Y POR QUÉ CADA 10
 *
 * Un sufijo solo se entiende pegado a lo anterior: encadena. Y una cadena es
 * frágil — borrar un eslabón deja sin reconstruir a todos los siguientes, que es
 * justo lo que hace una poda de versiones intermedias.
 *
 * La salida NO es prohibir la poda: eso cerraría la única palanca que libera
 * disco de verdad, y lo levantó el vigilante. La salida son ANCLAS: cada tantas
 * ediciones se guarda el texto completo, y borrar lo que hay entre dos anclas es
 * seguro sin materializar nada.
 *
 * **Las anclas ya existen gratis**, y ésa es la medición que fija el número: el
 * 17,5 % de ediciones que NO son añadidos guardan el texto entero por
 * definición. Medidas las cadenas reales entre ancla y ancla:
 *
 *     cadenas ....................... 1.329
 *     largo medio ................... 2,0 ediciones
 *     percentil 95 .................. 8
 *     la más larga .................. 29
 *     cadenas de más de 10 .......... 26   ← el 2 %
 *
 * Con tope en 10, el ancla forzada toca 26 cadenas de 1.329. Cuesta ~2 %, no el
 * ~10 % que parecería: casi todas las cadenas se cortan solas antes de llegar.
 * Y el p95 en 8 es lo que hace que 10 no sea un número inventado.
 *
 * ⚠️ LO QUE ESTO NO ARREGLA, escrito aquí para que no se lea de más: cada
 * edición sigue escribiendo la descripción completa en `cards`, porque la
 * tarjeta guarda su propio contenido. Son 11.067 actualizaciones con 13 kB de
 * media — más texto que todo el historial junto. Esto recorta el HISTORIAL.
 */
'use strict';

/** Cada cuántos sufijos seguidos se fuerza un ancla. Ver la cabecera: p95 = 8. */
const MAX_CADENA = 10;

/**
 * Qué guardar para una edición, dado lo que se guardó la vez anterior.
 *
 * @param {string} textoAnterior  El valor que la tarjeta tenía ANTES de esta
 *                                edición: lo que hay que poder recuperar.
 * @param {object|null} previa    La fila más reciente del historial de ese campo,
 *                                ya reconstruida: `{ id, texto, profundidad }`.
 *                                `null` si no hay ninguna.
 * @returns {{ old_value: string, es_sufijo: boolean, base_id: string|null }}
 */
function calcularFila(textoAnterior, previa) {
  // Sin fila previa no hay a qué pegarse: ancla obligatoria.
  if (!previa || typeof previa.texto !== 'string' || !previa.id) {
    return { old_value: textoAnterior, es_sufijo: false, base_id: null };
  }

  // La cadena llegó al tope: se ancla aunque sea un añadido. Esto es lo que
  // garantiza que ninguna poda se encuentre una cadena indefinidamente larga.
  if (previa.profundidad >= MAX_CADENA - 1) {
    return { old_value: textoAnterior, es_sufijo: false, base_id: null };
  }

  // ⚠️ `startsWith` y no `includes`: lo que se guarda como sufijo tiene que ser
  // lo que sobra AL FINAL. Un texto que contenga al anterior por el medio no se
  // reconstruye concatenando, y guardarlo como sufijo lo corrompería en silencio.
  if (!textoAnterior.startsWith(previa.texto)) {
    return { old_value: textoAnterior, es_sufijo: false, base_id: null };
  }

  // Caso degenerado: idénticos. No es un añadido, es un no-cambio; el llamante
  // no debería llegar aquí, pero si llega, un sufijo vacío sería una fila que no
  // dice nada. Se ancla.
  if (textoAnterior.length === previa.texto.length) {
    return { old_value: textoAnterior, es_sufijo: false, base_id: null };
  }

  return {
    old_value: textoAnterior.slice(previa.texto.length),
    es_sufijo: true,
    base_id:   previa.id,
  };
}

/**
 * Reconstruye el texto completo de cada fila siguiendo la cadena de `base_id`.
 *
 * @param {Array} filas  Filas tal cual salen de la base: `{ id, old_value,
 *                       es_sufijo, base_id, … }`. En cualquier orden.
 * @returns {Map<string, string|null>}  id → texto completo, o `null` si la
 *                                      cadena está rota y no se puede afirmar.
 */
function reconstruirTextos(filas) {
  const porId = new Map(filas.map((f) => [f.id, f]));
  const hecho = new Map();

  const resolver = (id, visitados) => {
    if (hecho.has(id)) return hecho.get(id);
    const fila = porId.get(id);
    if (!fila) return null;                       // el eslabón no está aquí

    let texto;
    if (!fila.es_sufijo) {
      texto = fila.old_value ?? null;             // ancla: el texto es el que es
    } else if (!fila.base_id) {
      // Sufijo huérfano: su ancla se borró (`ON DELETE SET NULL`). No se
      // inventa nada — devolver el trozo suelto como si fuera el texto entero
      // sería mentir, y mentir callando es lo que esta casa persigue.
      texto = null;
    } else if (visitados.has(id)) {
      texto = null;                               // ciclo: imposible, pero no se cuelga
    } else {
      visitados.add(id);
      const base = resolver(fila.base_id, visitados);
      texto = base === null ? null : base + (fila.old_value ?? '');
    }

    hecho.set(id, texto);
    return texto;
  };

  const salida = new Map();
  for (const f of filas) salida.set(f.id, resolver(f.id, new Set()));
  return salida;
}

/**
 * De las filas de un campo, la más reciente ya reconstruida — que es lo que
 * `calcularFila` necesita como `previa`.
 *
 * Devuelve `null` cuando la más reciente no se puede reconstruir: entonces la
 * edición se ancla, y la cadena rota deja de propagarse.
 */
function previaDesdeFilas(filas) {
  if (!filas.length) return null;

  const ordenadas = [...filas].sort(
    (a, b) => new Date(b.changed_at) - new Date(a.changed_at),
  );
  const ultima = ordenadas[0];
  const texto  = reconstruirTextos(filas).get(ultima.id);
  if (texto === null || texto === undefined) return null;

  // Cuántos sufijos seguidos hay hasta el ancla, para saber si toca anclar.
  let profundidad = 0;
  let cursor = ultima;
  const porId = new Map(filas.map((f) => [f.id, f]));
  while (cursor && cursor.es_sufijo && cursor.base_id && profundidad < MAX_CADENA) {
    profundidad += 1;
    cursor = porId.get(cursor.base_id);
  }

  return { id: ultima.id, texto, profundidad };
}

module.exports = { calcularFila, reconstruirTextos, previaDesdeFilas, MAX_CADENA };
