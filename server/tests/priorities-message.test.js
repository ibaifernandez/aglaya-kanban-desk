/**
 * El mensaje de prioridad inválida se DERIVA del conjunto, y las dos puertas
 * aceptan lo mismo.
 *
 * QUÉ DEFECTO VIGILA. `server/routes/cards.js` tenía el conjunto de prioridades
 * válidas —con `urgent` dentro— y **seis líneas más abajo** un mensaje de error
 * que enumeraba «low, medium, high, or none». La lista escrita a mano ya había
 * divergido de la lista real.
 *
 * POR QUÉ NO ES COSMÉTICO, que es lo que hace que esto merezca una prueba:
 * **el mensaje de error es la única documentación que lee quien acaba de
 * fallar.** Quien recibía ese `400` concluía que `urgent` no existe y bajaba su
 * tarjeta a `high`. Eso es exactamente la degradación silenciosa que el contrato
 * v2.0.0 se puso a evitar — solo que cometida por el llamante en vez de por el
 * servidor, y por eso **invisible desde este lado**: no hay error que leer ni
 * tarjeta perdida que buscar, hay una tarjeta con la urgencia equivocada.
 *
 * LAS DOS ASERCIONES QUE HACEN ESTO ÚTIL:
 *   1. El mensaje nombra TODAS las válidas. Escrito como bucle sobre la lista y
 *      no como una cadena fija: una prueba que compare contra un literal es otra
 *      copia de la lista, y se desincronizaría igual que la que vino a arreglar.
 *   2. Las DOS puertas aceptan exactamente el mismo conjunto. Había un `Set` por
 *      fichero; si vuelven a separarse, esto se pone rojo antes de que un
 *      llamante descubra que una puerta acepta lo que la otra rechaza.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

jest.mock('../utils/supabase', () => {
  const chainFor = (table) => {
    let rows = [];
    if (table === 'users')       rows = [{ id: 'user-1', name: 'Kanban Rail', email: 'rail@aglaya.biz' }];
    if (table === 'workspaces')  rows = [{ id: 'ws-1', name: 'Espacio', organization_id: 'org-1', type: 'interno' }];
    if (table === 'boards')      rows = [{ id: 'board-1', workspace_id: 'ws-1', title: 'Tablero' }];
    if (table === 'columns')     rows = [{ id: 'col-1', board_id: 'board-1', title: 'Backlog', order: 1 }];

    const chain = {
      select: () => chain,
      eq: () => chain,
      ilike: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      update: () => chain,
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: { id: 'card-1' }, error: null }) }),
      }),
      single: () => {
        if (table === 'cards') {
          return Promise.resolve({
            data: { id: 'card-1', column_id: 'col-1', board_id: 'board-1', title: 'T',
                    description: '', checklist: [], assignee_id: null, tags: [], order: 1,
                    priority: 'medium', created_at: null, updated_at: null },
            error: null,
          });
        }
        if (table === 'boards')            return Promise.resolve({ data: { id: 'board-1', workspace_id: 'ws-1' }, error: null });
        if (table === 'workspace_members') return Promise.resolve({ data: { workspace_id: 'ws-1', user_id: 'user-1', role: 'owner' }, error: null });
        if (table === 'workspaces')        return Promise.resolve({ data: { id: 'ws-1', type: 'interno' }, error: null });
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
    };
    return chain;
  };
  return { supabaseAdmin: { from: chainFor } };
});

const { VALID_PRIORITIES, priorityList } = require('../constants/priorities');
const app = require('../app');

const token = jwt.sign(
  { id: 'user-1', email: 'rail@aglaya.biz', role: 'admin', organizationId: 'org-1' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' },
);

const putCard = (body) =>
  request(app).put('/api/cards/card-1').set('Authorization', `Bearer ${token}`).send(body);

const postInternal = (body) =>
  request(app)
    .post('/api/internal/create-card')
    .set('x-task-secret', 'test-task-secret')
    .send(body);

describe('el mensaje de prioridad inválida no miente sobre lo que se acepta', () => {
  it('nombra TODAS las prioridades válidas, `urgent` incluida', async () => {
    const res = await putCard({ priority: 'no-existe' });

    expect(res.status).toBe(400);
    // Bucle sobre la lista viva, no contra un literal: un literal aquí sería
    // otra copia de la lista y se desincronizaría igual que la que se arregló.
    for (const p of VALID_PRIORITIES) {
      expect(res.body.error).toContain(p);
    }
  });

  it('y en concreto `urgent`, que es la que faltaba', async () => {
    const res = await putCard({ priority: 'no-existe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('urgent');
  });

  it('el listado derivado no se queda corto ni le sobra nada', () => {
    expect(priorityList().split(', ').sort()).toEqual([...VALID_PRIORITIES].sort());
  });
});

describe('las dos puertas aceptan el mismo conjunto', () => {
  // Había un `Set` escrito a mano por fichero. Si vuelven a separarse, esto se
  // pone rojo antes de que un llamante descubra que una puerta acepta lo que la
  // otra rechaza.
  it.each([...VALID_PRIORITIES])('la puerta con JWT acepta «%s»', async (p) => {
    const res = await putCard({ priority: p });
    expect(res.status).not.toBe(400);
  });

  it.each([...VALID_PRIORITIES])('la puerta interna acepta «%s»', async (p) => {
    const res = await postInternal({
      title: 'Tarea',
      boardName: 'Tablero',
      workspaceName: 'Espacio',
      assignee: 'rail@aglaya.biz',
      priority: p,
    });
    // Puede fallar por otras cosas del doble, pero NUNCA por la prioridad.
    expect(String(res.body.error ?? '')).not.toMatch(/priority/i);
  });
});
