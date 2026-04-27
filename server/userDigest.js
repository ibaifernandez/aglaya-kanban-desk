/**
 * userDigest.js — Personal task digest for AGLAYA Kanban Desk users
 *
 * Sends each user a daily summary of their urgent, high-priority,
 * and overdue cards — grouped by workspace type (personal/interno/externo).
 *
 * Distinct from the admin digest (digest.js), which is a platform health check.
 */

'use strict';

const cron              = require('node-cron');
const nodemailer        = require('nodemailer');
const { supabaseAdmin } = require('./utils/supabase');
const { logDigestAttempt } = require('./utils/digestLogging');

// ── Config ────────────────────────────────────────────────────────────────────

const USER_DIGEST_HOUR   = parseInt(process.env.USER_DIGEST_HOUR ?? '8', 10);
const USER_DIGEST_MINUTE = parseInt(process.env.USER_DIGEST_MINUTE ?? '0', 10);

const SITE_URL = process.env.SITE_URL ?? 'https://kanban.aglaya.biz';

// Column titles that indicate a card is "done" — excluded from digest
const DONE_RE = /✅|hecho|done|entregado|completado/i;

// Priorities that always appear in the digest (regardless of due date)
const URGENT_PRIORITIES = new Set(['urgent', 'high']);

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isOverdue(dueDate) {
  return !!dueDate && dueDate.slice(0, 10) < todayStr();
}

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  return new Date(dueDate).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Data builder ──────────────────────────────────────────────────────────────

/**
 * Fetches a user's actionable cards grouped by workspace type.
 *
 * Returns:
 * {
 *   personal: [{ workspace: { id, name, emoji }, boards: [{ title, cards[] }] }],
 *   interno:  [...],
 *   externo:  [...],
 *   total:    number,
 * }
 *
 * A card is "actionable" if:
 *   - priority is 'urgent' or 'high', OR
 *   - it is overdue (due_date < today)
 *   AND it is NOT in a done-type column.
 */
async function buildUserCards(userId, options = {}) {
  const { workspaceId = null } = options;

  // 1. Workspaces the user belongs to
  let workspaces = [];

  if (workspaceId) {
    const { data: workspace, error: wsErr } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, emoji, type')
      .eq('id', workspaceId)
      .single();

    if (wsErr || !workspace) return { personal: [], interno: [], externo: [], total: 0 };
    workspaces = [workspace];
  } else {
    const { data: memberships, error: mErr } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace:workspaces(id, name, emoji, type)')
      .eq('user_id', userId);

    if (mErr || !memberships?.length) return { personal: [], interno: [], externo: [], total: 0 };

    workspaces = memberships
      .map((m) => m.workspace)
      .filter(Boolean);
  }

  if (!workspaces.length) return { personal: [], interno: [], externo: [], total: 0 };

  const wsIds = workspaces.map((w) => w.id);

  // 2. All boards in those workspaces
  const { data: boards } = await supabaseAdmin
    .from('boards')
    .select('id, title, workspace_id')
    .in('workspace_id', wsIds);

  if (!boards?.length) return { personal: [], interno: [], externo: [], total: 0 };

  const boardIds = boards.map((b) => b.id);

  // 3. All columns in those boards (to detect "done" columns)
  const { data: columns } = await supabaseAdmin
    .from('columns')
    .select('id, title, board_id')
    .in('board_id', boardIds);

  const doneColumnIds = new Set(
    (columns || []).filter((c) => DONE_RE.test(c.title ?? '')).map((c) => c.id)
  );

  // 4. Actionable cards: urgent/high priority OR overdue, not in done columns
  const today = todayStr();
  const { data: cards } = await supabaseAdmin
    .from('cards')
    .select('id, title, priority, due_date, column_id, board_id, checklist')
    .in('board_id', boardIds)
    .not('column_id', 'in', `(${[...doneColumnIds].join(',') || 'null'})`);

  if (!cards?.length) return { personal: [], interno: [], externo: [], total: 0 };

  const actionable = cards.filter((c) =>
    URGENT_PRIORITIES.has(c.priority) || isOverdue(c.due_date)
  );

  if (!actionable.length) return { personal: [], interno: [], externo: [], total: 0 };

  // 5. Group: workspace → board → cards
  const boardMap    = Object.fromEntries(boards.map((b) => [b.id, b]));
  const wsMap       = Object.fromEntries(workspaces.map((w) => [w.id, w]));

  // { wsId: { boardId: [card, ...] } }
  const grouped = {};
  for (const card of actionable) {
    const board = boardMap[card.board_id];
    if (!board) continue;
    const wsId = board.workspace_id;
    if (!grouped[wsId]) grouped[wsId] = {};
    if (!grouped[wsId][board.id]) grouped[wsId][board.id] = [];
    grouped[wsId][board.id].push(card);
  }

  // 6. Sort within each board: urgent first, then overdue, then high
  const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

  for (const wsId of Object.keys(grouped)) {
    for (const boardId of Object.keys(grouped[wsId])) {
      grouped[wsId][boardId].sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 4;
        const pb = PRIORITY_ORDER[b.priority] ?? 4;
        if (pa !== pb) return pa - pb;
        // Both same priority — overdue first
        const aOverdue = isOverdue(a.due_date) ? 0 : 1;
        const bOverdue = isOverdue(b.due_date) ? 0 : 1;
        return aOverdue - bOverdue;
      });
    }
  }

  // 7. Build typed sections
  const sections = { personal: [], interno: [], externo: [] };
  let total = 0;

  for (const [wsId, boardGroups] of Object.entries(grouped)) {
    const ws = wsMap[wsId];
    if (!ws) continue;
    const type = ws.type ?? 'externo';
    if (!sections[type]) continue;

    const wsBoards = Object.entries(boardGroups).map(([boardId, boardCards]) => ({
      title: boardMap[boardId]?.title ?? '?',
      cards: boardCards,
    }));

    sections[type].push({ workspace: ws, boards: wsBoards });
    total += wsBoards.reduce((sum, b) => sum + b.cards.length, 0);
  }

  return { ...sections, total };
}

// ── HTML builder ──────────────────────────────────────────────────────────────

const PRIORITY_LABEL = {
  urgent: { text: 'URGENTE', bg: '#7f1d1d', color: '#fca5a5' },
  high:   { text: 'ALTA',    bg: '#7c2d12', color: '#fdba74' },
  medium: { text: 'MEDIA',   bg: '#713f12', color: '#fde047' },
  low:    { text: '#4b5563', color: '#9ca3af', text2: 'BAJA' },
  none:   null,
};

function priorityBadge(priority) {
  const p = PRIORITY_LABEL[priority];
  if (!p) return '';
  const bg    = p.bg    ?? '#374151';
  const color = p.color ?? '#9ca3af';
  const label = p.text  ?? p.text2 ?? priority.toUpperCase();
  return `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;background:${bg};color:${color};letter-spacing:.3px;vertical-align:middle;margin-left:6px;">${label}</span>`;
}

function dueBadge(dueDate) {
  if (!dueDate) return '';
  const overdue = isOverdue(dueDate);
  const label   = formatDueDate(dueDate);
  const color   = overdue ? '#f87171' : '#94a3b8';
  const icon    = overdue ? '⚠️ ' : '📅 ';
  return `<span style="font-size:11px;color:${color};margin-left:8px;">${icon}${escHtml(label)}</span>`;
}

function checklistBadge(checklist) {
  if (!Array.isArray(checklist) || checklist.length === 0) return '';
  const done  = checklist.filter((i) => i.done).length;
  const total = checklist.length;
  return `<span style="font-size:11px;color:#6b7280;margin-left:8px;">☑ ${done}/${total}</span>`;
}

const SECTION_META = {
  personal: { emoji: '🏠', label: 'Personal',  desc: 'Tus proyectos personales'    },
  interno:  { emoji: '🏢', label: 'Interno',   desc: 'Proyectos de equipo'         },
  externo:  { emoji: '👥', label: 'Clientes',  desc: 'Proyectos con clientes'      },
};

function buildSection(type, entries) {
  if (!entries.length) return '';
  const meta  = SECTION_META[type];
  const total = entries.reduce((s, e) => s + e.boards.reduce((ss, b) => ss + b.cards.length, 0), 0);

  const boardBlocks = entries.flatMap(({ workspace, boards }) =>
    boards.map(({ title, cards }) => {
      const cardRows = cards.map((c) => `
        <tr>
          <td style="padding:7px 12px 7px 20px;border-bottom:1px solid #1e2130;">
            <span style="font-size:13px;color:#c9cdd8;">${escHtml(c.title)}</span>
            ${priorityBadge(c.priority)}
            ${dueBadge(c.due_date)}
            ${checklistBadge(c.checklist)}
          </td>
        </tr>`).join('');

      return `
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:#555b70;text-transform:uppercase;letter-spacing:.6px;padding:6px 12px 4px;background:#13151e;border-radius:6px 6px 0 0;border:1px solid #1e2130;border-bottom:none;">
            ${escHtml(workspace.emoji ?? '')} ${escHtml(workspace.name)} · ${escHtml(title)}
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;border:1px solid #1e2130;border-radius:0 0 6px 6px;">
            ${cardRows}
          </table>
        </div>`;
    })
  ).join('');

  return `
    <!-- Section: ${type} -->
    <tr>
      <td style="padding:0 32px 24px;">
        <div style="display:flex;align-items:center;margin-bottom:12px;">
          <span style="font-size:15px;margin-right:8px;">${meta.emoji}</span>
          <span style="font-size:13px;font-weight:700;color:#e8eaf0;text-transform:uppercase;letter-spacing:.8px;">${meta.label}</span>
          <span style="margin-left:8px;padding:1px 7px;background:#1e2130;border-radius:10px;font-size:11px;color:#6366f1;font-weight:700;">${total}</span>
        </div>
        ${boardBlocks}
      </td>
    </tr>`;
}

function buildHtml(userName, sections) {
  const { personal, interno, externo, total } = sections;

  const sectionHtml =
    buildSection('personal', personal) +
    buildSection('interno',  interno)  +
    buildSection('externo',  externo);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AGLAYA Kanban Desk · Tu resumen del día</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1d26;border-radius:16px;overflow:hidden;max-width:600px;width:100%;border:1px solid #2a2d3a;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#312e81 0%,#4f46e5 100%);padding:32px 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">
                      AGLAYA Kanban Desk
                    </div>
                    <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.5px;line-height:1.2;">
                      Tu resumen del día
                    </div>
                    <div style="font-size:13px;color:rgba(255,255,255,.65);margin-top:6px;">
                      ${escHtml(dateLabel())}
                    </div>
                  </td>
                  <td width="56" align="right" valign="top">
                    <div style="width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:12px;font-size:24px;text-align:center;line-height:48px;">
                      📌
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#e8eaf0;font-weight:600;">
                Hola${userName ? `, ${escHtml(userName)}` : ''} 👋
              </p>
              <p style="margin:8px 0 0;font-size:13px;color:#8b92a5;line-height:1.6;">
                ${total === 1
                  ? 'Tienes <strong style="color:#e8eaf0;">1 tarea</strong> urgente, prioritaria o vencida que merece tu atención hoy.'
                  : `Tienes <strong style="color:#e8eaf0;">${total} tareas</strong> urgentes, prioritarias o vencidas que merecen tu atención hoy.`
                }
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:16px 32px;">
              <div style="height:1px;background:#2a2d3a;"></div>
            </td>
          </tr>

          ${sectionHtml}

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${SITE_URL}"
                       style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.3px;">
                      Abrir AGLAYA Kanban Desk →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #2a2d3a;">
              <p style="margin:0;font-size:11px;color:#3a3f50;line-height:1.6;">
                AGLAYA Kanban Desk · Resumen personal — generado automáticamente<br>
                © 2026 Ibai Fernández · Todos los derechos reservados
              </p>
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
    family: 4,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function buildSubject(workspaceName = null) {
  const now     = new Date();
  const weekday = now.toLocaleDateString('es-ES', { weekday: 'long' });
  const fecha   = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  const cap     = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  if (workspaceName) return `📌 ${workspaceName} — ${cap}, ${fecha}`;
  return `📌 Tus tareas del día — ${cap}, ${fecha}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sends the personal digest to a single user.
 * Silently skips if the user has no actionable cards.
 * Returns { ok: true, sent: boolean, total: number }.
 */
async function sendUserDigest({ id, name, email, sections: prebuiltSections = null, workspaceName = null, workspaceId = null }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error('SMTP no configurado en el servidor.');
  }

  try {
    const sections = prebuiltSections ?? await buildUserCards(id, { workspaceId });

    if (sections.total === 0) {
      console.log(`[userDigest] ${email} — sin tarjetas accionables, omitido`);
      return { ok: true, sent: false, total: 0 };
    }

    const html      = buildHtml(name, sections);
    const subject   = buildSubject(workspaceName);
    const transport = createTransport();

    const info = await transport.sendMail({
      from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to:      email,
      subject,
      html,
    });

    console.log(`[userDigest] Sent → ${email} (${sections.total} cards) [${info.messageId}]`);

    // Log successful send
    await logDigestAttempt({
      type: 'user',
      userId: id,
      recipient: email,
      status: 'sent',
    });

    return { ok: true, sent: true, total: sections.total };
  } catch (err) {
    // Log failed send
    await logDigestAttempt({
      type: 'user',
      userId: id,
      recipient: email,
      status: 'failed',
      errorMsg: err.message,
    });

    throw err;
  }
}

/**
 * Sends the personal digest to ALL users in the platform.
 * Skips users without email. Skips users with no actionable cards (silently).
 * Returns summary: { sent: number, skipped: number, errors: number }.
 */
async function sendAllUserDigests() {
  // Fetch all users from the `users` table (platform users, not auth.users)
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email');

  if (error) {
    console.error('[userDigest] sendAllUserDigests — error fetching users:', error.message);
    throw error;
  }

  const results = { sent: 0, skipped: 0, errors: 0 };

  // Sequential to avoid hammering SMTP concurrently
  for (const user of (users ?? [])) {
    if (!user.email) { results.skipped++; continue; }
    try {
      const result = await sendUserDigest({ id: user.id, name: user.name, email: user.email });
      if (result.sent) results.sent++;
      else             results.skipped++;
    } catch (err) {
      console.error(`[userDigest] Error sending to ${user.email}:`, err.message);
      results.errors++;
    }
  }

  console.log(`[userDigest] Done — sent: ${results.sent}, skipped: ${results.skipped}, errors: ${results.errors}`);
  return results;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

function startUserDigestScheduler() {
  const hour   = Number.isFinite(USER_DIGEST_HOUR) ? USER_DIGEST_HOUR : 8;
  const minute = Number.isFinite(USER_DIGEST_MINUTE) ? USER_DIGEST_MINUTE : 0;
  const expr   = `${minute} ${hour} * * *`;

  cron.schedule(expr, () => {
    console.log(`[userDigest] Running scheduled user digests (${new Date().toISOString()})`);
    sendAllUserDigests().catch((err) =>
      console.error('[userDigest] Scheduled send failed:', err.message)
    );
  });

  console.log(`[userDigest] Scheduler started — daily at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} local time`);
}

module.exports = { buildUserCards, sendUserDigest, sendAllUserDigests, startUserDigestScheduler };
