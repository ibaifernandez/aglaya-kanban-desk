/**
 * `POST /api/cards` — nacer asignada también avisa.
 *
 * Tarjeta: «La Puerta 1 crea la tarjeta y la asigna en dos pasos, y nada cubre
 * el hueco» (`2ae1cf5e`).
 *
 * QUÉ DEFECTO CIERRA, Y POR QUÉ ESTA PRUEBA VIVE AQUÍ Y NO EN EL RIEL.
 *
 * La notificación de responsable vivía **solo** en `updateCard`. Eso obligaba al
 * riel a crear primero y asignar después, en dos escrituras, porque la segunda
 * era la única que avisaba. Y la segunda **no se comprobaba**: si fallaba,
 * quedaba una tarjeta escrita y sin dueño —invisible para el sistema de trabajo,
 * porque nadie la coge y no falla— y el llamante recibía una excepción que no
 * decía que ya existía.
 *
 * El riel ya no parte la escritura (`kanban-mcp/test_server.py` lo fija), pero
 * eso **solo es correcto si crear con responsable notifica**. Si esto se rompe,
 * el riel seguiría en verde y la notificación desaparecería en silencio: nadie
 * echa de menos un aviso que no llega. Por eso la aserción está aquí.
 *
 * Y cierra de paso un hueco que no tenía tarjeta: **la UI permite elegir
 * responsable al crear** (`client/src/components/CardModal/CardModal.jsx`), así
 * que hasta hoy un humano podía asignar a otro sin que se enterase.
 *
 * LO QUE SE ASIERTA es que la fila de notificación se escribe, no lo que
 * devuelve la ruta: el `201` era idéntico con aviso y sin él.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../utils/supabase', () => {
  const state = {
    notificaciones: [],   // filas que llegaron a `notifications`
    reset() { state.notificaciones.length = 0; },
  };

  const supabaseAdmin = {
    from: (table) => {
      let mode = 'select';
      let fila = null;
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
          if (table === 'notifications') {
            state.notificaciones.push(...filas);
            return Promise.resolve({ data: filas, error: null });
          }
          mode = 'insert';
          fila = filas[0];
          return chain;
        },

        single: () => {
          if (table === 'cards' && mode === 'insert') {
            return Promise.resolve({
              data: { id: 'card-nueva', ...fila, created_at: '2026-08-10T00:00:00Z',
                      updated_at: '2026-08-10T00:00:00Z' },
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

const crear = (body) =>
  request(app)
    .post('/api/cards')
    .set('Authorization', `Bearer ${token}`)
    .send({ columnId: 'col-1', boardId: 'board-1', title: 'Tarea', ...body });

// La notificación es fire-and-forget: la ruta contesta sin esperarla. Un tic del
// bucle de eventos basta y no se inventa un `sleep`, que sería una prueba que
// pasa por suerte.
const dejarQueCorraElAviso = () => new Promise((r) => setImmediate(r));

beforeEach(() => __state.reset());

describe('POST /api/cards — nacer asignada notifica', () => {
  it('crear con responsable deja la notificación de asignación', async () => {
    const res = await crear({ assigneeId: 'user-2' });
    expect(res.status).toBe(201);

    await dejarQueCorraElAviso();

    expect(__state.notificaciones).toHaveLength(1);
    const aviso = __state.notificaciones[0];
    expect(aviso.user_id).toBe('user-2');
    expect(aviso.type).toBe('card_assignment');
    expect(aviso.read).toBe(false);
    expect(aviso.payload.cardId).toBe('card-nueva');
    expect(aviso.payload.assignedBy).toBe('user-1');
  });

  it('crear SIN responsable no notifica a nadie', async () => {
    const res = await crear({});
    expect(res.status).toBe(201);

    await dejarQueCorraElAviso();
    expect(__state.notificaciones).toHaveLength(0);
  });

  // Misma guarda que en `updateCard`, y por el mismo motivo: avisarse a uno
  // mismo de algo que uno acaba de hacer es ruido, y el ruido se aprende a
  // ignorar — con lo que el aviso que sí importa se pierde con él.
  it('asignarse a uno mismo al crear no genera aviso', async () => {
    const res = await crear({ assigneeId: 'user-1' });
    expect(res.status).toBe(201);

    await dejarQueCorraElAviso();
    expect(__state.notificaciones).toHaveLength(0);
  });
});
