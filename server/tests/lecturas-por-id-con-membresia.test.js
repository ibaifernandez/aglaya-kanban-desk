/**
 * `GET /api/columns/:id` y `GET /api/cards/:id` — las dos lecturas que el riel
 * hacía saltándose RLS. Tarjeta `34ff4d48`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ DEFECTO CIERRAN, Y POR QUÉ NO BASTA CON QUE DEVUELVAN EL DATO
 *
 * El servidor MCP necesitaba tres cosas que la API no exponía —el tablero de una
 * columna, el espacio de ese tablero, y el `checklist` de una tarjeta— y las leía
 * **directamente contra PostgREST con la llave `service_role`**, que se salta RLS
 * entera. Consecuencia: quien ejecutara ese servidor tenía la base completa
 * aunque la API le contestara 403. Y no se tapaba con configuración — `_cfg` cae
 * al fichero de secretos cuando la variable está VACÍA.
 *
 * Por eso **lo que estas pruebas vigilan no es que las rutas respondan**: es que
 * respondan **solo a quien es miembro**. Una ruta nueva que devolviera el dato a
 * cualquiera sería la misma fuga con mejor educación.
 *
 * El caso que más pesa es el de abajo del todo: un no-miembro recibe **403 y ni
 * un byte del recurso**. Si eso se pusiera verde devolviendo el cuerpo con un
 * código de error, el riel seguiría leyendo lo que no es suyo.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

const MIEMBRO    = 'user-miembro';
const EXTRANO    = 'user-extrano';

jest.mock('../utils/supabase', () => {
  const estado = {
    // Quién es miembro de qué. `ws-mio` es el único espacio de `user-miembro`.
    membresias: [{ workspace_id: 'ws-mio', user_id: 'user-miembro', role: 'owner' }],
    columna: { id: 'col-1', board_id: 'board-1', boards: { workspace_id: 'ws-mio' } },
    tarjeta: {
      id: 'card-1', column_id: 'col-1', board_id: 'board-1', title: 'Tarea',
      description: 'brief', priority: 'high', checklist: [{ text: 'primero', done: false }],
      tags: [], attachments: [], order: 1,
      created_at: '2026-11-02T00:00:00Z', updated_at: '2026-11-02T00:00:00Z',
    },
  };

  const supabaseAdmin = {
    from: (tabla) => {
      const filtros = {};
      const chain = {
        select: () => chain,
        eq: (col, val) => { filtros[col] = val; return chain; },
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        single: () => {
          if (tabla === 'columns') {
            return Promise.resolve(
              filtros.id === estado.columna.id
                ? { data: estado.columna, error: null }
                : { data: null, error: { message: 'no rows' } },
            );
          }
          if (tabla === 'cards') {
            return Promise.resolve(
              filtros.id === estado.tarjeta.id
                ? { data: estado.tarjeta, error: null }
                : { data: null, error: { message: 'no rows' } },
            );
          }
          if (tabla === 'boards') {
            return Promise.resolve({ data: { id: 'board-1', workspace_id: 'ws-mio' }, error: null });
          }
          if (tabla === 'workspace_members') {
            const hit = estado.membresias.find(
              (m) => m.workspace_id === filtros.workspace_id && m.user_id === filtros.user_id,
            );
            return Promise.resolve(hit ? { data: hit, error: null } : { data: null, error: { message: 'no rows' } });
          }
          if (tabla === 'workspaces') {
            return Promise.resolve({ data: { id: 'ws-mio', type: 'interno' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  };

  return { supabaseAdmin, __estado: estado };
});

const app = require('../app');

const tokenDe = (id, role = 'colaborador') =>
  jwt.sign({ id, email: `${id}@aglaya.biz`, role, organizationId: 'org-1' },
           process.env.JWT_SECRET, { expiresIn: '1h' });

const pedir = (ruta, quien, role) =>
  request(app).get(ruta).set('Authorization', `Bearer ${tokenDe(quien, role)}`);

describe('GET /api/columns/:id — el tablero y el espacio, en UNA llamada', () => {
  it('a un miembro le devuelve las dos cosas', async () => {
    const res = await pedir('/api/columns/col-1', MIEMBRO);

    expect(res.status).toBe(200);
    expect(res.body.data.boardId).toBe('board-1');
    // ⚠️ `workspaceId` es la mitad que ahorra la segunda lectura. Sin él, el riel
    // tendría que preguntar por el tablero aparte — que es exactamente lo que
    // hacía con la llave que saltaba RLS.
    expect(res.body.data.workspaceId).toBe('ws-mio');
  });

  // ⚠️ ESTE CASO DICE LO QUE PASA, NO LO QUE YO CREÍA. Lo escribí como «404 del
  // manejador» y un mutante lo desmintió: poner 500 en el manejador lo dejaba en
  // verde, porque **el manejador no llega a ejecutarse**. `requireWorkspaceMember`
  // no puede resolver el espacio de una columna que no existe y corta antes con
  // 400 (`workspace.js`: «cerrar, no abrir»).
  //
  // Se deja fijado el 400 porque es lo que el riel va a recibir de verdad. El 404
  // del manejador queda como red de debajo —para el caso en que el recurso
  // desaparezca entre la comprobación y la lectura— y **no está cubierto por
  // ninguna prueba**: decirlo aquí vale más que una aserción que no lo alcanza.
  it('una columna que no existe se corta ANTES del manejador, con 400', async () => {
    const res = await pedir('/api/columns/col-fantasma', MIEMBRO);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/workspace no encontrado/i);
  });
});

describe('GET /api/cards/:id — la tarjeta, con su checklist', () => {
  it('a un miembro le devuelve el checklist', async () => {
    const res = await pedir('/api/cards/card-1', MIEMBRO);

    expect(res.status).toBe(200);
    expect(res.body.data.checklist).toEqual([{ text: 'primero', done: false }]);
  });
});

// ── LO QUE DE VERDAD CIERRA LA TARJETA ──────────────────────────────────────
describe('y a quien NO es miembro no le llega nada', () => {
  it('la columna: 403, y sin el recurso dentro', async () => {
    const res = await pedir('/api/columns/col-1', EXTRANO);

    expect(res.status).toBe(403);
    // No basta el código: lo que no puede salir es el DATO. Una respuesta de
    // error que arrastre el cuerpo es la misma fuga con otro envoltorio.
    expect(JSON.stringify(res.body)).not.toContain('board-1');
    expect(JSON.stringify(res.body)).not.toContain('ws-mio');
  });

  it('la tarjeta: 403, y sin el checklist dentro', async () => {
    const res = await pedir('/api/cards/card-1', EXTRANO);

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('primero');
  });

  // El riel corre como un usuario normal desde `34ff4d48`. Si alguien le diera
  // `superadmin` para «arreglar» un 403, el aislamiento desaparecería entero sin
  // que ninguna prueba de las de arriba se enterase: este caso lo deja escrito.
  it('⚠️ un superadmin SÍ pasa — y por eso el riel no puede serlo', async () => {
    const res = await pedir('/api/columns/col-1', EXTRANO, 'superadmin');

    expect(res.status).toBe(200);
    expect(res.body.data.workspaceId).toBe('ws-mio');
  });
});
