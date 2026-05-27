import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Pencil, Check, X, GripVertical } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableCard } from '../Card/SortableCard.jsx';
import { IconButton } from '../UI/IconButton.jsx';

export function Column({ column, cards, sortBy = '', onSortChange = () => {}, onAddCard, onEditCard, onDeleteCard, onRenameColumn, onDeleteColumn, dragHandleProps = {}, forceEdit = false, onForceEditDone = () => {} }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft]     = useState(column.title);
  const [addingCard, setAddingCard]     = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');

  // Permite que Board dispare el rename desde el menú contextual
  const onForceEditDoneRef = useRef(onForceEditDone);
  onForceEditDoneRef.current = onForceEditDone;
  useEffect(() => {
    if (forceEdit) {
      setTitleDraft(column.title);
      setEditingTitle(true);
      onForceEditDoneRef.current();
    }
  }, [forceEdit, column.title]);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  function submitRename(e) {
    e?.preventDefault();
    if (titleDraft.trim() && titleDraft !== column.title) onRenameColumn(column.id, titleDraft.trim());
    setEditingTitle(false);
  }

  function submitAddCard(e) {
    e?.preventDefault();
    if (!newCardTitle.trim()) return;
    onAddCard(column.id, newCardTitle.trim());
    setNewCardTitle('');
    setAddingCard(false);
  }

  const cardIds = cards.map((c) => c.id);

  return (
    <div data-col-id={column.id} className="flex flex-col w-72 shrink-0 bg-[#1e2028] rounded-xl border border-[#2e3140] max-h-[calc(100vh-6.5rem)]">
      {/* Column header */}
      <div className="px-3 pt-3 pb-2">
        {editingTitle ? (
          <form onSubmit={submitRename} className="flex items-center gap-1.5">
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={submitRename}
              className="flex-1 bg-[#252830] border border-[#3d4155] rounded px-2 py-0.5 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500"
            />
            <button type="submit" aria-label="Guardar nombre de columna" className="text-indigo-400 shrink-0"><Check size={14} /></button>
            <button
              type="button"
              onClick={() => { setEditingTitle(false); setTitleDraft(column.title); }}
              aria-label="Cancelar edición de columna"
              className="text-[#555b70] shrink-0"
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <>
            {/* Row 1: drag handle + title (full width, wraps naturally) */}
            <div className="flex items-start gap-1.5 mb-1.5">
              <span
                {...dragHandleProps}
                className="mt-0.5 text-[#555b70] hover:text-[#8b90a0] cursor-grab active:cursor-grabbing p-0.5 rounded transition-colors shrink-0"
                title="Arrastrar columna"
              >
                <GripVertical size={14} />
              </span>
              <h3 className="flex-1 text-sm font-semibold text-[#e8eaf0] leading-snug break-words">
                {column.title}
              </h3>
            </div>

            {/* Row 2: count · sort · rename · delete (indented under title) */}
            <div className="flex items-center gap-1.5 pl-5">
              <span className="text-xs text-[#555b70] bg-[#252830] px-1.5 py-0.5 rounded font-mono shrink-0">
                {cards.length}
              </span>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(column.id, e.target.value)}
                title="Ordenar columna"
                className={`text-[10px] bg-[#252830] border rounded px-1.5 py-0.5 outline-none cursor-pointer transition-colors
                  ${sortBy
                    ? 'border-indigo-500/50 text-indigo-400'
                    : 'border-[#2e3140] text-[#555b70] hover:text-[#8b90a0]'
                  }`}
              >
                <option value="">· · ·</option>
                <option value="priority">prioridad</option>
                <option value="category">categoría</option>
              </select>
              <div className="ml-auto flex items-center gap-0.5">
                <IconButton onClick={() => setEditingTitle(true)} title="Renombrar columna">
                  <Pencil size={13} />
                </IconButton>
                <IconButton onClick={() => onDeleteColumn(column.id)} title="Eliminar columna" danger>
                  <Trash2 size={13} />
                </IconButton>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={`overflow-y-auto px-2 pb-2 space-y-2 min-h-[40px] rounded-b-xl transition-colors ${isOver ? 'bg-indigo-500/5' : ''}`}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              onClick={() => onEditCard(card)}
              onDelete={() => onDeleteCard(card.id)}
            />
          ))}
        </SortableContext>

        {/* Add card inline */}
        {addingCard ? (
          <form onSubmit={submitAddCard} className="pt-1">
            <textarea
              autoFocus
              rows={2}
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAddCard(); } if (e.key === 'Escape') setAddingCard(false); }}
              placeholder="Título de la tarea…"
              className="w-full bg-[#252830] border border-[#3d4155] rounded-lg px-2.5 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500 resize-none placeholder:text-[#555b70]"
            />
            <div className="flex gap-1 mt-1">
              <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-md py-1.5 transition-colors font-medium">
                Añadir
              </button>
              <button type="button" onClick={() => setAddingCard(false)}
                aria-label="Cancelar añadir tarjeta"
                className="px-2 bg-[#252830] hover:bg-[#2e3140] text-[#8b90a0] text-xs rounded-md transition-colors">
                <X size={13} />
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-[#555b70] hover:text-[#8b90a0] hover:bg-[#252830] rounded-md transition-colors"
          >
            <Plus size={13} /> Añadir tarea
          </button>
        )}
      </div>
    </div>
  );
}
