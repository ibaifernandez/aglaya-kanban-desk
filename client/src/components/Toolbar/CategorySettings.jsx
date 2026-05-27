import { useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { COLOR_OPTIONS } from '../../utils/constants.js';
import { useCategoriesCtx } from '../../context/CategoriesContext.jsx';
import { useEscapeKey } from '../../hooks/useEscapeKey.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

// ── Color picker ──────────────────────────────────────────────────────────────
function ColorPicker({ selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1.5 pb-0.5">
      {COLOR_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          title={opt.id}
          onClick={() => onChange(opt.id)}
          className={`
            w-4 h-4 rounded-full transition-transform
            ${opt.dot}
            ${selected === opt.id ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-[#1e2028] scale-110' : 'opacity-70 hover:opacity-100 hover:scale-110'}
          `}
        />
      ))}
    </div>
  );
}

// ── One editable category row ─────────────────────────────────────────────────
function CategoryRow({ cat }) {
  const { updateCategory, deleteCategory } = useCategoriesCtx();
  const [label,      setLabel]      = useState(cat.label);
  const [showColors, setShowColors] = useState(false);

  const colorOpt = COLOR_OPTIONS.find((o) => o.id === cat.colorId)
    ?? COLOR_OPTIONS[9]; // fallback: blue

  function saveLabel() {
    const trimmed = label.trim();
    if (trimmed && trimmed !== cat.label) {
      updateCategory(cat.id, { label: trimmed });
    } else {
      setLabel(cat.label); // revert on empty
    }
  }

  function changeColor(colorId) {
    updateCategory(cat.id, { colorId });
    setShowColors(false);
  }

  return (
    <div className="group/row">
      <div className="flex items-center gap-2 py-1">
        {/* Color swatch — click to toggle picker */}
        <button
          type="button"
          onClick={() => setShowColors((v) => !v)}
          className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${colorOpt.dot} transition-transform hover:scale-110`}
          title="Cambiar color"
        />

        {/* Editable label */}
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.target.blur(); }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setLabel(cat.label);
              e.target.blur();
            }
          }}
          className="flex-1 text-sm text-[#e8eaf0] bg-transparent border-b border-transparent hover:border-[#3d4155] focus:border-indigo-500 outline-none transition-colors"
        />

        {/* Delete */}
        <button
          type="button"
          onClick={() => deleteCategory(cat.id)}
          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-[#555b70] hover:text-red-400 transition-all flex-shrink-0"
          title="Eliminar categoría"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Inline color picker */}
      {showColors && (
        <div className="pl-5 pb-1">
          <ColorPicker selected={cat.colorId} onChange={changeColor} />
        </div>
      )}
    </div>
  );
}

// ── Main settings modal ───────────────────────────────────────────────────────
export function CategorySettings({ onClose }) {
  const { categories, createCategory } = useCategoriesCtx();
  const [newLabel,   setNewLabel]   = useState('');
  const [newColorId, setNewColorId] = useState('blue');

  useEscapeKey(onClose);
  const modalRef = useFocusTrap(true);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    await createCategory({ label: trimmed, colorId: newColorId });
    setNewLabel('');
    setNewColorId('blue');
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={handleBackdrop}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-settings-title"
        className="w-full max-w-sm bg-[#1e2028] rounded-xl border border-[#2e3140] shadow-2xl flex flex-col max-h-[80vh]"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3140]">
          <h2 id="category-settings-title" className="text-sm font-semibold text-[#e8eaf0]">Categorías</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded text-[#555b70] hover:text-[#e8eaf0] hover:bg-[#2e3140] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {categories.length === 0 ? (
            <p className="text-xs text-[#555b70] italic">Sin categorías todavía.</p>
          ) : (
            <div className="space-y-0.5">
              {categories.map((cat) => (
                <CategoryRow key={cat.id} cat={cat} />
              ))}
            </div>
          )}
        </div>

        {/* Add new category */}
        <div className="px-5 py-4 border-t border-[#2e3140]">
          <p className="text-xs text-[#555b70] mb-2">Nueva categoría</p>
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="flex gap-2">
              <input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nombre…"
                className="flex-1 bg-[#252830] border border-[#2e3140] rounded-lg px-2.5 py-1.5 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500 placeholder:text-[#555b70]"
              />
              <button
                type="submit"
                disabled={!newLabel.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs rounded-lg font-medium transition-colors flex items-center gap-1"
              >
                <Plus size={13} /> Añadir
              </button>
            </div>
            <ColorPicker selected={newColorId} onChange={setNewColorId} />
          </form>
        </div>

      </div>
    </div>
  );
}
