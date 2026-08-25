/**
 * `buildUserCards` — el digest solo lleva trabajo TUYO, urgente y vivo.
 *
 * Tarjeta: «El digest manda 79 tareas que no son de quien lo recibe» (`471404c5`).
 *
 * EL HECHO. Digest recibido el 24-ago-2026: *«Tienes **79 tareas** urgentes,
 * prioritarias o vencidas que merecen tu atención hoy»*, y el bloque que las
 * traía era `🍀 LEGAL REG TECH · 📒 ARCHIVO`. **Ninguna era suya.**
 *
 * TRES DEFECTOS INDEPENDIENTES que se sumaban, y por eso hay tres bloques aquí:
 *
 *   1. **No filtraba por responsable, y nunca lo hizo.** Se tomaban las tarjetas
 *      de todos los tableros de todos los espacios de los que el destinatario es
 *      MIEMBRO: ser miembro te traía el trabajo de todos.
 *   2. **No excluía los tableros de archivo.** El digest ya descartaba COLUMNAS
 *      de tipo hecho, pero «📒 Archivo» es un TABLERO entero.
 *   3. **Incluía vencidas de cualquier prioridad.**
 *
 * ⚠️ LAS DOS CONSECUENCIAS ACEPTADAS TIENEN PRUEBA PROPIA, y no es celo: son
 * decisiones de Ibai que **parecen defectos** desde fuera. Sin una prueba que
 * diga «esto es a propósito», el primero que vea una vencida desaparecida la
 * «arregla» de vuelta.
 */
jest.mock('../utils/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock('../utils/digestLogging', () => ({ logDigestAttempt: jest.fn() }));

const { supabaseAdmin } = require('../utils/supabase');
const { buildUserCards } = require('../services/digest/user');

// Doble encadenable: devuelve la tabla pedida pase lo que pase el filtro. Es
// deliberado — lo que se mide aquí es el filtrado que hace `buildUserCards` EN
// MEMORIA, no el que delega a la base. Un doble que filtrara podría tapar que la
// función no filtra.
function chain(data) {
  const result = { data, error: null };
  const c = {
    select: () => c, eq: () => c, in: () => c, not: () => c, order: () => c, limit: () => c,
    single: () => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error: null }),
    then: (res, rej) => Promise.resolve(result).then(res, rej),
  };
  return c;
}

const YO = 'user-yo';
const OTRO = 'user-otro';

function tablero(id, title, wsId = 'ws-1') {
  return { id, title, workspace_id: wsId };
}

function tarjeta(id, title, extra = {}) {
  return {
    id, title,
    priority: 'high',
    due_date: null,
    column_id: 'col-1',
    board_id: 'b-vivo',
    checklist: [],
    assignee_id: YO,
    ...extra,
  };
}

function montar({ boards, cards }) {
  const byTable = {
    workspace_members: [{ workspace: { id: 'ws-1', name: 'Interno', emoji: '📋', type: 'interno' } }],
    boards,
    columns: [
      { id: 'col-1', title: 'Backlog', board_id: 'b-vivo' },
      { id: 'col-a', title: 'Backlog', board_id: 'b-archivo' },
    ],
    cards,
  };
  supabaseAdmin.from.mockImplementation((table) => chain(byTable[table] ?? []));
}

const titulos = (r) =>
  [...r.personal, ...r.interno, ...r.externo]
    .flatMap((w) => w.boards)
    .flatMap((b) => b.cards)
    .map((c) => c.title);

beforeEach(() => jest.clearAllMocks());

describe('El digest lleva solo tarjetas del destinatario', () => {
  it('una tarjeta de otro NO entra, aunque sea urgente y del mismo espacio', async () => {
    montar({
      boards: [tablero('b-vivo', '🛠 Operaciones')],
      cards: [
        tarjeta('mia',   'Mía'),
        tarjeta('suya',  'De otro', { assignee_id: OTRO }),
      ],
    });

    const r = await buildUserCards(YO);

    expect(titulos(r)).toEqual(['Mía']);
  });

  // El defecto exacto del 24-ago: ser miembro del espacio traía el trabajo de
  // todos. Una tarjeta SIN responsable tampoco es de nadie, así que tampoco.
  it('una tarjeta sin responsable tampoco entra', async () => {
    montar({
      boards: [tablero('b-vivo', '🛠 Operaciones')],
      cards: [tarjeta('huerfana', 'Sin dueño', { assignee_id: null })],
    });

    const r = await buildUserCards(YO);

    expect(titulos(r)).toEqual([]);
    expect(r.total).toBe(0);
  });
});

describe('El digest no lleva tableros de archivo', () => {
  it('una tarjeta urgente y MÍA en «📒 Archivo» no entra', async () => {
    montar({
      boards: [tablero('b-vivo', '🛠 Operaciones'), tablero('b-archivo', '📒 Archivo')],
      cards: [
        tarjeta('viva',      'Viva'),
        tarjeta('archivada', 'Archivada', { board_id: 'b-archivo', column_id: 'col-a' }),
      ],
    });

    const r = await buildUserCards(YO);

    expect(titulos(r)).toEqual(['Viva']);
  });

  // Se agrava solo: esta casa CONSERVA la prioridad al cerrar, así que una
  // `urgent` archivada sigue siendo `urgent` para siempre. Cuanto más se limpia
  // el tablero, más ruidoso se volvía el correo.
  it('y da igual que sea urgent: archivada es archivada', async () => {
    montar({
      boards: [tablero('b-archivo', '📒 Archivo')],
      cards: [tarjeta('vieja', 'Urgente de hace meses', { priority: 'urgent', board_id: 'b-archivo', column_id: 'col-a' })],
    });

    expect(titulos(await buildUserCards(YO))).toEqual([]);
  });

  // Es una REGLA, no una lista de identificadores: un archivo nuevo que alguien
  // cree mañana queda fuera sin que nadie toque este código.
  it('reconoce el archivo por su título, no por una lista', async () => {
    montar({
      boards: [tablero('b-archivo', 'Archivo de 2025')],
      cards: [tarjeta('vieja', 'Vieja', { board_id: 'b-archivo', column_id: 'col-a' })],
    });

    expect(titulos(await buildUserCards(YO))).toEqual([]);
  });
});

describe('El digest lleva solo urgent y high', () => {
  it('una tarjeta mía de prioridad media no entra', async () => {
    montar({
      boards: [tablero('b-vivo', '🛠 Operaciones')],
      cards: [tarjeta('media', 'Media', { priority: 'medium' })],
    });

    expect(titulos(await buildUserCards(YO))).toEqual([]);
  });

  it('urgent y high sí', async () => {
    montar({
      boards: [tablero('b-vivo', '🛠 Operaciones')],
      cards: [
        tarjeta('u', 'Urgente',   { priority: 'urgent' }),
        tarjeta('h', 'Alta',      { priority: 'high' }),
        tarjeta('l', 'Baja',      { priority: 'low' }),
        tarjeta('n', 'Ninguna',   { priority: 'none' }),
      ],
    });

    expect(titulos(await buildUserCards(YO)).sort()).toEqual(['Alta', 'Urgente']);
  });
});

describe('Las dos consecuencias aceptadas — decisión, no defecto', () => {
  // Decidido por Ibai el 25-ago-2026. Esta prueba existe para que el primero que
  // eche de menos una vencida vea que se fue a propósito.
  it('una VENCIDA de prioridad media deja de aparecer, y es deliberado', async () => {
    montar({
      boards: [tablero('b-vivo', '🛠 Operaciones')],
      cards: [tarjeta('vencida', 'Vencida y media', { priority: 'medium', due_date: '2020-01-01' })],
    });

    expect(titulos(await buildUserCards(YO))).toEqual([]);
  });

  it('pero una vencida que además es MÍA y urgente sigue entrando', async () => {
    montar({
      boards: [tablero('b-vivo', '🛠 Operaciones')],
      cards: [tarjeta('vencida', 'Vencida y urgente', { priority: 'urgent', due_date: '2020-01-01' })],
    });

    expect(titulos(await buildUserCards(YO))).toEqual(['Vencida y urgente']);
  });

  it('el digest puede salir VACÍO, y eso es lo esperado, no un fallo', async () => {
    montar({
      boards: [tablero('b-vivo', '🛠 Operaciones')],
      cards: [tarjeta('suya', 'De otro', { assignee_id: OTRO })],
    });

    const r = await buildUserCards(YO);

    expect(r.total).toBe(0);
    // `assignedItems` sigue existiendo: es otra sección y no se toca.
    expect(Array.isArray(r.assignedItems)).toBe(true);
  });
});

describe('Lo que NO se toca: los ítems de checklist asignados', () => {
  // La tarjeta lo dice expreso: `assignedItems` ya filtra por responsable y se
  // queda. Aquí se fija que los tres filtros nuevos NO se lo hayan llevado por
  // delante — un ítem mío dentro de una tarjeta de OTRO tiene que seguir
  // llegándome.
  it('un ítem mío en una tarjeta de otro sigue llegando', async () => {
    montar({
      boards: [tablero('b-vivo', '🛠 Operaciones')],
      cards: [
        tarjeta('suya', 'De otro', {
          assignee_id: OTRO,
          priority: 'low',
          checklist: [{ text: 'Mi ítem', done: false, assignees: [YO] }],
        }),
      ],
    });

    const r = await buildUserCards(YO);

    expect(titulos(r)).toEqual([]);            // la tarjeta no es mía
    expect(r.assignedItems).toHaveLength(1);   // el ítem sí
    expect(r.assignedItems[0].item.text).toBe('Mi ítem');
  });
});
