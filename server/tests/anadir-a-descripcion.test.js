/**
 * Añadir a la descripción de una tarjeta sin reenviar lo que ya estaba escrito.
 *
 * Tarjeta: «Añadir un párrafo a una tarjeta obliga a reenviarla entera, y por
 * ahí se pierde trabajo» (`dccc9de0`).
 *
 * QUÉ DEFECTO VIGILA. `PUT /api/cards/:id` solo sabía SUSTITUIR. Apuntar tres
 * párrafos en una tarjeta obligaba a volver a mandar los quince o veinte mil
 * caracteres anteriores, transcritos a mano. No cuesta tiempo: cuesta trabajo
 * perdido — el 8-ago-2026 una reconstrucción desde una copia vieja se llevó por
 * delante la medición de otro papel y un hallazgo escrito para viajar entre
 * papeles.
 *
 * LAS DOS ASERCIONES QUE HACEN ESTO ÚTIL, y las dos son fáciles de romper con
 * una línea que parece limpieza:
 *
 *   · **El texto anterior se conserva BYTE A BYTE.** No es pulcritud. La
 *     compuerta del `409` compara por contención literal, así que un relleno que
 *     «normalizara» la cola del texto anterior —recortando saltos que sobran—
 *     pondría la compuerta roja contra la única escritura del sistema que por
 *     construcción no destruye nada. La composición y la compuerta están atadas.
 *   · **Añadir NO abre un atajo a la compuerta.** El texto compuesto pasa por la
 *     misma comparación que cualquier otro. Si algún día no la supera, es que la
 *     composición se rompió — y la compuerta es quien debe decirlo.
 *
 * Y una que no se ve mirando el código de estado: que añadir deja **la misma**
 * fila de historial que sustituir. Si no la dejara, se podría añadir sin rastro,
 * y «no se puede deshacer» volvería a ser cierto por otro camino.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

const ORIGINAL = '# Brief original\n\nLo que había antes, y que no se puede perder.';

jest.mock('../utils/supabase', () => {
  const state = {
    prevDescription: '# Brief original\n\nLo que había antes, y que no se puede perder.',
    historyInsertError: null,
    insertedHistory: [],   // filas que llegaron a card_description_history
    cardUpdates:     [],   // parches que llegaron a cards
    isMember:        true,
  };

  const supabaseAdmin = {
    from: (table) => {
      let mode = 'select';
      let patch = null;
      const filters = {};

      const chain = {
        select: () => chain,
        eq: (col, val) => { filters[col] = val; return chain; },
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        or: () => chain,

        update: (p) => { mode = 'update'; patch = p; return chain; },

        insert: (row) => {
          const filas = Array.isArray(row) ? row : [row];
          if (table === 'card_description_history') {
            if (state.historyInsertError) {
              return Promise.resolve({ data: null, error: { message: state.historyInsertError } });
            }
            state.insertedHistory.push(...filas);
            return Promise.resolve({ data: filas, error: null });
          }
          return Promise.resolve({ data: filas, error: null });
        },

        single: () => {
          if (table === 'cards' && mode === 'update') {
            state.cardUpdates.push(patch);
            return Promise.resolve({
              data: { id: filters.id, column_id: 'col-1', board_id: 'board-1', title: 'Tarea',
                      priority: 'medium', tags: [], checklist: [], order: 1,
                      description: patch.description ?? state.prevDescription,
                      created_at: '2026-08-09T00:00:00Z', updated_at: '2026-08-09T00:00:00Z' },
              error: null,
            });
          }
          if (table === 'cards') {
            return Promise.resolve({
              data: { checklist: [], board_id: 'board-1', title: 'Tarea',
                      assignee_id: null,
                      description: state.prevDescription,
                      priority: 'medium', due_date: null, category: null,
                      tags: [], checklist_title: '', attachments: [] },
              error: null,
            });
          }
          if (table === 'boards') {
            return Promise.resolve({ data: { id: 'board-1', workspace_id: 'ws-1' }, error: null });
          }
          if (table === 'workspace_members') {
            if (!state.isMember) {
              return Promise.resolve({ data: null, error: { message: 'no rows' } });
            }
            return Promise.resolve({ data: { workspace_id: 'ws-1', user_id: 'user-1', role: 'owner' }, error: null });
          }
          if (table === 'workspaces') {
            return Promise.resolve({ data: { id: 'ws-1', type: 'interno' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },

        then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  };

  return { supabaseAdmin, __state: state };
});

const { __state } = require('../utils/supabase');
const app = require('../app');

const token = jwt.sign(
  { id: 'user-1', email: 'test@aglaya.biz', role: 'admin', organizationId: 'org-1' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' },
);

// SIN acuse de sobrescritura: exactamente como llama el riel por defecto. Todas
// las pruebas de añadir van así a propósito — si alguna necesitara la bandera
// para pasar, la función no serviría para nada, porque el llamante que la
// necesita es justo el que puede no haber leído.
const put = (body) =>
  request(app)
    .put('/api/cards/card-1')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

const ultimaDescripcionEscrita = () =>
  __state.cardUpdates[__state.cardUpdates.length - 1]?.description;

beforeEach(() => {
  __state.prevDescription    = ORIGINAL;
  __state.historyInsertError = null;
  __state.insertedHistory    = [];
  __state.cardUpdates        = [];
  __state.isMember           = true;
});

describe('añadir sin reenviar lo anterior', () => {
  it('el llamante manda SOLO su texto y la tarjeta acaba con los dos', async () => {
    const res = await put({ appendDescription: 'Un párrafo nuevo.' });

    expect(res.status).toBe(200);
    expect(ultimaDescripcionEscrita()).toContain(ORIGINAL);
    expect(ultimaDescripcionEscrita()).toContain('Un párrafo nuevo.');
  });

  it('conserva el texto anterior BYTE A BYTE, y al principio', async () => {
    // Es la aserción que ata la composición a la compuerta. `toContain` sola no
    // basta: un relleno que recortara la cola del anterior seguiría «conteniendo»
    // trozos, pero ya no el texto entero, y el `409` mordería a quien añade.
    await put({ appendDescription: 'Un párrafo nuevo.' });
    expect(ultimaDescripcionEscrita().startsWith(ORIGINAL)).toBe(true);
  });

  it('lo añadido va al FINAL, no al principio', async () => {
    await put({ appendDescription: 'ZZZ el último.' });
    const escrita = ultimaDescripcionEscrita();
    expect(escrita.indexOf('ZZZ el último.')).toBeGreaterThan(escrita.indexOf('# Brief original'));
  });

  it('no reenviar lo anterior NO exige la bandera de sobrescritura', async () => {
    // Si esto pidiera `replacesDescriptionOnPurpose`, la función no serviría:
    // el llamante que la necesita es el que no ha leído.
    const res = await put({ appendDescription: 'Añadido a pelo.' });
    expect(res.status).not.toBe(409);
    expect(res.status).toBe(200);
  });
});

describe('el separador deja markdown legible sin tocar lo anterior', () => {
  // Pegar un párrafo al final de la última línea no produce un párrafo: produce
  // una línea más larga. Se escribe bien y se lee mal, que es la peor forma.
  it('mete una línea en blanco cuando el anterior no acaba en salto', async () => {
    __state.prevDescription = 'Una línea sin salto final.';
    await put({ appendDescription: 'Otra cosa.' });
    expect(ultimaDescripcionEscrita()).toBe('Una línea sin salto final.\n\nOtra cosa.');
  });

  it('completa el salto que falta cuando el anterior acaba en UNO', async () => {
    // Un solo `\n` no separa párrafos en markdown: seguiría siendo el mismo.
    __state.prevDescription = 'Acaba en un salto.\n';
    await put({ appendDescription: 'Otra cosa.' });
    expect(ultimaDescripcionEscrita()).toBe('Acaba en un salto.\n\nOtra cosa.');
  });

  it('no añade nada cuando el anterior ya acaba en línea en blanco', async () => {
    __state.prevDescription = 'Ya acaba bien.\n\n';
    await put({ appendDescription: 'Otra cosa.' });
    expect(ultimaDescripcionEscrita()).toBe('Ya acaba bien.\n\nOtra cosa.');
  });

  // ── ESTAS DOS SALEN DE UNA MUTACIÓN QUE SE ESCAPÓ ─────────────────────────
  //
  // La mutación era la «limpieza» evidente: `anterior.replace(/\n+$/, '') +
  // '\n\n'` en vez de rellenar. Pasó las 19 pruebas anteriores en VERDE.
  //
  // Por qué se escapó, que es lo que hay que dejar escrito: recortar la cola y
  // rellenarla hasta dos **dan el mismo texto** cuando el anterior acaba en 0, 1
  // o 2 saltos — recortar y reponer se compensan exactamente. Solo divergen a
  // partir del TERCERO, y ahí el recorte se come un salto que era del texto
  // anterior. Los cuatro casos de arriba usan colas de 0, 1 y 2: cubrían el
  // separador y no cubrían la única forma de romperlo.
  //
  // No es un caso rebuscado: un texto pegado por esta misma puerta acaba
  // fácilmente con más de dos saltos en cuanto alguien añade un bloque que ya
  // traía el suyo.
  it('conserva la cola aunque el anterior acabe en TRES saltos o más', async () => {
    __state.prevDescription = 'Texto con cola larga.\n\n\n\n';
    await put({ appendDescription: 'Añadido.' });
    expect(ultimaDescripcionEscrita().startsWith('Texto con cola larga.\n\n\n\n')).toBe(true);
  });

  it('y por eso la compuerta no muerde a quien añade: el resultado CONTIENE el anterior', async () => {
    // Esta comparación es LA MISMA que hace la compuerta (`.includes`). Si cae,
    // el `409` empieza a rechazar la única escritura del sistema que por
    // construcción no destruye nada — y el llamante honrado se queda sin poder
    // añadir mientras el que sobrescribe a ciegas sigue pasando con su bandera.
    const conCola = 'Texto con cola larga.\n\n\n\n';
    __state.prevDescription = conCola;
    await put({ appendDescription: 'Añadido.' });
    expect(ultimaDescripcionEscrita().includes(conCola)).toBe(true);
  });

  it('con la descripción vacía escribe solo lo añadido, sin separador delante', async () => {
    __state.prevDescription = '';
    await put({ appendDescription: 'Lo primero que se escribe.' });
    expect(ultimaDescripcionEscrita()).toBe('Lo primero que se escribe.');
  });

  it('y en ese caso NO hay fila de historial: no se destruyó nada', async () => {
    __state.prevDescription = '';
    await put({ appendDescription: 'Lo primero que se escribe.' });
    expect(__state.insertedHistory).toHaveLength(0);
  });
});

describe('añadir deja el MISMO rastro que sustituir', () => {
  it('guarda una fila de historial con el texto ANTERIOR', async () => {
    // Sin esto se podría añadir sin rastro, y «se puede deshacer» volvería a ser
    // falso por otra puerta.
    await put({ appendDescription: 'Un párrafo nuevo.' });

    expect(__state.insertedHistory).toHaveLength(1);
    expect(__state.insertedHistory[0].field).toBe('description');
    expect(__state.insertedHistory[0].old_value).toBe(ORIGINAL);
    expect(__state.insertedHistory[0].description).toBe(ORIGINAL);
    expect(__state.insertedHistory[0].card_id).toBe('card-1');
    expect(__state.insertedHistory[0].changed_by).toBe('user-1');
  });

  it('si el historial no se puede guardar, NO se escribe la descripción', async () => {
    // El precio declarado en v2.1.0 vale igual para esta forma de escribir.
    __state.historyInsertError = 'tabla no disponible';
    const res = await put({ appendDescription: 'Un párrafo nuevo.' });

    expect(res.status).toBe(500);
    expect(__state.cardUpdates).toHaveLength(0);
  });
});

describe('la compuerta del 409 sigue mordiendo, y añadir no la esquiva', () => {
  it('sustituir a ciegas sigue devolviendo 409', async () => {
    const res = await put({ description: 'texto armado en otro sitio' });
    expect(res.status).toBe(409);
    expect(__state.cardUpdates).toHaveLength(0);
  });

  it('sustituir diciéndolo sigue pasando', async () => {
    const res = await put({
      description: 'texto armado en otro sitio',
      replacesDescriptionOnPurpose: true,
    });
    expect(res.status).toBe(200);
  });

  it('vaciar la descripción sigue exigiendo la bandera', async () => {
    const res = await put({ description: '' });
    expect(res.status).toBe(409);
  });
});

describe('lo que la puerta rechaza, y por qué no lo hace en silencio', () => {
  it('añadir texto vacío es 400, no un no-op silencioso', async () => {
    // Un no-op reescribiría la misma descripción sin rastro y sin aviso: el
    // llamante creería haber apuntado algo.
    const res = await put({ appendDescription: '   ' });
    expect(res.status).toBe(400);
    expect(__state.cardUpdates).toHaveLength(0);
  });

  it('añadir algo que no es texto es 400', async () => {
    const res = await put({ appendDescription: 42 });
    expect(res.status).toBe(400);
    expect(__state.cardUpdates).toHaveLength(0);
  });

  it('mandar las dos a la vez es 400: son dos órdenes que se contradicen', async () => {
    const res = await put({
      appendDescription: 'añade esto',
      description: 'no, sustituye por esto',
      replacesDescriptionOnPurpose: true,
    });
    expect(res.status).toBe(400);
    expect(__state.cardUpdates).toHaveLength(0);
  });

  it('y sigue exigiendo membresía: añadir es editar', async () => {
    __state.isMember = false;
    const res = await put({ appendDescription: 'Un párrafo nuevo.' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(__state.cardUpdates).toHaveLength(0);
  });
});

describe('sobre un texto grande, que es el caso que duele', () => {
  it('añade a una descripción de más de 10 KB sin recibirla', async () => {
    const grande = '# Tarjeta larga\n\n' + 'párrafo de relleno con contenido real.\n\n'.repeat(300);
    expect(grande.length).toBeGreaterThan(10 * 1024);
    __state.prevDescription = grande;

    const res = await put({ appendDescription: '## Nota añadida al final' });

    expect(res.status).toBe(200);
    expect(ultimaDescripcionEscrita().startsWith(grande)).toBe(true);
    expect(ultimaDescripcionEscrita()).toContain('## Nota añadida al final');
    // Lo que se midió: el llamante mandó 24 caracteres para una tarjeta de más
    // de 10 KB. Ése es el defecto que esta tarjeta cierra, y aquí está el número.
    expect(ultimaDescripcionEscrita().length).toBeGreaterThan(grande.length);
  });
});
