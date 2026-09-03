/**
 * Los espacios de trabajo se pueden ordenar. Tarjeta `d0954969` (petición de Ibai).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAS DOS DECISIONES QUE ESTE BANCO FIJA, porque son de Ibai y no del código
 *
 *   · **El orden es POR SECCIÓN.** La vista agrupa por tipo y se arrastra dentro
 *     del grupo. Mezclar tipos en una llamada se rechaza con `400` en vez de
 *     guardarse: un orden global con secciones que lo parten hace que arrastrar
 *     a la posición 2 coloque la tarjeta en otro sitio.
 *   · **El orden es COMPARTIDO.** Vive en `workspaces`, así que lo ven todos los
 *     miembros. Si algún día se quiere por persona, no es esta columna.
 *
 * ⚠️ Y LA TRAMPA QUE NO SE COPIA. El molde natural era `reorderBoards`, que
 * renumera fila a fila con un `Promise.all` de `UPDATE` sueltos **sin comprobar
 * el resultado**: si uno falla, el orden queda medio aplicado y nadie se entera
 * (`c1efd488`). Aquí el reorden es **una sola sentencia** dentro de una función
 * de la base, y lo que este banco puede fijar desde fuera es que **el servidor
 * no renumera por su cuenta**: llama una vez a la función y ya.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

process.env.JWT_SECRET = 'test-secret';

const YO = 'user-1';
const ORG = 'org-1';

jest.mock('../utils/supabase', () => {
  const estado = {
    // workspaces de los que YO soy miembro
    mios: [
      { id: 'ws-a', type: 'interno', organization_id: 'org-1' },
      { id: 'ws-b', type: 'interno', organization_id: 'org-1' },
      { id: 'ws-c', type: 'externo', organization_id: 'org-1' },
    ],
    llamadasRpc: [],
    // Actualizaciones sueltas sobre `workspaces`: tienen que ser CERO. Si el
    // servidor renumerase por su cuenta, aparecerían aquí.
    updatesSueltos: 0,
    errorRpc: null,
    // Cuántas filas dice la función que tocó. `null` = tantas como se pidieron.
    aplicadas: null,
    // Errores encolados para el `select` de `workspace_members` (GET /).
    erroresSelect: [],
    intentosSelect: 0,
    reset() {
      estado.llamadasRpc.length = 0;
      estado.updatesSueltos = 0;
      estado.errorRpc = null;
      estado.aplicadas = null;
      estado.erroresSelect.length = 0;
      estado.intentosSelect = 0;
    },
  };

  const supabaseAdmin = {
    from: (tabla) => {
      let filtroIn = null;

      const chain = {
        select: () => chain,
        eq: () => chain,
        in: (_col, valores) => { filtroIn = valores; return chain; },
        update: () => { if (tabla === 'workspaces') estado.updatesSueltos += 1; return chain; },
        single: () => Promise.resolve({ data: null, error: null }),
        then: (resolve, reject) => {
          if (tabla === 'workspace_members' && !filtroIn) {
            // Camino de `GET /`: sin `in`, con posibles errores encolados.
            estado.intentosSelect += 1;
            const err = estado.erroresSelect.shift() || null;
            return Promise.resolve({ data: err ? null : [], error: err }).then(resolve, reject);
          }
          if (tabla === 'workspace_members' && filtroIn) {
            const filas = estado.mios
              .filter((w) => filtroIn.includes(w.id))
              .map((w) => ({ workspace: w }));
            return Promise.resolve({ data: filas, error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
    rpc: (nombre, args) => {
      estado.llamadasRpc.push({ nombre, args });
      if (estado.errorRpc) return Promise.resolve({ data: null, error: estado.errorRpc });
      const n = estado.aplicadas === null ? args.p_ids.length : estado.aplicadas;
      return Promise.resolve({ data: n, error: null });
    },
  };

  return { supabaseAdmin, createAdminClient: () => supabaseAdmin, createPublicClient: () => ({ auth: {} }), __estado: estado };
});

const { __estado } = require('../utils/supabase');
const app = require('../app');

const token = (role = 'admin') =>
  jwt.sign({ id: YO, email: 'x@aglaya.biz', name: 'X', role, organizationId: ORG }, 'test-secret', { expiresIn: '15m' });

const reordenar = (ids, role) =>
  request(app)
    .patch('/api/workspaces/reorder')
    .set('Authorization', `Bearer ${token(role)}`)
    .send({ ids });

beforeEach(() => __estado.reset());

describe('reordenar espacios', () => {
  it('acepta un orden dentro de una sección y lo manda a la base', async () => {
    const res = await reordenar(['ws-b', 'ws-a']);

    expect(res.status).toBe(200);
    expect(__estado.llamadasRpc).toHaveLength(1);
    expect(__estado.llamadasRpc[0].nombre).toBe('reorder_workspaces');
    expect(__estado.llamadasRpc[0].args.p_ids).toEqual(['ws-b', 'ws-a']);
    // El alcance viaja a la función, no se queda solo en el servidor.
    expect(__estado.llamadasRpc[0].args.p_org).toBe(ORG);
  });

  // ⚠️ LA TRAMPA DE `c1efd488`, fijada desde fuera: el servidor NO renumera.
  // Si alguien «simplifica» esto a un bucle de updates, este caso cae.
  it('NO renumera fila a fila: una sola llamada, cero updates sueltos', async () => {
    await reordenar(['ws-b', 'ws-a']);

    expect(__estado.updatesSueltos).toBe(0);
    expect(__estado.llamadasRpc).toHaveLength(1);
  });
});

describe('la respuesta no puede mentir sobre lo guardado', () => {
  // ⚠️ Devuelta del vigilante. La función dice cuántas filas tocó y el servidor
  // lo tiraba: contestaba `200` con los ids PEDIDOS. Si la base aplicaba menos
  // —una fila borrada entre comprobar y escribir—, la respuesta decía que todo
  // fue bien, y el cliente, que pinta al soltar, se quedaba mostrando un orden
  // que la base no tiene.
  it('si la base aplicó menos filas de las pedidas, NO contesta 200', async () => {
    __estado.aplicadas = 1;

    const res = await reordenar(['ws-b', 'ws-a']);

    expect(res.status).toBe(409);
    expect(res.body.pedidos).toBe(2);
    expect(res.body.aplicados).toBe(1);
  });

  it('cuando sí se aplicó entero, el 200 dice cuántas fueron', async () => {
    const res = await reordenar(['ws-b', 'ws-a']);

    expect(res.status).toBe(200);
    expect(res.body.data.aplicados).toBe(2);
  });
});

describe('lo que se rechaza antes de escribir nada', () => {
  it('mezclar secciones es 400, no un orden raro guardado', async () => {
    const res = await reordenar(['ws-a', 'ws-c']);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/secci/i);
    expect(__estado.llamadasRpc).toHaveLength(0);
  });

  it('un espacio que no es tuyo es 400 y no se toca nada', async () => {
    const res = await reordenar(['ws-a', 'ws-de-otro']);

    expect(res.status).toBe(400);
    expect(__estado.llamadasRpc).toHaveLength(0);
  });

  it('ids repetidos son 400: el orden sería ambiguo', async () => {
    const res = await reordenar(['ws-a', 'ws-a']);

    expect(res.status).toBe(400);
    expect(__estado.llamadasRpc).toHaveLength(0);
  });

  it('lista vacía es 400', async () => {
    expect((await reordenar([])).status).toBe(400);
  });

  it('sin token es 401', async () => {
    const res = await request(app).patch('/api/workspaces/reorder').send({ ids: ['ws-a'] });
    expect(res.status).toBe(401);
  });

  // Un cliente ve espacios externos; reordenarlos cambiaría lo que ven los demás.
  it('un usuario cliente no reordena', async () => {
    const res = await reordenar(['ws-c'], 'cliente');

    expect(res.status).toBe(403);
    expect(__estado.llamadasRpc).toHaveLength(0);
  });
});

describe('mientras la migración no esté aplicada', () => {
  // Este código se despliega ANTES de que el Operador toque la base. Ese hueco
  // tiene que dar un mensaje que diga qué falta, no un 500 mudo que parezca
  // avería — ni un 200 que mienta.
  it('si la función no existe todavía, contesta 503 nombrando la migración', async () => {
    __estado.errorRpc = { code: '42883', message: 'function public.reorder_workspaces does not exist' };

    const res = await reordenar(['ws-b', 'ws-a']);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/migration-orden-de-espacios\.sql/);
  });

  it('cualquier otro error de la base sigue siendo 500', async () => {
    __estado.errorRpc = { code: '08006', message: 'connection failure' };

    const res = await reordenar(['ws-b', 'ws-a']);

    expect(res.status).toBe(500);
  });
});

describe('el reintento del GET está acotado a la columna que falta', () => {
  // ⚠️ Devuelta del vigilante: abrir el reintento a `if (error)` dejaba todo en
  // verde, y eso es exactamente cómo se tapa un fallo real — un permiso
  // denegado o una caída se reintentarían «sin orden» y saldrían bien.
  const listar = () =>
    request(app).get('/api/workspaces').set('Authorization', `Bearer ${token()}`);

  it('con 42703 reintenta sin la columna y responde', async () => {
    __estado.erroresSelect.push({ code: '42703', message: 'column workspaces.order does not exist' });

    const res = await listar();

    expect(res.status).toBe(200);
    expect(__estado.intentosSelect).toBe(2);   // pidió con orden, reintentó sin él
  });

  it('con CUALQUIER otro error NO reintenta: es 500 y se ve en el registro', async () => {
    __estado.erroresSelect.push({ code: '42501', message: 'permission denied for table workspaces' });

    const res = await listar();

    expect(res.status).toBe(500);
    expect(__estado.intentosSelect).toBe(1);
  });
});

describe('la migración', () => {
  const MIGRACION = path.join(__dirname, '..', '..', 'docs', 'schema', 'migration-orden-de-espacios.sql');
  const ESQUEMA = path.join(__dirname, '..', '..', 'docs', 'schema', 'supabase-schema.sql');
  const leer = (p) => fs.readFileSync(p, 'utf8');

  it('existe y añade la columna de forma idempotente', () => {
    const sql = leer(MIGRACION);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "order"/);
  });

  // La razón de ser de la función: una sentencia, no un bucle.
  it('el reorden es UNA sentencia con unnest, no fila a fila', () => {
    const sql = leer(MIGRACION);
    expect(sql).toMatch(/unnest\(p_ids\) WITH ORDINALITY/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.reorder_workspaces/);
  });

  // ⚠️ Devuelta del vigilante: quitar este filtro dejaba las 379 en verde, y es
  // **la afirmación más fuerte de la migración** — que un identificador ajeno no
  // se ordena mal porque no se toca. Sin él, la función reordena filas de
  // cualquier organización que le pasen.
  it('el UPDATE de la función filtra por organización', () => {
    expect(leer(MIGRACION)).toMatch(/w\.organization_id\s*=\s*p_org/);
  });

  // La decisión de Ibai, fijada donde se aplica: el relleno numera por tipo.
  it('el relleno inicial numera DENTRO de cada tipo', () => {
    expect(leer(MIGRACION)).toMatch(/PARTITION BY organization_id, type/);
  });

  // Patrón obligatorio de esta casa: recortar antes de conceder.
  it('recorta privilegios antes de conceder, y solo service_role ejecuta', () => {
    const sql = leer(MIGRACION);
    const revoke = sql.indexOf('REVOKE ALL ON FUNCTION');
    const grant = sql.indexOf('GRANT EXECUTE ON FUNCTION');

    expect(revoke).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(revoke);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.reorder_workspaces\(UUID, UUID\[\]\) TO service_role;/);
  });

  it('lleva dentro las consultas con las que se comprueba después', () => {
    const sql = leer(MIGRACION);
    expect(sql).toMatch(/routine_privileges/);
    expect(sql).toMatch(/count\(DISTINCT "order"\)/);
  });

  // ⚠️ El orden entre aplicar y declarar, atado por las dos puntas — mismo
  // patrón que las migraciones anteriores de esta casa, y por la misma factura:
  // una cabecera dijo «PENDIENTE» diecisiete días después de aplicarse.
  it('si la migración dice APLICADA, el esquema ya declara la columna', () => {
    const aplicada = /^--\s*✅\s*APLICADA/m.test(leer(MIGRACION));

    // ⚠️ Se quitan los comentarios ANTES de mirar. La nota que explica que la
    // columna todavía no está **la nombra**, así que sin esto el caso leía su
    // propia explicación como si fuera la declaración: rojo con el esquema
    // correcto. Lo que declara una tabla es su SQL, no la prosa de al lado.
    const esquema = leer(ESQUEMA)
      .split('\n')
      .map((l) => l.replace(/--.*$/, ''))
      .join('\n');

    // ⚠️ El bloque es el CREATE TABLE, no «hasta la tabla siguiente». Mutación
    // superviviente: con la ventana ancha, borrar la columna de la definición
    // seguía en verde porque el `ALTER … ADD COLUMN IF NOT EXISTS` de
    // idempotencia, dos líneas más abajo, también la nombra. La prueba leía el
    // remiendo y lo daba por la declaración.
    const inicio = esquema.indexOf('CREATE TABLE IF NOT EXISTS public.workspaces');
    const bloque = esquema.slice(inicio, esquema.indexOf('\n);', inicio));
    const declarada = /"order"\s+INTEGER/.test(bloque);

    // Y la FUNCIÓN también. El lazo cubría solo la columna: renombrarla en el
    // esquema documentado dejaba 17 verdes, aunque el paso 6 de la migración
    // pide declarar las dos. Lo cazó el vigilante.
    const funcion = /CREATE OR REPLACE FUNCTION public\.reorder_workspaces/.test(esquema);

    expect(`aplicada=${aplicada} columna=${declarada} funcion=${funcion}`)
      .toBe(`aplicada=${aplicada} columna=${aplicada} funcion=${aplicada}`);
  });

  it('la cabecera dice PENDIENTE o APLICADA, y no las dos', () => {
    const sql = leer(MIGRACION);
    const pendiente = /^--\s*⏳\s*PENDIENTE DE APLICAR/m.test(sql);
    const aplicada = /^--\s*✅\s*APLICADA/m.test(sql);

    expect(pendiente || aplicada).toBe(true);
    expect(pendiente && aplicada).toBe(false);
  });
});
