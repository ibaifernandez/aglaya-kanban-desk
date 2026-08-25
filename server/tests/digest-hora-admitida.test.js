/**
 * PATCH /api/auth/me/preferences — la hora del digest se valida contra la lista
 * que visita el reloj, no contra «0..23».
 *
 * Tarjeta: «El digest despierta 24 veces al día para un solo destinatario que lo
 * quiere a las 11 UTC» (`a1015f7c`).
 *
 * QUÉ CIERRA, Y NO ES EL AHORRO. Bajar el reloj es la mitad barata. La otra —la
 * que justifica la tarjeta— es que **una hora que el reloj no visita no se pueda
 * guardar**. Mientras el servidor aceptara las 24 y el reloj visitara una, quien
 * eligiera otra **no recibía nada y sin error que leer**. No rompe: desaparece.
 *
 * La tarjeta lo dice con todas las letras: *«si solo baja el `cron` y no deja esa
 * comprobación, no ha cerrado la parte que justifica la tarjeta»*.
 *
 * Y HAY UN SEGUNDO CAMINO, que es el que la tarjeta llama «se concentra»:
 * **reactivar el digest con una hora vieja huérfana.** Validar lo que entra no
 * basta —hay filas anteriores a esta lista—, así que activar sin tocar la hora
 * también se comprueba. Encenderlo para no recibir nada, creyendo que sí, es el
 * mismo fallo entrando por la puerta de al lado.
 */
const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';

const { DIGEST_HOURS } = require('../constants/digest-hours');
const HORA_BUENA = DIGEST_HOURS[0];
// Una hora que la lista NO admite, elegida sin teclearla: si mañana la lista
// cambia, esto sigue siendo «una que no está» en vez de un literal que caduca.
const HORA_HUERFANA = [...Array(24).keys()].find(h => !DIGEST_HOURS.includes(h));

jest.mock('../utils/supabase', () => {
  const estado = {
    fila: { digest_hour: 11, digest_enabled: false },
    updates: [],
    reset(fila) {
      estado.fila = { ...fila };
      estado.updates.length = 0;
    },
  };

  const cliente = {
    from: () => {
      let patch = null;
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: (p) => { patch = p; return chain; },
        single: () => {
          if (patch) {
            estado.updates.push(patch);
            Object.assign(estado.fila, patch);
            return Promise.resolve({ data: { ...estado.fila }, error: null });
          }
          return Promise.resolve({ data: { ...estado.fila }, error: null });
        },
      };
      return chain;
    },
  };

  return {
    supabaseAdmin: cliente,
    createAdminClient: () => cliente,
    __estado: estado,
  };
});

const { __estado } = require('../utils/supabase');
const app = require('../app');

const token = jwt.sign(
  { id: 'user-1', email: 'test@aglaya.biz', role: 'admin', organizationId: 'org-1' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' },
);

const patch = (body) =>
  request(app)
    .patch('/api/auth/me/preferences')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

beforeEach(() => __estado.reset({ digest_hour: HORA_BUENA, digest_enabled: false }));

describe('PATCH /api/auth/me/preferences — la hora se valida contra el reloj', () => {
  it('una hora de la lista se guarda', async () => {
    const res = await patch({ digestHour: HORA_BUENA });

    expect(res.status).toBe(200);
    expect(__estado.updates).toHaveLength(1);
    expect(__estado.updates[0].digest_hour).toBe(HORA_BUENA);
  });

  it('una hora que el reloj no visita se rechaza, y NO se escribe', async () => {
    const res = await patch({ digestHour: HORA_HUERFANA });

    expect(res.status).toBe(400);
    expect(__estado.updates).toHaveLength(0);
  });

  // El mensaje es la única documentación que lee quien acaba de fallar. Si dice
  // «entre 0 y 23» manda a probar otra hora cualquiera, que fallará igual.
  it('el 400 dice cuáles SON las horas admitidas, no un rango genérico', async () => {
    const res = await patch({ digestHour: HORA_HUERFANA });

    expect(res.body.error).toMatch(new RegExp(String(HORA_BUENA)));
    expect(res.body.error).not.toMatch(/entre 0 y 23/);
    expect(res.body.digestHours).toEqual(DIGEST_HOURS);
  });

  it('y explica el daño: sin digest y sin error que leer', async () => {
    const res = await patch({ digestHour: HORA_HUERFANA });
    expect(res.body.error).toMatch(/sin error que leer/);
  });

  it('lo que no es un entero también se rechaza', async () => {
    const res = await patch({ digestHour: 'las once' });

    expect(res.status).toBe(400);
    expect(__estado.updates).toHaveLength(0);
  });

  // ── El segundo camino: reactivar con una hora vieja ───────────────────────
  describe('activar el digest con una hora huérfana guardada', () => {
    it('se rechaza: encenderlo así sería encenderlo para no recibir nada', async () => {
      __estado.reset({ digest_hour: HORA_HUERFANA, digest_enabled: false });

      const res = await patch({ digestEnabled: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/No se ha activado/);
      expect(__estado.updates).toHaveLength(0);
    });

    it('pero activar Y elegir hora buena a la vez, sí', async () => {
      __estado.reset({ digest_hour: HORA_HUERFANA, digest_enabled: false });

      const res = await patch({ digestEnabled: true, digestHour: HORA_BUENA });

      expect(res.status).toBe(200);
      expect(__estado.updates[0].digest_hour).toBe(HORA_BUENA);
      expect(__estado.updates[0].digest_enabled).toBe(true);
    });

    it('y con la hora ya buena, activar no molesta', async () => {
      __estado.reset({ digest_hour: HORA_BUENA, digest_enabled: false });

      const res = await patch({ digestEnabled: true });

      expect(res.status).toBe(200);
      expect(__estado.updates[0].digest_enabled).toBe(true);
    });

    // Apagar no se estorba: quien se va no necesita una hora válida para irse.
    it('desactivar con una hora huérfana NO se estorba', async () => {
      __estado.reset({ digest_hour: HORA_HUERFANA, digest_enabled: true });

      const res = await patch({ digestEnabled: false });

      expect(res.status).toBe(200);
      expect(__estado.updates[0].digest_enabled).toBe(false);
    });
  });
});
