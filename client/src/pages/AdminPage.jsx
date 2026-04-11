import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, UserPlus, Trash2, Shield, Users } from 'lucide-react';
import { api } from '../api/client.js';

const ROLE_LABELS = {
  superadmin:  { label: 'Superadmin',  color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  admin:       { label: 'Admin',       color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  colaborador: { label: 'Colaborador', color: 'bg-green-500/20  text-green-300  border-green-500/30'  },
  cliente:     { label: 'Cliente',     color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  guest:       { label: 'Invitado',    color: 'bg-[#2e3140]     text-[#8b90a0]  border-[#3d4155]'     },
};

const ASSIGNABLE_ROLES = ['admin', 'colaborador', 'cliente', 'guest'];

function RoleBadge({ role }) {
  const { label, color } = ROLE_LABELS[role] ?? ROLE_LABELS.guest;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}>
      {label}
    </span>
  );
}

function InviteModal({ onClose, onSuccess }) {
  const [form,    setForm]    = useState({ email: '', name: '', role: 'colaborador' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.inviteUser(form);
      onSuccess(res.data, res.message);
    } catch (err) {
      setError(err.message ?? 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e2028] border border-[#2e3140] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-base font-semibold text-[#e8eaf0] mb-5 flex items-center gap-2">
          <UserPlus size={16} className="text-indigo-400" />
          Invitar usuario
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-[#8b90a0] mb-1.5 uppercase tracking-wide">Nombre</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nombre completo"
              className="w-full bg-[#0f1117] border border-[#2e3140] rounded-lg px-3 py-2 text-sm text-[#e8eaf0] placeholder:text-[#3d4155] outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-[#8b90a0] mb-1.5 uppercase tracking-wide">Email corporativo</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="nombre@empresa.com"
              className="w-full bg-[#0f1117] border border-[#2e3140] rounded-lg px-3 py-2 text-sm text-[#e8eaf0] placeholder:text-[#3d4155] outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-[#8b90a0] mb-1.5 uppercase tracking-wide">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="w-full bg-[#0f1117] border border-[#2e3140] rounded-lg px-3 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm text-[#8b90a0] border border-[#2e3140] hover:border-[#3d4155] hover:text-[#e8eaf0] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {loading ? 'Invitando…' : 'Invitar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage({ user, onBack }) {
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [showInvite,  setShowInvite]  = useState(false);
  const [toast,       setToast]       = useState(null); // { msg, type }
  const [deletingId,  setDeletingId]  = useState(null);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.getAdminUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message ?? 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleRoleChange(userId, role) {
    try {
      const { data } = await api.updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === data.id ? { ...u, role: data.role } : u)));
      showToast(`Rol de ${data.name} actualizado a ${ROLE_LABELS[role].label}`);
    } catch (err) {
      showToast(err.message ?? 'Error al cambiar rol', 'error');
    }
  }

  async function handleDelete(targetUser) {
    if (!window.confirm(`¿Eliminar a ${targetUser.name} (${targetUser.email})? Esta acción no se puede deshacer.`)) return;
    setDeletingId(targetUser.id);
    try {
      await api.deleteUser(targetUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      showToast(`${targetUser.name} eliminado correctamente`);
    } catch (err) {
      showToast(err.message ?? 'Error al eliminar usuario', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  function handleInviteSuccess(newUser, message) {
    setUsers((prev) => [...prev, { ...newUser, created_at: new Date().toISOString() }]);
    setShowInvite(false);
    showToast(message);
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden bg-[#0f1117]">
      {/* Header */}
      <header className="h-14 shrink-0 flex items-center gap-3 px-6 border-b border-[#2e3140] bg-[#16181f]">
        <button
          onClick={onBack}
          className="p-1.5 rounded text-[#555b70] hover:text-[#e8eaf0] hover:bg-[#2e3140] transition-colors"
          title="Volver al tablero"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2 mr-auto">
          <Users size={16} className="text-indigo-400" />
          <h1 className="font-semibold text-[#e8eaf0] text-base">Gestión de usuarios</h1>
          <span className="text-xs text-[#555b70] bg-[#2e3140] px-2 py-0.5 rounded-full">
            {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
          </span>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
        >
          <UserPlus size={13} />
          Invitar usuario
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[#555b70] text-sm">
            Cargando usuarios…
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center mt-10">{error}</div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="bg-[#16181f] border border-[#2e3140] rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2e3140]">
                    <th className="text-left text-[10px] text-[#555b70] uppercase tracking-wide px-4 py-3">Usuario</th>
                    <th className="text-left text-[10px] text-[#555b70] uppercase tracking-wide px-4 py-3">Rol</th>
                    <th className="text-left text-[10px] text-[#555b70] uppercase tracking-wide px-4 py-3">Miembro desde</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr
                      key={u.id}
                      className={`${i < users.length - 1 ? 'border-b border-[#2e3140]' : ''} hover:bg-[#1e2028] transition-colors`}
                    >
                      {/* Avatar + nombre */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
                            {u.name?.[0] ?? u.email?.[0] ?? '?'}
                          </div>
                          <div>
                            <p className="text-sm text-[#e8eaf0] font-medium">
                              {u.name}
                              {u.id === user.id && (
                                <span className="ml-1.5 text-[10px] text-[#555b70]">(tú)</span>
                              )}
                            </p>
                            <p className="text-xs text-[#555b70]">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Rol — dropdown si no es el propio usuario ni superadmin, y no otro admin si soy admin */}
                      <td className="px-4 py-3">
                        {u.id === user.id || u.role === 'superadmin' || (user.role === 'admin' && u.role === 'admin') ? (
                          <RoleBadge role={u.role} />
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="bg-[#0f1117] border border-[#2e3140] text-[#e8eaf0] text-xs rounded-lg px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer hover:border-[#3d4155] transition-colors"
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 text-xs text-[#555b70]">
                        {new Date(u.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Eliminar — ocultar si es uno mismo, superadmin o admin si soy admin */}
                      <td className="px-4 py-3 text-right">
                        {u.id !== user.id && u.role !== 'superadmin' && !(user.role === 'admin' && u.role === 'admin') && (
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={deletingId === u.id}
                            className="p-1.5 rounded text-[#555b70] hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                            title="Eliminar usuario"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Info box */}
            <div className="mt-4 flex items-start gap-2 text-xs text-[#555b70] bg-[#16181f] border border-[#2e3140] rounded-xl px-4 py-3">
              <Shield size={13} className="text-indigo-400 mt-0.5 shrink-0" />
              <p>
                Puedes invitar usuarios de <strong className="text-[#8b90a0]">cualquier dominio</strong>.
                Al invitar a un usuario, recibirá un email para establecer su contraseña.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm shadow-2xl border transition-all
          ${toast.type === 'error'
            ? 'bg-red-900/90 text-red-200 border-red-700/50'
            : 'bg-green-900/90 text-green-200 border-green-700/50'}`}>
          {toast.msg}
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  );
}
