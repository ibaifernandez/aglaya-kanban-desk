import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

export function useBoardData(boardId) {
  const [columns, setColumns] = useState([]);
  const [cards,   setCards]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    if (!boardId) return;
    try {
      setLoading(true);
      const [cols, cds] = await Promise.all([
        api.getColumns(boardId),
        api.getCards(boardId),
      ]);
      setColumns(cols);
      setCards(cds);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  // ── Columns ──────────────────────────────────────────────
  const createColumn = useCallback(async (title) => {
    const col = await api.createColumn(boardId, { title });
    setColumns((prev) => [...prev, col]);
    return col;
  }, [boardId]);

  const updateColumn = useCallback(async (id, body) => {
    const col = await api.updateColumn(id, body);
    setColumns((prev) => prev.map((c) => (c.id === id ? col : c)));
  }, []);

  const deleteColumn = useCallback(async (id) => {
    await api.deleteColumn(id);
    setColumns((prev) => prev.filter((c) => c.id !== id));
    setCards((prev) => prev.filter((c) => c.columnId !== id));
  }, []);

  // Reorder columns after drag & drop — optimistic, persiste en server
  const reorderColumns = useCallback(async (reordered) => {
    setColumns(reordered);
    try {
      await Promise.all(
        reordered.map((col, idx) => api.updateColumn(col.id, { order: idx + 1 }))
      );
    } catch {
      load(); // rollback on error
    }
  }, [load]);

  // ── Cards ────────────────────────────────────────────────
  const createCard = useCallback(async (payload) => {
    const card = await api.createCard({ ...payload, boardId });
    setCards((prev) => [...prev, card]);
    return card;
  }, [boardId]);

  const updateCard = useCallback(async (id, payload) => {
    const card = await api.updateCard(id, payload);
    setCards((prev) => prev.map((c) => (c.id === id ? card : c)));
    return card;
  }, []);

  const moveCard = useCallback(async (id, columnId, order) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, columnId, order } : c))
    );
    try {
      const card = await api.moveCard(id, { columnId, order });
      // Si la tarjeta se movió a otro tablero, sacarla del estado actual
      if (card.boardId !== boardId) {
        setCards((prev) => prev.filter((c) => c.id !== id));
      } else {
        setCards((prev) => prev.map((c) => (c.id === id ? card : c)));
      }
    } catch {
      load();
    }
  }, [load, boardId]);

  const deleteCard = useCallback(async (id) => {
    await api.deleteCard(id, { boardId });
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, [boardId]);

  return {
    columns, cards, loading, error,
    createColumn, updateColumn, deleteColumn, reorderColumns,
    createCard, updateCard, moveCard, deleteCard,
  };
}
