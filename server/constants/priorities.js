/**
 * Las prioridades válidas de una tarjeta, en un solo sitio.
 *
 * POR QUÉ EXISTE ESTE FICHERO (2026-08-06).
 * La lista estaba escrita a mano en tres sitios de JavaScript: el `Set` de
 * `cards.js`, el `Set` de `internalRoute.js`, y —seis líneas más abajo del
 * primero— el texto del error que la enumeraba. Esa tercera copia **ya había
 * divergido**: el conjunto aceptaba `urgent` y el mensaje decía
 * «low, medium, high, or none».
 *
 * El daño no es cosmético, y es de la familia que esta nave persigue. El mensaje
 * de error es **la única documentación que lee quien acaba de fallar**. Quien
 * recibía ese `400` concluía que `urgent` no existe y bajaba su tarjeta a
 * `high` — la misma degradación silenciosa que el contrato v2.0.0 se puso a
 * evitar, solo que cometida por el llamante en vez de por el servidor, y por
 * eso invisible desde aquí.
 *
 * La regla: **el mensaje se DERIVA del conjunto, nunca se escribe al lado.**
 * Una lista que se repite se desincroniza; la pregunta no es si, es cuándo.
 *
 * Lo que esto NO cierra, dicho en voz alta: `kanban-mcp/validation.py` tiene su
 * propia copia porque es otro lenguaje y otro proceso. Esa no se puede fundir
 * desde aquí; que las dos digan lo mismo no lo garantiza nadie todavía.
 */

// El orden es el de urgencia descendente, y se usa tal cual en los mensajes:
// quien lee el error ve primero lo más fuerte.
const VALID_PRIORITIES = Object.freeze(['urgent', 'high', 'medium', 'low', 'none']);

const VALID_PRIORITY_SET = new Set(VALID_PRIORITIES);

/** `true` si el valor es una prioridad utilizable. No juzga si es la acertada. */
const isValidPriority = (value) => VALID_PRIORITY_SET.has(value);

/**
 * La lista, para meterla en un mensaje de error. Se deriva — no se teclea.
 * `priorityList()` → "urgent, high, medium, low, none"
 */
const priorityList = (separator = ', ') => VALID_PRIORITIES.join(separator);

module.exports = { VALID_PRIORITIES, VALID_PRIORITY_SET, isValidPriority, priorityList };
