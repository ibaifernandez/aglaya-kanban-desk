/**
 * Historial de la descripción de una tarjeta.
 *
 * Tarjeta: «Actualizar una tarjeta borra lo que había, y no queda rastro».
 *
 * QUÉ DEFECTO VIGILA. `PUT /api/cards/:id` recibe la descripción COMPLETA y la
 * reemplaza: no hay forma de añadir sin arriesgarse a borrar. Un llamante que no
 * lea antes de escribir destruye lo que había — y **recibe éxito**. Pagado el
 * 6-ago-2026: un obrero automático sustituyó la descripción de una tarjeta por
 * el texto de otra, y se recuperó por casualidad porque alguien tenía el
 * original en su contexto. Con naves escribiendo de noche, esa casualidad no se
 * repite.
 *
 * LA ASERCIÓN QUE HACE ESTO ÚTIL, y por la que el doble captura escrituras: que
 * cuando el historial NO se puede guardar, la tarjeta **no se sobrescribe**. Un
 * historial que falla en silencio es peor que no tenerlo: da la sensación de que
 * se puede deshacer justo en la escritura que había que poder deshacer. Eso no
 * se puede medir por el código de estado ni por el cuerpo de la respuesta —
 * solo mirando si el `update` llegó a salir.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

const ORIGINAL = '# Brief original\n\nLo que había antes, y que no se puede perder.';

jest.mock('../utils/supabase', () => {
  const state = {
    prevDescription:    '# Brief original\n\nLo que había antes, y que no se puede perder.',
    historyInsertError: null,
    historyRows:        [],
    users:              [],
    insertedHistory:    [],   // filas que llegaron a card_description_history
    cardUpdates:        [],   // parches que llegaron a cards
    // Si el usuario es miembro del workspace de la tarjeta. El doble original
    // devolvía membresía SIEMPRE, así que `requireWorkspaceMember` era un
    // no-op en las pruebas: se le podía quitar entero a la ruta del historial
    // y las 12 seguían verdes. Y ese middleware es la ÚNICA protección real —
    // el servidor lee con `service_role`, que salta la RLS de la migración.
    isMember:           true,
  };

  const supabaseAdmin = {
    from: (table) => {
      let mode = 'select';
      let patch = null;
      let filters = {};
      let sort = null;

      const chain = {
        select: () => chain,
        eq: (col, val) => { filters[col] = val; return chain; },
        in: () => chain,
        // El doble APLICA el orden. Sin esto, invertirlo en la ruta pasaba en
        // verde — y el endpoint promete «la más reciente primero», que es de lo
        // que depende que deshacer coja la versión buena y no otra.
        order: (col, opts = {}) => { sort = { col, asc: opts.ascending !== false }; return chain; },
        limit: () => chain,
        or: () => chain,

        update: (p) => { mode = 'update'; patch = p; return chain; },

        insert: (row) => {
          if (table === 'card_description_history') {
            if (state.historyInsertError) {
              return Promise.resolve({ data: null, error: { message: state.historyInsertError } });
            }
            state.insertedHistory.push(row);
            return Promise.resolve({ data: [row], error: null });
          }
          return Promise.resolve({ data: [row], error: null });
        },

        single: () => {
          if (table === 'cards' && mode === 'update') {
            state.cardUpdates.push(patch);
            return Promise.resolve({
              data: { id: filters.id, column_id: 'col-1', board_id: 'board-1', title: 'Tarea',
                      priority: 'medium', tags: [], checklist: [], order: 1,
                      description: patch.description ?? state.prevDescription,
                      created_at: '2026-08-06T00:00:00Z', updated_at: '2026-08-06T00:00:00Z' },
              error: null,
            });
          }
          if (table === 'cards') {
            return Promise.resolve({
              data: { checklist: [], board_id: 'board-1', title: 'Tarea', assignee_id: null,
                      description: state.prevDescription },
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

        // El doble APLICA los filtros, no los ignora. Un doble que devuelve sus
        // fixtures pase lo que pase convierte cualquier aserción sobre la forma
        // en una tautología sobre sí mismo — y aquí en concreto dejaba pasar en
        // verde la retirada de `.eq('card_id', …)`, que es fuga del historial de
        // una tarjeta al de otra. Comprobado por mutación: sin esta línea, el
        // endpoint sin filtro pasaba las 12 pruebas.
        then: (resolve, reject) => {
          let data = [];
          if (table === 'card_description_history') data = state.historyRows;
          if (table === 'users')                    data = state.users;
          for (const [col, val] of Object.entries(filters)) {
            data = data.filter((r) => r[col] === val);
          }
          if (sort) {
            const dir = sort.asc ? 1 : -1;
            data = [...data].sort((a, b) =>
              a[sort.col] > b[sort.col] ? dir : a[sort.col] < b[sort.col] ? -dir : 0);
          }
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
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

// Sin acuse: como llama el riel por defecto. Es el que puede toparse con la
// compuerta de sobrescritura.
const putSinAcuse = (body) =>
  request(app)
    .put('/api/cards/card-1')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

// Con acuse, que es como llama el navegador. Las pruebas de ESTE fichero miden
// el HISTORIAL, no la compuerta: todas sustituyen el texto a propósito, así que
// afirman el acuse igual que lo afirmaría quien tiene el editor delante.
// Ponerlo aquí y no en cada caso evita que la compuerta —añadida el
// 8-ago-2026 por `f19dda2d`— se lea como si hubiera roto el historial.
const put = (body) => putSinAcuse({ replacesDescriptionOnPurpose: true, ...body });

beforeEach(() => {
  __state.prevDescription    = ORIGINAL;
  __state.historyInsertError = null;
  __state.historyRows        = [];
  __state.users              = [];
  __state.insertedHistory    = [];
  __state.cardUpdates        = [];
  __state.isMember           = true;
});

describe('sobrescribir una descripción deja rastro', () => {
  it('guarda la versión ANTERIOR, no la nueva', async () => {
    // El fallo fácil aquí es guardar el texto entrante. Entonces el historial
    // existe, se ve lleno, y no sirve para deshacer nada.
    const res = await put({ description: 'texto nuevo que pisa el anterior' });

    expect(res.status).toBe(200);
    expect(__state.insertedHistory).toHaveLength(1);
    expect(__state.insertedHistory[0].description).toBe(ORIGINAL);
    expect(__state.insertedHistory[0].description).not.toBe('texto nuevo que pisa el anterior');
  });

  it('la fila cuelga de la tarjeta y dice quién la sustituyó', async () => {
    await put({ description: 'texto nuevo' });
    expect(__state.insertedHistory[0].card_id).toBe('card-1');
    expect(__state.insertedHistory[0].changed_by).toBe('user-1');
  });

  it('y la descripción nueva sí se escribe', async () => {
    await put({ description: 'texto nuevo' });
    expect(__state.cardUpdates).toHaveLength(1);
    expect(__state.cardUpdates[0].description).toBe('texto nuevo');
  });
});

describe('si el historial no se puede guardar, NO se sobrescribe', () => {
  it('devuelve 500', async () => {
    __state.historyInsertError = 'permission denied for table card_description_history';
    const res = await put({ description: 'texto nuevo' });
    expect(res.status).toBe(500);
  });

  it('y la tarjeta se queda intacta — cero updates', async () => {
    // La aserción central del archivo. Sin ella, un historial "fire-and-forget"
    // pasaría en verde: devolvería 200, la tarjeta quedaría pisada y el texto
    // anterior perdido, que es exactamente el defecto que esto cierra.
    __state.historyInsertError = 'boom';
    await put({ description: 'texto nuevo' });
    expect(__state.cardUpdates).toHaveLength(0);
  });

  it('el error dice que la tarjeta sigue intacta', async () => {
    // Quien lo lea tiene que saber si perdió el texto o no. «Error interno» le
    // deja sin saberlo, y volverá a intentarlo a ciegas.
    __state.historyInsertError = 'boom';
    const res = await put({ description: 'texto nuevo' });
    expect(res.body.error).toMatch(/intacta|no se ha sobrescrito/i);
  });
});

describe('no se guarda ruido', () => {
  it('si la descripción no cambia, no hay fila', async () => {
    await put({ description: ORIGINAL });
    expect(__state.insertedHistory).toHaveLength(0);
    expect(__state.cardUpdates).toHaveLength(1);
  });

  it('si no se toca la descripción, no hay fila', async () => {
    await put({ title: 'Otro título' });
    expect(__state.insertedHistory).toHaveLength(0);
  });

  it('si antes no había texto, no hay nada que perder y no hay fila', async () => {
    __state.prevDescription = '';
    await put({ description: 'primer brief' });
    expect(__state.insertedHistory).toHaveLength(0);
    expect(__state.cardUpdates).toHaveLength(1);
  });
});

describe('GET /api/cards/:id/history — el historial se puede leer', () => {
  it('devuelve las versiones con su fecha y su autor resuelto', async () => {
    // Sin endpoint, el historial es una tabla que nadie alcanza y «se puede
    // deshacer» sería falso: el texto estaría guardado y perdido a la vez.
    __state.historyRows = [
      { id: 'h-2', card_id: 'card-1', description: 'penúltima',  changed_by: 'user-1', changed_at: '2026-08-06T10:00:00Z' },
      { id: 'h-1', card_id: 'card-1', description: 'la primera', changed_by: null,     changed_at: '2026-08-05T10:00:00Z' },
    ];
    __state.users = [{ id: 'user-1', name: 'Kanban Rail' }];

    const res = await request(app)
      .get('/api/cards/card-1/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].description).toBe('penúltima');
    expect(res.body.data[0].changedBy).toBe('Kanban Rail');
    expect(res.body.data[0].changedAt).toBe('2026-08-06T10:00:00Z');
  });

  it('una versión cuyo autor ya no existe conserva el texto', async () => {
    // Se pierde el quién, nunca el qué: el texto es lo que hace falta para
    // recuperar. Si esto se pusiera rojo, borrar una cuenta borraría el rastro.
    __state.historyRows = [
      { id: 'h-1', card_id: 'card-1', description: 'texto de una cuenta borrada', changed_by: null, changed_at: '2026-08-05T10:00:00Z' },
    ];

    const res = await request(app)
      .get('/api/cards/card-1/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].description).toBe('texto de una cuenta borrada');
    expect(res.body.data[0].changedBy).toBeNull();
  });

  it('solo devuelve el historial de LA tarjeta pedida', async () => {
    // La prueba que faltaba. Sin ella, retirar el `.eq('card_id', …)` de la ruta
    // —fuga del historial de una tarjeta al de otra, o sea contenido de tarjetas
    // ajenas— pasaba en verde. Comprobado por mutación.
    __state.historyRows = [
      { id: 'h-mia',   card_id: 'card-1', description: 'de la mía',  changed_by: null, changed_at: '2026-08-06T10:00:00Z' },
      { id: 'h-ajena', card_id: 'card-9', description: 'de la otra', changed_by: null, changed_at: '2026-08-06T11:00:00Z' },
    ];

    const res = await request(app)
      .get('/api/cards/card-1/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].description).toBe('de la mía');
  });

  it('sin historial devuelve lista vacía, no error', async () => {
    const res = await request(app)
      .get('/api/cards/card-1/history')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  // Añadida por el vigilante (6-ago-2026). Sin ella, invertir el orden en la
  // ruta pasaba en verde. El endpoint promete «la más reciente primero» y de eso
  // depende deshacer: quien restaura coge la primera fila, así que un orden al
  // revés devuelve la versión MÁS ANTIGUA creyendo que es la anterior — y la
  // restauración escribe encima algo que nadie pidió, con acuse de éxito.
  it('devuelve la más reciente primero', async () => {
    __state.historyRows = [
      { id: 'h-vieja',  card_id: 'card-1', description: 'la vieja',  changed_by: null, changed_at: '2026-08-06T09:00:00Z' },
      { id: 'h-nueva',  card_id: 'card-1', description: 'la nueva',  changed_by: null, changed_at: '2026-08-06T12:00:00Z' },
      { id: 'h-media',  card_id: 'card-1', description: 'la media',  changed_by: null, changed_at: '2026-08-06T10:30:00Z' },
    ];

    const res = await request(app)
      .get('/api/cards/card-1/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toEqual(['h-nueva', 'h-media', 'h-vieja']);
  });
});

// Añadido por el vigilante (6-ago-2026), tras comprobar por mutación que
// `requireWorkspaceMember` se podía retirar ENTERO de esta ruta sin romper una
// sola prueba. El doble devolvía membresía pase lo que pase, así que el
// middleware era un no-op aquí.
//
// Importa más en esta ruta que en las demás: sirve el TEXTO de las tarjetas, y
// la RLS de la migración no la protege — el servidor lee con `service_role`, que
// la salta. El middleware es la única puerta que queda.
describe('el historial no sale del workspace de quien pregunta', () => {
  it('un no-miembro recibe 403 y ni una fila', async () => {
    __state.isMember = false;
    __state.historyRows = [
      { id: 'h-1', card_id: 'card-1', description: 'texto que no debe salir', changed_by: null, changed_at: '2026-08-06T10:00:00Z' },
    ];

    const res = await request(app)
      .get('/api/cards/card-1/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('texto que no debe salir');
  });

  it('un miembro sí lo recibe — el 403 es por membresía, no porque la ruta esté rota', async () => {
    __state.historyRows = [
      { id: 'h-1', card_id: 'card-1', description: 'texto legítimo', changed_by: null, changed_at: '2026-08-06T10:00:00Z' },
    ];

    const res = await request(app)
      .get('/api/cards/card-1/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].description).toBe('texto legítimo');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La compuerta de sobrescritura — tarjeta `f19dda2d`, 8-ago-2026.
//
// El historial de arriba hace RECUPERABLE lo que se pisa. Esta compuerta hace
// que pisarlo **cueste un acto deliberado**, que es distinto: un historial que
// nadie mira no evita nada, y nadie mira el historial salvo que ya sospeche.
//
// Pasó de verdad: un agente reconstruyó la descripción de una tarjeta desde una
// copia vieja y se llevó por delante la medición de otro papel —y un hallazgo
// escrito ahí para viajar entre papeles—. Se recuperó por el historial, que es
// suerte de implementación, no una garantía del protocolo.
// ─────────────────────────────────────────────────────────────────────────────
describe('sobrescribir texto exige decirlo', () => {
  it('una reescritura sin acuse se rechaza con 409', async () => {
    const res = await putSinAcuse({ description: 'un resumen de cinco líneas' });
    expect(res.status).toBe(409);
  });

  it('y NO toca la tarjeta ni escribe historial', async () => {
    // La aserción central: rechazar con 409 y haber escrito igual sería peor
    // que no tener compuerta, porque además mentiría.
    await putSinAcuse({ description: 'un resumen de cinco líneas' });
    expect(__state.cardUpdates).toHaveLength(0);
    expect(__state.insertedHistory).toHaveLength(0);
  });

  it('el error dice cómo seguir, no solo que no', async () => {
    // Quien recibe esto es un agente. Un «409» a secas lo deja adivinando, y
    // adivinando es como llegó aquí.
    const res = await putSinAcuse({ description: 'otro texto' });
    expect(res.body.error).toMatch(/replacesDescriptionOnPurpose/);
    expect(res.body.error).toMatch(/lee la versión actual/i);
  });

  it('AÑADIR no necesita acuse: el texto nuevo contiene el anterior', async () => {
    // El caso normal de un agente que amplía una tarjeta. Si esto pidiera
    // acuse, la compuerta se volvería un trámite y se pasaría siempre — que es
    // como mueren las compuertas.
    const res = await putSinAcuse({ description: `${ORIGINAL}\n\n## Y una sección nueva` });
    expect(res.status).toBe(200);
    expect(__state.cardUpdates).toHaveLength(1);
    expect(__state.insertedHistory).toHaveLength(1);
  });

  it('con el acuse, la reescritura pasa', async () => {
    const res = await putSinAcuse({
      description: 'un resumen de cinco líneas',
      replacesDescriptionOnPurpose: true,
    });
    expect(res.status).toBe(200);
    expect(__state.cardUpdates[0].description).toBe('un resumen de cinco líneas');
  });

  it('vaciar la descripción también es destruir, y también exige acuse', async () => {
    const res = await putSinAcuse({ description: '' });
    expect(res.status).toBe(409);
    expect(__state.cardUpdates).toHaveLength(0);
  });

  it('sobre una tarjeta SIN descripción previa no hay nada que destruir', async () => {
    __state.prevDescription = '';
    const res = await putSinAcuse({ description: 'primer brief' });
    expect(res.status).toBe(200);
  });

  it('no mandar la descripción no dispara la compuerta', async () => {
    // «No mandarla» y «mandarla vacía» son órdenes distintas, y el contrato ya
    // lo dice. La compuerta no puede confundirlas: bloquear un cambio de
    // prioridad sería un rojo con razón formal y juicio equivocado.
    const res = await putSinAcuse({ priority: 'high' });
    expect(res.status).toBe(200);
    expect(__state.cardUpdates).toHaveLength(1);
  });
});
