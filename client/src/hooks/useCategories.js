import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

export function useCategories(boardId) {
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(() => {
    if (!boardId) { setCategories([]); setLoading(false); return; }
    setLoading(true);
    api.getCategories(boardId)
      .then(setCategories)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  async function createCategory(body) {
    const cat = await api.createCategory({ ...body, boardId });
    setCategories((prev) => [...prev, cat]);
    return cat;
  }

  async function updateCategory(id, body) {
    const cat = await api.updateCategory(id, body);
    setCategories((prev) => prev.map((c) => (c.id === id ? cat : c)));
    return cat;
  }

  async function deleteCategory(id) {
    await api.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  return { categories, loading, createCategory, updateCategory, deleteCategory };
}
