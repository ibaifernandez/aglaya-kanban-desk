/**
 * PUT /api/cards/:id/move — mover una tarjeta NO le toca la prioridad.
 *
 * Tarjeta: «Toda tarjeta que llega a ✅ Hecho pierde su prioridad, y no sé quién
 * la borra».
 *
 * QUÉ VIGILA, y por qué es raro: vigila que algo SIGA sin hacerse. El código
 * nunca borró la prioridad al mover — se comprobaron los cinco escritores y los
 * cinco están limpios. Quien la borraba era una regla escrita en `CLAUDE.md`
 * («al mover a una columna de tipo hecho/entregado/completado: establecer
 * `priority` a "none" automáticamente») que **ejecutaban a mano las sesiones de
 * Claude** que cierran tarjetas. Esa regla se ha retirado.
 *
 * POR QUÉ HACE FALTA LA PRUEBA SI EL CÓDIGO YA ESTABA BIEN. Porque la regla
 * retirada era una invitación abierta a implementarla: cualquiera que la leyera
 * podía decidir «esto debería hacerlo el código». Sin prueba, ese día llega y
 * nadie lo nota — una prioridad borrada no avisa, y no tiene historial del que
 * recuperarla. Esta prueba convierte una decisión en un hecho comprobable.
 *
 * DÓNDE MUERDE DE VERDAD. No en la respuesta —que podría venir bien por
 * casualidad— sino en **lo que se escribe en la base**: el `update` de mover
 * tiene que llevar `column_id`, `board_id`, `order` y `updated_at`, y NO puede
 * llevar `priority`. Si alguien añade el borrado, aparece esa clave y esto se
 * pone rojo aunque la respuesta siguiera pareciendo correcta.
 *
 * `none` sigue siendo una prioridad válida y elegible a mano. Lo que se retira
 * es que se ponga sola.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

// Todo lo que se escriba en `cards` acaba aquí. Es la aserción de verdad de este
// fichero: no qué contesta la puerta, sino qué llegó a la base.
const escrituras = [];

jest.mock('../utils/supabase', () => {
  const CARDS = [
    // La de origen lleva `urgent` a propósito: es la prioridad más alta, la que
    // más se nota al perderse, y la que llevaba la tarjeta real que destapó esto.
    { id: 'c-1', column_id: 'col-curso', board_id: 'board-1', title: 'En marcha', order: 1, priority: 'urgent', tags: [], checklist: [] },
    { id: 'c-2', column_id: 'col-hecho', board_id: 'board-1', title: 'Ya cerrada', order: 1, priority: 'low',    tags: [], checklist: [] },
  ];

  return {
    supabaseAdmin: {
      from: (table) => {
        let rows = JSON.parse(JSON.stringify(CARDS.filter(() => table === 'cards')));
        const filtros = {};
        let pendiente = null;

        const chain = {
          select: () => chain,
          eq:  (col, val) => { filtros[col] = val; rows = rows.filter(r => r[col] === val); return chain; },
          neq: (col, val) => { rows = rows.filter(r => r[col] !== val); return chain; },
          gt:  (col, val) => { rows = rows.filter(r => r[col] >  val); return chain; },
          gte: (col, val) => { rows = rows.filter(r => r[col] >= val); return chain; },
          update: (payload) => {
            if (table === 'cards') escrituras.push(payload);
            pendiente = payload;
            return chain;
          },
          single: () => {
            if (table === 'workspace_members') {
              return Promise.resolve({ data: { workspace_id: 'ws-1', user_id: 'u-1', role: 'owner' }, error: null });
            }
            if (table === 'workspaces') {
              return Promise.resolve({ data: { id: 'ws-1', type: 'interno' }, error: null });
            }
            if (table === 'columns') {
              // La columna destino VIENE CON NOMBRE, y no es adorno del doble.
              //
              // La regla retirada decía «al mover a una columna de tipo
              // hecho/entregado/completado», o sea que miraba CÓMO SE LLAMA la
              // columna. Un doble que devuelve la columna sin `title` deja
              // ciega a esta prueba ante la única reimplementación que alguien
              // escribiría de verdad: la condicional al nombre.
              //
              // Medido: con el mutante condicional al nombre, sin `title` pasan
              // las cinco pruebas en verde; con `title`, caen cuatro.
              const nombres = { 'col-hecho': '✅ Hecho', 'col-curso': '🔄 En curso' };
              return Promise.resolve({
                data: { id: filtros.id, board_id: 'board-1', title: nombres[filtros.id] ?? 'Sin nombre' },
                error: null,
              });
            }
            if (table === 'boards') {
              return Promise.resolve({ data: { id: 'board-1', workspace_id: 'ws-1' }, error: null });
            }
            // Tras un update, la fila que vuelve es la original MÁS lo escrito.
            // Así, si alguien mete `priority` en el update, la respuesta también
            // cambia — y las dos aserciones caen a la vez, que es lo correcto.
            const base = rows[0] ?? null;
            if (pendiente && base) return Promise.resolve({ data: { ...base, ...pendiente }, error: null });
            return Promise.resolve({ data: base, error: null });
          },
          then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
        };
        return chain;
      },
    },
  };
});

const app = require('../app');

const token = jwt.sign(
  { id: 'u-1', email: 'test@aglaya.biz', role: 'admin', organizationId: 'org-1' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' },
);

const mover = (id, columnId, order = 0) =>
  request(app)
    .put(`/api/cards/${id}/move`)
    .set('Authorization', `Bearer ${token}`)
    .send({ columnId, order });

// Solo el update que lleva `column_id` es el de mover; los demás son el
// renumerado de las vecinas, que sí tocan `order` y nada más.
const escrituraDeMover = () => escrituras.find((e) => 'column_id' in e);

beforeEach(() => { escrituras.length = 0; });

describe('mover una tarjeta no le toca la prioridad', () => {
  it('a una columna de HECHO conserva `urgent`', async () => {
    const res = await mover('c-1', 'col-hecho');
    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe('urgent');
  });

  it('el update de mover NO lleva la clave `priority`', async () => {
    // La aserción que muerde. Dicha en negativo a propósito: comprobar que la
    // respuesta trae `urgent` puede salir bien por casualidad si el doble
    // devolviera la fila sin tocar. Lo que no sale bien por casualidad es que la
    // clave no esté en lo que se escribe.
    await mover('c-1', 'col-hecho');
    const escrito = escrituraDeMover();
    expect(escrito).toBeDefined();
    expect(Object.keys(escrito)).not.toContain('priority');
  });

  it('lo que se escribe al mover son exactamente los cuatro campos del movimiento', async () => {
    // Cerrado por arriba, no solo por abajo: un update que se hiciera más ancho
    // —por prioridad o por cualquier otra cosa— cae aquí aunque alguien retire
    // la aserción anterior.
    await mover('c-1', 'col-hecho');
    expect(Object.keys(escrituraDeMover()).sort())
      .toEqual(['board_id', 'column_id', 'order', 'updated_at']);
  });

  it('mover dentro de la MISMA columna tampoco la toca', async () => {
    await mover('c-1', 'col-curso', 5);
    expect(Object.keys(escrituraDeMover())).not.toContain('priority');
  });

  it('la reimplementación REALISTA —condicional al NOMBRE de la columna— también cae', async () => {
    // El caso que faltaba, y el único que alguien escribiría de verdad. La regla
    // retirada no decía «al mover, borra»: decía «al mover a una columna de tipo
    // hecho/entregado/completado». Quien la reimplemente mirará el nombre.
    //
    // `col-hecho` se llama «✅ Hecho» en el doble, así que un `if` sobre el
    // nombre SÍ entra aquí. Antes no entraba en ninguna prueba —la columna
    // llegaba sin nombre— y por eso el mutante condicional pasaba en verde.
    const res = await mover('c-1', 'col-hecho');
    expect(res.body.data.priority).toBe('urgent');
    expect(Object.keys(escrituraDeMover())).not.toContain('priority');
  });

  it('mover a una columna que NO es de hecho tampoco la toca', async () => {
    // El opuesto, para que no valga un mutante que borre en todas partes ni uno
    // que borre solo en «Hecho»: los dos tienen que morir, y con este par
    // mueren por caminos distintos.
    const res = await mover('c-2', 'col-curso', 0);
    expect(res.body.data.priority).toBe('low');
    expect(Object.keys(escrituraDeMover())).not.toContain('priority');
  });

  it('una que ya estaba en HECHO conserva la suya al reordenarse', async () => {
    const res = await mover('c-2', 'col-hecho', 3);
    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe('low');
  });
});
