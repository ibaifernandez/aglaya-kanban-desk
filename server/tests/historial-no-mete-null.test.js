/**
 * Guardar una tarjeta que cambia la descripción Y otro campo a la vez.
 * Tarjeta `dd7746cf`.
 *
 * QUÉ DEFECTO VIGILA, Y POR QUÉ LLEGÓ A PRODUCCIÓN. El `PUT` construye UN SOLO
 * lote de filas de historial, una por campo que cambia. La fila de `description`
 * recibe `es_sufijo`/`base_id` de `calcularFila`; las de los demás campos **no
 * llevan esas claves**. En un `insert` de varias filas, PostgREST une las claves
 * de todas y **rellena con NULL las que faltan, no con el DEFAULT** — y
 * `es_sufijo` es `BOOLEAN NOT NULL`. El lote entero se rechaza:
 *
 *     null value in column "es_sufijo" of relation "card_description_history"
 *     violates not-null constraint
 *
 * El Operador se lo comió seis veces el 14-nov-2026 editando desde la UI.
 *
 * ⚠️ EL DOBLE DE ESTE FICHERO RESPETA ESA REGLA, Y ESA ES LA PIEZA QUE FALTABA.
 * Los dobles del resto del banco aceptan cualquier fila, así que este defecto
 * **no se podía reproducir con ellos**: el lote pasaba en verde mientras en
 * producción no pasaba nada. Un doble que acepta lo que la base rechaza no
 * verifica, decora.
 *
 * Lo que se imita no es «fallar si falta una clave» —eso sería una regla
 * inventada— sino la semántica real:
 *
 *   · `insert` de UNA fila con la clave ausente → el DEFAULT entra. No falla.
 *   · `insert` de VARIAS → se unen las claves; la fila a la que le falte recibe
 *     NULL, y si la columna es NOT NULL, el lote entero se rechaza.
 *
 * Sin la primera mitad, el doble prohibiría el caso legítimo y nadie podría
 * volver a insertar una fila suelta sin rellenar columnas que tienen default.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

/** Columnas `NOT NULL DEFAULT …` de `card_description_history` (esquema:314). */
const NOT_NULL_CON_DEFAULT = ['es_sufijo'];

jest.mock('../utils/supabase', () => {
  const NOT_NULL = ['es_sufijo'];
  const state = {
    prevDescription: '# Acta\n\nLo que ya estaba escrito.',
    prevPriority:    'medium',
    insertedHistory: [],
    cardUpdates:     [],
    previas:         [],   // filas que devuelve la lectura del historial
  };

  /**
   * Lo que haría PostgREST con este lote. Devuelve el mensaje de error de
   * Postgres, o `null` si el lote es aceptable.
   */
  const rechazoDePostgres = (filas) => {
    // Una sola fila: las claves ausentes toman su DEFAULT. No hay nada que unir.
    if (filas.length < 2) return null;
    const union = new Set();
    for (const f of filas) for (const k of Object.keys(f)) union.add(k);
    for (const col of NOT_NULL) {
      if (!union.has(col)) continue;            // nadie la manda → DEFAULT para todas
      for (const f of filas) {
        if (f[col] === undefined || f[col] === null) {
          return `null value in column "${col}" of relation ` +
                 '"card_description_history" violates not-null constraint';
        }
      }
    }
    return null;
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
        or: () => chain,
        limit: () => {
          if (table === 'card_description_history') {
            return Promise.resolve({ data: state.previas, error: null });
          }
          return chain;
        },

        update: (p) => { mode = 'update'; patch = p; return chain; },

        insert: (row) => {
          const filas = Array.isArray(row) ? row : [row];
          if (table === 'card_description_history') {
            const rechazo = rechazoDePostgres(filas);
            if (rechazo) return Promise.resolve({ data: null, error: { message: rechazo } });
            state.insertedHistory.push(...filas);
            return Promise.resolve({ data: filas, error: null });
          }
          return Promise.resolve({ data: filas, error: null });
        },

        single: () => {
          if (table === 'cards' && mode === 'update') {
            state.cardUpdates.push(patch);
            return Promise.resolve({
              data: { id: filters.id, column_id: 'col-1', board_id: 'board-1',
                      title: 'Tarea', priority: patch.priority ?? state.prevPriority,
                      tags: [], checklist: [], order: 1,
                      description: patch.description ?? state.prevDescription,
                      created_at: '2026-11-14T00:00:00Z', updated_at: '2026-11-14T00:00:00Z' },
              error: null,
            });
          }
          if (table === 'cards') {
            return Promise.resolve({
              data: { checklist: [], board_id: 'board-1', title: 'Tarea',
                      assignee_id: null, description: state.prevDescription,
                      priority: state.prevPriority, due_date: null, category: null,
                      tags: [], checklist_title: '', attachments: [] },
              error: null,
            });
          }
          if (table === 'boards') {
            return Promise.resolve({ data: { id: 'board-1', workspace_id: 'ws-1' }, error: null });
          }
          if (table === 'workspace_members') {
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

const put = (body) =>
  request(app).put('/api/cards/card-1').set('Authorization', `Bearer ${token}`).send(body);

beforeEach(() => {
  __state.insertedHistory = [];
  __state.cardUpdates = [];
  __state.previas = [];
  __state.prevDescription = '# Acta\n\nLo que ya estaba escrito.';
  __state.prevPriority = 'medium';
});

describe('el lote de historial no mete NULL en una columna NOT NULL', () => {
  // ── Condición 1 y 2 de la tarjeta ────────────────────────────────────────
  test('cambiar descripción Y prioridad a la vez GUARDA, con dos filas', async () => {
    const res = await put({ description: '# Acta\n\nLo que ya estaba escrito.\n\nY esto nuevo.',
                            priority: 'high' });

    expect(res.status).toBe(200);
    expect(__state.insertedHistory).toHaveLength(2);

    // Lo que rompía: la fila que NO es de descripción llegaba sin la clave, y
    // en un lote de varias eso es un NULL, no el default.
    for (const fila of __state.insertedHistory) {
      for (const col of NOT_NULL_CON_DEFAULT) {
        expect(fila[col]).not.toBeUndefined();
        expect(fila[col]).not.toBeNull();
      }
    }

    // Y la tarjeta se escribió de verdad, que es lo que el Operador no podía.
    expect(__state.cardUpdates).toHaveLength(1);
  });

  test('las DOS clases de fila llevan las MISMAS claves', async () => {
    // ⚠️ ESTO ES LO QUE DE VERDAD IMPIDE QUE VUELVA, y no es `es_sufijo`.
    //
    // El mutante lo enseñó: quitar `base_id: null` deja los casos en verde,
    // porque esa columna es nullable. O sea que la línea, por sí sola, no
    // sostiene nada. Lo que sostiene es la **uniformidad**: PostgREST une las
    // claves del lote, así que mientras las dos clases de fila lleven las
    // mismas, no hay hueco que rellenar con NULL — hoy ni el día que alguien
    // añada otra columna `NOT NULL` a esta tabla.
    //
    // Sin este caso, el arreglo quedaba atado a una columna concreta en vez de
    // a la propiedad que lo hace cierto.
    const res = await put({ description: '# Acta\n\nLo que ya estaba escrito.\n\nNuevo.',
                            priority: 'high' });
    expect(res.status).toBe(200);

    const [a, b] = __state.insertedHistory;
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  });

  test('el mensaje de la compuerta no se devuelve: no hay nada que reintentar', async () => {
    const res = await put({ description: '# Acta\n\nLo que ya estaba escrito.\n\nMás.',
                            priority: 'urgent' });

    expect(res.status).not.toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/no se ha sobrescrito nada/i);
  });

  // ── Condición 4: el ahorro de `fc38e47f` sigue en pie ────────────────────
  test('CONTRAPRUEBA · cambiar solo la descripción sigue guardando el SUFIJO', async () => {
    // Con una fila previa cuyo texto es prefijo del anterior, `calcularFila`
    // debe guardar solo lo añadido. Si este caso se pusiera verde guardando el
    // texto entero, el arreglo habría costado el 82,5 % de ahorro de `fc38e47f`
    // sin que nada avisara.
    __state.prevDescription = '# Acta\n\nUno.\n\nDos.';
    __state.previas = [{ id: 'h-1', old_value: '# Acta\n\nUno.', es_sufijo: false,
                         base_id: null, changed_at: '2026-11-13T00:00:00Z' }];

    const res = await put({ description: '# Acta\n\nUno.\n\nDos.\n\nTres.' });

    expect(res.status).toBe(200);
    expect(__state.insertedHistory).toHaveLength(1);

    const fila = __state.insertedHistory[0];
    expect(fila.es_sufijo).toBe(true);
    expect(fila.base_id).toBe('h-1');
    expect(fila.old_value).toBe('\n\nDos.');
  });

  // ── Y la otra mitad del doble, para que no prohíba lo legítimo ───────────
  test('una fila SUELTA sin la clave sigue siendo aceptable', async () => {
    // Solo cambia la prioridad: una fila, y la columna toma su DEFAULT. Si el
    // doble rechazara esto, estaría imponiendo una regla que la base no tiene —
    // y el arreglo del lote parecería obligatorio por el motivo equivocado.
    const res = await put({ priority: 'low' });

    expect(res.status).toBe(200);
    expect(__state.insertedHistory).toHaveLength(1);
    expect(__state.insertedHistory[0].field).toBe('priority');
  });
});
