/**
 * digest.js — Admin digest email for MyBoardLFi
 *
 * Sends a usage statistics report to the superadmin (DIGEST_TO).
 * Also triggered on-demand via POST /api/digest/send-me (restricted to admins).
 */

'use strict';

const cron              = require('node-cron');
const nodemailer        = require('nodemailer');
const { supabaseAdmin } = require('./utils/supabase');

// ── Config ────────────────────────────────────────────────────────────────────

const DIGEST_HOUR = parseInt(process.env.DIGEST_HOUR ?? '6', 10);

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dateLabel() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Stats builder ─────────────────────────────────────────────────────────────

async function buildStats() {
  // Fetch all data from Supabase (service_role bypasses RLS — full org view)
  const [boardsRes, columnsRes, cardsRes, categoriesRes] = await Promise.all([
    supabaseAdmin.from('boards').select('id, title'),
    supabaseAdmin.from('columns').select('id, title'),
    supabaseAdmin.from('cards').select('id, column_id, board_id, priority, due_date'),
    supabaseAdmin.from('categories').select('id'),
  ]);

  const boards     = boardsRes.data     ?? [];
  const columns    = columnsRes.data    ?? [];
  const cards      = cardsRes.data      ?? [];
  const categories = categoriesRes.data ?? [];

  // Column IDs marked as "done"
  const doneColumnIds = new Set(
    columns.filter(c => c.title && /✅|hecho|done|entregado|completado/i.test(c.title)).map(c => c.id)
  );

  const totalBoards   = boards.length;
  const totalColumns  = columns.length;
  const totalCards    = cards.length;
  const doneCards     = cards.filter(c => doneColumnIds.has(c.column_id)).length;
  const pendingCards  = totalCards - doneCards;

  // Priority breakdown (pending only)
  const pending = cards.filter(c => !doneColumnIds.has(c.column_id));
  const byPriority = { urgent: 0, high: 0, medium: 0, low: 0, none: 0 };
  for (const c of pending) {
    const p = c.priority ?? 'none';
    byPriority[p] = (byPriority[p] ?? 0) + 1;
  }

  // Overdue pending cards
  const today = todayStr();
  const overdue = pending.filter(c => c.due_date && c.due_date.slice(0,10) < today).length;

  // Cards with no column assigned (data integrity)
  const columnIds = new Set(columns.map(c => c.id));
  const orphanCards = cards.filter(c => !columnIds.has(c.column_id)).length;

  // Boards breakdown (top 10 by card count)
  const boardCardCount = {};
  for (const c of cards) {
    boardCardCount[c.board_id] = (boardCardCount[c.board_id] ?? 0) + 1;
  }
  const boardRows = boards
    .map(b => ({ title: b.title, count: boardCardCount[b.id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Supabase user stats (best-effort)
  let userStats = null;
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (!error && users) {
      const now = Date.now();
      const DAY = 86_400_000;
      userStats = {
        total:      users.length,
        confirmed:  users.filter(u => u.email_confirmed_at).length,
        lastDay:    users.filter(u => u.last_sign_in_at && (now - new Date(u.last_sign_in_at)) < DAY).length,
        lastWeek:   users.filter(u => u.last_sign_in_at && (now - new Date(u.last_sign_in_at)) < 7 * DAY).length,
        list:       users
          .sort((a, b) => new Date(b.last_sign_in_at ?? 0) - new Date(a.last_sign_in_at ?? 0))
          .slice(0, 15)
          .map(u => ({
            email:     u.email,
            confirmed: !!u.email_confirmed_at,
            lastLogin: u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('es-ES') : '—',
            createdAt: u.created_at  ? new Date(u.created_at).toLocaleDateString('es-ES')  : '—',
          })),
      };
    }
  } catch (_) {
    // Supabase not available in this context — skip user stats
  }

  return {
    totalBoards, totalColumns, totalCards,
    doneCards, pendingCards,
    byPriority, overdue, orphanCards,
    boardRows, categories: categories.length,
    userStats,
  };
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function statCard(emoji, label, value, subtext = '') {
  return `
    <td style="width:25%;padding:0 8px 0 0;vertical-align:top;">
      <div style="background:#0f1117;border:1px solid #2a2d3a;border-radius:10px;padding:16px 14px;">
        <div style="font-size:22px;margin-bottom:6px;">${emoji}</div>
        <div style="font-size:26px;font-weight:800;color:#e8eaf0;line-height:1;">${value}</div>
        <div style="font-size:11px;color:#555b70;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">${label}</div>
        ${subtext ? `<div style="font-size:11px;color:#6366f1;margin-top:4px;">${subtext}</div>` : ''}
      </div>
    </td>`;
}

function priorityRow(label, count, color) {
  if (count === 0) return '';
  return `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #2a2d3a;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle;"></span>
        <span style="font-size:13px;color:#8b92a5;">${label}</span>
      </td>
      <td style="padding:6px 0;border-bottom:1px solid #2a2d3a;text-align:right;">
        <strong style="font-size:13px;color:#e8eaf0;">${count}</strong>
      </td>
    </tr>`;
}

function buildHtml(stats) {
  const { totalBoards, totalColumns, totalCards, doneCards, pendingCards,
          byPriority, overdue, orphanCards, boardRows, userStats } = stats;

  const donePercent = totalCards > 0 ? Math.round(doneCards / totalCards * 100) : 0;

  // ── User table ──────────────────────────────────────────────────────────────
  let userSection = '';
  if (userStats) {
    const rows = userStats.list.map(u => `
      <tr>
        <td style="padding:7px 8px;border-bottom:1px solid #2a2d3a;font-size:12px;color:#8b92a5;">${escHtml(u.email)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #2a2d3a;font-size:12px;color:${u.confirmed ? '#22c55e' : '#f59e0b'};text-align:center;">${u.confirmed ? 'Activo' : 'Pendiente'}</td>
        <td style="padding:7px 8px;border-bottom:1px solid #2a2d3a;font-size:12px;color:#555b70;text-align:right;">${u.lastLogin}</td>
      </tr>`).join('');

    userSection = `
      <!-- Users -->
      <tr>
        <td style="padding:0 32px 28px;">
          <div style="font-size:13px;font-weight:700;color:#555b70;text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px;">
            Usuarios registrados
          </div>

          <!-- User summary pills -->
          <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
            <tr>
              <td style="padding:0 6px 0 0;">
                <div style="background:#0f1117;border:1px solid #2a2d3a;border-radius:8px;padding:10px;text-align:center;">
                  <div style="font-size:20px;font-weight:800;color:#e8eaf0;">${userStats.total}</div>
                  <div style="font-size:10px;color:#555b70;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Total</div>
                </div>
              </td>
              <td style="padding:0 6px;">
                <div style="background:#0f1117;border:1px solid #2a2d3a;border-radius:8px;padding:10px;text-align:center;">
                  <div style="font-size:20px;font-weight:800;color:#22c55e;">${userStats.confirmed}</div>
                  <div style="font-size:10px;color:#555b70;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Confirmados</div>
                </div>
              </td>
              <td style="padding:0 6px;">
                <div style="background:#0f1117;border:1px solid #2a2d3a;border-radius:8px;padding:10px;text-align:center;">
                  <div style="font-size:20px;font-weight:800;color:#6366f1;">${userStats.lastDay}</div>
                  <div style="font-size:10px;color:#555b70;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Activos hoy</div>
                </div>
              </td>
              <td style="padding:0 0 0 6px;">
                <div style="background:#0f1117;border:1px solid #2a2d3a;border-radius:8px;padding:10px;text-align:center;">
                  <div style="font-size:20px;font-weight:800;color:#a78bfa;">${userStats.lastWeek}</div>
                  <div style="font-size:10px;color:#555b70;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;">Activos (7d)</div>
                </div>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;border:1px solid #2a2d3a;border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:#1a1d26;">
                <th style="padding:8px;font-size:11px;color:#555b70;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Email</th>
                <th style="padding:8px;font-size:11px;color:#555b70;text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Estado</th>
                <th style="padding:8px;font-size:11px;color:#555b70;text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Último acceso</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </td>
      </tr>`;
  }

  // ── Board rows ───────────────────────────────────────────────────────────────
  const boardTableRows = boardRows.map(b => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #2a2d3a;font-size:13px;color:#8b92a5;">${escHtml(b.title)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #2a2d3a;font-size:13px;color:#e8eaf0;text-align:right;font-weight:700;">${b.count}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MyBoardLFi · Admin Digest</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1d26;border-radius:16px;overflow:hidden;max-width:600px;width:100%;border:1px solid #2a2d3a;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af 0%,#7c3aed 100%);padding:32px 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">
                      MyBoardLFi — Admin Digest
                    </div>
                    <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.5px;line-height:1.2;">
                      Resumen de actividad
                    </div>
                    <div style="font-size:13px;color:rgba(255,255,255,.65);margin-top:6px;">
                      ${escHtml(dateLabel())}
                    </div>
                  </td>
                  <td width="56" align="right" valign="top">
                    <div style="width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:12px;font-size:24px;text-align:center;line-height:48px;">
                      📊
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Global stats -->
          <tr>
            <td style="padding:28px 32px 20px;">
              <div style="font-size:13px;font-weight:700;color:#555b70;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;">
                Estado global del tablero
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${statCard('📋', 'Tableros', totalBoards)}
                  ${statCard('🗂', 'Columnas', totalColumns)}
                  ${statCard('🃏', 'Tarjetas', totalCards, `${donePercent}% completadas`)}
                  ${statCard('✅', 'Hechas', doneCards, `${pendingCards} pendientes`)}
                </tr>
              </table>
            </td>
          </tr>

          ${overdue > 0 ? `
          <!-- Alert: overdue -->
          <tr>
            <td style="padding:0 32px 20px;">
              <div style="background:#0f1117;border:1px solid #2a2d3a;border-left:3px solid #ef4444;border-radius:8px;padding:12px 16px;">
                <p style="margin:0;font-size:13px;color:#e8eaf0;font-weight:600;">
                  ⚠️ ${overdue} tarjeta${overdue !== 1 ? 's' : ''} con fecha vencida
                </p>
                <p style="margin:4px 0 0;font-size:12px;color:#8b92a5;">
                  Hay tarjetas pendientes con fecha de entrega pasada que requieren atención.
                </p>
              </div>
            </td>
          </tr>` : ''}

          ${orphanCards > 0 ? `
          <!-- Alert: orphan cards -->
          <tr>
            <td style="padding:0 32px 20px;">
              <div style="background:#0f1117;border:1px solid #2a2d3a;border-left:3px solid #f59e0b;border-radius:8px;padding:12px 16px;">
                <p style="margin:0;font-size:13px;color:#e8eaf0;font-weight:600;">
                  🔍 ${orphanCards} tarjeta${orphanCards !== 1 ? 's' : ''} sin columna asignada
                </p>
                <p style="margin:4px 0 0;font-size:12px;color:#8b92a5;">
                  Posible inconsistencia de datos. Revisar integridad del JSON.
                </p>
              </div>
            </td>
          </tr>` : ''}

          <!-- Priority breakdown + Board breakdown -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Priority -->
                  <td width="48%" style="vertical-align:top;padding-right:12px;">
                    <div style="font-size:13px;font-weight:700;color:#555b70;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;">
                      Pendientes por prioridad
                    </div>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${priorityRow('Urgente', byPriority.urgent, '#ef4444')}
                      ${priorityRow('Alta',    byPriority.high,   '#f97316')}
                      ${priorityRow('Media',   byPriority.medium, '#eab308')}
                      ${priorityRow('Baja',    byPriority.low,    '#6b7280')}
                      ${priorityRow('Sin prioridad', byPriority.none, '#374151')}
                    </table>
                  </td>
                  <!-- Boards -->
                  <td width="52%" style="vertical-align:top;padding-left:12px;">
                    <div style="font-size:13px;font-weight:700;color:#555b70;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;">
                      Tarjetas por tablero
                    </div>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${boardTableRows || '<tr><td style="font-size:13px;color:#555b70;">Sin tableros</td></tr>'}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${userSection}

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #2a2d3a;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;color:#3a3f50;line-height:1.6;">
                      MyBoardLFi · Admin Digest — generado automáticamente<br>
                      © 2026 Ibai Fernández · Todos los derechos reservados
                    </p>
                  </td>
                  <td align="right" width="80">
                    <p style="margin:0;font-size:11px;color:#3a3f50;">v1.0</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Mailer ────────────────────────────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildSubject() {
  const now      = new Date();
  const weekday  = now.toLocaleDateString('es-ES', { weekday: 'long' });
  const fecha    = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const cap      = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `📊 MyBoardLFi Admin — ${cap}, ${fecha}`;
}

// ── Main send function ────────────────────────────────────────────────────────

/**
 * Sends the admin digest to `to`.
 * If `to` is omitted, falls back to DIGEST_TO env var.
 * Returns { ok: true } on success, throws on error.
 */
async function sendDigest(to) {
  const recipient = to ?? process.env.DIGEST_TO;
  if (!recipient) {
    console.warn('[digest] No recipient — skipping.');
    return;
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error('SMTP no configurado en el servidor.');
  }

  const stats     = await buildStats();
  const html      = buildHtml(stats);
  const subject   = buildSubject();
  const transport = createTransport();

  const info = await transport.sendMail({
    from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to:      recipient,
    subject,
    html,
  });

  console.log(`[digest] Admin digest sent → ${recipient} [${info.messageId}]`);
  return { ok: true, stats };
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

function startDigestScheduler() {
  const hour = Number.isFinite(DIGEST_HOUR) ? DIGEST_HOUR : 6;
  const expr  = `0 ${hour} * * *`;

  cron.schedule(expr, () => {
    console.log(`[digest] Running scheduled admin digest (${new Date().toISOString()})`);
    sendDigest().catch(err => console.error('[digest] Scheduled send failed:', err.message));
  });

  console.log(`[digest] Scheduler started — daily at ${String(hour).padStart(2, '0')}:00 local time`);
}

module.exports = { startDigestScheduler, sendDigest };
