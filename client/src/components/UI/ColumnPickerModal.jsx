import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../api/client.js';

export function ColumnPickerModal({ board, card, onSelect, onClose }) {
  const [cols, setCols] = useState(null); // null = loading

  useEffect(() => {
    api.getColumns(board.id).then(setCols).catch(() => setCols([]));
  }, [board.id]);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#1e2028] border border-[#2e3140] rounded-xl shadow-2xl p-4 w-64"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 pr-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555b70] mb-0.5">
              Mover tarjeta a
            </p>
            <p className="text-sm font-semibold text-[#e8eaf0] truncate">{board.title}</p>
            {card && (
              <p className="text-xs text-[#555b70] truncate mt-0.5">«{card.title}»</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[#555b70] hover:text-[#8b90a0] shrink-0 mt-0.5 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Column list */}
        {cols === null ? (
          <p className="text-xs text-[#555b70] text-center py-4">Cargando…</p>
        ) : cols.length === 0 ? (
          <p className="text-xs text-[#555b70] text-center py-4">Sin columnas</p>
        ) : (
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {cols.map((col) => (
              <button
                key={col.id}
                onClick={() => onSelect(col)}
                className="w-full text-left px-3 py-2 text-sm text-[#c8cadd] hover:bg-[#252830] hover:text-[#e8eaf0] rounded-lg transition-colors"
              >
                {col.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
