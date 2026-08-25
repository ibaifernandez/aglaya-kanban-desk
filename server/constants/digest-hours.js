/**
 * Las horas UTC a las que el digest se envía, en un solo sitio.
 *
 * POR QUÉ EXISTE ESTE FICHERO (2026-08-25).
 *
 * El digest tiene DOS consumidores de esta lista y vivían separados:
 *
 *   · **el reloj** — `.github/workflows/digest-cron.yml`, que decide a qué horas
 *     hay una pasada;
 *   · **el servidor** — `PATCH /api/auth/me/preferences`, que decidía qué hora
 *     puede guardar un usuario, y aceptaba **cualquiera de las 24**.
 *
 * Mientras aceptara las 24 y el reloj visitara menos, existía una hora huérfana:
 * la que un usuario puede elegir y el reloj no visita. **A quien la tuviera no le
 * llegaba nada, y sin error que leer.** No rompe: desaparece — la forma de fallo
 * que esta casa persigue.
 *
 * La solución adoptada no es detectarlo después, es **hacerlo imposible**: las
 * horas que el reloj visita y los valores admisibles son la MISMA lista. Si no se
 * puede guardar una hora que el reloj no visita, no hay huérfana que detectar.
 *
 * EL PRECIO, DICHO: cambiar tu hora de digest deja de ser un ajuste de interfaz y
 * pasa a ser **un cambio en este fichero, con su commit**. Es deliberado. La
 * alternativa —24 pasadas diarias para que la preferencia sea libre— costaba el
 * 83 % del gasto vivo de esta nave para servir a un destinatario.
 *
 * DE DÓNDE SALE EL 11. Medido contra la base y pegado dentro de la tarjeta
 * `a1015f7c`: un solo usuario con `digest_enabled`, hora 11 UTC. No es una
 * elección de diseño, es el censo — y por eso este fichero es lo primero que hay
 * que mirar cuando ese censo cambie.
 *
 * LO QUE ESTO NO PUEDE HACER SOLO: el reloj vive en YAML y no puede importar
 * este fichero. Que los dos digan lo mismo lo sostiene `scripts/digest-horas-guard.sh`,
 * que compara el `cron` con esta lista y se pone rojo si divergen. **No es
 * «imposible por construcción» en sentido literal: es imposible que diverjan sin
 * que CI lo diga.** Dicho así para que nadie lea de más.
 */

// UTC. Orden ascendente, y se usa tal cual en los mensajes de error.
const DIGEST_HOURS = Object.freeze([11]);

const DIGEST_HOUR_SET = new Set(DIGEST_HOURS);

/** El texto se DERIVA de la lista, nunca se escribe al lado. */
const digestHourList = () => DIGEST_HOURS.join(', ');

/** `null` si la hora es admisible; el motivo si no. */
function digestHourError(valor) {
  const h = Number(valor);
  if (!Number.isInteger(h)) {
    return `digestHour debe ser un entero. Horas admitidas (UTC): ${digestHourList()}.`;
  }
  if (!DIGEST_HOUR_SET.has(h)) {
    return (
      `digestHour ${h} no está entre las horas a las que se envía el digest. ` +
      `Admitidas (UTC): ${digestHourList()}. ` +
      'No es un capricho: el reloj solo despierta a esas horas, así que una ' +
      'hora fuera de la lista no te dejaría sin aviso — te dejaría sin digest, ' +
      'y sin error que leer. Para añadir una hora hay que añadirla también al ' +
      'reloj, y eso vive en server/constants/digest-hours.js.'
    );
  }
  return null;
}

module.exports = { DIGEST_HOURS, DIGEST_HOUR_SET, digestHourList, digestHourError };
