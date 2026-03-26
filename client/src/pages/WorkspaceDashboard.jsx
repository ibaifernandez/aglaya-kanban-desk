import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Users, LayoutGrid, LogOut, ChevronRight, Camera, Pencil, Trash2, UserCircle } from 'lucide-react';
import { useWorkspaces } from '../hooks/useWorkspaces.js';
import { Spinner } from '../components/UI/Spinner.jsx';
import { AvatarCropModal } from '../components/UI/AvatarCropModal.jsx';
import { api } from '../api/client.js';
import lfiLogo from '../assets/lfi.png';

const ROLE_LABELS = {
  owner:  { label: 'Propietario', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  admin:  { label: 'Admin',       color: 'text-amber-400  bg-amber-500/10  border-amber-500/20'  },
  member: { label: 'Miembro',     color: 'text-sky-400    bg-sky-500/10    border-sky-500/20'    },
  guest:  { label: 'Invitado',    color: 'text-zinc-400   bg-zinc-500/10   border-zinc-500/20'   },
};

const TYPE_LABELS = {
  cliente:      { label: 'Cliente',      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  departamento: { label: 'Departamento', color: 'text-sky-400     bg-sky-500/10     border-sky-500/20'     },
};

const EMOJIS = ['📋', '🚀', '⭐', '🎯', '💡', '🏢', '📊', '🛠', '🎨', '📣', '🤝', '💼'];
const TYPE_OPTS = [
  { value: 'cliente',      label: 'Cliente' },
  { value: 'departamento', label: 'Departamento' },
];

function RoleBadge({ role }) {
  const { label, color } = ROLE_LABELS[role] ?? ROLE_LABELS.member;
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }) {
  const def = TYPE_LABELS[type];
  if (!def) return null;
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${def.color}`}>
      {def.label}
    </span>
  );
}

// Deterministic pseudo-random from a string seed
function seededRand(seed, index) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ index, 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

const COLUMN_COLORS = [
  'bg-indigo-500/40', 'bg-sky-500/40', 'bg-amber-500/40',
  'bg-emerald-500/40', 'bg-violet-500/40', 'bg-rose-500/40',
];

function MiniKanban({ id }) {
  const cols = 4;
  return (
    <div className="flex items-end gap-1.5 h-10 mb-4 px-0.5">
      {Array.from({ length: cols }, (_, col) => {
        const cards = 1 + Math.floor(seededRand(id, col) * 4);
        const color = COLUMN_COLORS[Math.floor(seededRand(id, col + 10) * COLUMN_COLORS.length)];
        return (
          <div key={col} className="flex-1 flex flex-col justify-end gap-1">
            {Array.from({ length: cards }, (_, card) => {
              const w = 60 + Math.floor(seededRand(id, col * 10 + card) * 40);
              return (
                <div
                  key={card}
                  style={{ width: `${w}%` }}
                  className={`h-1.5 rounded-full ${color} opacity-70`}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Profile dropdown ──────────────────────────────────────────────────────────
function ProfileDropdown({ user, onAvatarChange, onLogout, onClose }) {
  const menuRef    = useRef(null);
  const fileRef    = useRef(null);
  const [cropSrc,   setCropSrc]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');
  const cropSrcRef = useRef(null); // ref mirror to read inside event listener

  useEffect(() => {
    function handleClick(e) {
      if (cropSrcRef.current) return; // crop modal open — ignore outside clicks
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    function handleEsc(e) {
      if (cropSrcRef.current) return; // let AvatarCropModal handle Escape
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  function openCrop(src) {
    cropSrcRef.current = src;
    setCropSrc(src);
  }

  function closeCrop() {
    cropSrcRef.current = null;
    setCropSrc(null);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => openCrop(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleCropConfirm(croppedFile) {
    setUploading(true);
    setError('');
    try {
      const url = await api.uploadAvatar(croppedFile);
      onAvatarChange?.(url);
      closeCrop();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div
        ref={menuRef}
        className="absolute right-0 top-full mt-2 w-60 bg-[#1e2028] border border-[#2e3140] rounded-xl shadow-2xl z-50 overflow-hidden"
      >
        {/* User info */}
        <div className="px-4 py-3 border-b border-[#2e3140]">
          <div className="flex items-center gap-3">
            <div
              className="relative group/av w-10 h-10 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
              onClick={() => fileRef.current?.click()}
              title="Cambiar foto de perfil"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold uppercase">
                  {user.name?.[0] ?? user.email?.[0] ?? '?'}
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity rounded-full">
                <Camera size={12} className="text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#e8eaf0] truncate">{user.name ?? '—'}</p>
              <p className="text-[11px] text-[#555b70] truncate">{user.email}</p>
            </div>
          </div>
          {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#c8ccd8] hover:bg-[#252830] hover:text-[#e8eaf0] transition-colors"
        >
          <UserCircle size={13} className="text-[#555b70]" />
          Cambiar foto de perfil
        </button>

        <button
          onClick={() => { onClose(); onLogout(); }}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-[#2e3140]"
        >
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          uploading={uploading}
          onConfirm={handleCropConfirm}
          onClose={closeCrop}
        />
      )}
    </>
  );
}

// ── Context menu ──────────────────────────────────────────────────────────────
function ContextMenu({ x, y, ws, canEdit, onEdit, onDelete, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    function handleEsc(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Keep menu within viewport
  const style = { position: 'fixed', top: y, left: x, zIndex: 9999 };

  return (
    <div
      ref={menuRef}
      style={style}
      className="bg-[#1e2028] border border-[#2e3140] rounded-xl shadow-2xl overflow-hidden w-44 py-1"
    >
      {canEdit && (
        <button
          onClick={() => { onEdit(ws); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#c8ccd8] hover:bg-[#252830] hover:text-[#e8eaf0] transition-colors"
        >
          <Pencil size={13} className="text-[#555b70]" />
          Editar
        </button>
      )}
      {canEdit && (
        <button
          onClick={() => { onDelete(ws); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={13} />
          Eliminar
        </button>
      )}
      {!canEdit && (
        <p className="px-3 py-2 text-xs text-[#555b70]">Sin acciones disponibles</p>
      )}
    </div>
  );
}

// ── Workspace card ────────────────────────────────────────────────────────────
function WorkspaceCard({ ws, onEnter, onCoverChange, canEdit, onContextMenu }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const coverUrl = await api.uploadWorkspaceCover(ws.id, file);
      onCoverChange?.(ws.id, coverUrl);
    } catch (err) {
      console.error('Error al subir portada:', err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleContextMenu(e) {
    e.preventDefault();
    onContextMenu(e, ws);
  }

  return (
    <div className="group relative" onContextMenu={handleContextMenu}>
      <button
        onClick={() => onEnter(ws)}
        className="w-full text-left bg-[#1a1d26] border border-[#2a2d3a] rounded-xl p-5 hover:border-indigo-500/50 hover:bg-[#1e2230] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      >
        {/* Cover image or mini-kanban */}
        {ws.coverUrl ? (
          <div className="-mx-5 -mt-5 mb-4 h-28 rounded-t-xl overflow-hidden">
            <img src={ws.coverUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <MiniKanban id={ws.id} />
        )}

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

        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <RoleBadge role={ws.myRole} />
          <TypeBadge type={ws.type} />
        </div>

        {/* Hover gradient */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </button>

      {/* Cover upload button */}
      {canEdit && (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Cambiar imagen de portada"
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 disabled:opacity-50"
        >
          {uploading ? <Spinner size={3} /> : <Camera size={13} />}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
    </div>
  );
}

// ── Workspace form (shared by New + Edit modals) ──────────────────────────────
function WorkspaceForm({ initial, onSubmit, onClose, title, submitLabel, onCoverChange }) {
  const [name,       setName]       = useState(initial?.name        ?? '');
  const [emoji,      setEmoji]      = useState(initial?.emoji       ?? '📋');
  const [desc,       setDesc]       = useState(initial?.description ?? '');
  const [type,       setType]       = useState(initial?.type && initial.type !== 'general' ? initial.type : '');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [coverPreview, setCoverPreview] = useState(initial?.coverUrl ?? null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverFileRef = useRef(null);

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !initial?.id) return;
    setCoverUploading(true);
    try {
      const url = await api.uploadWorkspaceCover(initial.id, file);
      setCoverPreview(url);
      onCoverChange?.(initial.id, url);
    } catch (err) {
      setError('Error al subir la portada: ' + err.message);
    } finally {
      setCoverUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), emoji, description: desc.trim(), type: type || 'general' });
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
          <h2 className="text-base font-semibold text-[#e8eaf0]">{title}</h2>
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
              placeholder="¿Qué gestiona este espacio de trabajo?"
              className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-[#e8eaf0] placeholder-[#3a3f50] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors resize-none"
            />
          </div>

          {/* Cover image — only when editing (initial.id exists) */}
          {initial?.id && (
            <div>
              <label className="block text-xs font-medium text-[#8b92a5] mb-2">Imagen de portada <span className="text-[#3a3f50]">(opcional)</span></label>
              <div
                onClick={() => coverFileRef.current?.click()}
                className="relative h-20 rounded-lg overflow-hidden cursor-pointer border border-dashed border-[#2a2d3a] hover:border-indigo-500/60 transition-colors group/cover"
              >
                {coverPreview ? (
                  <>
                    <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
                      <Camera size={16} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center gap-2 text-[#555b70] hover:text-[#8b92a5] transition-colors">
                    {coverUploading ? <Spinner size={3} /> : <><Camera size={14} /><span className="text-xs">Subir imagen de portada</span></>}
                  </div>
                )}
              </div>
              <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-[#8b92a5] mb-2">Tipo <span className="text-[#3a3f50]">(opcional)</span></label>
            <div className="flex gap-2">
              {TYPE_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(type === opt.value ? '' : opt.value)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    type === opt.value
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                      : 'bg-[#0f1117] border-[#2a2d3a] text-[#8b92a5] hover:border-[#3a3f50]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
              {saving ? <Spinner size={3} /> : null}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ ws, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try { await onConfirm(ws.id); onClose(); }
    catch (err) { setError(err.message); setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d26] border border-[#2a2d3a] rounded-xl w-full max-w-sm shadow-2xl p-6">
        <h2 className="text-base font-semibold text-[#e8eaf0] mb-2">¿Eliminar espacio de trabajo?</h2>
        <p className="text-sm text-[#555b70] mb-4">
          Se eliminará <span className="text-[#e8eaf0] font-medium">{ws.emoji} {ws.name}</span> junto con todos sus tableros y tarjetas. Esta acción no se puede deshacer.
        </p>
        {error && <p className="text-xs text-red-400 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#8b92a5] hover:text-[#e8eaf0] transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {deleting ? <Spinner size={3} /> : <Trash2 size={13} />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Type filter tabs ──────────────────────────────────────────────────────────
const TYPE_FILTERS = [
  { value: '',             label: 'Todos' },
  { value: 'cliente',      label: 'Clientes' },
  { value: 'departamento', label: 'Departamentos' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function WorkspaceDashboard({ user, onEnterWorkspace, onLogout, onOpenAdmin, onAvatarChange }) {
  const { workspaces, loading, createWorkspace, updateWorkspace, deleteWorkspace } = useWorkspaces();
  const [showNew,       setShowNew]       = useState(false);
  const [editTarget,    setEditTarget]    = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);
  const [typeFilter,    setTypeFilter]    = useState('');
  const [coverOverrides, setCoverOverrides] = useState({});
  const [ctxMenu,       setCtxMenu]       = useState(null); // { x, y, ws }
  const [showProfile,   setShowProfile]   = useState(false);
  const profileBtnRef = useRef(null);

  const canCreate = ['superadmin', 'admin'].includes(user?.role);
  const canEdit   = ['superadmin', 'admin'].includes(user?.role);

  const filtered = typeFilter
    ? workspaces.filter((ws) => (ws.type ?? 'general') === typeFilter)
    : workspaces;

  function handleCoverChange(wsId, coverUrl) {
    setCoverOverrides((prev) => ({ ...prev, [wsId]: coverUrl }));
  }

  const handleContextMenu = useCallback((e, ws) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, ws });
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2a2d3a] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={lfiLogo} alt="LFi" className="w-8 h-8 rounded-lg object-cover" />
            <span className="text-sm font-semibold text-[#e8eaf0]">LFi Kanban Desk</span>
          </div>

          <div className="flex items-center gap-2">
            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#8b92a5] hover:text-[#e8eaf0] hover:bg-[#1a1d26] rounded-lg transition-colors border border-[#2a2d3a] hover:border-[#3a3d4a]"
                title="Gestión de usuarios"
              >
                <Users size={13} />
                Admin
              </button>
            )}
            <div className="relative flex items-center gap-2 pl-2 border-l border-[#2a2d3a]">
              <button
                ref={profileBtnRef}
                onClick={() => setShowProfile((v) => !v)}
                className="flex items-center gap-2 rounded-lg hover:bg-[#252830] px-2 py-1 transition-colors"
                title="Perfil"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                      {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                <span className="text-xs text-[#8b92a5] hidden sm:block">{user?.name}</span>
              </button>

              {showProfile && (
                <ProfileDropdown
                  user={user}
                  onAvatarChange={onAvatarChange}
                  onLogout={onLogout}
                  onClose={() => setShowProfile(false)}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto">
          {/* Title row */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-[#e8eaf0]">Mis espacios de trabajo</h1>
              <p className="text-sm text-[#555b70] mt-1">
                {workspaces.length === 0
                  ? 'Aún no tienes espacios de trabajo asignados.'
                  : `${workspaces.length} espacio${workspaces.length !== 1 ? 's' : ''} de trabajo disponible${workspaces.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {canCreate && (
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus size={15} />
                Nuevo espacio de trabajo
              </button>
            )}
          </div>

          {/* Type filter tabs */}
          {workspaces.length > 0 && (
            <div className="flex gap-1.5 mb-6">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    typeFilter === f.value
                      ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                      : 'bg-[#1a1d26] border-[#2a2d3a] text-[#8b92a5] hover:border-[#3a3d4a] hover:text-[#e8eaf0]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-24">
              <Spinner size={8} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-[#8b92a5] text-sm">
                {typeFilter ? 'No hay espacios de trabajo de este tipo.' : 'No tienes espacios de trabajo todavía.'}
              </p>
              {canCreate && !typeFilter && (
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
              {filtered.map((ws) => (
                <WorkspaceCard
                  key={ws.id}
                  ws={{ ...ws, coverUrl: coverOverrides[ws.id] ?? ws.coverUrl }}
                  onEnter={onEnterWorkspace}
                  onCoverChange={handleCoverChange}
                  canEdit={canEdit}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          ws={ctxMenu.ws}
          canEdit={canEdit}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* New workspace modal */}
      {showNew && (
        <WorkspaceForm
          title="Nuevo espacio de trabajo"
          submitLabel="Crear espacio de trabajo"
          onClose={() => setShowNew(false)}
          onSubmit={createWorkspace}
        />
      )}

      {/* Edit workspace modal */}
      {editTarget && (
        <WorkspaceForm
          title="Editar espacio de trabajo"
          submitLabel="Guardar cambios"
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={(body) => updateWorkspace(editTarget.id, body)}
          onCoverChange={handleCoverChange}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirmModal
          ws={deleteTarget}
          onConfirm={deleteWorkspace}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
