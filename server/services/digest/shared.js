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

module.exports = {
  escHtml,
  dateLabel,
  todayStr,
  isOverdue,
  DONE_COLUMN_RE,
};
