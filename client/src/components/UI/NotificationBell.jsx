import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../../api/client.js';
import { useEscapeKey } from '../../hooks/useEscapeKey.js';

// Render-friendly summary of each notification type.
function formatNotification(n) {
  const p = n.payload ?? {};
  if (n.type === 'card_assignment') {
    return {
      primary:   `Te han asignado «${p.cardTitle ?? 'una tarjeta'}»`,
      secondary: 'Asignación de responsable',
    };
  }
  // Default: checklist_mention (legacy)
  return {
    primary:   p.checklistText ?? 'Te han mencionado',
    secondary: p.cardTitle ? `en «${p.cardTitle}»` : '',
  };
}

/**
 * Self-contained notification bell with polling.
 * Can be dropped into any header/toolbar.
 *
 * Props:
 *   user        — current user object (must have `id`).
 *   onNavigate  — optional. Called when the user clicks a notification with
 *                 a navigable payload. Receives the full notification object.
 */
export function NotificationBell({ user, onNavigate }) {
  const [notifs,    setNotifs]    = useState([]);
  const [open,      setOpen]      = useState(false);
  const wrapRef    = useRef(null);
  const pollingRef = useRef(null);

  useEscapeKey(() => setOpen(false), open);

  // Fetch + poll every 45 s
  useEffect(() => {
    if (!user?.id) return;
    async function fetch() {
      try { setNotifs(await api.getNotifications()); } catch {}
    }
    fetch();
    pollingRef.current = setInterval(fetch, 45_000);
    return () => clearInterval(pollingRef.current);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleMarkRead(id) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    api.markNotificationRead(id).catch(() => {});
  }

  function handleMarkAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    api.markAllNotificationsRead().catch(() => {});
  }

  const unreadCount = notifs.filter((n) => !n.read).length;

  if (!user) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notificaciones"
        className={`relative p-1.5 rounded transition-colors ${
          open
            ? 'text-[#e8eaf0] bg-[#2e3140]'
            : 'text-[#555b70] hover:text-[#e8eaf0] hover:bg-[#2e3140]'
        }`}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center bg-indigo-500 text-white text-[9px] font-bold rounded-full leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-[#1e2028] border border-[#2e3140] rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[#2e3140] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#e8eaf0]">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <p className="text-xs text-[#555b70] text-center py-6">Sin notificaciones</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-[#1e2130]">
              {notifs.map((n) => {
                const { primary, secondary } = formatNotification(n);
                const canNavigate = Boolean(onNavigate && n.payload?.workspaceId && n.payload?.cardId);
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        handleMarkRead(n.id);
                        setOpen(false);
                        if (canNavigate) onNavigate(n);
                      }}
                      className={`w-full text-left px-3 py-2.5 hover:bg-[#252830] transition-colors flex items-start gap-2 ${n.read ? 'opacity-50' : ''} ${canNavigate ? 'cursor-pointer' : 'cursor-default'}`}
                      title={canNavigate ? 'Ir a la tarjeta' : undefined}
                    >
                      {!n.read && (
                        <span className="mt-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0" />
                      )}
                      <div className="w-full">
                        <p className="text-[11px] text-[#e8eaf0] line-clamp-2 leading-relaxed">
                          {primary}
                        </p>
                        {secondary && (
                          <p className="text-[10px] text-[#555b70] mt-0.5">
                            {secondary}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
