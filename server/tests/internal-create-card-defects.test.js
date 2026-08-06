/**
 * POST /api/internal/create-card — ambigüedad de destino.
 *
 * Tarjeta operativa: «Tres formas de aterrizar mal devolviendo éxito».
 * Este archivo cubre SOLO el defecto 1 (ambigüedad). Los defectos 2
 * (idempotencia) y 3 (orden / race) siguen ABIERTOS y no se prueban aquí.
 *
 * POR QUÉ NO HAY PRUEBAS DE LOS DEFECTOS 2 Y 3 (2026-08-06).
 * Las había, y eran peores que no tenerlas:
 *
 *   · La de idempotencia asertaba `res1.card.id === res2.card.id` y pasaba en
 *     verde. No porque el código sea idempotente —no lo es, no hay clave de
 *     idempotencia en ninguna parte— sino porque el mock devolvía el literal
 *     `'card-123'` en todas las inserciones. Comprobado por mutación: basta con
 *     que el mock devuelva un id distinto por inserción, que es lo que hace una
 *     base de datos real, para que la prueba se ponga roja. Afirmaba en verde
 *     una propiedad que el código no tiene, y el propio PR que la traía decía en
 *     su descripción que dejaba la idempotencia sin tocar. La suite contradecía
 *     al PR, y ganaba la suite: quien leyera «dos POSTs idénticos deberían
 *     devolver lo mismo ✓» concluiría que está resuelto.
 *
 *   · La del orden era `expect(true).toBe(true)` con un comentario. No mide
 *     nada; solo sube el recuento de pruebas, que es justo la cifra que se cita
 *     para decir que algo está cubierto.
 *
 * Una deuda se lleva en su tarjeta, que es donde se puede priorizar. Un test que
 * no puede fallar no es un recordatorio: es una afirmación falsa con palomita.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

// Mock que simula ambigüedad: dos workspaces con nombres parciales coincidentes.
// En la DB real esto no es hipotético: 7 de 13 espacios casan con `%AGLAYA%`.
jest.mock('../utils/supabase', () => {
  const mockWorkspacesData = [
    { id: 'ws-ambig-1', name: 'AGLAYA',      type: 'interno', emoji: '🚀', organization_id: 'org-1' },
    { id: 'ws-ambig-2', name: 'AGLAYA Docs', type: 'interno', emoji: '📚', organization_id: 'org-1' },
  ];

  const mockBoardsData = [
    { id: 'board-1', workspace_id: 'ws-ambig-1', title: '🛠 Operaciones', order: 1 },
    { id: 'board-2', workspace_id: 'ws-ambig-2', title: '🛠 Operaciones', order: 1 },
  ];

  const mockColumnsData = [
    { id: 'col-1', board_id: 'board-1', title: 'Backlog', order: 1 },
    { id: 'col-2', board_id: 'board-2', title: 'Backlog', order: 1 },
  ];

  // La ruta resuelve el responsable antes de escribir (lo exige el contrato).
  // Este archivo no prueba esa resolución —tiene la suya— pero sin un usuario
  // que resolver ninguna petición llegaría al código de ambigüedad.
  const mockUsersData = [
    { id: 'user-rail', name: 'Kanban Rail', email: 'kanban-rail@aglaya.biz' },
  ];

  return {
    supabaseAdmin: {
      from: (table) => {
        let data = [];
        if (table === 'workspaces') data = JSON.parse(JSON.stringify(mockWorkspacesData));
        if (table === 'boards')     data = JSON.parse(JSON.stringify(mockBoardsData));
        if (table === 'columns')    data = JSON.parse(JSON.stringify(mockColumnsData));
        if (table === 'users')      data = JSON.parse(JSON.stringify(mockUsersData));

        const chain = {
          select: () => chain,
          eq: (col, val) => {
            if (col === 'workspace_id')   data = data.filter(b => b.workspace_id === val);
            else if (col === 'board_id')  data = data.filter(c => c.board_id === val);
            else if (col === 'column_id') data = data.filter(c => c.column_id === val);
            else if (col === 'id')        data = data.filter(r => r.id === val);
            return chain;
          },
          ilike: (col, val) => {
            const searchTerm = val.replace(/%/g, '').toLowerCase();
            if (col === 'name')       data = data.filter(w => w.name.toLowerCase().includes(searchTerm));
            else if (col === 'title') data = data.filter(b => b.title.toLowerCase().includes(searchTerm));
            else if (col === 'email') data = data.filter(u => u.email.toLowerCase() === searchTerm);
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({
                data: {
                  id: 'card-123',
                  title: 'Test card',
                  priority: 'medium',
                  order: 1,
                  column_id: 'col-1',
                  board_id: 'board-1',
                },
                error: null,
              }),
            }),
          }),
          then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject),
        };
        return chain;
      },
    },
  };
});

const app = require('../app');

const SECRET = 'test-task-secret';
const post = (body) =>
  request(app)
    .post('/api/internal/create-card')
    .set('x-task-secret', SECRET)
    .send(body);

describe('POST /api/internal/create-card — ambigüedad de workspace', () => {
  it('rechaza con 400 si workspaceName casa con múltiples workspaces', async () => {
    const res = await post({
      title: 'Tarea',
      boardName: 'Operaciones',
      workspaceName: 'AGLAYA', // Casa con "AGLAYA" y "AGLAYA Docs"
      priority: 'medium',
      assignee: 'kanban-rail@aglaya.biz',
      caller: 'banco-de-pruebas',
    });
    // Antes: 201, cogiendo el primero de un orden que nadie fija.
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/múltiple|ambig|candidato/i);
  });

  // Sin aserción sobre `candidates`, borrar el campo entero de la ruta pasaba en
  // verde — comprobado por mutación. Y `candidates` es la mitad útil del 400:
  // un error que dice «ambiguo» sin decir entre qué obliga a adivinar otra vez.
  it('el 400 lista los candidatos, con id y nombre de cada uno', async () => {
    const res = await post({
      title: 'Tarea',
      boardName: 'Operaciones',
      workspaceName: 'AGLAYA',
      priority: 'medium',
      assignee: 'kanban-rail@aglaya.biz',
      caller: 'banco-de-pruebas',
    });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.candidates)).toBe(true);
    expect(res.body.candidates).toHaveLength(2);
    for (const candidate of res.body.candidates) {
      expect(typeof candidate.id).toBe('string');
      expect(typeof candidate.name).toBe('string');
    }
    expect(res.body.candidates.map(c => c.id).sort()).toEqual(['ws-ambig-1', 'ws-ambig-2']);
  });

  it('sin ambigüedad, crea la tarjeta correctamente', async () => {
    const res = await post({
      title: 'Tarea única',
      boardName: 'Operaciones',
      workspaceName: 'AGLAYA Docs', // Único match
      priority: 'medium',
      assignee: 'kanban-rail@aglaya.biz',
      caller: 'banco-de-pruebas',
    });
    expect(res.status).toBe(201);
    expect(res.body.card).toBeDefined();
  });
});
