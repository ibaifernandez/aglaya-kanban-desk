/**
 * `POST /api/internal/create-card` — asignar suena también por la Puerta 2.
 *
 * Tarjeta `b0a46770`. Decisión de Ibai, 25-ago-2026.
 *
 * QUÉ DEFECTO CIERRA. Una comanda que entraba por esta puerta **existía, tenía
 * dueño y no avisaba a nadie**: su responsable solo se enteraba si abría el
 * tablero. No era un incumplimiento —el contrato declaraba esta puerta «en
 * crudo, sin notificaciones»— sino una asimetría que dejó de tener sentido
 * cuando la Puerta 1 y la UI empezaron a avisar al nacer asignadas (#56). Y es
 * **la puerta por la que entra el trabajo de fuera de esta máquina**.
 *
 * Es la familia «nace invisible» de esta casa: no falla, envejece.
 *
 * LO QUE SE ASIERTA es la FILA de notificación, no lo que devuelve la ruta: el
 * `201` era idéntico con campana y sin ella. Un banco que mirase el acuse
 * estaría en verde con la campana borrada.
 */
const request = require('supertest');

process.env.JWT_SECRET  = 'test-secret';
process.env.TASK_SECRET = 'test-task-secret';

const CLAVE = '11111111-2222-4333-8444-999999999999';

jest.mock('../utils/supabase', () => {
  const TABLES = {
    workspaces: [
      { id: 'ws-1', name: 'AGLAYA Kanban', type: 'interno', emoji: '📊', organization_id: 'org-1' },
    ],
    boards: [
      { id: 'board-1', workspace_id: 'ws-1', title: '🛠 Operaciones', order: 1 },
    ],
    columns: [
      { id: 'col-backlog', board_id: 'board-1', title: 'Backlog', order: 1 },
    ],
    users: [
      { id: 'user-mon',  name: 'Món',         email: 'mon@ejemplo.test' },
      { id: 'user-rail', name: 'Kanban Rail', email: 'kanban-rail@aglaya.biz' },
    ],
    cards: [],
  };

  const PRISTINO = JSON.parse(JSON.stringify(TABLES));

  const banco = {
    TABLES,
    campanas: [],           // filas que llegaron a `notifications`
    siguienteId: 1,
    // Una campana rota no puede tumbar la escritura que la motivó. Esto lo hace
    // comprobable sin tocar el código.
    romperCampana: false,
    // Distinto de `romperCampana`: aquí la campana no devuelve un error, sino
    // que REVIENTA. Es la promesa rechazada que solo puede parar el `.catch`.
    explotarCampana: false,
    reset() {
      for (const t of Object.keys(PRISTINO)) {
        TABLES[t].length = 0;
        TABLES[t].push(...JSON.parse(JSON.stringify(PRISTINO[t])));
      }
      banco.campanas.length = 0;
      banco.siguienteId = 1;
      banco.romperCampana = false;
      banco.explotarCampana = false;
    },
  };

  const supabaseAdmin = {
    from: (table) => {
      let data = JSON.parse(JSON.stringify(TABLES[table] ?? []));

      const chain = {
        select: () => chain,
        eq: (col, val) => { data = data.filter(r => r[col] === val); return chain; },
        ilike: (col, pattern) => {
          const p = String(pattern);
          const needle = p.replace(/%/g, '').toLowerCase();
          const abreIzq = p.startsWith('%');
          const abreDer = p.endsWith('%');
          data = data.filter(r => {
            const s = String(r[col] ?? '').toLowerCase();
            if (abreIzq && abreDer) return s.includes(needle);
            if (abreIzq)            return s.endsWith(needle);
            if (abreDer)            return s.startsWith(needle);
            return s === needle;
          });
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        single: () => {
          // La campana empieza leyendo el tablero para derivar el workspace. Si
          // esa lectura revienta, lo que sale de aquí es una promesa RECHAZADA.
          if (table === 'boards' && banco.explotarCampana) {
            banco.explotarCampana = false;   // solo la lectura de la campana
            return Promise.reject(new Error('la red se cayó a mitad'));
          }
          return Promise.resolve({ data: data[0] ?? null, error: null });
        },

        insert: (row) => {
          const filas = Array.isArray(row) ? row : [row];

          if (table === 'notifications') {
            if (banco.romperCampana) {
              return Promise.resolve({ data: null, error: { message: 'permission denied' } });
            }
            banco.campanas.push(...filas);
            return Promise.resolve({ data: filas, error: null });
          }

          return {
            select: () => ({
              single: () => {
                const fila = filas[0];
                const choca =
                  fila.idempotency_key != null &&
                  TABLES.cards.some(c => c.idempotency_key === fila.idempotency_key);

                if (choca) {
                  return Promise.resolve({
                    data: null,
                    error: { code: '23505', message: 'duplicate key' },
                  });
                }

                const creada = { id: `card-${banco.siguienteId++}`, ...fila };
                TABLES.cards.push(creada);
                return Promise.resolve({ data: creada, error: null });
              },
            }),
          };
        },

        then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject),
      };
      return chain;
    },
  };

  return { supabaseAdmin, __banco: banco };
});

const { __banco } = require('../utils/supabase');
const app = require('../app');

const SECRET = 'test-task-secret';
const post = (body) =>
  request(app)
    .post('/api/internal/create-card')
    .set('x-task-secret', SECRET)
    .send(body);

const COMANDA = {
  title: 'Revisar el contrato del riel',
  boardName: 'Operaciones',
  workspaceName: 'AGLAYA Kanban',
  priority: 'high',
  assignee: 'mon@ejemplo.test',
};

// La campana se dispara sin esperarla —no puede bloquear el `201`—, así que hay
// que dejar correr la microcola antes de mirar la tabla. Sin esto, el banco
// mediría «todavía no ha llegado» y lo leería como «no suena».
const dejarSonar = () => new Promise((r) => setImmediate(r));

beforeEach(() => __banco.reset());

describe('la Puerta 2 avisa a quien le clava trabajo', () => {
  it('crear asignada escribe la notificación in-app', async () => {
    const res = await post(COMANDA);
    await dejarSonar();

    expect(res.status).toBe(201);
    expect(__banco.campanas).toHaveLength(1);

    const [campana] = __banco.campanas;
    expect(campana.user_id).toBe('user-mon');
    expect(campana.type).toBe('card_assignment');
    expect(campana.read).toBe(false);
  });

  // El aviso tiene que llevar dentro con qué navegar hasta la tarjeta. Sin
  // `workspaceId` la campana suena y no lleva a ninguna parte — y ese campo NO
  // está en la fila de la tarjeta: se deriva del tablero.
  it('la campana trae el destino resuelto, no solo el id de la tarjeta', async () => {
    const res = await post(COMANDA);
    await dejarSonar();

    const { payload } = __banco.campanas[0];
    expect(payload.cardId).toBe(res.body.card.id);
    expect(payload.cardTitle).toBe(COMANDA.title);
    expect(payload.boardId).toBe('board-1');
    expect(payload.workspaceId).toBe('ws-1');
  });

  // ⚠️ Por esta puerta NO hay identidad de llamante: entra un secreto, no un
  // usuario. `assignedBy` va a `null` **a propósito** — inventar un autor haría
  // creer que alguien concreto te clavó ese trabajo.
  it('assignedBy es null porque no se sabe quién asignó, y no se inventa', async () => {
    await post(COMANDA);
    await dejarSonar();

    expect(__banco.campanas[0].payload).toHaveProperty('assignedBy', null);
  });

  it('la tarjeta queda igual: el acuse no cambia de forma', async () => {
    const res = await post(COMANDA);
    await dejarSonar();

    expect(res.body.ok).toBe(true);
    expect(res.body.card.assignee).toBe('Món');
    expect(res.body.card.assignee_id).toBe('user-mon');
  });
});

describe('lo que la campana NO puede hacer', () => {
  // La campana va DESPUÉS de la escritura y no la bloquea. Si un fallo al
  // notificar convirtiera en error una creación que salió bien, el llamante
  // reintentaría y duplicaría trabajo — el remedio sería peor que el defecto.
  it('si el aviso falla, la tarjeta se crea igual y el 201 no cambia', async () => {
    __banco.romperCampana = true;

    const res = await post(COMANDA);
    await dejarSonar();

    expect(res.status).toBe(201);
    expect(__banco.TABLES.cards).toHaveLength(1);
    expect(__banco.campanas).toHaveLength(0);
  });

  // ⚠️ Y el caso que de verdad ejerce el `.catch`, que es distinto del de
  // arriba. Allí la campana devuelve un error y el código lo registra; aquí la
  // campana **revienta** —promesa rechazada—, y sin `.catch` eso sería un
  // rechazo sin manejar: en Node moderno tumba el proceso. Comprobado por
  // mutación: quitar el `.catch` dejaba verde el caso de arriba.
  it('si el aviso REVIENTA, la creación sigue en pie y nadie se entera por un 500', async () => {
    __banco.explotarCampana = true;

    const res = await post(COMANDA);
    await dejarSonar();

    expect(res.status).toBe(201);
    expect(__banco.TABLES.cards).toHaveLength(1);
    expect(__banco.campanas).toHaveLength(0);
  });

  // Una repetición por `idempotencyKey` NO crea nada, así que tampoco vuelve a
  // sonar: dos campanas por el mismo trabajo enseñan a ignorar la campana. Es la
  // misma regla que el contrato ya fija para el `warning` de brief vacío.
  it('una repetición idempotente no vuelve a sonar', async () => {
    const a = await post({ ...COMANDA, idempotencyKey: CLAVE });
    await dejarSonar();
    const b = await post({ ...COMANDA, idempotencyKey: CLAVE });
    await dejarSonar();

    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.idempotent).toBe(true);
    expect(__banco.TABLES.cards).toHaveLength(1);
    expect(__banco.campanas).toHaveLength(1);   // una tarjeta, una campana
  });

  // Y lo que esta puerta NO promete pese a sonar: sigue insertando en crudo.
  // Sin este caso, «ahora avisa» se leería como «ahora valida», que es otra
  // cosa y el contrato la mantiene fuera a propósito.
  it('sigue sin comprobar membresía: avisar no es validar', async () => {
    // `user-mon` no es miembro de nada en este banco — no hay tabla de
    // membresías siquiera — y la comanda entra igual.
    const res = await post(COMANDA);
    await dejarSonar();

    expect(res.status).toBe(201);
    expect(__banco.campanas).toHaveLength(1);
  });
});
