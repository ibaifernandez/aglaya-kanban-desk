/**
 * shared.js — Helpers compartidos entre digest admin y user.
 *
 * Extraído del refactor de god-router digestRouter (ADR-revisitado: el
 * degree alto venía de superficie de imports, no de mezcla de concerns).
 * Estos helpers eran duplicados byte-a-byte entre digest.js y userDigest.js.
 */

'use strict';

// ── HTML escaping ─────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Date formatting ───────────────────────────────────────────────────────────

function dateLabel() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(dueDate) {
  return !!dueDate && dueDate.slice(0, 10) < todayStr();
}

// ── Domain constants ──────────────────────────────────────────────────────────

// Column titles flagged as "done" — excluded from digests
const DONE_COLUMN_RE = /✅|hecho|done|entregado|completado/i;

// Tableros de ARCHIVO. Su trabajo terminó y no vuelve a la cola de nadie.
//
// POR QUÉ HACE FALTA APARTE DE `DONE_COLUMN_RE`. El digest ya excluía las
// COLUMNAS de tipo hecho, pero «📒 Archivo» es un TABLERO entero y su título no
// casa con aquel patrón. El 24-ago-2026 el digest de Ibai encabezaba con «Tienes
// **79 tareas** urgentes» y el bloque que las traía era
// `🍀 LEGAL REG TECH · 📒 ARCHIVO`.
//
// Y se agrava solo: la regla de esta casa **conserva la prioridad al cerrar**,
// así que una tarjeta `urgent` archivada sigue siendo `urgent` para siempre.
// **Cuanto más se limpia el tablero, más ruidoso se vuelve el correo.**
//
// ES UNA REGLA Y NO UNA LISTA, a propósito: una lista de identificadores de
// tablero es completa el día que se escribe y el siguiente archivo que alguien
// cree entra en el correo sin que nadie se entere. Medido sobre los tableros
// vivos —13 en tres espacios— la convención es exacta: los dos de archivo se
// llaman `📒 Archivo` y ningún otro título contiene «archiv».
//
// EL PRECIO, DICHO: un tablero llamado «Archivo de prensa» quedaría fuera del
// digest aunque fuera trabajo vivo. Con la convención de hoy no existe, y si
// algún día existe, el remedio es renombrarlo — no ampliar el patrón hasta que
// deje de significar algo.
const ARCHIVE_BOARD_RE = /📒|archiv/i;

module.exports = {
  escHtml,
  dateLabel,
  todayStr,
  isOverdue,
  DONE_COLUMN_RE,
  ARCHIVE_BOARD_RE,
};
