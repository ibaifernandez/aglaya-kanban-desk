import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { api } from './api/client.js';
import LoginPage from './pages/LoginPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import WorkspaceDashboard from './pages/WorkspaceDashboard.jsx';
import { WorkspaceMembers } from './components/Workspace/WorkspaceMembers.jsx';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Sidebar }  from './components/Sidebar/Sidebar.jsx';
import { Toolbar }  from './components/Toolbar/Toolbar.jsx';
import { Board }    from './components/Board/Board.jsx';
import { Card }     from './components/Card/Card.jsx';
import { Spinner }  from './components/UI/Spinner.jsx';
import { ColumnPickerModal } from './components/UI/ColumnPickerModal.jsx';
import { useBoards }      from './hooks/useBoards.js';
import { useBoardData }   from './hooks/useBoardData.js';
import { useCategories }  from './hooks/useCategories.js';
import { CategoriesContext } from './context/CategoriesContext.jsx';

export default function App() {
  const { isAuthenticated, user, logout, updateUser } = useAuth();

  // Supabase recovery links land on / with type=recovery in the hash
  const hash = window.location.hash;
  if (
    window.location.pathname === '/reset-password' ||
    (hash.includes('type=recovery') && hash.includes('access_token='))
  ) {
    return <ResetPasswordPage onDone={() => { logout(); window.location.replace('/'); }} />;
  }

  if (!isAuthenticated) {
    sessionStorage.removeItem('lfi_session');
    return <LoginPage />;
  }

  return <AuthenticatedApp user={user} logout={logout} updateUser={updateUser} />;
}

function restoreSession() {
  try {
    const raw = sessionStorage.getItem('lfi_session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function AuthenticatedApp({ user, logout, updateUser }) {
  const saved = restoreSession();
  const [view, setView]                       = useState(saved?.view ?? 'workspaces');
  const [activeWorkspace, setActiveWorkspace] = useState(saved?.workspace ?? null);
  const [showMembers,     setShowMembers]     = useState(false);

  const { boards, loading: loadingBoards, createBoard, updateBoard, deleteBoard, reorderBoards } = useBoards(activeWorkspace?.id);
  const {
    categories, loading: loadingCategories,
    createCategory, updateCategory, deleteCategory,
  } = useCategories();

  const [activeBoardId, setActiveBoardId] = useState(saved?.boardId ?? null);
  const [filters, setFilters] = useState({ category: '', priority: '', tag: '', search: '', assignee: '', overdue: false });
  const [workspaceMembers, setWorkspaceMembers] = useState([]);

  // ── History API navigation ────────────────────────────────────────────────
  // Central navigate: updates React state + writes browser history entry
  function navigate(nextView, workspace = null) {
    const state = { view: nextView, workspace };
    window.history.pushState(state, '');
    setView(nextView);
    setActiveWorkspace(workspace);
  }

  // Handle browser back/forward
  useEffect(() => {
    function onPopState(e) {
      const state = e.state;
      if (!state) { setView('workspaces'); setActiveWorkspace(null); return; }
      setView(state.view ?? 'workspaces');
      setActiveWorkspace(state.workspace ?? null);
      if (state.view !== 'board') setActiveBoardId(null);
    }
    window.addEventListener('popstate', onPopState);
    // Write initial history entry so back from first view stays in-app
    window.history.replaceState({ view, workspace: activeWorkspace }, '');
    return () => window.removeEventListener('popstate', onPopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist session so page refresh restores the current view
  useEffect(() => {
    try {
      sessionStorage.setItem('lfi_session', JSON.stringify({
        view,
        workspace: activeWorkspace,
        boardId:   activeBoardId,
      }));
    } catch { /* ignore */ }
  }, [view, activeWorkspace, activeBoardId]);

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    api.getWorkspaceMembers(activeWorkspace.id)
      .then((members) => setWorkspaceMembers(members.map((m) => m.user).filter(Boolean)))
      .catch(() => setWorkspaceMembers([]));
  }, [activeWorkspace?.id]);

  // Drag state
  const [activeCard,       setActiveCard]       = useState(null);
  const [activeColumn,     setActiveColumn]     = useState(null);
  const [pendingCrossBoard, setPendingCrossBoard] = useState(null); // { card, targetBoard }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Pick first board once loaded; explicit selection overrides
  const boardId = activeBoardId ?? boards[0]?.id ?? null;

  const {
    columns, cards, loading: loadingBoard,
    createColumn, updateColumn, deleteColumn, reorderColumns,
    createCard, updateCard, moveCard, deleteCard,
  } = useBoardData(boardId);

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleEnterWorkspace(ws) {
    setActiveBoardId(null);
    navigate('board', ws);
  }

  // Auto-navigate to newly created board
  async function handleCreateBoard(title) {
    const board = await createBoard(title);
    setActiveBoardId(board.id);
    return board;
  }

  // Clear filters when switching boards
  function handleSelectBoard(id) {
    setActiveBoardId(id);
    setFilters({ category: '', priority: '', tag: '', search: '', assignee: '', overdue: false });
  }

  // ⌘1–9 / Ctrl+1–9 — navigate to board by position (like Slack channels)
  useEffect(() => {
    function handleKeyDown(e) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const digit = parseInt(e.key, 10);
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;
      const board = boards[digit - 1];
      if (board) {
        e.preventDefault();
        setActiveBoardId(board.id);
        setFilters({ category: '', priority: '', tag: '', search: '', assignee: '', overdue: false });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [boards]);

  // Unique sorted tags across all cards in the current board
  const availableTags = [...new Set(cards.flatMap((c) => c.tags || []))].sort();

  const activeBoard = boards.find((b) => b.id === boardId);

  // ── Unified drag handlers ──────────────────────────────────
  function handleDragStart({ active }) {
    const type = active.data.current?.type;
    if (type === 'column') {
      setActiveColumn(columns.find((c) => c.id === active.id) ?? null);
    } else if (type === 'card') {
      setActiveCard(cards.find((c) => c.id === active.id) ?? null);
    }
  }

  function handleDragEnd({ active, over }) {
    setActiveCard(null);
    setActiveColumn(null);
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;
    const overType   = over.data.current?.type;

    // ── Board reorder (sidebar drag) ─────────────────────────
    if (activeType === 'board' && overType === 'board') {
      const oldIdx = boards.findIndex((b) => b.id === active.id);
      const newIdx = boards.findIndex((b) => b.id === over.id);
      if (oldIdx !== newIdx) reorderBoards(arrayMove(boards, oldIdx, newIdx).map((b) => b.id));
      return;
    }

    // ── Card dropped on sidebar board → column picker ─────────
    if (activeType === 'card' && overType === 'board') {
      const card        = cards.find((c) => c.id === active.id);
      const targetBoard = boards.find((b) => b.id === over.id);
      if (card && targetBoard && targetBoard.id !== boardId) {
        setPendingCrossBoard({ card, targetBoard });
      }
      return;
    }

    // ── Column reorder ───────────────────────────────────────
    if (activeType === 'column') {
      const overAsColumn = columns.find((c) => c.id === over.id);
      const overAsCard   = !overAsColumn ? cards.find((c) => c.id === over.id) : null;
      const destColumn   = overAsColumn ?? (overAsCard ? columns.find((c) => c.id === overAsCard.columnId) : null);
      if (!destColumn || destColumn.id === active.id) return;
      const oldIdx = columns.findIndex((c) => c.id === active.id);
      const newIdx = columns.findIndex((c) => c.id === destColumn.id);
      if (oldIdx !== newIdx) reorderColumns(arrayMove([...columns], oldIdx, newIdx));
      return;
    }

    // ── Card move within board ───────────────────────────────
    const draggedCard = cards.find((c) => c.id === active.id);
    if (!draggedCard) return;

    const overCard  = cards.find((c) => c.id === over.id);
    const destColId = overCard ? overCard.columnId : over.id;
    const destCol   = columns.find((c) => c.id === destColId);
    if (!destCol) return;

    const destCards = cards
      .filter((c) => c.columnId === destColId && c.id !== draggedCard.id)
      .sort((a, b) => a.order - b.order);

    const newOrder = overCard
      ? destCards.findIndex((c) => c.id === overCard.id) + 1
      : destCards.length + 1;

    moveCard(draggedCard.id, destColId, newOrder);
  }

  if (view === 'workspaces') {
    return (
      <WorkspaceDashboard
        user={user}
        onEnterWorkspace={handleEnterWorkspace}
        onLogout={logout}
        onOpenAdmin={() => navigate('admin')}
        onAvatarChange={(url) => updateUser({ avatarUrl: url })}
      />
    );
  }

  if (view === 'admin') {
    return <AdminPage user={user} onBack={() => navigate('workspaces')} />;
  }

  if (loadingBoards || loadingCategories) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0f1117]">
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <CategoriesContext.Provider value={{ categories, createCategory, updateCategory, deleteCategory }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-screen bg-[#0f1117] overflow-hidden">
          <Sidebar
            boards={boards}
            activeBoardId={boardId}
            onSelect={handleSelectBoard}
            onCreate={handleCreateBoard}
            onRename={updateBoard}
            onDelete={deleteBoard}
            isDraggingCard={!!activeCard}
          />

          <div className="flex flex-col flex-1 min-w-0">
            <Toolbar
              boardTitle={activeBoard?.title ?? '—'}
              filters={filters}
              onFilterChange={handleFilterChange}
              availableTags={availableTags}
              workspaceMembers={workspaceMembers}
              onSelectBoard={handleSelectBoard}
              user={user}
              onLogout={logout}
              onOpenAdmin={() => navigate('admin')}
              workspace={activeWorkspace}
              onBackToWorkspaces={() => navigate('workspaces')}
              onOpenMembers={() => setShowMembers(true)}
              onAvatarChange={(url) => updateUser({ avatarUrl: url })}
            />

            {boardId ? (
              <Board
                boardId={boardId}
                boards={boards}
                columns={columns}
                cards={cards}
                loading={loadingBoard}
                filters={filters}
                workspaceMembers={workspaceMembers}
                onCreateColumn={createColumn}
                onRenameColumn={(id, title) => updateColumn(id, { title })}
            onUpdateColumn={updateColumn}
                onDeleteColumn={deleteColumn}
                onReorderColumns={reorderColumns}
                onCreateCard={createCard}
                onUpdateCard={updateCard}
                onMoveCard={moveCard}
                onDeleteCard={deleteCard}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#555b70] text-sm">
                Crea tu primer tablero en la barra lateral.
              </div>
            )}
          </div>
        </div>

        {/* Drag overlays */}
        <DragOverlay dropAnimation={null}>
          {activeCard && (
            <div className="rotate-1 opacity-90 w-72">
              <Card card={activeCard} isDragging />
            </div>
          )}
          {activeColumn && (
            <div className="opacity-90 rotate-1 w-72 bg-[#1e2028] border border-indigo-500/50 rounded-xl px-3 py-2.5">
              <span className="text-sm font-semibold text-[#e8eaf0]">{activeColumn.title}</span>
            </div>
          )}
        </DragOverlay>

        {/* Workspace members panel */}
        {showMembers && activeWorkspace && (
          <WorkspaceMembers
            workspace={activeWorkspace}
            currentUser={user}
            onClose={() => setShowMembers(false)}
          />
        )}

        {/* Cross-board column picker */}
        {pendingCrossBoard && (
          <ColumnPickerModal
            board={pendingCrossBoard.targetBoard}
            card={pendingCrossBoard.card}
            onSelect={(col) => {
              moveCard(pendingCrossBoard.card.id, col.id, 1);
              setPendingCrossBoard(null);
            }}
            onClose={() => setPendingCrossBoard(null)}
          />
        )}
      </DndContext>
    </CategoriesContext.Provider>
  );
}
