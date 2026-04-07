import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, GripVertical } from 'lucide-react';
import agLayaLogo from '../../assets/lfi.png'; // TODO: replace lfi.png with AGLAYA logo
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from '../UI/IconButton.jsx';

// ── Sortable board row ────────────────────────────────────
function SortableBoardItem({
  board, idx, isActive, isDraggingCard,
  editingId, editTitle, setEditTitle,
  onSelect, onStartEdit, onSubmitRename, onCancelEdit, onDelete,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: board.id, data: { type: 'board', board } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isEditing = editingId === board.id;
  const isDropTarget = isDraggingCard && isOver;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={isEditing ? undefined : () => onSelect(board.id)}
      className={`
        group flex items-center gap-2 rounded-md px-2 py-2 transition-colors text-sm
        ${isEditing ? 'cursor-default' : 'cursor-pointer'}
        ${isDropTarget
          ? 'bg-indigo-500/20 ring-1 ring-indigo-500/50 text-indigo-300'
          : isActive && !isEditing
            ? 'bg-indigo-500/15 text-indigo-300'
            : 'text-[#8b90a0] hover:bg-[#252830] hover:text-[#e8eaf0]'}
      `}
    >
      {isEditing ? (
        /* ── Edit mode ─────────────────────────────────── */
        <form
          onSubmit={onSubmitRename}
          className="flex items-center gap-1 flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 bg-[#252830] border border-[#3d4155] rounded px-1.5 py-0.5 text-xs text-[#e8eaf0] outline-none focus:border-indigo-500"
          />
          <button type="submit" className="text-indigo-400 hover:text-indigo-300">
            <Check size={13} />
          </button>
          <button type="button" onClick={onCancelEdit} className="text-[#555b70] hover:text-[#8b90a0]">
            <X size={13} />
          </button>
        </form>
      ) : (
        /* ── Normal mode ────────────────────────────────── */
        <>
          {/* Drag handle */}
          <span
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="text-[#3d4155] hover:text-[#555b70] cursor-grab active:cursor-grabbing p-0.5 rounded transition-colors shrink-0"
            title="Arrastrar"
          >
            <GripVertical size={12} />
          </span>

          {/* Title */}
          <span className="flex-1 truncate">{board.title}</span>

          {/* ⌘N hint — visible by default, hidden on hover */}
          {idx < 9 && (
            <span className="text-[10px] text-[#3d4155] group-hover:hidden font-mono shrink-0">
              ⌘{idx + 1}
            </span>
          )}

          {/* Action buttons — appear on hover */}
          <span className="hidden group-hover:flex items-center gap-0.5">
            <IconButton onClick={(e) => onStartEdit(board, e)} title="Renombrar">
              <Pencil size={12} />
            </IconButton>
            <IconButton
              onClick={(e) => { e.stopPropagation(); onDelete(board.id); }}
              title="Eliminar"
              danger
            >
              <Trash2 size={12} />
            </IconButton>
          </span>
        </>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────
export function Sidebar({ boards, activeBoardId, onSelect, onCreate, onRename, onDelete, isDraggingCard = false }) {
  const [creating, setCreating]   = useState(false);
  const [newTitle, setNewTitle]   = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  function handleCreate(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreate(newTitle.trim());
    setNewTitle('');
    setCreating(false);
  }

  function startEdit(board, e) {
    e.stopPropagation();
    setEditingId(board.id);
    setEditTitle(board.title);
  }

  function handleRename(e) {
    e?.preventDefault();
    if (!editTitle.trim()) return;
    onRename(editingId, editTitle.trim());
    setEditingId(null);
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-[#16181f] border-r border-[#2e3140] select-none">

      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-[#2e3140] shrink-0">
        <img src={agLayaLogo} alt="AGLAYA" className="w-7 h-7 rounded-lg object-contain" />
        <span className="font-bold text-[#e8eaf0] tracking-tight">LFi Kanban Desk</span>
      </div>

      {/* Board list */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555b70] px-2 mb-2">
          Tableros
        </p>

        <SortableContext items={boards.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {boards.map((board, idx) => (
            <SortableBoardItem
              key={board.id}
              board={board}
              idx={idx}
              isActive={board.id === activeBoardId}
              isDraggingCard={isDraggingCard}
              editingId={editingId}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              onSelect={onSelect}
              onStartEdit={startEdit}
              onSubmitRename={handleRename}
              onCancelEdit={() => setEditingId(null)}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {/* Inline create form */}
        {creating ? (
          <form onSubmit={handleCreate} className="px-2 pt-1">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nombre del tablero"
              className="w-full bg-[#252830] border border-[#3d4155] rounded px-2 py-1 text-xs text-[#e8eaf0] outline-none focus:border-indigo-500 placeholder:text-[#555b70]"
            />
            <div className="flex gap-1 mt-1">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded py-1 transition-colors"
              >
                Crear
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="flex-1 bg-[#252830] hover:bg-[#2e3140] text-[#8b90a0] text-xs rounded py-1 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 w-full px-2 py-2 text-sm text-[#555b70] hover:text-[#8b90a0] rounded-md hover:bg-[#252830] transition-colors"
          >
            <Plus size={14} />
            Nuevo tablero
          </button>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#2e3140]">
        <span className="text-[10px] text-[#555b70]">MyBoard v1.0 · Phase 1</span>
      </div>
    </aside>
  );
}
