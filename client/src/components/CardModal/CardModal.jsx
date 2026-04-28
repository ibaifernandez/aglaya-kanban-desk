import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Trash2, Tag, Pencil, Plus, GripVertical, Check, Paperclip, ZoomIn, FileText, File, Download } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PRIORITY_LIST } from '../../utils/constants.js';
import { useCategoriesCtx } from '../../context/CategoriesContext.jsx';
import { api } from '../../api/client.js';
import { useEscapeKey } from '../../hooks/useEscapeKey.js';

const EMPTY = {
  title: '', description: '', category: '',
  priority: 'none', dueDate: '', tags: [], checklist: [], checklistTitle: '', attachments: [], assigneeId: null,
};

// Normaliza el formato antiguo (array de strings) al nuevo ({ url, name, type })
function normalizeAttachments(card) {
  if (card.attachments) return card.attachments;
  if (card.images?.length) {
    return card.images.map((url) => ({
      url,
      name: url.split('/').pop(),
      type: 'image/jpeg',
    }));
  }
  return [];
}

function fileIcon(type) {
  if (type?.startsWith('image/')) return null; // usa thumbnail
  if (type === 'application/pdf') return <FileText size={18} className="text-red-400" />;
  if (type?.includes('spreadsheet') || type?.includes('csv') || type?.includes('excel'))
    return <FileText size={18} className="text-green-400" />;
  return <File size={18} className="text-[#8b90a0]" />;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Sortable checklist item ────────────────────────────────
function SortableCheckItem({ item, onToggle, onRemove, isEditing, editText, onEditStart, onEditChange, onEditConfirm, onEditCancel }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const editRef = useRef(null);

  useEffect(() => {
    if (isEditing) editRef.current?.focus();
  }, [isEditing]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 group/item py-0.5 ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Drag handle — oculto mientras se edita */}
      {isEditing ? (
        <div className="w-[13px] flex-shrink-0" />
      ) : (
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-[#3d4155] hover:text-[#555b70] flex-shrink-0 touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} />
        </button>
      )}

      <input
        type="checkbox"
        checked={item.done}
        onChange={() => onToggle(item.id)}
        className="accent-indigo-500 w-3.5 h-3.5 cursor-pointer flex-shrink-0"
      />

      {isEditing ? (
        <input
          ref={editRef}
          value={editText}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  { e.preventDefault(); onEditConfirm(); }
            if (e.key === 'Escape') { e.preventDefault(); onEditCancel();  }
          }}
          className="flex-1 bg-[#2e3140] border border-indigo-500/50 rounded px-1.5 py-0.5 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500"
        />
      ) : (
        <span
          onDoubleClick={() => onEditStart(item.id)}
          className={`flex-1 text-sm leading-snug transition-colors cursor-text ${
            item.done ? 'line-through text-[#555b70]' : 'text-[#e8eaf0]'
          }`}
        >
          {item.text}
        </span>
      )}

      {isEditing ? (
        <button
          type="button"
          onClick={onEditConfirm}
          className="p-0.5 text-indigo-400 hover:text-indigo-300 flex-shrink-0 transition-colors"
          title="Confirmar"
        >
          <Check size={13} />
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onEditStart(item.id)}
            className="opacity-0 group-hover/item:opacity-100 p-0.5 text-[#555b70] hover:text-indigo-400 transition-all flex-shrink-0"
            title="Editar"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="opacity-0 group-hover/item:opacity-100 p-0.5 text-[#555b70] hover:text-red-400 transition-all flex-shrink-0"
            title="Eliminar"
          >
            <X size={12} />
          </button>
        </>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────
export function CardModal({ card, columnId, boardId, boards = [], columns, workspaceMembers = [], onSave, onDelete, onClose }) {
  const isNew = !card?.id;
  const { categories } = useCategoriesCtx();
  const [form, setForm]                 = useState(EMPTY);
  const [tagInput, setTagInput]             = useState('');
  const [descPreview, setDescPreview]       = useState(false);
  const [checkInput, setCheckInput]         = useState('');
  const [editingCheckId, setEditingCheckId] = useState(null);
  const [editingCheckText, setEditingCheckText] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [selectedBoardId, setSelectedBoardId] = useState(boardId);
  const [availableColumns, setAvailableColumns] = useState(columns ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [xwsBoards,     setXwsBoards]     = useState(null);  // null = cargando, Array = listo
  const [xwsMap,        setXwsMap]        = useState(null);  // { workspaceId: workspace }
  const checkInputRef                   = useRef(null);

  useEscapeKey(() => {
    if (lightboxSrc) {
      setLightboxSrc(null);
      return;
    }
    onClose();
  });

  const checklistSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    setDescPreview(!isNew);   // existente → preview; nueva → editar directo
    setCheckInput('');
    setEditingCheckId(null);
    setEditingCheckText('');
    setSelectedBoardId(boardId);
    setAvailableColumns(columns ?? []);
    if (card) {
      setForm({
        title:          card.title          || '',
        description:    card.description    || '',
        category:       card.category       || categories[0]?.id || '',
        priority:       card.priority       || 'none',
        dueDate:        card.dueDate ? card.dueDate.slice(0, 10) : '',
        tags:           card.tags           || [],
        checklist:      card.checklist      || [],
        checklistTitle: card.checklistTitle || '',
        attachments:    normalizeAttachments(card),
        columnId:       card.columnId       || columnId,
        assigneeId:     card.assigneeId     || null,
      });
    } else {
      setForm({ ...EMPTY, category: categories[0]?.id || '', columnId });
    }
  }, [card, columnId, boardId, columns, categories]);

  // Fetch todos los tableros accesibles para el selector cross-workspace (solo en edición)
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    Promise.all([api.getBoards(), api.getWorkspaces()])
      .then(([bds, wss]) => {
        if (cancelled) return;
        const accessibleIds = new Set(wss.map((w) => w.id));
        setXwsBoards(bds.filter((b) => accessibleIds.has(b.workspaceId)));
        setXwsMap(Object.fromEntries(wss.map((w) => [w.id, w])));
      })
      .catch(() => { /* mantener null — el selector vuelve a boards prop */ });
    return () => { cancelled = true; };
  }, [isNew]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ── Tags ─────────────────────────────────────────────────
  function addTag(e) {
    e?.preventDefault();
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag && !form.tags.includes(tag)) set('tags', [...form.tags, tag]);
    setTagInput('');
  }
  function removeTag(tag) {
    set('tags', form.tags.filter((t) => t !== tag));
  }

  // ── Checklist ─────────────────────────────────────────────
  function addCheckItem() {
    const text = checkInput.trim();
    if (!text) return;
    set('checklist', [...form.checklist, { id: uid(), text, done: false }]);
    setCheckInput('');
    checkInputRef.current?.focus();
  }
  function toggleCheckItem(id) {
    set('checklist', form.checklist.map((i) => i.id === id ? { ...i, done: !i.done } : i));
  }
  function removeCheckItem(id) {
    set('checklist', form.checklist.filter((i) => i.id !== id));
  }
  function handleChecklistDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const oldIdx = form.checklist.findIndex((i) => i.id === active.id);
    const newIdx = form.checklist.findIndex((i) => i.id === over.id);
    set('checklist', arrayMove(form.checklist, oldIdx, newIdx));
  }
  function startEditCheckItem(id) {
    const item = form.checklist.find((i) => i.id === id);
    if (!item) return;
    setEditingCheckId(id);
    setEditingCheckText(item.text);
  }
  function confirmEditCheckItem() {
    const text = editingCheckText.trim();
    if (text) set('checklist', form.checklist.map((i) => i.id === editingCheckId ? { ...i, text } : i));
    setEditingCheckId(null);
    setEditingCheckText('');
  }
  function cancelEditCheckItem() {
    setEditingCheckId(null);
    setEditingCheckText('');
  }

  // ── Attachments ───────────────────────────────────────────
  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    e.target.value = '';
    setUploadingCount((n) => n + files.length);
    for (const file of files) {
      try {
        const attachment = await api.uploadFile(file); // { url, name, type }
        setForm((prev) => ({ ...prev, attachments: [...prev.attachments, attachment] }));
      } catch (err) {
        console.error('Error subiendo archivo:', err);
      } finally {
        setUploadingCount((n) => n - 1);
      }
    }
  }
  async function removeAttachment(url) {
    const filename = url.split('/').pop();
    set('attachments', form.attachments.filter((a) => a.url !== url));
    try { await api.deleteFile(filename); } catch {}
  }

  // ── Board change → fetch columns of destination board ────
  async function handleBoardChange(newBoardId) {
    setSelectedBoardId(newBoardId);
    try {
      const cols = await api.getColumns(newBoardId);
      setAvailableColumns(cols);
      set('columnId', cols[0]?.id ?? '');
    } catch {
      setAvailableColumns([]);
    }
  }

  // ── Submit ────────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const isCrossBoard = selectedBoardId !== boardId;
    onSave({
      ...form,
      title:    form.title.trim(),
      dueDate:  form.dueDate || null,
      boardId:  selectedBoardId,
      columnId: form.columnId || columnId,
      ...(isCrossBoard && {
        targetBoardTitle: displayBoards.find((b) => b.id === selectedBoardId)?.title,
      }),
    });
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const checkTotal = form.checklist.length;
  const checkDone  = form.checklist.filter((i) => i.done).length;
  const checkPct   = checkTotal > 0 ? (checkDone / checkTotal) * 100 : 0;
  const allDone    = checkTotal > 0 && checkDone === checkTotal;

  // Tableros a mostrar: cross-workspace cuando están cargados, mismo workspace como fallback
  const displayBoards   = xwsBoards !== null ? xwsBoards : boards;
  const showBoardPicker = !isNew && displayBoards.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-lg bg-[#1e2028] rounded-xl border border-[#2e3140] shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3140]">
          <h2 className="text-sm font-semibold text-[#e8eaf0]">
            {isNew ? 'Nueva tarea' : 'Editar tarea'}
          </h2>
          <div className="flex items-center gap-1">
            {!isNew && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded text-[#555b70] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Eliminar tarea"
              >
                <Trash2 size={15} />
              </button>
            )}
            {!isNew && confirmDelete && (
              <div className="flex items-center gap-1.5 mr-1">
                <span className="text-[11px] text-red-400">¿Eliminar?</span>
                <button
                  type="button"
                  onClick={() => { onDelete(card.id); onClose(); }}
                  className="px-2 py-0.5 rounded text-[11px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 rounded text-[11px] bg-[#2e3140] text-[#9aa0b8] hover:bg-[#3a3f52] transition-colors"
                >
                  No
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-[#555b70] hover:text-[#e8eaf0] hover:bg-[#2e3140] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Title */}
          <div>
            <label className="block text-xs text-[#8b90a0] mb-1">Título *</label>
            <input
              autoFocus
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="¿Qué hay que hacer?"
              className="w-full bg-[#252830] border border-[#2e3140] rounded-lg px-3 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500 placeholder:text-[#555b70]"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[#8b90a0]">Descripción</label>
              {!descPreview && (
                <button
                  type="button"
                  onClick={() => setDescPreview(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  title="Confirmar"
                >
                  <Check size={10} /> Listo
                </button>
              )}
            </div>

            {descPreview ? (
              <div
                className="
                  relative group/desc cursor-pointer
                  w-full min-h-[80px] bg-[#252830] border border-[#2e3140] rounded-lg px-3 py-2 text-sm text-[#e8eaf0]
                  hover:border-[#3d4155] transition-colors
                  [&_p]:mb-2 [&_p:last-child]:mb-0
                  [&_a]:text-indigo-400 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-indigo-300
                  [&_strong]:font-semibold [&_em]:italic
                  [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1
                  [&_h2]:text-sm  [&_h2]:font-bold [&_h2]:mb-1
                  [&_h3]:text-sm  [&_h3]:font-semibold [&_h3]:mb-1
                  [&_ul]:list-disc   [&_ul]:pl-4 [&_ul]:space-y-0.5
                  [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:space-y-0.5
                  [&_li]:text-sm
                  [&_code]:bg-[#2e3140] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:text-indigo-300 [&_code]:font-mono
                  [&_pre]:bg-[#2e3140] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:mb-2
                  [&_blockquote]:border-l-2 [&_blockquote]:border-[#3d4155] [&_blockquote]:pl-3 [&_blockquote]:text-[#8b90a0] [&_blockquote]:italic
                  [&_hr]:border-[#2e3140] [&_hr]:my-2
                "
                onClick={() => setDescPreview(false)}
                title="Editar descripción"
              >
                {form.description
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.description}</ReactMarkdown>
                  : <span className="text-[#555b70] italic text-xs">Sin descripción. Haz clic para escribir…</span>
                }
                {/* Lápiz flotante */}
                <span className="absolute top-2 right-2 opacity-0 group-hover/desc:opacity-100 transition-opacity p-1 rounded bg-[#1e2028]/80 text-[#555b70]">
                  <Pencil size={11} />
                </span>
              </div>
            ) : (
              <textarea
                autoFocus
                rows={4}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setDescPreview(true);
                  }
                }}
                placeholder={"Acepta **Markdown**: _cursiva_, [enlace](https://...), `código`…"}
                className="w-full bg-[#252830] border border-indigo-500/50 rounded-lg px-3 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500 resize-none placeholder:text-[#555b70] font-mono"
              />
            )}
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <input
                type="text"
                value={form.checklistTitle}
                onChange={(e) => set('checklistTitle', e.target.value)}
                placeholder="Checklist"
                className="text-xs text-[#8b90a0] bg-transparent border-b border-transparent hover:border-[#3d4155] focus:border-indigo-500 outline-none w-32 transition-colors placeholder:text-[#555b70]"
              />
              {checkTotal > 0 && (
                <span className={`text-xs font-mono ${allDone ? 'text-green-400' : 'text-[#555b70]'}`}>
                  {checkDone} / {checkTotal}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {checkTotal > 0 && (
              <div className="h-1.5 bg-[#2e3140] rounded-full mb-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${allDone ? 'bg-green-500' : 'bg-indigo-500'}`}
                  style={{ width: `${checkPct}%` }}
                />
              </div>
            )}

            {/* Sortable items */}
            {form.checklist.length > 0 && (
              <DndContext
                sensors={checklistSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleChecklistDragEnd}
              >
                <SortableContext
                  items={form.checklist.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1 mb-2">
                    {form.checklist.map((item) => (
                      <SortableCheckItem
                        key={item.id}
                        item={item}
                        onToggle={toggleCheckItem}
                        onRemove={removeCheckItem}
                        isEditing={editingCheckId === item.id}
                        editText={editingCheckText}
                        onEditStart={startEditCheckItem}
                        onEditChange={setEditingCheckText}
                        onEditConfirm={confirmEditCheckItem}
                        onEditCancel={cancelEditCheckItem}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Add item */}
            <div className="flex gap-2">
              <input
                ref={checkInputRef}
                value={checkInput}
                onChange={(e) => setCheckInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addCheckItem(); }
                }}
                placeholder="Añadir elemento al checklist…"
                className="flex-1 bg-[#252830] border border-[#2e3140] rounded-lg px-2.5 py-1.5 text-xs text-[#e8eaf0] outline-none focus:border-indigo-500 placeholder:text-[#555b70]"
              />
              <button
                type="button"
                onClick={addCheckItem}
                className="px-2.5 py-1.5 bg-[#252830] border border-[#2e3140] rounded-lg text-[#8b90a0] hover:text-indigo-400 hover:border-indigo-500 transition-colors"
                title="Añadir"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Responsable */}
          {workspaceMembers.length > 0 && (
            <div>
              <label className="block text-xs text-[#8b90a0] mb-1">Responsable</label>
              <select
                value={form.assigneeId ?? ''}
                onChange={(e) => set('assigneeId', e.target.value || null)}
                className="w-full bg-[#252830] border border-[#2e3140] rounded-lg px-2.5 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500"
              >
                <option value="">Sin responsable</option>
                {workspaceMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email}</option>
                ))}
              </select>
            </div>
          )}

          {/* Row: category + priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#8b90a0] mb-1">Categoría</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full bg-[#252830] border border-[#2e3140] rounded-lg px-2.5 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500"
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8b90a0] mb-1">Prioridad</label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                className="w-full bg-[#252830] border border-[#2e3140] rounded-lg px-2.5 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500"
              >
                {PRIORITY_LIST.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row: due date + column */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#8b90a0] mb-1">Fecha límite</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
                className="w-full bg-[#252830] border border-[#2e3140] rounded-lg px-2.5 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
            </div>
            {!isNew && availableColumns?.length > 0 && (
              <div>
                <label className="block text-xs text-[#8b90a0] mb-1">Columna</label>
                <select
                  value={form.columnId}
                  onChange={(e) => set('columnId', e.target.value)}
                  className="w-full bg-[#252830] border border-[#2e3140] rounded-lg px-2.5 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500"
                >
                  {availableColumns.map((col) => <option key={col.id} value={col.id}>{col.title}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Selector de tablero — mismo workspace de inmediato, cross-workspace al cargar */}
          {showBoardPicker && (
            <div>
              <label className="block text-xs text-[#8b90a0] mb-1">Mover a tablero</label>
              <select
                value={selectedBoardId}
                onChange={(e) => handleBoardChange(e.target.value)}
                className="w-full bg-[#252830] border border-[#2e3140] rounded-lg px-2.5 py-2 text-sm text-[#e8eaf0] outline-none focus:border-indigo-500"
              >
                {xwsMap !== null
                  ? Object.entries(
                      displayBoards.reduce((acc, b) => {
                        (acc[b.workspaceId] ??= []).push(b);
                        return acc;
                      }, {})
                    ).map(([wsId, wsBoards]) => {
                      const ws    = xwsMap[wsId];
                      const label = ws ? `${ws.emoji ?? ''} ${ws.name}`.trim() : 'Espacio de trabajo';
                      return (
                        <optgroup key={wsId} label={label}>
                          {wsBoards.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.id === boardId ? `${b.title} (actual)` : b.title}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })
                  : displayBoards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id === boardId ? `${b.title} (actual)` : b.title}
                      </option>
                    ))
                }
              </select>
            </div>
          )}

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#8b90a0]">
                Archivos {uploadingCount > 0 && <span className="text-indigo-400 ml-1">subiendo…</span>}
              </label>
              <label className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[#555b70] hover:text-indigo-400 cursor-pointer transition-colors border border-[#2e3140] hover:border-indigo-500/50">
                <Paperclip size={10} /> Adjuntar
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            {form.attachments.length > 0 && (
              <div className="space-y-1.5">
                {/* Thumbnails de imágenes — grid 3 columnas */}
                {(() => {
                  const imgs = form.attachments.filter((a) => a.type?.startsWith('image/'));
                  const docs = form.attachments.filter((a) => !a.type?.startsWith('image/'));
                  return (
                    <>
                      {imgs.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {imgs.map((att) => (
                            <div
                              key={att.url}
                              className="relative group/img aspect-video rounded-lg overflow-hidden bg-[#252830] border border-[#2e3140] hover:border-[#3d4155] transition-colors"
                            >
                              <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover/img:opacity-100">
                                <button type="button" onClick={() => setLightboxSrc(att.url)} className="p-1 rounded-full bg-black/60 text-white hover:bg-white/20 transition-colors" title="Ver a tamaño completo">
                                  <ZoomIn size={13} />
                                </button>
                                <button type="button" onClick={() => removeAttachment(att.url)} className="p-1 rounded-full bg-black/60 text-white hover:bg-red-500/80 transition-colors" title="Eliminar">
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Fichas de documentos */}
                      {docs.map((att) => (
                        <div key={att.url} className="flex items-center gap-2.5 bg-[#252830] border border-[#2e3140] hover:border-[#3d4155] rounded-lg px-3 py-2 group/doc transition-colors">
                          <span className="flex-shrink-0">{fileIcon(att.type)}</span>
                          <span className="flex-1 text-xs text-[#c8cadd] truncate" title={att.name}>{att.name}</span>
                          <a
                            href={att.url}
                            download={att.name}
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover/doc:opacity-100 p-1 text-[#555b70] hover:text-indigo-400 transition-all flex-shrink-0"
                            title="Descargar"
                          >
                            <Download size={12} />
                          </a>
                          <button type="button" onClick={() => removeAttachment(att.url)} className="opacity-0 group-hover/doc:opacity-100 p-1 text-[#555b70] hover:text-red-400 transition-all flex-shrink-0" title="Eliminar">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-[#8b90a0] mb-1">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 bg-[#252830] border border-[#2e3140] text-[#8b90a0] text-xs px-2 py-0.5 rounded-full">
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-[#555b70] hover:text-red-400">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(e); } }}
                placeholder="Añadir tag…"
                className="flex-1 bg-[#252830] border border-[#2e3140] rounded-lg px-2.5 py-1.5 text-xs text-[#e8eaf0] outline-none focus:border-indigo-500 placeholder:text-[#555b70]"
              />
              <button type="button" onClick={addTag} className="px-2.5 py-1.5 bg-[#252830] border border-[#2e3140] rounded-lg text-[#8b90a0] hover:text-indigo-400 hover:border-indigo-500 transition-colors">
                <Tag size={13} />
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-1">
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg py-2.5 transition-colors"
            >
              {isNew ? 'Crear tarea' : 'Guardar cambios'}
            </button>
          </div>

        </form>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxSrc(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
