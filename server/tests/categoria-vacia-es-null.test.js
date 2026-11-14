/**
 * Un `category` vacío se guarda como NULL, no como cadena vacía. Tarjeta `ec5b86e6`.
 *
 * POR QUÉ EXISTE, SIENDO UNA LÍNEA. El arreglo del cliente —que el modal deje de
 * rellenar la categoría con la primera de la lista— se apoya en que el servidor
 * acepte vacío y lo convierta en NULL. La tarjeta decía «el servidor ya lo hace:
 * compruébalo, no lo des por bueno», y yo lo había comprobado **leyendo**
 * `server/routes/cards.js` (`update.category = category || null`).
 *
 * Leer no es medir. Si alguien cambia esa línea a `category ?? null` —que suena
 * a limpieza y es lo que hace un linter moderno— la cadena vacía dejaría de
 * convertirse y empezaría a guardarse como `''`. Eso no da ningún error: deja
 * una categoría que no es ninguna de las que existen, invisible en el
 * desplegable e imposible de filtrar. El cliente seguiría en verde.
 *
 * Y la diferencia importa porque `Card.jsx` pinta la insignia con
 * `categories.find(c => c.id === card.category)`: con `''` no encuentra nada y no
 * pinta, así que el síntoma no se ve en pantalla. Solo se ve en la fila.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../utils/supabase', () => {
  const state = { cardUpdates: [], cardInserts: [] };

  const supabaseAdmin = {
    from: (table) => {
      let mode = 'select';
      let patch = null;
      let inserted = null;
      const filters = {};

      const chain = {
        select: () => chain,
        eq: (col, val) => { filters[col] = val; return chain; },
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        or: () => chain,
        insert: (row) => {
          const filas = Array.isArray(row) ? row : [row];
          if (table === 'cards') { mode = 'insert'; inserted = filas[0]; state.cardInserts.push(filas[0]); }
          return chain;
        },
        update: (p) => { mode = 'update'; patch = p; return chain; },

        single: () => {
          if (table === 'cards' && mode === 'insert') {
            return Promise.resolve({
              data: { id: 'card-nueva', column_id: inserted.column_id,
                      board_id: inserted.board_id, title: inserted.title,
                      priority: inserted.priority, tags: [], checklist: [], order: 1,
                      description: inserted.description, category: inserted.category,
                      created_at: '2026-11-14T00:00:00Z', updated_at: '2026-11-14T00:00:00Z' },
              error: null,
            });
          }
          if (table === 'cards' && mode === 'update') {
            state.cardUpdates.push(patch);
            return Promise.resolve({
              data: { id: filters.id, column_id: 'col-1', board_id: 'board-1',
                      title: 'Tarea', priority: 'medium', tags: [], checklist: [],
                      order: 1, description: '', category: patch.category ?? null,
                      created_at: '2026-11-14T00:00:00Z', updated_at: '2026-11-14T00:00:00Z' },
              error: null,
            });
          }
          if (table === 'cards') {
            return Promise.resolve({
              data: { checklist: [], board_id: 'board-1', title: 'Tarea',
                      assignee_id: null, description: '', priority: 'medium',
                      due_date: null, category: 'cat-1', tags: [],
                      checklist_title: '', attachments: [] },
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
  process.env.JWT_SECRET, { expiresIn: '1h' },
);

const put = (body) =>
  request(app).put('/api/cards/card-1').set('Authorization', `Bearer ${token}`).send(body);

const post = (body) =>
  request(app).post('/api/cards').set('Authorization', `Bearer ${token}`)
    .send({ columnId: 'col-1', boardId: 'board-1', title: 'Recién nacida', ...body });

beforeEach(() => { __state.cardUpdates = []; __state.cardInserts = []; });

describe('PUT /api/cards/:id — la categoría vacía', () => {
  test('se guarda como NULL, no como cadena vacía', async () => {
    const res = await put({ category: '' });

    expect(res.status).toBe(200);
    expect(__state.cardUpdates).toHaveLength(1);
    // La aserción que importa: NULL, y no `''`.
    expect(__state.cardUpdates[0].category).toBeNull();
  });

  test('CONTRAPRUEBA · una categoría de verdad se guarda tal cual', async () => {
    const res = await put({ category: 'cat-2' });

    expect(res.status).toBe(200);
    expect(__state.cardUpdates[0].category).toBe('cat-2');
  });

  test('y NO mandarla no toca el campo', async () => {
    // «No mandarlo» y «mandarlo vacío» son órdenes distintas, igual que con la
    // descripción. Si no se distinguieran, cambiar solo el título borraría la
    // categoría de cualquier tarjeta que la tuviera.
    const res = await put({ title: 'Otro título' });

    expect(res.status).toBe(200);
    expect(__state.cardUpdates[0]).not.toHaveProperty('category');
  });
});

describe('POST /api/cards — y en CREAR, lo mismo', () => {
  // ⚠️ ESTA MITAD LA DEVOLVIÓ EL VIGILANTE, Y CON MI PROPIO ARGUMENTO.
  //
  // Yo añadí la prueba del `PUT` diciendo que «leer no es medir», y dejé el
  // camino de crear sin medir — donde vive exactamente la misma línea. Medido:
  // mutar `category || null` a `?? null` en `createCard` dejaba los 3 casos de
  // este fichero en VERDE.
  //
  // Y crear está en lo que la tarjeta pide: «una tarjeta nueva nace sin
  // categoría salvo que se elija una». En el cliente eso quedó sellado; la
  // mitad que llega a la fila, no.
  //
  // El síntoma sería idéntico e igual de invisible: una tarjeta recién creada
  // con la categoría guardada como cadena vacía, que no es ninguna de las que
  // existen. No da error, no se ve en pantalla, y solo aparece en la fila.
  test('una categoría vacía se guarda como NULL', async () => {
    const res = await post({ category: '' });

    expect(res.status).toBe(201);
    expect(__state.cardInserts).toHaveLength(1);
    expect(__state.cardInserts[0].category).toBeNull();
  });

  test('CONTRAPRUEBA · una categoría de verdad se guarda tal cual', async () => {
    const res = await post({ category: 'cat-2' });

    expect(res.status).toBe(201);
    expect(__state.cardInserts[0].category).toBe('cat-2');
  });

  test('y no mandarla también nace sin categoría', async () => {
    // Aquí «no mandarlo» y «mandarlo vacío» SÍ significan lo mismo, al revés
    // que al actualizar: una tarjeta que nace no tiene valor previo que
    // conservar. Se fija para que la simetría con el `PUT` no se dé por hecha.
    const res = await post({});

    expect(res.status).toBe(201);
    expect(__state.cardInserts[0].category).toBeNull();
  });
});
