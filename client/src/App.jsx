import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { api } from './api/client.js';
import LoginPage from './pages/LoginPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import WorkspaceDashboard from './pages/WorkspaceDashboard.jsx';
import { WorkspaceMembers } from './components/Workspace/WorkspaceMembers.jsx';
import { WorkspaceSettings } from './components/Workspace/WorkspaceSettings.jsx';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
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
import { clearUiState, readUiState, writeUiState } from './utils/session.js';

export default function App() {
  const { isAuthenticated, user, logout, updateUser } = useAuth();

  // Supabase recovery/invite links land on / with access_token in the hash.
  // Invitations use a recovery token but include ?flow=invite in the URL.
  const hash = window.location.hash;
  const searchParams = new URLSearchParams(window.location.search);
  const isInvite   = (hash.includes('type=invite') && hash.includes('access_token='))
                   || (searchParams.get('flow') === 'invite' && hash.includes('access_token='));
  const isRecovery = hash.includes('type=recovery') && hash.includes('access_token=');
  if (window.location.pathname === '/reset-password' || isRecovery || isInvite) {
    return (
      <ResetPasswordPage
        isInvite={isInvite}
        onDone={isInvite
          ? () => window.location.replace('/')
          : () => { logout(); window.location.replace('/'); }}
      />
    );
  }

  if (!isAuthenticated) {
    clearUiState();
    return <LoginPage />;
  }

  return <AuthenticatedApp user={user} logout={logout} updateUser={updateUser} />;
}

function restoreSession() {
  return readUiState();
}

function AuthenticatedApp({ user, logout, updateUser }) {
  const saved = restoreSession();
  const [view, setView]                       = useState(saved?.view ?? 'workspaces');
  const [activeWorkspace, setActiveWorkspace] = useState(saved?.workspace ?? null);
  const [showMembers,     setShowMembers]     = useState(false);
  const [showWsSettings,  setShowWsSettings]  = useState(false);

  const { boards, loading: loadingBoards, createBoard, updateBoard, deleteBoard, reorderBoards, moveBoard } = useBoards(activeWorkspace?.id);

  const [activeBoardId, setActiveBoardId] = useState(saved?.boardId ?? null);
  const [filters, setFilters] = useState({ category: '', priority: '', tag: '', search: '', assignee: '', overdue: false });
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [pendingOpenCardId, setPendingOpenCardId] = useState(null);

  // Derive active boardId — explicit selection wins, otherwise first board
  const boardId = activeBoardId ?? boards[0]?.id ?? null;

  const {
    categories, loading: loadingCategories,
    createCategory, updateCategory, deleteCategory,
  } = useCategories(boardId);

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
    writeUiState({
      view,
      workspace: activeWorkspace,
      boardId: activeBoardId,
    });
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

  // KeyboardSensor habilita drag-and-drop para usuarios sin mouse/touch.
  // Hallazgo A-02 audit Mariana — WCAG 2.1.1 Level A.
  // sortableKeyboardCoordinates maneja el cálculo de drop targets via flechas.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  // Navigate from a notification: switch to the target workspace + board and
  // open the card modal once Board.jsx has the card in state.
  async function handleNotificationNavigate(notif) {
    const { workspaceId, boardId: targetBoardId, cardId } = notif.payload ?? {};
    if (!workspaceId || !cardId) return;

    try {
      let workspace = activeWorkspace?.id === workspaceId ? activeWorkspace : null;
      if (!workspace) {
        const all = await api.getWorkspaces();
        workspace = all.find((w) => w.id === workspaceId) ?? null;
      }
      if (!workspace) return; // user is not (or no longer) member

      navigate('board', workspace);
      if (targetBoardId) setActiveBoardId(targetBoardId);
      setPendingOpenCardId(cardId);
    } catch (err) {
      console.error('[notifications] navigate failed:', err);
    }
  }

  function handleWorkspaceSettingsSave(updatedWs) {
    setActiveWorkspace((prev) => ({ ...prev, ...updatedWs }));
  }

  // Auto-navigate to newly created board
  async function handleCreateBoard(title) {
    const board = await createBoard(title);
    setActiveBoardId(board.id);
    return board;
  }

  // Move board to another workspace — remove from list and clear active if needed
  async function handleMoveBoard(id, workspaceId) {
    await moveBoard(id, workspaceId);
    if (activeBoardId === id) setActiveBoardId(null);
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
  const workspaceRole = activeWorkspace?.myRole;
  const canCreateBoards = ['owner', 'admin', 'member'].includes(workspaceRole);
  const canRenameOrDeleteBoards = ['owner', 'admin', 'member'].includes(workspaceRole);
  const canMoveBoards = ['owner', 'admin'].includes(workspaceRole);

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
        onNotificationNavigate={handleNotificationNavigate}
      />
    );
  }

  if (view === 'admin') {
    return (
      <AdminPage
        user={user}
        onBack={() => navigate('workspaces')}
        onLogout={logout}
        onAvatarChange={(url) => updateUser({ avatarUrl: url })}
      />
    );
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
          {/* Skip-to-content link (A-19 audit Mariana — WCAG 2.4.1 Level A).
              Oculto hasta focus por teclado; permite saltar Sidebar+Toolbar
              y aterrizar directo en el contenido. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            Saltar al contenido principal
          </a>

          <Sidebar
            boards={boards}
            activeBoardId={boardId}
            currentWorkspaceId={activeWorkspace?.id}
            workspaceRole={workspaceRole}
            onSelect={handleSelectBoard}
            onCreate={handleCreateBoard}
            onRename={updateBoard}
            onDelete={deleteBoard}
            onMoveBoard={handleMoveBoard}
            isDraggingCard={!!activeCard}
            canCreateBoards={canCreateBoards}
            canRenameOrDeleteBoards={canRenameOrDeleteBoards}
            canMoveBoards={canMoveBoards}
          />

          <main id="main-content" tabIndex={-1} className="flex flex-col flex-1 min-w-0">
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
              onOpenWsSettings={() => setShowWsSettings(true)}
              onAvatarChange={(url) => updateUser({ avatarUrl: url })}
              onNotificationNavigate={handleNotificationNavigate}
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
                pendingOpenCardId={pendingOpenCardId}
                onPendingOpenCardConsumed={() => setPendingOpenCardId(null)}
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
          </main>
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

        {/* Workspace settings panel */}
        {showWsSettings && activeWorkspace && (
          <WorkspaceSettings
            workspace={activeWorkspace}
            onSave={handleWorkspaceSettingsSave}
            onClose={() => setShowWsSettings(false)}
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
