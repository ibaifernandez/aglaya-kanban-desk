/**
 * La búsqueda aísla por ESPACIO, no por organización. Tarjeta `0092a0c0`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ DEFECTO CIERRA
 *
 * `/api/cards/search` filtraba solo por `organization_id`, y va por
 * `supabaseAdmin`, que **salta las políticas de fila**. Así que el aislamiento
 * de esta ruta era ese `.eq` y nada más: un miembro de la organización
 * recuperaba por búsqueda títulos y descripciones de espacios a los que no
 * pertenece — personales, internos o de cliente.
 *
 * Y no había decisión de diseño detrás: **era la única ruta de tarjetas sin
 * `requireWorkspaceMember`**, mientras sus seis hermanas lo llevan en las líneas
 * contiguas del registro. Se quedó fuera del patrón de su propia familia.
 *
 * ⚠️ SUPERFICIE HOY: cero. Tres cuentas, las tres de confianza. **Esto no es una
 * urgencia: es un requisito previo a la primera cuenta de cliente**, que es una
 * capacidad declarada de esta nave (`CLAUDE.md`) y ya hay un espacio `externo`.
 * Se escribe así para que nadie lo despache como «no pasa nada» ni lo infle como
 * «estamos expuestos».
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

const YO = 'user-yo';
const ORG = 'org-1';

jest.mock('../utils/supabase', () => {
  const TABLAS = {
    // Soy miembro de ws-mio. NO de ws-ajeno.
    workspace_members: [
      { workspace_id: 'ws-mio', user_id: 'user-yo' },
      { workspace_id: 'ws-ajeno', user_id: 'otra-persona' },
    ],
    boards: [
      { id: 'b-mio',   title: 'Mío',   workspace_id: 'ws-mio',   organization_id: 'org-1' },
      { id: 'b-ajeno', title: 'Ajeno', workspace_id: 'ws-ajeno', organization_id: 'org-1' },
    ],
    columns: [
      { id: 'col-1', title: 'Backlog' },
    ],
    cards: [
      { id: 'c-mia',   title: 'secreto mío',   description: '', board_id: 'b-mio',   column_id: 'col-1', organization_id: 'org-1' },
      { id: 'c-ajena', title: 'secreto ajeno', description: '', board_id: 'b-ajeno', column_id: 'col-1', organization_id: 'org-1' },
      // Fila INCONSISTENTE: vive en un tablero que yo veo, pero pertenece a otra
      // organización. No debería existir — y por eso está aquí: las dos
      // condiciones son independientes, y esta es la única forma de comprobar
      // que la de organización sigue haciendo algo.
      { id: 'c-rara',  title: 'secreto colado', description: '', board_id: 'b-mio', column_id: 'col-1', organization_id: 'org-otra' },
    ],
  };

  const estado = {
    TABLAS,
    // Sin membresías: para el caso «quien no es miembro de nada no ve nada».
    sinMembresias: false,
    reset() { estado.sinMembresias = false; },
  };

  const supabaseAdmin = {
    from: (tabla) => {
      let filas = JSON.parse(JSON.stringify(TABLAS[tabla] ?? []));
      if (tabla === 'workspace_members' && estado.sinMembresias) filas = [];

      const chain = {
        select: () => chain,
        eq: (col, val) => { filas = filas.filter((r) => r[col] === val); return chain; },
        // ⚠️ El doble APLICA el `in` de verdad. Si lo ignorara, el caso de la
        // tarjeta pasaría con el filtro quitado: sería una tautología sobre la
        // fixture en vez de una medición del código.
        in: (col, valores) => { filas = filas.filter((r) => valores.includes(r[col])); return chain; },
        // El `or` del ilike: se aplica sobre título y descripción, que es lo que
        // hace la ruta. Sin esto, «buscar» devolvería todo y el caso mediría otra
        // cosa.
        or: (expr) => {
          const m = /title\.ilike\.%(.*?)%/.exec(expr);
          const aguja = (m ? m[1] : '').toLowerCase();
          filas = filas.filter(
            (r) =>
              String(r.title || '').toLowerCase().includes(aguja) ||
              String(r.description || '').toLowerCase().includes(aguja),
          );
          return chain;
        },
        limit: () => chain,
        single: () => Promise.resolve({ data: filas[0] ?? null, error: null }),
        then: (resolve, reject) => Promise.resolve({ data: filas, error: null }).then(resolve, reject),
      };
      return chain;
    },
  };

  return { supabaseAdmin, createAdminClient: () => supabaseAdmin, createPublicClient: () => ({ auth: {} }), __estado: estado };
});

const { __estado } = require('../utils/supabase');
const app = require('../app');

const token = jwt.sign(
  { id: YO, email: 'x@aglaya.biz', name: 'X', role: 'colaborador', organizationId: ORG },
  'test-secret',
  { expiresIn: '15m' },
);

const buscar = (q) =>
  request(app).get(`/api/cards/search?q=${encodeURIComponent(q)}`).set('Authorization', `Bearer ${token}`);

beforeEach(() => __estado.reset());

describe('la búsqueda solo alcanza los espacios de los que eres miembro', () => {
  // ⚠️ EL CASO DE LA TARJETA. Las dos tarjetas son de la MISMA organización y
  // las dos casan con la búsqueda: lo único que las separa es la membresía.
  it('no devuelve tarjetas de un espacio ajeno de la misma organización', async () => {
    const res = await buscar('secreto');

    const titulos = res.body.data.map((c) => c.title);
    expect(titulos).toEqual(['secreto mío']);
    expect(titulos).not.toContain('secreto ajeno');
  });

  it('sí devuelve las del espacio del que eres miembro', async () => {
    const res = await buscar('mío');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('c-mia');
  });

  // Consecuencia aceptada, y se fija para que no se lea como avería: quien no
  // es miembro de nada no encuentra nada — no hay nada suyo que encontrar.
  it('quien no es miembro de ningún espacio recibe lista vacía, no un error', async () => {
    __estado.sinMembresias = true;

    const res = await buscar('secreto');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  // ⚠️ El filtro por organización NO se sustituye: se SUMA. Y comprobarlo exige
  // una fila inconsistente —tablero visible, organización ajena—, porque por el
  // camino normal la condición de organización de la consulta de tableros ya
  // corta antes y la de las tarjetas nunca llega a decidir nada.
  //
  // Medido: sin esta fila, quitar el `.eq('organization_id')` de la consulta de
  // tarjetas dejaba el banco entero en verde. La redundancia era real y el caso
  // que decía cubrirla no cubría nada.
  it('una tarjeta de otra organización en un tablero mío tampoco sale', async () => {
    const res = await buscar('secreto');

    const ids = res.body.data.map((c) => c.id);
    expect(ids).toContain('c-mia');
    expect(ids).not.toContain('c-rara');
  });

  it('sigue sin buscar con menos de dos caracteres', async () => {
    expect((await buscar('a')).body.data).toEqual([]);
  });

  it('sin token sigue siendo 401', async () => {
    expect((await request(app).get('/api/cards/search?q=secreto')).status).toBe(401);
  });
});
