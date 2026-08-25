// assigneeNotification.js — la campana de «te han asignado esto».
//
// ─────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ES UN MÓDULO Y NO UNA FUNCIÓN DENTRO DE UNA RUTA
//
// Vivía dentro de `server/routes/cards.js` y solo la Puerta 1 podía usarla. La
// Puerta 2 —`POST /api/internal/create-card`, por donde entra el trabajo que
// mandan las naves de fuera de esta máquina— creaba tarjetas asignadas **sin
// avisar a nadie**: existían, tenían dueño, y su dueño solo se enteraba si abría
// el tablero.
//
// Eso no era un incumplimiento —el contrato declaraba la Puerta 2 como tubería
// en crudo— sino una asimetría que dejó de tener sentido cuando la Puerta 1 y la
// UI empezaron a avisar al nacer asignadas. Decisión de Ibai, 25-ago-2026:
// **las dos puertas suenan** (tarjeta `b0a46770`).
//
// Se extrae en vez de duplicarse porque **dos campanas separadas se
// desincronizan sin que nadie lo note**: quien arregle el texto, el tipo o la
// forma del `payload` en una no tiene por qué acordarse de la otra, y un aviso
// que llega distinto según la puerta por la que entró el trabajo es peor que uno
// que no llega — parecen dos sistemas.
//
// ⚠️ LO QUE ESTA FUNCIÓN NO HACE, Y HAY QUE SABERLO ANTES DE USARLA:
//
//   · **No decide a quién NO avisar.** Las guardas —sin responsable no hay a
//     quién avisar; a uno mismo no se le notifica— viven en quien llama, porque
//     cada puerta sabe cosas distintas sobre quién está llamando. La Puerta 1
//     tiene `req.user`; la Puerta 2 **no tiene identidad de llamante en
//     absoluto**.
//   · **No rompe nada si falla.** Un aviso que no sale no puede tumbar la
//     escritura que lo motivó: la tarjeta ya existe y el llamante ya tiene su
//     respuesta. Se registra en consola y se sigue.
// ─────────────────────────────────────────────────────────────────────────────

const { supabaseAdmin } = require('./supabase');

/**
 * Escribe la notificación in-app de asignación.
 *
 * @param {string}      cardId
 * @param {string}      boardId
 * @param {string}      cardTitle
 * @param {string}      assigneeUserId  a quién le suena
 * @param {string|null} authorId        quién asignó, o `null` si no se sabe
 */
async function createAssigneeNotification(cardId, boardId, cardTitle, assigneeUserId, authorId) {
  const { data: board } = await supabaseAdmin
    .from('boards')
    .select('workspace_id')
    .eq('id', boardId)
    .single();

  if (!board?.workspace_id) return;

  // `assignedBy` puede ser `null` y es deliberado: por la Puerta 2 **no se sabe
  // quién asignó**. Inventar un autor —el riel, el primer superadmin, quien sea—
  // sería peor que no decirlo: haría creer que alguien concreto te clavó ese
  // trabajo. Que el llamante tenga identidad es otra tarjeta.
  const payload = { cardId, cardTitle, boardId, workspaceId: board.workspace_id, assignedBy: authorId ?? null };
  const { error } = await supabaseAdmin
    .from('notifications')
    .insert([{ user_id: assigneeUserId, type: 'card_assignment', payload, read: false }]);

  if (error) console.error('[notifications] assignee insert:', error.message);
}

module.exports = { createAssigneeNotification };
