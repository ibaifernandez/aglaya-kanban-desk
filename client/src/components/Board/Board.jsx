import { useState } from 'react';
import { isOverdue } from '../../utils/dates.js';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, X, Pencil, Trash2, ArrowUpRight, ArrowRight } from 'lucide-react';
import { SortableColumn } from '../Column/SortableColumn.jsx';
import { CardModal } from '../CardModal/CardModal.jsx';
import { ContextMenu } from '../UI/ContextMenu.jsx';
import { Spinner } from '../UI/Spinner.jsx';
import { useCategoriesCtx } from '../../context/CategoriesContext.jsx';
import { api } from '../../api/client.js';

const PRIORITY_SORT_ORDER = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export function Board({
  columns, cards, loading, filters, boardId, boards = [], workspaceMembers = [],
  onCreateColumn, onRenameColumn, onUpdateColumn, onDeleteColumn, onReorderColumns,
  onCreateCard, onUpdateCard, onMoveCard, onDeleteCard,
}) {
  const [modalState,     setModalState]     = useState(null);
  const [addingColumn,   setAddingColumn]   = useState(false);
  const [newColTitle,    setNewColTitle]     = useState('');
  const [columnSorts,    setColumnSorts]    = useState({});
  const [contextMenu,    setContextMenu]    = useState(null); // { x, y, type, card?, column? }
  const [otherBoardCols, setOtherBoardCols] = useState({});   // { [boardId]: columns[] }
  const [editingColId,   setEditingColId]   = useState(null);

  const { categories } = useCategoriesCtx();

  // ── Filters ───────────────────────────────────────────────
  const visibleCards = cards.filter((c) => {
    if (filters.category && c.category !== filters.category) return false;
    if (filters.priority && c.priority !== filters.priority) return false;
    if (filters.tag && !c.tags?.includes(filters.tag)) return false;
    if (filters.assignee && c.assigneeId !== filters.assignee) return false;
    if (filters.overdue && !isOverdue(c.dueDate)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function cardsForColumn(colId) {
    return visibleCards
      .filter((c) => c.columnId === colId)
      .sort((a, b) => a.order - b.order);
  }

  // Returns the effective sort for a column: explicit override or server default
  function getSortForColumn(colId) {
    if (colId in columnSorts) return columnSorts[colId];
    return columns.find((c) => c.id === colId)?.defaultSort ?? '';
  }

  function handleSortChange(colId, sortBy) {
    setColumnSorts((prev) => ({ ...prev, [colId]: sortBy }));
    onUpdateColumn?.(colId, { defaultSort: sortBy });
  }

  function sortedCardsForColumn(colId) {
    const base   = cardsForColumn(colId);
    const sortBy = getSortForColumn(colId);
    if (!sortBy) return base;
    return [...base].sort((a, b) => {
      if (sortBy === 'priority') {
        return (PRIORITY_SORT_ORDER[a.priority] ?? 2) - (PRIORITY_SORT_ORDER[b.priority] ?? 2);
      }
      if (sortBy === 'category') {
        const aLabel = categories.find((c) => c.id === a.category)?.label ?? a.category ?? '';
        const bLabel = categories.find((c) => c.id === b.category)?.label ?? b.category ?? '';
        return aLabel.localeCompare(bLabel);
      }
      return 0;
    });
  }

  // ── Modal helpers ──────────────────────────────────────────
  function openEdit(card)  { setModalState({ card, columnId: card.columnId }); }
  function closeModal()    { setModalState(null); }

  async function handleSave(formData) {
    if (modalState?.card?.id) {
      const { columnId: newColId, boardId: newBoardId, ...rest } = formData;
      const isCrossBoard   = newBoardId && newBoardId !== boardId;
      const isColumnChange = newColId !== modalState.card.columnId;

      if (isCrossBoard || isColumnChange) {
        const destCards = isCrossBoard
          ? []
          : cards.filter((c) => c.columnId === newColId);
        await onMoveCard(modalState.card.id, newColId, destCards.length + 1);
      }
      await onUpdateCard(modalState.card.id, rest);
    } else {
      await onCreateCard(formData);
    }
    closeModal();
  }

  // ── Context menu ───────────────────────────────────────────
  function handleContextMenu(e) {
    const cardEl = e.target.closest('[data-card-id]');
    const colEl  = !cardEl ? e.target.closest('[data-col-id]') : null;

    e.preventDefault();

    if (cardEl) {
      const card = cards.find((c) => c.id === cardEl.dataset.cardId);
      if (!card) return;
      setContextMenu({ x: e.clientX, y: e.clientY, type: 'card', card });

      boards.filter((b) => b.id !== boardId).forEach(async (board) => {
        if (otherBoardCols[board.id]) return;
        try {
          const cols = await api.getColumns(board.id);
          setOtherBoardCols((prev) => ({ ...prev, [board.id]: cols }));
        } catch { /* ignore */ }
      });
      return;
    }

    if (colEl) {
      const column = columns.find((c) => c.id === colEl.dataset.colId);
      if (!column) return;
      setContextMenu({ x: e.clientX, y: e.clientY, type: 'column', column });
      return;
    }

    setContextMenu({ x: e.clientX, y: e.clientY, type: 'board' });
  }

  function buildCardContextItems(card) {
    const otherCols   = columns.filter((c) => c.id !== card.columnId);
    const otherBoards = boards.filter((b) => b.id !== boardId);
    const hasMoves    = otherCols.length > 0 || otherBoards.length > 0;

    const colSubItems = otherCols.map((col) => ({
      label:  col.title,
      action: () => {
        const destCards = cards.filter((c) => c.columnId === col.id);
        onMoveCard(card.id, col.id, destCards.length + 1);
      },
    }));

    const boardSubItems = otherBoards.flatMap((board, i) => {
      const cols = otherBoardCols[board.id];
      const rows = [];
      if (i > 0) rows.push({ type: 'separator' });
      rows.push({ type: 'label', label: board.title });
      if (!cols) {
        rows.push({ label: 'Cargando…', disabled: true });
      } else if (cols.length === 0) {
        rows.push({ label: 'Sin columnas', disabled: true });
      } else {
        cols.forEach((col) =>
          rows.push({ label: col.title, action: () => onMoveCard(card.id, col.id, 1) })
        );
      }
      return rows;
    });

    const priorityItems = [
      { value: 'urgent', label: 'Urgente',      dot: 'bg-purple-500'  },
      { value: 'high',   label: 'Alta',         dot: 'bg-red-500'     },
      { value: 'medium', label: 'Media',        dot: 'bg-amber-500'   },
      { value: 'low',    label: 'Baja',         dot: 'bg-green-500'   },
      { value: 'none',   label: 'Sin prioridad',dot: 'bg-[#3d4155]'   },
    ].map((p) => ({
      icon:    <span className={`w-2.5 h-2.5 rounded-full ${p.dot} shrink-0 inline-block`} />,
      label:   p.label,
      checked: (card.priority ?? 'none') === p.value,
      action:  () => onUpdateCard(card.id, { priority: p.value }),
    }));

    return [
      { icon: <Pencil size={13} />, label: 'Editar', action: () => openEdit(card) },
      ...(hasMoves ? [
        { type: 'separator' },
        ...(otherCols.length > 0   ? [{ type: 'submenu', icon: <ArrowRight   size={13} />, label: 'Mover a columna', items: colSubItems   }] : []),
        ...(otherBoards.length > 0 ? [{ type: 'submenu', icon: <ArrowUpRight size={13} />, label: 'Mover a tablero', items: boardSubItems }] : []),
      ] : []),
      { type: 'separator' },
      ...priorityItems,
      { type: 'separator' },
      { icon: <Trash2 size={13} />, label: 'Eliminar', danger: true, action: () => onDeleteCard(card.id) },
    ];
  }

  function buildColumnContextItems(column) {
    return [
      { icon: <Plus   size={13} />, label: 'Añadir tarjeta',  action: () => setModalState({ card: null, columnId: column.id }) },
      { icon: <Pencil size={13} />, label: 'Renombrar',        action: () => setEditingColId(column.id) },
      { type: 'separator' },
      { icon: <Trash2 size={13} />, label: 'Eliminar columna', danger: true, action: () => onDeleteColumn(column.id) },
    ];
  }

  function buildBoardContextItems() {
    return [
      { icon: <Plus size={13} />, label: 'Añadir columna', action: () => setAddingColumn(true) },
    ];
  }

  // ── Add column form ────────────────────────────────────────
  async function handleAddColumn(e) {
    e.preventDefault();
    if (!newColTitle.trim()) return;
    await onCreateColumn(newColTitle.trim());
    setNewColTitle('');
    setAddingColumn(false);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={8} />
      </div>
    );
  }

  const columnIds = columns.map((c) => c.id);

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden" onContextMenu={handleContextMenu}>
      <div className="flex gap-4 p-6 h-full items-start">

        {/* Columns — sortable horizontally */}
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {columns.map((col) => (
            <SortableColumn
              key={col.id}
              column={col}
              cards={sortedCardsForColumn(col.id)}
              sortBy={getSortForColumn(col.id)}
              onSortChange={handleSortChange}
              onAddCard={(colId, title) => onCreateCard({ columnId: colId, boardId, title })}
              onEditCard={openEdit}
              onDeleteCard={onDeleteCard}
              onRenameColumn={onRenameColumn}
              onDeleteColumn={onDeleteColumn}
              forceEdit={editingColId === col.id}
              onForceEditDone={() => setEditingColId(null)}
            />
          ))}
        </SortableContext>

        {/* Add column — inline form */}
        {addingColumn ? (
          <form
            onSubmit={handleAddColumn}
            className="shrink-0 w-72 bg-[#1e2028] border border-[#2e3140] rounded-xl p-3"
          >
            <input
              autoFocus
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAddingColumn(false)}
              placeholder="Nombre de la columna…"
              className="w-full bg-[#252830] border border-[#3d4155] rounded-lg px-2.5 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500 placeholder:text-[#555b70]"
            />
            <div className="flex gap-1.5 mt-2">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg py-1.5 font-medium transition-colors"
              >
                Añadir columna
              </button>
              <button
                type="button"
                onClick={() => { setAddingColumn(false); setNewColTitle(''); }}
                className="px-2 bg-[#252830] hover:bg-[#2e3140] text-[#8b90a0] rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddingColumn(true)}
            className="flex items-center gap-2 shrink-0 w-72 px-4 py-3 border-2 border-dashed border-[#2e3140] rounded-xl text-sm text-[#555b70] hover:text-[#8b90a0] hover:border-[#3d4155] transition-colors"
          >
            <Plus size={16} /> Añadir columna
          </button>
        )}

      </div>

      {/* Card modal */}
      {modalState && (
        <CardModal
          card={modalState.card}
          columnId={modalState.columnId}
          boardId={boardId}
          boards={boards}
          columns={columns}
          workspaceMembers={workspaceMembers}
          onSave={handleSave}
          onDelete={onDeleteCard}
          onClose={closeModal}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={
            contextMenu.type === 'card'   ? buildCardContextItems(contextMenu.card)     :
            contextMenu.type === 'column' ? buildColumnContextItems(contextMenu.column) :
            buildBoardContextItems()
          }
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
