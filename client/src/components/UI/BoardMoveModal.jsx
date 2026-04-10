import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../api/client.js';

export function BoardMoveModal({ board, currentWorkspaceId, onMove, onClose }) {
  const [workspaces, setWorkspaces] = useState(null); // null = loading

  useEffect(() => {
    api.getWorkspaces()
      .then((data) => setWorkspaces(data.filter((ws) => ws.id !== currentWorkspaceId)))
      .catch(() => setWorkspaces([]));
  }, [currentWorkspaceId]);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
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
              Mover tablero a
            </p>
            <p className="text-sm font-semibold text-[#e8eaf0] truncate">{board.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#555b70] hover:text-[#8b90a0] shrink-0 mt-0.5 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Workspace list */}
        {workspaces === null ? (
          <p className="text-xs text-[#555b70] text-center py-4">Cargando…</p>
        ) : workspaces.length === 0 ? (
          <p className="text-xs text-[#555b70] text-center py-4">No hay otros espacios disponibles</p>
        ) : (
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => onMove(ws.id)}
                className="w-full text-left px-3 py-2 text-sm text-[#c8cadd] hover:bg-[#252830] hover:text-[#e8eaf0] rounded-lg transition-colors flex items-center gap-2.5"
              >
                <span className="text-base leading-none">{ws.emoji}</span>
                <span className="truncate">{ws.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
