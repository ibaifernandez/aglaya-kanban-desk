import { useState, useEffect, useMemo } from 'react';
import { Mail } from 'lucide-react';
import { api } from '../../api/client.js';

// Render labels in the user's local timezone but persist as UTC.
// The cron in GitHub Actions fires hourly on UTC, and the server filters
// users by `digest_hour` (UTC). We translate user input to UTC on save.
function localHourToUtc(localHour) {
  const tzOffsetHours = new Date().getTimezoneOffset() / 60; // minutes → hours, sign inverted
  return ((localHour + tzOffsetHours) % 24 + 24) % 24;
}

function utcHourToLocal(utcHour) {
  const tzOffsetHours = new Date().getTimezoneOffset() / 60;
  return ((utcHour - tzOffsetHours) % 24 + 24) % 24;
}

function formatLocalHour(localHour) {
  const h = String(localHour).padStart(2, '0');
  return `${h}:00`;
}

export function DigestPreferences({ user, onChange }) {
  const initialUtcHour = Number.isInteger(user?.digestHour) ? user.digestHour : 7;
  const initialEnabled = user?.digestEnabled !== false;

  const [localHour, setLocalHour] = useState(() => utcHourToLocal(initialUtcHour));
  const [enabled,   setEnabled]   = useState(initialEnabled);
  const [state,     setState]     = useState('idle'); // idle | saving | ok | error
  const [error,     setError]     = useState('');

  // Reset state if the parent user object updates (e.g. after refresh)
  useEffect(() => {
    setLocalHour(utcHourToLocal(initialUtcHour));
    setEnabled(initialEnabled);
  }, [initialUtcHour, initialEnabled]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const timezoneLabel = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch { return null; }
  }, []);

  async function save({ nextHour = localHour, nextEnabled = enabled } = {}) {
    setState('saving');
    setError('');
    try {
      const result = await api.updatePreferences({
        digestHour:    localHourToUtc(nextHour),
        digestEnabled: nextEnabled,
      });
      setState('ok');
      onChange?.(result);
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar');
      setState('error');
    }
  }

  function handleHourChange(e) {
    const next = parseInt(e.target.value, 10);
    if (!Number.isInteger(next)) return;
    setLocalHour(next);
    save({ nextHour: next });
  }

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    save({ nextEnabled: next });
  }

  return (
    <div className="border-t border-[#2e3140] px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-2 text-[11px] text-[#8b90a0] uppercase tracking-wider font-semibold">
        <Mail size={11} />
        Resumen diario por email
      </div>

      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-xs text-[#c8ccd8]">Recibir digest</span>
        <button
          type="button"
          onClick={handleToggle}
          aria-pressed={enabled}
          className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-indigo-500' : 'bg-[#2e3140]'}`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
          />
        </button>
      </label>

      <label className={`flex items-center justify-between gap-2 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <span className="text-xs text-[#c8ccd8]">Hora de envío</span>
        <select
          value={localHour}
          onChange={handleHourChange}
          disabled={!enabled}
          className="bg-[#252830] border border-[#2e3140] rounded-md px-2 py-1 text-xs text-[#e8eaf0] outline-none focus:border-indigo-500 cursor-pointer"
        >
          {hours.map((h) => (
            <option key={h} value={h}>{formatLocalHour(h)}</option>
          ))}
        </select>
      </label>

      <p className="text-[10px] text-[#555b70] leading-relaxed">
        {timezoneLabel
          ? `Zona horaria: ${timezoneLabel}. El envío real depende del cron horario UTC.`
          : 'Hora en tu zona horaria local.'}
      </p>

      {state === 'saving' && <p className="text-[10px] text-[#8b90a0]">Guardando…</p>}
      {state === 'ok'     && <p className="text-[10px] text-green-400">Preferencias guardadas</p>}
      {state === 'error'  && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
