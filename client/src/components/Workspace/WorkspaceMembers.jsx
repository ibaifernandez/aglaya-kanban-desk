import { useState, useEffect, useCallback, useRef } from 'react';
import { X, UserPlus, Trash2, Users, ChevronDown, Search } from 'lucide-react';
import { api } from '../../api/client.js';
import { Spinner } from '../UI/Spinner.jsx';
import { useEscapeKey } from '../../hooks/useEscapeKey.js';

const WS_ROLES = ['admin', 'member', 'guest'];

const ROLE_LABELS = {
  owner:  { label: 'Propietario', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  admin:  { label: 'Admin',       color: 'bg-amber-500/20  text-amber-300  border-amber-500/30'  },
  member: { label: 'Miembro',     color: 'bg-sky-500/20    text-sky-300    border-sky-500/30'    },
  guest:  { label: 'Invitado',    color: 'bg-zinc-500/20   text-zinc-400   border-zinc-500/30'   },
};

function RoleBadge({ role }) {
  const { label, color } = ROLE_LABELS[role] ?? ROLE_LABELS.member;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}>
      {label}
    </span>
  );
}

function Avatar({ name }) {
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  );
}

function UserSearchInput({ users, selectedUser, onSelect }) {
  const [query,     setQuery]     = useState('');
  const [open,      setOpen]      = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim().length === 0
    ? users
    : users.filter((u) => {
        const q = query.toLowerCase();
        return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
      });

  function handleSelect(u) {
    onSelect(u);
    setQuery('');
    setOpen(false);
  }

  function handleClear() {
    onSelect(null);
    setQuery('');
    setOpen(true);
  }

  // Show the selected user as a chip; input for searching otherwise
  if (selectedUser) {
    return (
      <div className="flex items-center gap-2 w-full bg-[#0f1117] border border-indigo-500 rounded-lg px-3 py-2.5">
        <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
          {selectedUser.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#e8eaf0] truncate">{selectedUser.name}</p>
          <p className="text-[11px] text-[#555b70] truncate">{selectedUser.email}</p>
        </div>
        <button type="button" onClick={handleClear} aria-label="Limpiar selección" className="text-[#555b70] hover:text-[#e8eaf0] transition-colors shrink-0">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555b70] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por nombre o email…"
          autoFocus
          className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg pl-8 pr-3 py-2.5 text-sm text-[#e8eaf0] placeholder:text-[#3d4155] focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {open && (
        <div className="absolute z-10 top-full mt-1 w-full bg-[#1a1d26] border border-[#2a2d3a] rounded-lg shadow-xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-xs text-[#555b70] text-center py-3">Sin coincidencias</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(u)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#252830] transition-colors text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {u.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[#e8eaf0] truncate">{u.name}</p>
                      <p className="text-[11px] text-[#555b70] truncate">{u.email}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AddMemberModal({ workspaceId, existingIds, onClose, onAdded }) {
  const [orgUsers,      setOrgUsers]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedUser,  setSelectedUser]  = useState(null);
  const [role,          setRole]          = useState('member');
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  useEscapeKey(onClose, !saving);

  useEffect(() => {
    api.getWorkspaceAvailableUsers(workspaceId)
      .then((data) => {
        setOrgUsers((data ?? []).filter((u) => !existingIds.has(u.id)));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? 'Error al cargar usuarios disponibles');
        setLoading(false);
      });
  }, [existingIds, workspaceId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedUser) { setError('Selecciona un usuario'); return; }
    setSaving(true);
    try {
      await api.addWorkspaceMember(workspaceId, { userId: selectedUser.id, role });
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d26] border border-[#2a2d3a] rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2d3a]">
          <h3 className="text-sm font-semibold text-[#e8eaf0] flex items-center gap-2">
            <UserPlus size={14} className="text-indigo-400" />
            Añadir miembro
          </h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-[#555b70] hover:text-[#e8eaf0] transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-4"><Spinner size={5} /></div>
          ) : orgUsers.length === 0 ? (
            <p className="text-sm text-[#555b70] text-center py-4">
              Todos los usuarios de la organización ya son miembros.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-[#8b92a5] mb-1.5">Usuario</label>
                <UserSearchInput
                  users={orgUsers}
                  selectedUser={selectedUser}
                  onSelect={setSelectedUser}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8b92a5] mb-1.5">Rol</label>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full appearance-none bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-[#e8eaf0] focus:outline-none focus:border-indigo-500 transition-colors pr-8"
                  >
                    <option value="admin">Admin — puede invitar y gestionar tableros</option>
                    <option value="member">Miembro — puede crear y editar tarjetas</option>
                    <option value="guest">Invitado — solo lectura</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555b70] pointer-events-none" />
                </div>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#8b92a5] hover:text-[#e8eaf0] transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit" disabled={saving || !selectedUser}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? <Spinner size={3} /> : <UserPlus size={13} />}
                  Añadir
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

export function WorkspaceMembers({ workspace, currentUser, onClose }) {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [toast,    setToast]    = useState('');

  useEscapeKey(onClose, !showAdd);

  const myRole = members.find((m) => m.user?.id === currentUser?.id)?.role;
  const canManage = ['owner', 'admin'].includes(myRole);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getWorkspaceMembers(workspace.id);
      setMembers(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [workspace.id]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await api.updateWorkspaceMember(workspace.id, userId, { role: newRole });
      setMembers((prev) => prev.map((m) => m.user?.id === userId ? { ...m, role: newRole } : m));
      showToast('Rol actualizado');
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  }

  async function handleRemove(userId, userName) {
    if (!confirm(`¿Eliminar a ${userName} del espacio de trabajo?`)) return;
    try {
      await api.removeWorkspaceMember(workspace.id, userId);
      setMembers((prev) => prev.filter((m) => m.user?.id !== userId));
      showToast('Miembro eliminado');
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  }

  const existingIds = new Set(members.map((m) => m.user?.id));

  return (
    <>
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-[#13151e] border-l border-[#2a2d3a] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2d3a]">
          <div>
            <h2 className="text-sm font-semibold text-[#e8eaf0] flex items-center gap-2">
              <Users size={15} className="text-indigo-400" />
              Miembros del espacio de trabajo
            </h2>
            <p className="text-xs text-[#555b70] mt-0.5">{workspace.emoji} {workspace.name}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-[#555b70] hover:text-[#e8eaf0] transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Actions */}
        {canManage && (
          <div className="px-6 py-3 border-b border-[#2a2d3a]">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <UserPlus size={13} />
              Añadir miembro
            </button>
          </div>
        )}

        {/* Members list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner size={6} /></div>
          ) : members.length === 0 ? (
            <p className="text-sm text-[#555b70] text-center py-10">Sin miembros todavía.</p>
          ) : members.map((m) => {
            const user    = m.user ?? {};
            const isMe    = user.id === currentUser?.id;
            const isOwner = m.role === 'owner';

            return (
              <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1d26] border border-[#2a2d3a]">
                <Avatar name={user.name} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#e8eaf0] truncate">
                      {user.name}{isMe && <span className="text-[#555b70] font-normal text-xs ml-1">(tú)</span>}
                    </span>
                    <RoleBadge role={m.role} />
                  </div>
                  <p className="text-[11px] text-[#555b70] truncate mt-0.5">{user.email}</p>
                </div>

                {/* Role selector — owner can't be changed, can't edit yourself */}
                {canManage && !isOwner && !isMe && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="appearance-none bg-[#0f1117] border border-[#2a2d3a] rounded-lg pl-2.5 pr-6 py-1.5 text-xs text-[#e8eaf0] focus:outline-none focus:border-indigo-500 transition-colors"
                      >
                        {WS_ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]?.label ?? r}</option>
                        ))}
                      </select>
                      <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#555b70] pointer-events-none" />
                    </div>

                    <button
                      onClick={() => handleRemove(user.id, user.name)}
                      className="p-1.5 text-[#555b70] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Eliminar del espacio de trabajo"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="px-6 py-4 border-t border-[#2a2d3a]">
          <p className="text-[11px] text-[#3a3f50] leading-relaxed">
            Los <strong className="text-[#555b70]">invitados</strong> solo pueden ver el contenido.<br />
            Los <strong className="text-[#555b70]">miembros</strong> pueden crear y editar tarjetas.<br />
            Los <strong className="text-[#555b70]">admins</strong> pueden gestionar tableros e invitar.
          </p>
        </div>
      </div>

      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />

      {/* Add member modal */}
      {showAdd && (
        <AddMemberModal
          workspaceId={workspace.id}
          existingIds={existingIds}
          onClose={() => setShowAdd(false)}
          onAdded={load}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#1e2230] border border-[#2a2d3a] rounded-lg text-sm text-[#e8eaf0] shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
