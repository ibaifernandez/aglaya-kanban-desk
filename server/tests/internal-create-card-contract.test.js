/**
 * POST /api/internal/create-card — contrato consistente.
 *
 * Tarjeta: «Las dos puertas enseñan dos contratos distintos, y el acuse no deja
 * comprobar el destino».
 *
 * Dos asimetrías que cierra este archivo:
 *   1. Prioridad inválida se corregía en silencio a 'medium'. Ahora → 400.
 *      (La puerta de ACTUALIZAR ya devolvía 400: la misma regla existía y no se
 *      aplicaba en los dos sitios.)
 *   2. El acuse devolvía tablero y columna resueltos, pero el espacio TAL COMO
 *      ENTRÓ — justo el campo por el que se puede aterrizar mal, y el único que
 *      no se podía comprobar. Ahora devuelve los tres IDs resueltos.
 *
 * POR QUÉ EL MOCK CAMBIÓ (2026-08-06).
 * El original devolvía la MISMA fila con forma de workspace para toda tabla:
 * `boards` y `columns` incluidas. Con él, `board.title` era `undefined` y el
 * camino del 201 recorría datos que no existen. La única prueba del acuse
 * asertaba `workspace_id` y nada más, y estaba envuelta en `if (res.status ===
 * 201)`, así que un 500 la habría dejado pasar en verde. Comprobado por mutación
 * sobre el archivo original:
 *
 *   · borrar `board_id` y `column_id` del acuse       → las 3 seguían verdes
 *   · devolver `workspace: workspaceName` (sin resolver, el defecto original)
 *                                                     → las 3 seguían verdes
 *
 * Es decir: la prueba del acuse no vigilaba el defecto que el PR decía cerrar.
 * Este mock da a cada tabla su forma real, y el nombre de espacio que se envía
 * es PARCIAL (`Kanban`) para que «resuelto» y «tal como entró» sean strings
 * distintos y la diferencia sea observable.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

jest.mock('../utils/supabase', () => {
  const TABLES = {
    workspaces: [
      { id: 'ws-1', name: 'AGLAYA Kanban', type: 'interno', emoji: '📊', organization_id: 'org-1' },
    ],
    boards: [
      { id: 'board-1', workspace_id: 'ws-1', title: '🛠 Operaciones', order: 1 },
    ],
    columns: [
      { id: 'col-backlog', board_id: 'board-1', title: 'Backlog',  order: 1 },
      { id: 'col-hecho',   board_id: 'board-1', title: '✅ Hecho', order: 2 },
    ],
    users: [
      { id: 'user-rail', name: 'Kanban Rail', email: 'kanban-rail@aglaya.biz' },
    ],
    cards: [],
  };

  return {
    supabaseAdmin: {
      from: (table) => {
        let data = JSON.parse(JSON.stringify(TABLES[table] ?? []));

        const chain = {
          select: () => chain,
          eq: (col, val) => { data = data.filter(r => r[col] === val); return chain; },
          // ILIKE fiel: un patrón SIN comodines es igualdad, no «contiene». La
          // ruta usa las dos formas y significan cosas distintas — `%nombre%`
          // para tolerar emojis en títulos, y exacto para el email del
          // responsable, donde un parcial engancharía a la persona de al lado.
          // Un mock que trata las dos igual no puede distinguirlas.
          ilike: (col, pattern) => {
            const p = String(pattern);
            const needle = p.replace(/%/g, '').toLowerCase();
            const openStart = p.startsWith('%');
            const openEnd   = p.endsWith('%');
            data = data.filter(r => {
              const s = String(r[col] ?? '').toLowerCase();
              if (openStart && openEnd) return s.includes(needle);
              if (openStart)            return s.endsWith(needle);
              if (openEnd)              return s.startsWith(needle);
              return s === needle;
            });
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          insert: (row) => ({
            select: () => ({
              single: () => Promise.resolve({
                data: { id: 'card-123', ...row },
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

describe('POST /api/internal/create-card — contrato consistente', () => {
  describe('Prioridad: se rechaza, no se corrige', () => {
    it('rechaza con 400 si priority inválida', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA Kanban',
        priority: 'invalid',
        assignee: 'kanban-rail@aglaya.biz',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/priority/i);
    });

    it('el 400 lista las prioridades válidas', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA Kanban',
        priority: 'totally-wrong',
        assignee: 'kanban-rail@aglaya.biz',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/urgent/);
      expect(res.body.error).toMatch(/none/);
    });

    it('una priority válida sigue pasando', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA Kanban',
        priority: 'high',
        assignee: 'kanban-rail@aglaya.biz',
      });
      expect(res.status).toBe(201);
      expect(res.body.card.priority).toBe('high');
    });

    // Esta prueba decía «sin priority, sigue cayendo en medium» y era correcta:
    // describía el comportamiento anterior. El contrato la invirtió porque ese
    // comportamiento era el defecto — la mitad CALLADA del mismo problema que el
    // 400 de prioridad inválida ya cerraba. Se deja escrito el antes para que
    // quien lo lea vea que es un cambio de contrato, no una prueba que se rompió.
    it('sin priority, rechaza con 400 — ya no cae en medium', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'AGLAYA Kanban',
        assignee: 'kanban-rail@aglaya.biz',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/priority/i);
    });
  });

  describe('Acuse: los tres destinos, resueltos', () => {
    // El nombre que se envía es PARCIAL a propósito. Si la ruta vuelve a
    // devolver la entrada sin resolver, `workspace` valdría 'Kanban' y esta
    // prueba se pone roja — que es exactamente el defecto de la tarjeta.
    it('resuelve el workspace: devuelve id y nombre canónico, no la entrada', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'Kanban',
        priority: 'medium',
        assignee: 'kanban-rail@aglaya.biz',
      });
      expect(res.status).toBe(201);
      expect(res.body.card.workspace_id).toBe('ws-1');
      expect(res.body.card.workspace).toBe('AGLAYA Kanban');
      expect(res.body.card.workspace).not.toBe('Kanban');
    });

    it('resuelve el tablero y la columna: id y título de cada uno', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'Kanban',
        priority: 'medium',
        assignee: 'kanban-rail@aglaya.biz',
      });
      expect(res.status).toBe(201);
      expect(res.body.card.board_id).toBe('board-1');
      expect(res.body.card.board).toBe('🛠 Operaciones');
      expect(res.body.card.column_id).toBe('col-backlog');
      expect(res.body.card.column).toBe('Backlog');
    });

    it('el acuse trae el id de la tarjeta creada', async () => {
      const res = await post({
        title: 'Tarea',
        boardName: 'Operaciones',
        workspaceName: 'Kanban',
        priority: 'medium',
        assignee: 'kanban-rail@aglaya.biz',
      });
      expect(res.status).toBe(201);
      expect(res.body.card.id).toBe('card-123');
    });
  });
});
