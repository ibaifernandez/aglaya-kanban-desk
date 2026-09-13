/**
 * La matriz de permisos se cumple — y nadie la esquiva nombrando otro espacio. Tarjeta `05efbd1d`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS COSAS DISTINTAS, Y LA TARJETA SOLO VEÍA UNA
 *
 * 1. LA MATRIZ. `docs/PERMISSIONS.md` dice qué puede hacer cada papel dentro de
 *    un espacio. La auditoría del 2026-09-11 afirmó que **cinco de sus diez
 *    filas no se aplicaban** porque las rutas de tableros, columnas y tarjetas se
 *    montan solo con `requireWorkspaceMember`, que no mira papel.
 *
 *    **Medido: no es así.** Los manejadores comprueban el papel POR DENTRO
 *    —`createBoard`, `deleteBoard`, `createColumn`, `deleteColumn`,
 *    `deleteCard`, y `updateBoard` para mover entre espacios—. La auditoría leyó
 *    el montaje y el middleware, no los manejadores. El primer bloque de esta
 *    prueba fija que esas comprobaciones existen y muerden: hasta hoy **no las
 *    sostenía ninguna prueba**, y eso sí era cierto.
 *
 * 2. EL HUECO QUE NO VIO NADIE. `requireWorkspaceMember` decidía en qué espacio
 *    estás mirando **primero `req.body.workspaceId`**, y solo si faltaba,
 *    resolviéndolo desde el recurso que se toca. Así que el PAPEL con el que se
 *    juzgaba la petición era el que tuvieras **en el espacio que tú nombrabas**,
 *    no en el del recurso.
 *
 *    Cualquiera es `owner` de su propio espacio personal. Mandando ese
 *    `workspaceId` en el cuerpo, **actuaba como propietario sobre tarjetas y
 *    tableros de un espacio del que ni siquiera es miembro**. Eso no es una fila
 *    de la matriz que falla: es la matriz entera saltada.
 *
 * ⚠️ SUPERFICIE HOY: cero. En los diez espacios que ve el riel solo hay papeles
 * `owner` y `admin` —medido con `list_members` el 2026-09-13—, y las tres
 * cuentas son de confianza. **Es un requisito previo a la primera cuenta de
 * fuera**, que es para lo que existen los espacios `externo`.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

// Todo lo que llega a escribirse, por tabla. Es la segunda aserción del bloque
// del hueco: no basta con que la respuesta sea 403, no puede haberse escrito nada.
const escrituras = [];

jest.mock('../utils/supabase', () => {
  const TABLAS = {
    workspaces: [
      { id: 'ws-propio', type: 'personal', organization_id: 'org-1' },
      { id: 'ws-ajeno',  type: 'interno',  organization_id: 'org-1' },
      { id: 'ws-lejano', type: 'interno',  organization_id: 'org-1' },
      { id: 'ws-cliente', type: 'externo', organization_id: 'org-1' },
    ],
    // El papel de cada usuario en cada espacio lo pone el caso, no la fixture:
    // ver `estado.papeles`.
    workspace_members: [],
    boards: [
      { id: 'b-propio', title: 'Propio', workspace_id: 'ws-propio', organization_id: 'org-1', order: 1 },
      { id: 'b-ajeno',  title: 'Ajeno',  workspace_id: 'ws-ajeno',  organization_id: 'org-1', order: 1 },
      { id: 'b-lejano', title: 'Lejano', workspace_id: 'ws-lejano', organization_id: 'org-1', order: 1 },
      { id: 'b-cliente', title: 'Cliente', workspace_id: 'ws-cliente', organization_id: 'org-1', order: 1 },
    ],
    columns: [
      { id: 'c-propio', title: 'Backlog', board_id: 'b-propio', organization_id: 'org-1', order: 1 },
      { id: 'c-ajeno',  title: 'Backlog', board_id: 'b-ajeno',  organization_id: 'org-1', order: 1 },
      { id: 'c-lejano', title: 'Backlog', board_id: 'b-lejano', organization_id: 'org-1', order: 1 },
      { id: 'c-cliente', title: 'Backlog', board_id: 'b-cliente', organization_id: 'org-1', order: 1 },
    ],
    cards: [
      { id: 'k-ajeno',  title: 'Ajena',  board_id: 'b-ajeno',  column_id: 'c-ajeno',  organization_id: 'org-1', order: 1, priority: 'high', tags: [], checklist: [], attachments: [] },
      { id: 'k-lejano', title: 'Lejana', board_id: 'b-lejano', column_id: 'c-lejano', organization_id: 'org-1', order: 1, priority: 'high', tags: [], checklist: [], attachments: [] },
      { id: 'k-propio', title: 'Mía', board_id: 'b-propio', column_id: 'c-propio', organization_id: 'org-1', order: 1, priority: 'high', tags: [], checklist: [], attachments: [] },
    ],
  };

  const estado = {
    // { [workspace_id]: papel } del usuario que hace las peticiones.
    papeles: {},
    // Tabla cuya lectura devuelve error: para el caso «si no se puede resolver el
    // recurso, se cierra — no se vuelve al cuerpo».
    fallaLectura: null,
    reset() { estado.papeles = {}; estado.fallaLectura = null; },
  };

  const filas = (tabla) => {
    if (tabla === 'workspace_members') {
      return Object.entries(estado.papeles).map(([workspace_id, role]) => ({ workspace_id, user_id: 'u-yo', role }));
    }
    return JSON.parse(JSON.stringify(TABLAS[tabla] ?? []));
  };

  const supabaseAdmin = {
    from: (tabla) => {
      let rows = filas(tabla);
      let escritura = null;

      const chain = {
        select: () => chain,
        eq:  (c, v) => { rows = rows.filter((r) => r[c] === v); return chain; },
        neq: (c, v) => { rows = rows.filter((r) => r[c] !== v); return chain; },
        in:  (c, vs) => { rows = rows.filter((r) => vs.includes(r[c])); return chain; },
        gt:  () => chain, gte: () => chain, lt: () => chain, lte: () => chain,
        or:  () => chain, ilike: () => chain, order: () => chain, limit: () => chain,
        insert: (payload) => { escritura = { op: 'insert', tabla, payload }; escrituras.push(escritura); rows = [].concat(payload).map((p, i) => ({ id: `nuevo-${i}`, ...p })); return chain; },
        update: (payload) => { escritura = { op: 'update', tabla, payload }; escrituras.push(escritura); return chain; },
        delete: () => { escritura = { op: 'delete', tabla }; escrituras.push(escritura); return chain; },
        upsert: (payload) => { escrituras.push({ op: 'upsert', tabla, payload }); return chain; },
        rpc: () => Promise.resolve({ data: null, error: null }),
        single: () => (estado.fallaLectura === tabla
          ? Promise.resolve({ data: null, error: { message: 'lectura fallida' } })
          : Promise.resolve({ data: rows[0] ?? null, error: rows[0] ? null : { message: 'no rows' } })),
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        then: (res, rej) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(res, rej),
      };
      return chain;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  };

  return { supabaseAdmin, createAdminClient: () => supabaseAdmin, createPublicClient: () => ({ auth: {} }), __estado: estado };
});

const { __estado } = require('../utils/supabase');
const app = require('../app');

const token = jwt.sign(
  { id: 'u-yo', email: 'yo@example.com', name: 'Yo', role: 'colaborador', organizationId: 'org-1' },
  'test-secret',
  { expiresIn: '15m' },
);
const conToken = (r) => r.set('Authorization', `Bearer ${token}`);

beforeEach(() => { __estado.reset(); escrituras.length = 0; });

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1 — la matriz, fila a fila, con el papel puesto en el espacio del recurso.
// ─────────────────────────────────────────────────────────────────────────────
describe('la matriz de permisos se aplica', () => {
  const COMO = (papel) => { __estado.papeles = { 'ws-ajeno': papel }; };

  describe('un invitado', () => {
    beforeEach(() => COMO('guest'));

    it.each([
      ['crear tableros',   () => request(app).post('/api/boards').send({ title: 'x', workspaceId: 'ws-ajeno' })],
      ['borrar tableros',  () => request(app).delete('/api/boards/b-ajeno')],
      ['crear columnas',   () => request(app).post('/api/boards/b-ajeno/columns').send({ title: 'x' })],
      ['borrar columnas',  () => request(app).delete('/api/columns/c-ajeno')],
      ['borrar tarjetas',  () => request(app).delete('/api/cards/k-ajeno')],
    ])('NO puede %s', async (_, peticion) => {
      const res = await conToken(peticion());
      expect(res.status).toBe(403);
    });

    it('NO puede eliminar a otro miembro', async () => {
      const res = await conToken(request(app).delete('/api/workspaces/ws-ajeno/members/otro'));
      expect(res.status).toBe(403);
    });

    it('SÍ puede editar tarjetas', async () => {
      const res = await conToken(request(app).put('/api/cards/k-ajeno').send({ title: 'editada' }));
      expect(res.status).not.toBe(403);
    });

    // La contraparte: la matriz SÍ le deja crear tarjetas. Sin esto, un
    // middleware que respondiera 403 a todo pasaría el bloque de arriba.
    it('SÍ puede crear tarjetas', async () => {
      const res = await conToken(request(app).post('/api/cards')
        .send({ title: 'x', boardId: 'b-ajeno', columnId: 'c-ajeno', priority: 'high' }));
      expect(res.status).not.toBe(403);
    });
  });

  describe('un miembro', () => {
    beforeEach(() => COMO('member'));

    it('SÍ puede borrar tableros', async () => {
      const res = await conToken(request(app).delete('/api/boards/b-ajeno'));
      expect(res.status).not.toBe(403);
    });

    it('NO puede configurar el espacio', async () => {
      const res = await conToken(request(app).patch('/api/workspaces/ws-ajeno').send({ name: 'x' }));
      expect(res.status).toBe(403);
    });

    it('NO puede añadir miembros', async () => {
      const res = await conToken(request(app).post('/api/workspaces/ws-ajeno/members').send({ userId: 'otro', role: 'member' }));
      expect(res.status).toBe(403);
    });

    // ⚠️ Las dos filas que faltaban, y las señaló el vigilante al revisar: quitó
    // `requireWorkspaceRole('owner','admin')` de estas dos rutas y la batería
    // entera siguió en verde. La matriz decía «verificado por prueba» sin que lo
    // estuvieran.
    it('NO puede cambiar el papel de otro miembro', async () => {
      const res = await conToken(request(app).patch('/api/workspaces/ws-ajeno/members/otro').send({ role: 'admin' }));
      expect(res.status).toBe(403);
    });

    it('NO puede mover un tablero a otro espacio, aunque sea miembro de los dos', async () => {
      __estado.papeles = { 'ws-ajeno': 'member', 'ws-propio': 'member' };
      const res = await conToken(request(app).put('/api/boards/b-ajeno').send({ workspaceId: 'ws-propio' }));
      expect(res.status).toBe(403);
    });

    // Contrapartes: sin ellas, restringir DE MÁS pasaría la prueba.
    it('SÍ puede crear columnas', async () => {
      const res = await conToken(request(app).post('/api/boards/b-ajeno/columns').send({ title: 'x' }));
      expect(res.status).not.toBe(403);
    });

    it('SÍ puede borrar columnas', async () => {
      const res = await conToken(request(app).delete('/api/columns/c-ajeno'));
      expect(res.status).not.toBe(403);
    });

    it('SÍ puede crear tableros', async () => {
      const res = await conToken(request(app).post('/api/boards').send({ title: 'x', workspaceId: 'ws-ajeno' }));
      expect(res.status).not.toBe(403);
    });

    it('SÍ puede borrar tarjetas', async () => {
      const res = await conToken(request(app).delete('/api/cards/k-ajeno'));
      expect(res.status).not.toBe(403);
    });
  });

  it('un admin NO puede eliminar el espacio', async () => {
    COMO('admin');
    const res = await conToken(request(app).delete('/api/workspaces/ws-ajeno'));
    expect(res.status).toBe(403);
  });

  // Y lo que el admin SÍ puede, para que un gate endurecido a `owner` se note.
  it.each([
    ['configurar el espacio',         () => request(app).patch('/api/workspaces/ws-ajeno').send({ name: 'x' })],
    ['cambiar el papel de un miembro', () => request(app).patch('/api/workspaces/ws-ajeno/members/otro').send({ role: 'member' })],
    ['eliminar a un miembro',          () => request(app).delete('/api/workspaces/ws-ajeno/members/otro')],
  ])('un admin SÍ puede %s', async (_, peticion) => {
    COMO('admin');
    const res = await conToken(peticion());
    expect(res.status).not.toBe(403);
  });

  it('un propietario SÍ puede eliminar el espacio', async () => {
    COMO('owner');
    const res = await conToken(request(app).delete('/api/workspaces/ws-ajeno'));
    expect(res.status).not.toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2 — EL HUECO. El usuario es `owner` de su espacio personal y NO es
// miembro de `ws-lejano`. Nombra su espacio en el cuerpo y toca recursos del otro.
// ─────────────────────────────────────────────────────────────────────────────
describe('nadie esquiva la matriz nombrando otro espacio en el cuerpo', () => {
  beforeEach(() => { __estado.papeles = { 'ws-propio': 'owner' }; });

  const escribioEnLejano = () => escrituras.some((e) => e.op !== 'insert' || e.payload?.board_id === 'b-lejano');

  it.each([
    ['editar una tarjeta ajena',   () => request(app).put('/api/cards/k-lejano').send({ workspaceId: 'ws-propio', title: 'robada' })],
    ['mover una tarjeta ajena',    () => request(app).put('/api/cards/k-lejano/move').send({ workspaceId: 'ws-propio', columnId: 'c-lejano', order: 2 })],
    ['borrar una tarjeta ajena',   () => request(app).delete('/api/cards/k-lejano').send({ workspaceId: 'ws-propio' })],
    ['borrar un tablero ajeno',    () => request(app).delete('/api/boards/b-lejano').send({ workspaceId: 'ws-propio' })],
    ['borrar una columna ajena',   () => request(app).delete('/api/columns/c-lejano').send({ workspaceId: 'ws-propio' })],
    ['llevarse un tablero ajeno a su espacio', () => request(app).put('/api/boards/b-lejano').send({ workspaceId: 'ws-propio' })],
    ['leer las tarjetas de un tablero ajeno',  () => request(app).get('/api/boards/b-lejano/cards').send({ workspaceId: 'ws-propio' })],
  ])('NO puede %s', async (_, peticion) => {
    const res = await conToken(peticion());

    expect(res.status).toBe(403);
    expect(escribioEnLejano()).toBe(false);
  });

  // ⚠️ La variante que no lleva `workspaceId`: una columna ajena emparejada con
  // un tablero propio. Si se resuelve solo por el tablero, pasa y la tarjeta
  // aterriza en una columna de un espacio del que no es miembro.
  it('NO puede crear una tarjeta en una columna ajena emparejándola con un tablero propio', async () => {
    const res = await conToken(request(app).post('/api/cards')
      .send({ title: 'colada', boardId: 'b-propio', columnId: 'c-lejano', priority: 'high' }));

    expect(res.status).toBe(403);
    expect(escrituras.filter((e) => e.tabla === 'cards')).toEqual([]);
  });

  // ⚠️ La variante de `moveCard`: la tarjeta es SUYA —el actor es su espacio—,
  // pero la columna de destino es de un espacio del que no es miembro. El
  // manejador no miraba el destino, así que la tarjeta aterrizaba allí.
  it('NO puede mover su propia tarjeta a una columna de un espacio ajeno', async () => {
    const res = await conToken(request(app).put('/api/cards/k-propio/move')
      .send({ columnId: 'c-lejano', order: 1 }));

    expect(res.status).toBe(403);
    expect(escrituras.filter((e) => e.tabla === 'cards')).toEqual([]);
  });

  // La contraparte, sin la cual el bloque pasaría con un middleware que lo
  // rechazara todo: en SU espacio sigue pudiendo hacerlo todo.
  it('en su propio espacio sigue pudiendo crear tableros', async () => {
    const res = await conToken(request(app).post('/api/boards').send({ title: 'nuevo', workspaceId: 'ws-propio' }));
    expect(res.status).not.toBe(403);
  });

  it('y crear tarjetas con tablero y columna propios', async () => {
    const res = await conToken(request(app).post('/api/cards')
      .send({ title: 'mía', boardId: 'b-propio', columnId: 'c-propio', priority: 'high' }));
    expect(res.status).not.toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2c — si el recurso de la URL no se resuelve, se CIERRA. No se vuelve al
// `workspaceId` del cuerpo. Nota de diseño del vigilante: un error transitorio al
// leer el tablero fallaba en abierto justo en el punto que este arreglo cierra.
// ─────────────────────────────────────────────────────────────────────────────
describe('si el recurso de la URL no se resuelve, no manda el cuerpo', () => {
  beforeEach(() => { __estado.papeles = { 'ws-propio': 'owner' }; });

  it('un recurso que no existe no deja elegir espacio', async () => {
    const res = await conToken(request(app).delete('/api/cards/no-existe').send({ workspaceId: 'ws-propio' }));

    expect(res.status).toBe(400);
    expect(escrituras).toEqual([]);
  });

  it.each([
    ['del tablero',  'boards', () => request(app).put('/api/boards/b-lejano').send({ workspaceId: 'ws-propio', title: 'x' })],
    ['de la tarjeta', 'cards', () => request(app).delete('/api/cards/k-lejano').send({ workspaceId: 'ws-propio' })],
  ])('una lectura fallida %s tampoco', async (_, tabla, peticion) => {
    __estado.fallaLectura = tabla;
    const res = await conToken(peticion());

    expect(res.status).toBe(400);
    expect(escrituras).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2b — un CLIENTE solo entra en espacios `externo`, y eso vale para TODOS
// los espacios que toque la petición, no solo para el primero.
// ─────────────────────────────────────────────────────────────────────────────
describe('un cliente no alcanza un espacio interno nombrándolo en el cuerpo', () => {
  const tokenCliente = jwt.sign(
    { id: 'u-yo', email: 'cliente@example.com', name: 'Cliente', role: 'cliente', organizationId: 'org-1' },
    'test-secret', { expiresIn: '15m' },
  );

  // Aunque figure como miembro del interno —un error de alta, por ejemplo—, el
  // tipo de espacio manda. Es lo que declara PERMISSIONS.md, regla hardened 3.
  it('ni emparejando una columna interna con un tablero externo suyo', async () => {
    __estado.papeles = { 'ws-cliente': 'member', 'ws-ajeno': 'member' };
    const res = await request(app).post('/api/cards')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ title: 'x', boardId: 'b-cliente', columnId: 'c-ajeno', priority: 'high' });

    expect(res.status).toBe(403);
  });

  it('y en su espacio externo sí puede', async () => {
    __estado.papeles = { 'ws-cliente': 'member' };
    const res = await request(app).post('/api/cards')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({ title: 'x', boardId: 'b-cliente', columnId: 'c-cliente', priority: 'high' });

    expect(res.status).not.toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 3 — mover un tablero entre espacios exige papel en LOS DOS.
// ─────────────────────────────────────────────────────────────────────────────
describe('mover un tablero entre espacios mira el origen y el destino', () => {
  it('siendo admin del origen pero solo invitado en el destino, NO puede', async () => {
    __estado.papeles = { 'ws-ajeno': 'admin', 'ws-propio': 'guest' };
    const res = await conToken(request(app).put('/api/boards/b-ajeno').send({ workspaceId: 'ws-propio' }));
    expect(res.status).toBe(403);
  });

  // ⚠️ La otra mitad, y la que sobrevivía a la mutación: quitar la comprobación
  // del ORIGEN dejaba el banco en verde, porque ningún caso tenía papel bajo en el
  // origen y alto en el destino — que es justo el caso de llevarse un tablero.
  it('siendo solo miembro del origen, aunque sea dueño del destino, NO puede', async () => {
    __estado.papeles = { 'ws-ajeno': 'member', 'ws-propio': 'owner' };
    const res = await conToken(request(app).put('/api/boards/b-ajeno').send({ workspaceId: 'ws-propio' }));
    expect(res.status).toBe(403);
  });

  it('siendo admin de los dos, SÍ puede', async () => {
    __estado.papeles = { 'ws-ajeno': 'admin', 'ws-propio': 'owner' };
    const res = await conToken(request(app).put('/api/boards/b-ajeno').send({ workspaceId: 'ws-propio' }));
    expect(res.status).not.toBe(403);
  });
});
