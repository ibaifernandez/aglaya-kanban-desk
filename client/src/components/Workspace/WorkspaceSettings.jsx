import { useState, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import { api } from '../../api/client.js';
import { Spinner } from '../UI/Spinner.jsx';

const EMOJIS = ['📋', '🚀', '⭐', '🎯', '💡', '🏢', '📊', '🛠', '🎨', '📣', '🤝', '💼'];

const TYPE_OPTS = [
  { value: 'personal', label: 'Personal' },
  { value: 'interno',  label: 'Interno'  },
  { value: 'externo',  label: 'Cliente'  },
];

/**
 * Workspace settings side panel.
 * Allows editing name, emoji, description, type and cover image.
 * Only rendered for workspace owners/admins.
 */
export function WorkspaceSettings({ workspace, onSave, onClose }) {
  const [name,           setName]           = useState(workspace.name ?? '');
  const [emoji,          setEmoji]          = useState(workspace.emoji ?? '📋');
  const [desc,           setDesc]           = useState(workspace.description ?? '');
  const [type,           setType]           = useState(workspace.type ?? 'externo');
  const [coverPreview,   setCoverPreview]   = useState(workspace.coverUrl ?? null);
  const [saving,         setSaving]         = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [error,          setError]          = useState('');
  const coverFileRef = useRef(null);

  const showExternoWarning = type === 'externo' && workspace.type !== 'externo';

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    setError('');
    try {
      const url = await api.uploadWorkspaceCover(workspace.id, file);
      setCoverPreview(url);
    } catch (err) {
      setError('Error al subir la portada: ' + err.message);
    } finally {
      setCoverUploading(false);
      e.target.value = '';
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateWorkspace(workspace.id, {
        name:        name.trim(),
        emoji,
        description: desc.trim(),
        type,
      });
      onSave({ ...workspace, ...updated, coverUrl: coverPreview });
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-80 bg-[#1a1d26] border-l border-[#2a2d3a] flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2a2d3a] flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-[#e8eaf0]">Ajustes del espacio</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#555b70] hover:text-[#e8eaf0] hover:bg-[#2a2d3a] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Emoji */}
          <div>
            <label className="block text-xs font-medium text-[#8b92a5] mb-2">Icono</label>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    emoji === e
                      ? 'bg-indigo-500/20 ring-1 ring-indigo-500'
                      : 'bg-[#0f1117] hover:bg-[#2a2d3a]'
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
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-[#e8eaf0] placeholder-[#3a3f50] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[#8b92a5] mb-1.5">
              Descripción <span className="text-[#3a3f50]">(opcional)</span>
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="¿Qué gestiona este espacio de trabajo?"
              className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5 text-sm text-[#e8eaf0] placeholder-[#3a3f50] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors resize-none"
            />
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-xs font-medium text-[#8b92a5] mb-2">
              Imagen de portada <span className="text-[#3a3f50]">(opcional)</span>
            </label>
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
                  {coverUploading
                    ? <Spinner size={3} />
                    : <><Camera size={14} /><span className="text-xs">Subir imagen de portada</span></>
                  }
                </div>
              )}
            </div>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverUpload}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-[#8b92a5] mb-2">Tipo</label>
            <div className="flex gap-2">
              {TYPE_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
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
            {showExternoWarning && (
              <p className="mt-2 text-[11px] text-amber-400">
                Este espacio pasará a ser visible para usuarios con rol <strong>cliente</strong>.
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#2a2d3a] shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? <Spinner size={3} /> : null}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
