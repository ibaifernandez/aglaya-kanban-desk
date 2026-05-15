import { useState, useEffect, useRef } from 'react';
import { Settings, Search, X, ArrowRight, LogOut, Mail, ChevronLeft, UserCog, Camera, SlidersHorizontal } from 'lucide-react';
import { api } from '../../api/client.js';
import { AvatarCropModal } from '../UI/AvatarCropModal.jsx';
import { NotificationBell } from '../UI/NotificationBell.jsx';
import { PRIORITY_LIST } from '../../utils/constants.js';
import { useCategoriesCtx } from '../../context/CategoriesContext.jsx';
import { CategorySettings } from './CategorySettings.jsx';
import { useEscapeKey } from '../../hooks/useEscapeKey.js';

export function Toolbar({ boardTitle, filters, onFilterChange, availableTags = [], workspaceMembers = [], onSelectBoard, user, onLogout, onOpenAdmin, workspace, onBackToWorkspaces, onOpenMembers, onOpenWsSettings, onAvatarChange, onNotificationNavigate }) {
  const { category, priority, tag, search = '', assignee = '', overdue = false } = filters;
  const { categories } = useCategoriesCtx();
  const [showSettings,  setShowSettings]  = useState(false);
  const [showDigestConfirm, setShowDigestConfirm] = useState(false);
  const [digestState,   setDigestState]   = useState('idle'); // 'idle' | 'sending' | 'ok' | 'error'
  const [digestMsg,     setDigestMsg]     = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarCropSrc,   setAvatarCropSrc]   = useState(null);
  const avatarFileRef = useRef(null);

  // Global search state
  const [globalQ,       setGlobalQ]       = useState('');
  const [globalResults, setGlobalResults] = useState([]);
  const [globalOpen,    setGlobalOpen]    = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const timerRef  = useRef(null);
  const wrapRef   = useRef(null);

  useEscapeKey(() => setShowDigestConfirm(false), showDigestConfirm && digestState !== 'sending');

  // Debounced fetch
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (globalQ.trim().length < 2) { setGlobalResults([]); setGlobalOpen(false); return; }
    setGlobalLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const results = await api.searchCards(globalQ.trim());
        setGlobalResults(results);
        setGlobalOpen(true);
      } catch { setGlobalResults([]); }
      finally  { setGlobalLoading(false); }
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [globalQ]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setGlobalOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSelectResult(card) {
    onSelectBoard?.(card.boardId);
    setGlobalQ('');
    setGlobalOpen(false);
  }

  async function handleSendDigest() {
    setDigestState('sending');
    setDigestMsg('');
    try {
      const json = await api.sendPersonalDigest({ workspaceId: workspace?.id });
      setDigestState('ok');
      setDigestMsg(json.message);
    } catch (err) {
      setDigestState('error');
      setDigestMsg(err.message);
    } finally {
      setShowDigestConfirm(false);
      setTimeout(() => setDigestState('idle'), 4000);
    }
  }

  function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleAvatarCropConfirm(croppedFile) {
    setAvatarUploading(true);
    try {
      const avatarUrl = await api.uploadAvatar(croppedFile);
      onAvatarChange?.(avatarUrl);
      setAvatarCropSrc(null);
    } catch (err) {
      console.error('Error al subir avatar:', err.message);
    } finally {
      setAvatarUploading(false);
    }
  }

  function clearAll() {
    onFilterChange('category', '');
    onFilterChange('priority', '');
    onFilterChange('tag', '');
    onFilterChange('search', '');
    onFilterChange('assignee', '');
    onFilterChange('overdue', false);
  }

  const hasActiveFilters = category || priority || tag || search || assignee || overdue;

  return (
    <>
      <header className="h-14 shrink-0 flex items-center gap-3 px-6 border-b border-[#2e3140] bg-[#16181f]">
        {/* Breadcrumb: workspace → board */}
        <div className="flex items-center gap-1.5 mr-auto min-w-0">
          {onBackToWorkspaces && (
            <>
              <button
                onClick={onBackToWorkspaces}
                className="flex items-center gap-1 text-sm text-[#555b70] hover:text-[#e8eaf0] transition-colors shrink-0"
              >
                <ChevronLeft size={14} />
                {workspace ? (
                  <span className="hidden sm:inline">{workspace.emoji} {workspace.name}</span>
                ) : (
                  <span className="hidden sm:inline">Workspaces</span>
                )}
              </button>
              <span className="text-[#2a2d3a] shrink-0">/</span>
            </>
          )}
          <h1 className="font-semibold text-[#e8eaf0] text-sm truncate">{boardTitle}</h1>
        </div>

        {/* Global search (all boards) */}
        <div ref={wrapRef} className="relative flex items-center">
          <Search size={13} className="absolute left-2 text-[#555b70] pointer-events-none z-10" />
          <input
            type="text"
            value={globalQ}
            onChange={(e) => setGlobalQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setGlobalQ(''); setGlobalOpen(false); }
            }}
            onFocus={() => { if (globalResults.length > 0) setGlobalOpen(true); }}
            placeholder="Buscar en todos los tableros…"
            className="bg-[#1e2028] border border-[#2e3140] text-[#8b90a0] text-xs rounded-md pl-6 pr-6 py-1.5 w-44 outline-none focus:border-indigo-500 focus:w-64 focus:text-[#e8eaf0] placeholder:text-[#3d4155] transition-all"
          />
          {globalQ && (
            <button
              onClick={() => { setGlobalQ(''); setGlobalOpen(false); }}
              className="absolute right-1.5 text-[#555b70] hover:text-[#8b90a0]"
            >
              <X size={11} />
            </button>
          )}

          {/* Results dropdown */}
          {globalOpen && (
            <div className="absolute top-full left-0 mt-1 w-80 bg-[#1e2028] border border-[#2e3140] rounded-xl shadow-2xl z-50 overflow-hidden">
              {globalLoading ? (
                <p className="text-xs text-[#555b70] text-center py-4">Buscando…</p>
              ) : globalResults.length === 0 ? (
                <p className="text-xs text-[#555b70] text-center py-4">Sin resultados</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto py-1">
                  {globalResults.map((card) => (
                    <li key={card.id}>
                      <button
                        onClick={() => handleSelectResult(card)}
                        className="w-full text-left px-3 py-2.5 hover:bg-[#252830] transition-colors group"
                      >
                        <p className="text-sm text-[#e8eaf0] line-clamp-1 group-hover:text-white">
                          {card.title}
                        </p>
                        <p className="text-[10px] text-[#555b70] flex items-center gap-1 mt-0.5">
                          <span>{card.boardTitle}</span>
                          <ArrowRight size={9} />
                          <span>{card.columnTitle}</span>
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Board-scoped search */}
        <div className="relative hidden 2xl:flex items-center">
          <Search size={13} className="absolute left-2 text-[#555b70] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onFilterChange('search', '')}
            placeholder="Filtrar tablero…"
            className="bg-[#1e2028] border border-[#2e3140] text-[#8b90a0] text-xs rounded-md pl-6 pr-6 py-1.5 w-32 outline-none focus:border-indigo-500 focus:w-44 focus:text-[#e8eaf0] placeholder:text-[#3d4155] transition-all"
          />
          {search && (
            <button
              onClick={() => onFilterChange('search', '')}
              className="absolute right-1.5 text-[#555b70] hover:text-[#8b90a0]"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <select
          value={category}
          onChange={(e) => onFilterChange('category', e.target.value)}
          className="bg-[#1e2028] border border-[#2e3140] text-[#8b90a0] text-xs rounded-md px-2 py-1.5 outline-none focus:border-indigo-500 cursor-pointer hover:border-[#3d4155] transition-colors"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          value={priority}
          onChange={(e) => onFilterChange('priority', e.target.value)}
          className="bg-[#1e2028] border border-[#2e3140] text-[#8b90a0] text-xs rounded-md px-2 py-1.5 outline-none focus:border-indigo-500 cursor-pointer hover:border-[#3d4155] transition-colors"
        >
          <option value="">Todas las prioridades</option>
          {PRIORITY_LIST.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Tag filter — only shown when there are tags */}
        {availableTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => onFilterChange('tag', e.target.value)}
            className="bg-[#1e2028] border border-[#2e3140] text-[#8b90a0] text-xs rounded-md px-2 py-1.5 outline-none focus:border-indigo-500 cursor-pointer hover:border-[#3d4155] transition-colors"
          >
            <option value="">Todas las etiquetas</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>#{t}</option>
            ))}
          </select>
        )}

        {/* Assignee filter — only when workspace has members */}
        {workspaceMembers.length > 0 && (
          <select
            value={assignee}
            onChange={(e) => onFilterChange('assignee', e.target.value)}
            className="bg-[#1e2028] border border-[#2e3140] text-[#8b90a0] text-xs rounded-md px-2 py-1.5 outline-none focus:border-indigo-500 cursor-pointer hover:border-[#3d4155] transition-colors"
          >
            <option value="">Todos los responsables</option>
            {workspaceMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email}</option>
            ))}
          </select>
        )}

        {/* Overdue toggle */}
        <button
          onClick={() => onFilterChange('overdue', !overdue)}
          title="Solo tarjetas vencidas"
          className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
            overdue
              ? 'bg-red-500/15 border-red-500/40 text-red-400'
              : 'bg-[#1e2028] border-[#2e3140] text-[#8b90a0] hover:border-[#3d4155]'
          }`}
        >
          Vencidas
        </button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Limpiar filtros
          </button>
        )}

        {/* Workspace buttons — when inside a workspace */}
        {workspace && onOpenWsSettings && ['owner', 'admin'].includes(workspace.myRole) && (
          <button
            onClick={onOpenWsSettings}
            title="Ajustes del espacio de trabajo"
            className="p-1.5 rounded text-[#555b70] hover:text-[#e8eaf0] hover:bg-[#2e3140] transition-colors"
          >
            <SlidersHorizontal size={15} />
          </button>
        )}
        {workspace && onOpenMembers && (
          <button
            onClick={onOpenMembers}
            title="Miembros del espacio de trabajo"
            className="p-1.5 rounded text-[#555b70] hover:text-[#e8eaf0] hover:bg-[#2e3140] transition-colors"
          >
            <UserCog size={15} />
          </button>
        )}

        {/* Notification bell */}
        <NotificationBell user={user} onNavigate={onNotificationNavigate} />

        {/* Workspace digest button */}
        {workspace && (
        <div className="relative">
          <button
            onClick={() => setShowDigestConfirm(true)}
            disabled={digestState === 'sending'}
            title="Recibir resumen de este espacio de trabajo"
            className={`p-1.5 rounded transition-colors
              ${digestState === 'ok'    ? 'text-green-400 bg-green-400/10' :
                digestState === 'error' ? 'text-red-400 bg-red-400/10' :
                'text-[#555b70] hover:text-[#e8eaf0] hover:bg-[#2e3140]'}
              disabled:opacity-50 disabled:cursor-wait`}
          >
            <Mail size={15} />
          </button>
          {digestMsg && digestState !== 'idle' && (
            <div className={`absolute right-0 top-full mt-1.5 z-50 w-64 rounded-lg px-3 py-2 text-xs shadow-xl
              ${digestState === 'ok' ? 'bg-green-900/80 text-green-300 border border-green-700/50' : 'bg-red-900/80 text-red-300 border border-red-700/50'}`}>
              {digestMsg}
            </div>
          )}
        </div>
        )}

        {/* Settings button — manage categories */}
        <button
          onClick={() => setShowSettings(true)}
          className="p-1.5 rounded text-[#555b70] hover:text-[#e8eaf0] hover:bg-[#2e3140] transition-colors"
          title="Gestionar categorías"
        >
          <Settings size={15} />
        </button>

        {/* User info + logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-[#2e3140]">
            <div className="flex items-center gap-1.5">
              {/* Avatar with upload on hover */}
              <div
                className="relative group/avatar w-6 h-6 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => avatarFileRef.current?.click()}
                title="Cambiar foto de perfil"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold uppercase">
                    {user.name?.[0] ?? user.email?.[0] ?? '?'}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                  {avatarUploading ? (
                    <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera size={9} className="text-white" />
                  )}
                </div>
              </div>
              <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <span className="text-xs text-[#8b92a5] hidden lg:block max-w-[120px] truncate">
                {user.name ?? user.email}
              </span>
            </div>
            <button
              onClick={onLogout}
              title="Cerrar sesión"
              className="p-1.5 rounded text-[#555b70] hover:text-red-400 hover:bg-[#2e3140] transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </header>

      {showSettings && <CategorySettings onClose={() => setShowSettings(false)} />}

      {showDigestConfirm && workspace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowDigestConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[#2e3140] bg-[#1e2028] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[#e8eaf0] mb-2">¿Recibir resumen del workspace?</h2>
            <p className="text-sm text-[#8b90a0] mb-5">
              ¿Quieres recibir el resumen de tus tareas <strong className="text-[#e8eaf0]">concernientes a este workspace</strong>?
              <br />
              <span className="text-[#555b70]">{workspace.emoji} {workspace.name}</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDigestConfirm(false)}
                className="px-4 py-2 text-sm text-[#8b92a5] hover:text-[#e8eaf0] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendDigest}
                disabled={digestState === 'sending'}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {digestState === 'sending' ? 'Enviando…' : 'Enviar resumen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {avatarCropSrc && (
        <AvatarCropModal
          imageSrc={avatarCropSrc}
          uploading={avatarUploading}
          onConfirm={handleAvatarCropConfirm}
          onClose={() => setAvatarCropSrc(null)}
        />
      )}
    </>
  );
}
