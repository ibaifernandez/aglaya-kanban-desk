import { Calendar, CheckSquare, Paperclip } from 'lucide-react';
import { PRIORITIES, colorById } from '../../utils/constants.js';
import { isOverdue, formatDate, daysUntil } from '../../utils/dates.js';
import { Badge } from '../UI/Badge.jsx';
import { useCategoriesCtx } from '../../context/CategoriesContext.jsx';

export function Card({ card, onClick, dragHandleProps = {}, style = {}, isDragging = false }) {
  const { categories } = useCategoriesCtx();
  const catDef   = categories.find((c) => c.id === card.category);
  const catColor  = catDef ? colorById(catDef.colorId).badge : 'bg-[#2e3140] text-[#555b70]';
  const category  = { label: catDef?.label ?? card.category, color: catColor };
  const priority  = PRIORITIES[card.priority] ?? PRIORITIES.none;
  const overdue  = isOverdue(card.dueDate);
  const dateStr  = formatDate(card.dueDate);
  const days     = daysUntil(card.dueDate);
  const daysLabel = days === null ? null
    : days < 0  ? `${Math.abs(days)}d`
    : days === 0 ? 'hoy'
    : `${days}d`;
  const daysColor = days === null ? ''
    : days <= 0  ? 'text-red-400'
    : days <= 3  ? 'text-amber-400'
    : 'text-[#555b70]';

  const checklist  = card.checklist ?? [];
  const checkTotal = checklist.length;
  const checkDone  = checklist.filter((i) => i.done).length;
  const checkPct   = checkTotal > 0 ? (checkDone / checkTotal) * 100 : 0;
  const allDone    = checkTotal > 0 && checkDone === checkTotal;

  // Strip markdown symbols for a clean plain-text preview
  const descPlain = card.description
    ? card.description.replace(/[#*`_~>[\]!]/g, '').replace(/\(https?[^)]+\)/g, '').trim()
    : '';

  return (
    <div
      data-card-id={card.id}
      onClick={onClick}
      style={style}
      className={`
        group relative bg-[#252830] rounded-lg px-3 py-2.5 cursor-pointer
        border-l-[3px] ${priority.border}
        border border-transparent hover:border-[#3d4155]
        transition-colors select-none
        ${card.priority === 'urgent' ? 'shadow-[0_0_0_1px_rgba(168,85,247,0.55),0_0_18px_rgba(168,85,247,0.5),0_0_36px_rgba(168,85,247,0.2)]' : ''}
        ${isDragging ? 'opacity-50 shadow-2xl ring-1 ring-indigo-500/50' : ''}
      `}
      {...dragHandleProps}
    >
      {/* Urgent glow ring */}
      {card.priority === 'urgent' && (
        <span className="absolute inset-0 rounded-lg ring-1 ring-purple-500/50 pointer-events-none" />
      )}

      {/* Days counter — top right (only when dueDate exists) */}
      {daysLabel && (
        <span
          className={`absolute top-2 right-2.5 text-[10px] font-semibold tabular-nums ${daysColor}`}
          title={days <= 0 ? `Vencida hace ${Math.abs(days)} día(s)` : `${days} día(s) restante(s)`}
        >
          {days < 0 ? `-${daysLabel}` : daysLabel}
        </span>
      )}

      {/* Title */}
      <p className="text-sm text-[#e8eaf0] font-medium leading-snug line-clamp-2 mb-1 pr-4">
        {card.title}
      </p>

      {/* Description preview (plain text, 1 line) */}
      {descPlain && (
        <p className="text-xs text-[#555b70] leading-snug line-clamp-1 mb-1.5">
          {descPlain}
        </p>
      )}

      {/* Checklist progress */}
      {checkTotal > 0 && (
        <div className="mb-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckSquare size={10} className={allDone ? 'text-green-400' : 'text-[#555b70]'} />
            <span className={`text-[10px] ${allDone ? 'text-green-400' : 'text-[#555b70]'}`}>
              {checkDone} / {checkTotal}
            </span>
          </div>
          <div className="h-[3px] bg-[#2e3140] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${allDone ? 'bg-green-500' : 'bg-indigo-500'}`}
              style={{ width: `${checkPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Category badge */}
        <Badge label={category.label} className={category.color} />

        {/* Priority dot (hidden when priority = none) */}
        {priority.dot && (
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${priority.dot}`} title={priority.label} />
        )}

        {/* Tags (first 2) */}
        {card.tags?.slice(0, 2).map((tag) => (
          <Badge key={tag} label={`#${tag}`} className="bg-[#2e3140] text-[#555b70]" />
        ))}

        {/* Attachment count */}
        {(card.attachments?.length > 0 || card.images?.length > 0) && (
          <span className="flex items-center gap-0.5 text-[10px] text-[#555b70]" title="Archivos adjuntos">
            <Paperclip size={10} />
            {card.attachments?.length ?? card.images?.length}
          </span>
        )}

        {/* Assignee avatar */}
        {card.assignee && (
          <span
            className="ml-auto w-5 h-5 rounded-full bg-indigo-700 flex items-center justify-center text-[9px] font-semibold text-white flex-shrink-0"
            title={card.assignee.name || card.assignee.email}
          >
            {(card.assignee.name || card.assignee.email).charAt(0).toUpperCase()}
          </span>
        )}

        {/* Due date */}
        {dateStr && (
          <span className={`${card.assignee ? '' : 'ml-auto'} flex items-center gap-1 text-[10px] ${overdue ? 'text-red-400' : 'text-[#555b70]'}`}>
            <Calendar size={10} />
            {dateStr}
          </span>
        )}
      </div>
    </div>
  );
}
