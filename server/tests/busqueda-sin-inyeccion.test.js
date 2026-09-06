/**
 * La búsqueda no interpola el texto del usuario dentro del filtro. Tarjeta `2c6c81b3`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ DEFECTO CIERRA
 *
 * `searchCards` construía el filtro concatenando:
 *
 *   .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
 *
 * `q` es texto del usuario, y dentro de un grupo `or` de PostgREST la coma
 * separa condiciones y el paréntesis agrupa. Una búsqueda con coma no buscaba
 * una coma: **añadía una condición al filtro**.
 *
 * ⚠️ QUÉ ALCANZABA DE VERDAD, QUE ES LO QUE PEDÍA MEDIR LA TARJETA
 *
 * La tarjeta escribía su gravedad en condicional —«si una condición inyectada
 * altera la forma de ese filtro»— y el delineante pidió medir ese «si» antes de
 * tratarlo como fuga. Medido sobre la URL que genera `postgrest-js` de verdad:
 *
 *   · `&` SÍ se escapa (`%26`). El texto del usuario **no puede crear otro
 *     parámetro**, así que **no llega a los `AND`** de organización ni de
 *     tablero. **No era una fuga entre inquilinos.**
 *   · `,` y `)` viajan sin escapar dentro del valor de `or=(…)`. Ahí la
 *     inyección **sí es real**: ensancha el grupo `or` con condiciones sobre
 *     cualquier columna de `cards` — dentro de las filas que ya te tocan— o
 *     rompe la consulta con un paréntesis descuadrado.
 *
 * O sea: **ensanchado dentro del alcance permitido y error de sintaxis, no
 * fuga.** Se arregla igual; lo que cambia es lo que se puede afirmar de él.
 *
 * POR QUÉ DOS CONSULTAS Y NO COMILLAS
 *
 * Entrecomillar el valor dentro del `or` es lo que documenta PostgREST, pero su
 * corrección vive en la gramática del **servidor**, que desde aquí no se puede
 * preguntar. Un filtro por columna suelto no necesita esa gramática: fuera de un
 * grupo, la coma y el paréntesis no significan nada, y lo único que separa
 * filtros —`&`— es justo lo que el cliente escapa. Eso sí se puede medir aquí, y
 * es lo que mide el primer bloque.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { PostgrestClient } = require('@supabase/postgrest-js');
const { likeARegExp } = require('./helpers/like');

process.env.JWT_SECRET = 'test-secret';

const YO = 'user-yo';
const ORG = 'org-1';

// Textos hostiles, en las dos formas que tenía el defecto.
const CON_COMA = 'x,organization_id.neq.zzz,title.ilike.%';
const CON_PARENTESIS = 'x),organization_id.neq.zzz,(title.ilike.%';

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1 — la forma de la consulta, medida sobre `postgrest-js` DE VERDAD.
//
// Sin doble: se deja que la librería construya la URL y se mira. Esto es lo que
// convierte «creo que no puede escaparse» en un dato.
// ─────────────────────────────────────────────────────────────────────────────
describe('un filtro por columna no deja escapar el texto del usuario del parámetro', () => {
  const urlDe = async (construir) => {
    let capturada = null;
    const pg = new PostgrestClient('http://x/rest/v1', {
      fetch: async (u) => {
        capturada = new URL(String(u));
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    });
    await construir(pg);
    return capturada;
  };

  const consultaDeLaRuta = (q) => (pg) =>
    pg.from('cards').select('*')
      .eq('organization_id', 'org-1')
      .in('board_id', ['b-1'])
      .ilike('title', `%${q}%`)
      .limit(15);

  it.each([
    ['una coma', CON_COMA],
    ['un paréntesis', CON_PARENTESIS],
    ['un ampersand — el separador de filtros', 'x&organization_id=eq.otra&y'],
  ])('con %s, el filtro por organización sigue siendo el nuestro', async (_, hostil) => {
    const url = await urlDe(consultaDeLaRuta(hostil));

    // ⚠️ EL CASO. `getAll` devuelve TODOS los valores del parámetro: si el texto
    // hubiera creado otro `organization_id`, aquí habría dos.
    expect(url.searchParams.getAll('organization_id')).toEqual(['eq.org-1']);
    expect(url.searchParams.getAll('board_id')).toEqual(['in.(b-1)']);
  });

  it('el texto hostil viaja ENTERO dentro del valor de un solo filtro', async () => {
    const url = await urlDe(consultaDeLaRuta(CON_PARENTESIS));

    expect(url.searchParams.get('title')).toBe(`ilike.%${CON_PARENTESIS}%`);
    // Y no aparecen parámetros nuevos: los cinco de la consulta y ninguno más.
    expect([...url.searchParams.keys()].sort())
      .toEqual(['board_id', 'limit', 'organization_id', 'select', 'title']);
  });

  // ⚠️ LA CONTRAPARTE, y es la que impide leer el bloque anterior como «da igual
  // cómo se escriba el filtro». Con el grupo `or` —la forma que tenía la ruta—
  // la misma entrada SÍ mete una condición.
  it('con el grupo `or` que tenía la ruta, la misma entrada sí inyectaba', async () => {
    const url = await urlDe((pg) =>
      pg.from('cards').select('*')
        .eq('organization_id', 'org-1')
        .or(`title.ilike.%${CON_COMA}%,description.ilike.%${CON_COMA}%`)
        .limit(15));

    const grupo = url.searchParams.get('or');

    // La condición inyectada está dentro del grupo, como condición, no como texto.
    expect(grupo).toContain(',organization_id.neq.zzz,');

    // Y esto es lo que acota la gravedad: el `AND` de organización sigue intacto
    // y en su propio parámetro. La inyección ensancha DENTRO, no se sale.
    expect(url.searchParams.getAll('organization_id')).toEqual(['eq.org-1']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2 — la ruta, con doble. Mide QUÉ construye `searchCards`, no qué
// construiría una consulta escrita a mano en este fichero.
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('../utils/supabase', () => {
  const { likeARegExp: aRegExp } = require('./helpers/like');

  const TABLAS = {
    workspace_members: [{ workspace_id: 'ws-mio', user_id: 'user-yo' }],
    boards: [{ id: 'b-mio', title: 'Mío', workspace_id: 'ws-mio', organization_id: 'org-1' }],
    columns: [{ id: 'col-1', title: 'Backlog' }],
    cards: [
      // Contiene los tres caracteres del enunciado de la tarjeta como TEXTO.
      { id: 'c-literal', title: 'informe 100% (x), final', description: '', board_id: 'b-mio', column_id: 'col-1', organization_id: 'org-1' },
      // No contiene el texto buscado. Si una inyección ensanchara el filtro,
      // esta sería la fila que se colaría.
      { id: 'c-otra', title: 'nada que ver', description: '', board_id: 'b-mio', column_id: 'col-1', organization_id: 'org-1' },
      // ⚠️ Casa por los DOS campos. Sin una fila así, el caso del duplicado pasa
      // con el dedup quitado — medido: la mutación sobrevivía porque ninguna
      // fixture llegaba por los dos caminos a la vez.
      { id: 'c-doble', title: 'zumbido', description: 'otra vez zumbido', board_id: 'b-mio', column_id: 'col-1', organization_id: 'org-1' },
    ],
  };

  const registro = {
    llamadas: [],
    // Para el caso «si la consulta falla, no se contesta como si no».
    fallaLaConsulta: false,
    reset() { registro.llamadas = []; registro.fallaLaConsulta = false; },
  };

  const supabaseAdmin = {
    from: (tabla) => {
      let filas = JSON.parse(JSON.stringify(TABLAS[tabla] ?? []));
      let falla = false;
      const chain = {
        select: () => chain,
        eq: (col, val) => { filas = filas.filter((r) => r[col] === val); return chain; },
        in: (col, valores) => { filas = filas.filter((r) => valores.includes(r[col])); return chain; },
        ilike: (col, patron) => {
          registro.llamadas.push({ metodo: 'ilike', tabla, col, patron });
          if (registro.fallaLaConsulta && col === 'description') falla = true;
          const re = aRegExp(patron);
          filas = filas.filter((r) => re.test(String(r[col] || '')));
          return chain;
        },
        // ⚠️ El `or` NO se implementa: se registra y se deja pasar. Si alguien
        // devuelve la ruta a la forma concatenada, el caso de abajo se pone rojo
        // en vez de seguir en verde por casualidad.
        or: (expr) => { registro.llamadas.push({ metodo: 'or', tabla, expr }); return chain; },
        limit: () => chain,
        single: () => Promise.resolve({ data: filas[0] ?? null, error: null }),
        then: (resolve, reject) => Promise.resolve(
          falla ? { data: null, error: { message: 'la base dijo que no' } } : { data: filas, error: null },
        ).then(resolve, reject),
      };
      return chain;
    },
  };

  return { supabaseAdmin, createAdminClient: () => supabaseAdmin, createPublicClient: () => ({ auth: {} }), __registro: registro };
});

const { __registro } = require('../utils/supabase');
const app = require('../app');

const token = jwt.sign(
  { id: YO, email: 'x@aglaya.biz', name: 'X', role: 'colaborador', organizationId: ORG },
  'test-secret',
  { expiresIn: '15m' },
);

const buscar = (q) =>
  request(app).get(`/api/cards/search?q=${encodeURIComponent(q)}`).set('Authorization', `Bearer ${token}`);

beforeEach(() => __registro.reset());

describe('la ruta ya no mete el texto del usuario en un grupo de condiciones', () => {
  // ⚠️ EL CASO DE LA TARJETA. Es el que se pone rojo si vuelve el `.or(...)`
  // concatenado — sin él, todo lo demás seguiría verde con el defecto puesto,
  // porque los otros casos miden resultados y no la forma de la consulta.
  it('busca por columna, no por grupo `or`', async () => {
    await buscar(CON_COMA);

    const sobreCards = __registro.llamadas.filter((l) => l.tabla === 'cards');
    expect(sobreCards.map((l) => l.metodo)).toEqual(['ilike', 'ilike']);
    expect(sobreCards.map((l) => l.col)).toEqual(['title', 'description']);
  });

  // El texto va entero como VALOR del filtro. Comas y paréntesis, tal cual —ahí
  // no significan nada—; los comodines, escapados, que es lo único que se toca.
  it('el texto del usuario va como valor del filtro, entero', async () => {
    await buscar(CON_PARENTESIS);

    const [primera] = __registro.llamadas.filter((l) => l.tabla === 'cards');
    // Escrito a mano, no recalculado con la misma expresión que usa la ruta: un
    // caso que repite la transformación que mide no mide nada.
    expect(primera.patron).toBe('%x),organization\\_id.neq.zzz,(title.ilike.\\%%');
  });

  // La condición de cierre que escribió el delineante, en su literal: los tres
  // caracteres se buscan COMO TEXTO.
  it('una búsqueda con `,` `)` y `%` encuentra la tarjeta que los contiene', async () => {
    const res = await buscar('100% (x),');

    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.id)).toEqual(['c-literal']);
  });

  // ⚠️ Y la otra mitad de la condición de cierre: no ensancha. Si `%` siguiera
  // siendo comodín, `100%` traería también `nada que ver`.
  it('y no arrastra las que no lo contienen', async () => {
    const res = await buscar('100%');

    expect(res.body.data.map((c) => c.id)).not.toContain('c-otra');
  });

  // Que el patrón lleve escapados los comodines es lo que sostiene el caso
  // anterior, y se fija aparte para que se vea POR QUÉ pasa.
  it('los comodines del usuario van escapados en el patrón', async () => {
    await buscar('100%_x');

    const [primera] = __registro.llamadas.filter((l) => l.tabla === 'cards');
    expect(primera.patron).toBe('%100\\%\\_x%');
  });

  // ⚠️ Buscar por dos columnas y unir en el servidor tiene un precio que el
  // grupo `or` no tenía: la misma fila llega por los dos caminos. La fixture
  // tiene una que casa por título Y por descripción — sin ella este caso pasaba
  // con el dedup quitado, medido por mutación.
  it('una tarjeta que casa por los dos campos no sale duplicada', async () => {
    const res = await buscar('zumbido');

    expect(res.body.data.map((c) => c.id)).toEqual(['c-doble']);
  });

  // Dos consultas son dos formas de fallar. Contestar 200 con la mitad de los
  // resultados sería peor que fallar: la búsqueda diría «no hay» sin distinguir
  // «no hay» de «no se pudo mirar».
  it('si una de las dos consultas falla, contesta 500 y no una lista a medias', async () => {
    __registro.fallaLaConsulta = true;

    const res = await buscar('zumbido');

    expect(res.status).toBe(500);
  });
});

// El helper se importa arriba para que su ausencia se note como fallo de carga y
// no como caso que no llega a existir.
describe('el traductor de `like` del banco hace lo que dice', () => {
  it('`%` es comodín y `\\%` no', () => {
    expect(likeARegExp('%100%%').test('el 100% de esto')).toBe(true);
    expect(likeARegExp('%100\\%%').test('el 100% de esto')).toBe(true);
    expect(likeARegExp('%100\\%%').test('el 1000 de esto')).toBe(false);
  });
});
