/**
 * historial-sufijo.test.js — guardar solo lo añadido SIN perder la reconstrucción.
 * Tarjeta `fc38e47f`.
 *
 * LO QUE ESTÁ EN JUEGO. Guardar un trozo en vez del texto entero encadena cada
 * versión a la anterior, y una cadena se rompe: la poda de versiones intermedias
 * —que es la única palanca que libera disco de verdad— borra eslabones por
 * diseño. Si esto no sobrevive a eso, la obra no vale aunque ahorre 25 MB; lo
 * puso así el delineante y es la condición de cierre.
 *
 * Por eso el caso que más pesa aquí no es el ahorro: es el de más abajo, que
 * BORRA una fila intermedia y exige que las demás se sigan leyendo.
 *
 * Y la otra mitad, que es la que daría un fallo silencioso: cuando una cadena NO
 * se puede reconstruir, hay que decir `null` — nunca devolver el trozo suelto
 * como si fuera el texto entero. Un historial que miente sin dar error es peor
 * que uno que falta.
 */
'use strict';

const {
  calcularFila,
  reconstruirTextos,
  previaDesdeFilas,
  MAX_CADENA,
} = require('../utils/historial-sufijo');

const ACTA = '# Acta\n\n' + 'Un párrafo largo de los que escribe esta casa.\n'.repeat(40);

describe('qué se guarda en cada edición', () => {
  it('sin historial previo guarda el texto entero: no hay a qué pegarse', () => {
    const fila = calcularFila(ACTA, null);

    expect(fila).toEqual({ old_value: ACTA, es_sufijo: false, base_id: null });
  });

  it('un añadido al final guarda SOLO lo añadido', () => {
    const anadido = '\n\n## Bloque nuevo\n\nLo que se pega al pie.';
    const previa  = { id: 'h-1', texto: ACTA, profundidad: 0 };

    const fila = calcularFila(ACTA + anadido, previa);

    expect(fila.es_sufijo).toBe(true);
    expect(fila.base_id).toBe('h-1');
    expect(fila.old_value).toBe(anadido);
    // El ahorro, medido en bytes y no de oído, que es lo que pide la tarjeta.
    expect(Buffer.byteLength(fila.old_value))
      .toBeLessThan(Buffer.byteLength(ACTA + anadido) / 10);
  });

  it('un cambio POR EL MEDIO guarda el texto entero, y no finge ser un sufijo', () => {
    // Lo que no se puede reconstruir concatenando, no se guarda como si se
    // pudiera. Guardarlo como sufijo lo corrompería en silencio.
    const previa   = { id: 'h-1', texto: ACTA, profundidad: 0 };
    const reescrito = ACTA.replace('Un párrafo largo', 'OTRA COSA');

    const fila = calcularFila(reescrito, previa);

    expect(fila.es_sufijo).toBe(false);
    expect(fila.old_value).toBe(reescrito);
    expect(fila.base_id).toBeNull();
  });

  it('un texto que CONTIENE al anterior por el medio tampoco es sufijo', () => {
    // `startsWith`, no `includes`. Si esto pasara como sufijo, al reconstruir
    // saldría el texto en otro orden — y nadie lo vería.
    const previa = { id: 'h-1', texto: 'medio', profundidad: 0 };

    const fila = calcularFila('principio medio final', previa);

    expect(fila.es_sufijo).toBe(false);
    expect(fila.old_value).toBe('principio medio final');
  });

  it('un texto IDÉNTICO al anterior no se guarda como sufijo vacío', () => {
    // Lo cazó un mutante que sobrevivía: sin esta guarda, dos textos iguales
    // producen `old_value: ''` con `es_sufijo: true`. Reconstruye bien —pegar
    // nada no rompe nada—, así que ninguna prueba de reconstrucción lo nota.
    //
    // Lo que deja es una fila de historial que **no dice nada**: ocupa, aparece
    // en la lista de versiones con su fecha y su autor, y al abrirla muestra lo
    // mismo que la anterior. El llamante de hoy no llega aquí —`updateCard` ya
    // descarta lo que no cambió—, pero este módulo no puede depender de eso.
    const previa = { id: 'h-1', texto: ACTA, profundidad: 0 };

    const fila = calcularFila(ACTA, previa);

    expect(fila.es_sufijo).toBe(false);
    expect(fila.old_value).toBe(ACTA);
  });

  it(`a las ${MAX_CADENA} ediciones seguidas se ancla, aunque siga siendo un añadido`, () => {
    const previa = { id: 'h-9', texto: ACTA, profundidad: MAX_CADENA - 1 };

    const fila = calcularFila(ACTA + '\nmás', previa);

    // Lo que esto protege: que ninguna poda se encuentre una cadena
    // indefinidamente larga que tenga que materializar entera.
    expect(fila.es_sufijo).toBe(false);
    expect(fila.old_value).toBe(ACTA + '\nmás');
  });

  it('justo por debajo del tope todavía guarda el trozo', () => {
    // La contraprueba del caso anterior: sin esto, «anclar siempre» pasaría los
    // dos, y el ahorro sería cero con la batería en verde.
    const previa = { id: 'h-8', texto: ACTA, profundidad: MAX_CADENA - 2 };

    const fila = calcularFila(ACTA + '\nmás', previa);

    expect(fila.es_sufijo).toBe(true);
    expect(fila.old_value).toBe('\nmás');
  });
});

// ── Los bordes que pidió el vigilante, uno por uno ──────────────────────────
describe('el borde del tope, contado sobre una cadena de verdad', () => {
  // Lo de arriba fija la decisión con una `profundidad` dada a mano. Esto la
  // cuenta recorriendo la cadena, que es lo que hace el código en producción: si
  // `previaDesdeFilas` contara uno de más o de menos, los casos anteriores
  // seguirían verdes y el tope real sería 9 u 11 sin que nadie lo viera.
  function cadenaDe(n) {
    const filas = [{
      id: 'f0', old_value: 'base', es_sufijo: false, base_id: null,
      changed_at: '2026-10-01T00:00:00Z',
    }];
    for (let i = 1; i <= n; i += 1) {
      filas.push({
        id: `f${i}`, old_value: `+${i}`, es_sufijo: true, base_id: `f${i - 1}`,
        changed_at: `2026-10-01T${String(i).padStart(2, '0')}:00:00Z`,
      });
    }
    return filas;
  }

  it(`con ${MAX_CADENA - 1} sufijos encadenados, la siguiente TODAVÍA es sufijo`, () => {
    const previa = previaDesdeFilas(cadenaDe(MAX_CADENA - 2));
    expect(previa.profundidad).toBe(MAX_CADENA - 2);

    expect(calcularFila(previa.texto + ' más', previa).es_sufijo).toBe(true);
  });

  it(`y en la ${MAX_CADENA}ª ancla: ni una antes, ni una después`, () => {
    const previa = previaDesdeFilas(cadenaDe(MAX_CADENA - 1));
    expect(previa.profundidad).toBe(MAX_CADENA - 1);

    const fila = calcularFila(previa.texto + ' más', previa);
    expect(fila.es_sufijo).toBe(false);
    expect(fila.old_value).toBe(previa.texto + ' más');
  });

  it('una edición POR EL MEDIO ancla aunque la cadena solo vaya por 2', () => {
    // El tope no es la única razón para anclar, y confundirlas rompería el
    // historial: lo que no se reconstruye concatenando no puede ir como trozo,
    // esté la cadena donde esté.
    const previa = previaDesdeFilas(cadenaDe(2));
    expect(previa.profundidad).toBe(2);

    const fila = calcularFila('texto completamente distinto', previa);
    expect(fila.es_sufijo).toBe(false);
    expect(fila.base_id).toBeNull();
  });
});

describe('reconstruir el texto de cualquier versión', () => {
  const cadena = [
    { id: 'a', old_value: 'uno',    es_sufijo: false, base_id: null, changed_at: '2026-10-01T10:00:00Z' },
    { id: 'b', old_value: ' dos',   es_sufijo: true,  base_id: 'a',  changed_at: '2026-10-01T11:00:00Z' },
    { id: 'c', old_value: ' tres',  es_sufijo: true,  base_id: 'b',  changed_at: '2026-10-01T12:00:00Z' },
    { id: 'd', old_value: ' cuatro',es_sufijo: true,  base_id: 'c',  changed_at: '2026-10-01T13:00:00Z' },
  ];

  it('sigue la cadena hasta el ancla', () => {
    const textos = reconstruirTextos(cadena);

    expect(textos.get('a')).toBe('uno');
    expect(textos.get('b')).toBe('uno dos');
    expect(textos.get('c')).toBe('uno dos tres');
    expect(textos.get('d')).toBe('uno dos tres cuatro');
  });

  // ── EL CASO QUE DECIDE SI LA OBRA VALE ──────────────────────────────────────
  //
  // Condición literal del delineante: «borrar una fila intermedia y que las
  // siguientes se sigan reconstruyendo». Es lo que hará la poda.
  it('BORRADA una fila intermedia, las anteriores y el ancla se siguen leyendo', () => {
    const podado = cadena.filter((f) => f.id !== 'c');   // se va la tercera

    const textos = reconstruirTextos(podado);

    expect(textos.get('a')).toBe('uno');
    expect(textos.get('b')).toBe('uno dos');
    // Y la que colgaba de la borrada no se inventa nada: dice que no se puede.
    expect(textos.get('d')).toBeNull();
  });

  it('y entre dos ANCLAS, borrar lo de en medio no afecta a nada de fuera', () => {
    // Ésta es la forma de poda que la casa puede ejecutar con tranquilidad, y la
    // razón de que existan las anclas. Sin este caso, nadie sabría que es segura.
    const conDosAnclas = [
      ...cadena,
      { id: 'e', old_value: 'otra cosa entera', es_sufijo: false, base_id: null, changed_at: '2026-10-01T14:00:00Z' },
      { id: 'f', old_value: ' y su añadido',    es_sufijo: true,  base_id: 'e',  changed_at: '2026-10-01T15:00:00Z' },
    ];

    const podado = conDosAnclas.filter((f) => !['b', 'c', 'd'].includes(f.id));
    const textos = reconstruirTextos(podado);

    expect(textos.get('a')).toBe('uno');
    expect(textos.get('e')).toBe('otra cosa entera');
    expect(textos.get('f')).toBe('otra cosa entera y su añadido');
  });

  it('un sufijo que perdió su ancla dice NULL, no devuelve el trozo suelto', () => {
    // `ON DELETE SET NULL` deja la fila huérfana a propósito, para que se note.
    // Devolver ' dos' como si fuera el texto completo sería un historial que
    // miente sin dar error — exactamente lo que no se puede permitir.
    const huerfana = [{ id: 'b', old_value: ' dos', es_sufijo: true, base_id: null, changed_at: '2026-10-01T11:00:00Z' }];

    expect(reconstruirTextos(huerfana).get('b')).toBeNull();
  });

  it('una cadena con un ciclo no cuelga el proceso', () => {
    // No debería poder pasar. Si pasa, el servidor tiene que contestar, no
    // quedarse girando: una petición colgada se lleva por delante al resto.
    const ciclo = [
      { id: 'x', old_value: 'a', es_sufijo: true, base_id: 'y', changed_at: '2026-10-01T10:00:00Z' },
      { id: 'y', old_value: 'b', es_sufijo: true, base_id: 'x', changed_at: '2026-10-01T11:00:00Z' },
    ];

    expect(reconstruirTextos(ciclo).get('x')).toBeNull();
  });
});

describe('de qué fila cuelga la próxima edición', () => {
  it('la más reciente, con su texto entero y su profundidad', () => {
    const filas = [
      { id: 'a', old_value: 'uno',  es_sufijo: false, base_id: null, changed_at: '2026-10-01T10:00:00Z' },
      { id: 'b', old_value: ' dos', es_sufijo: true,  base_id: 'a',  changed_at: '2026-10-01T11:00:00Z' },
    ];

    expect(previaDesdeFilas(filas)).toEqual({ id: 'b', texto: 'uno dos', profundidad: 1 });
  });

  it('sin filas, no hay previa', () => {
    expect(previaDesdeFilas([])).toBeNull();
  });

  it('si la más reciente NO se puede reconstruir, no hay previa: se anclará', () => {
    // La pieza que impide que una cadena rota se propague: ante la duda, ancla.
    // Sin esto, la siguiente edición colgaría de algo ilegible y la rotura
    // crecería en silencio con cada edición.
    const rota = [
      { id: 'b', old_value: ' dos', es_sufijo: true, base_id: 'desaparecida', changed_at: '2026-10-01T11:00:00Z' },
    ];

    expect(previaDesdeFilas(rota)).toBeNull();
  });

  it('las 24 filas antiguas, sin es_sufijo ni base_id, se leen como anclas', () => {
    // Compatibilidad con lo que ya hay: 4.000 filas escritas antes de esto. La
    // migración les pone `es_sufijo = false`, así que son anclas por definición;
    // este caso lo fija por si alguien cambia el valor por defecto.
    const vieja = [{ id: 'v', old_value: 'texto de antes', es_sufijo: false, base_id: null, changed_at: '2026-08-06T10:00:00Z' }];

    expect(reconstruirTextos(vieja).get('v')).toBe('texto de antes');
    expect(previaDesdeFilas(vieja)).toEqual({ id: 'v', texto: 'texto de antes', profundidad: 0 });
  });
});
