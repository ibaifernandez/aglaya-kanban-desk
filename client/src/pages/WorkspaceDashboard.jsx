import { useState } from 'react';
import { Plus, Users, LayoutGrid, LogOut, Shield, ChevronRight, Settings } from 'lucide-react';
import { useWorkspaces } from '../hooks/useWorkspaces.js';
import { Spinner } from '../components/UI/Spinner.jsx';

const ROLE_LABELS = {
  owner:  { label: 'Propietario', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  admin:  { label: 'Admin',       color: 'text-amber-400  bg-amber-500/10  border-amber-500/20'  },
  member: { label: 'Miembro',     color: 'text-sky-400    bg-sky-500/10    border-sky-500/20'    },
  guest:  { label: 'Invitado',    color: 'text-zinc-400   bg-zinc-500/10   border-zinc-500/20'   },
};

function RoleBadge({ role }) {
  const { label, color } = ROLE_LABELS[role] ?? ROLE_LABELS.member;
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

function WorkspaceCard({ ws, onEnter }) {
  return (
    <button
      onClick={() => onEnter(ws)}
      className="group relative text-left bg-[#1a1d26] border border-[#2a2d3a] rounded-xl p-5 hover:border-indigo-500/50 hover:bg-[#1e2230] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
    >
      {/* Emoji + name */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-3xl leading-none shrink-0">{ws.emoji}</span>
          <div className="min-w-0">
            <h3 className="font-semibold text-[#e8eaf0] text-sm leading-snug truncate group-hover:text-white transition-colors">
              {ws.name}
            </h3>
            {ws.description && (
              <p className="text-[11px] text-[#555b70] mt-0.5 line-clamp-1">{ws.description}</p>
            )}
          </div>
        </div>
        <ChevronRight size={14} className="text-[#3a3f50] group-hover:text-indigo-400 shrink-0 mt-0.5 transition-colors" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-3">
        <span className="flex items-center gap-1.5 text-[11px] text-[#555b70]">
          <LayoutGrid size={11} />
          {ws.boardCount ?? 0} tablero{ws.boardCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#555b70]">
          <Users size={11} />
          {ws.memberCount ?? 0} miembro{ws.memberCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Role */}
      <RoleBadge role={ws.myRole} />

      {/* Hover gradient */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </button>
  );
}

function NewWorkspaceModal({ onClose, onCreate }) {
  const [name, setName]     = useState('');
  const [emoji, setEmoji]   = useState('📋');
  const [desc, setDesc]     = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const EMOJIS = ['📋', '🚀', '⭐', '🎯', '💡', '🏢', '📊', '🛠', '🎨', '📣', '🤝', '💼'];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await onCreate({ name: name.trim(), emoji, description: desc.trim() });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d26] border border-[#2a2d3a] rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-5 border-b border-[#2a2d3a]">
          <h2 className="text-base font-semibold text-[#e8eaf0]">Nuevo workspace</h2>
          <p className="text-xs text-[#555b70] mt-0.5">Un espacio aislado para un cliente o departamento.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Emoji picker */}
          <div>
            <label className="block text-xs font-medium text-[#8b92a5] mb-2">Icono</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e} type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    emoji === e ? 'bg-indigo-500/20 ring-1 ring-indigo-500' : 'bg-[#0f1117] hover:bg-[#2a2d3a]'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[#8b92a5] mb-1.5">Nombre *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Banco Internacional de Chile"
              className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-[#e8eaf0] placeholder-[#3a3f50] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[#8b92a5] mb-1.5">Descripción <span className="text-[#3a3f50]">(opcional)</span></label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="¿Qué gestiona este workspace?"
              className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-[#e8eaf0] placeholder-[#3a3f50] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#8b92a5] hover:text-[#e8eaf0] transition-colors">
              Cancelar
            </button>
            <button
              type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? <Spinner size={3} /> : <Plus size={14} />}
              Crear workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkspaceDashboard({ user, onEnterWorkspace, onLogout, onOpenAdmin }) {
  const { workspaces, loading, createWorkspace } = useWorkspaces();
  const [showNew, setShowNew] = useState(false);

  const canCreate = ['superadmin', 'admin'].includes(user?.role);

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2a2d3a] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              M
            </div>
            <span className="text-sm font-semibold text-[#e8eaf0]">MyBoardLFi</span>
          </div>

          <div className="flex items-center gap-2">
            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#8b92a5] hover:text-[#e8eaf0] hover:bg-[#1a1d26] rounded-lg transition-colors"
              >
                <Shield size={13} />
                Admin
              </button>
            )}
            <div className="flex items-center gap-2 pl-2 border-l border-[#2a2d3a]">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <span className="text-xs text-[#8b92a5] hidden sm:block">{user?.name}</span>
              <button
                onClick={onLogout}
                className="p-1.5 text-[#555b70] hover:text-[#e8eaf0] hover:bg-[#1a1d26] rounded-lg transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto">
          {/* Title row */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-bold text-[#e8eaf0]">Mis workspaces</h1>
              <p className="text-sm text-[#555b70] mt-1">
                {workspaces.length === 0
                  ? 'Aún no tienes workspaces asignados.'
                  : `${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''} disponible${workspaces.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {canCreate && (
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus size={15} />
                Nuevo workspace
              </button>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-24">
              <Spinner size={8} />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-[#8b92a5] text-sm">No tienes workspaces todavía.</p>
              {canCreate && (
                <button
                  onClick={() => setShowNew(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus size={14} />
                  Crear el primero
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((ws) => (
                <WorkspaceCard key={ws.id} ws={ws} onEnter={onEnterWorkspace} />
              ))}
            </div>
          )}
        </div>
      </main>

      {showNew && (
        <NewWorkspaceModal
          onClose={() => setShowNew(false)}
          onCreate={createWorkspace}
        />
      )}
    </div>
  );
}
