import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setWorkspaces(await api.getWorkspaces());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createWorkspace = useCallback(async (body) => {
    const ws = await api.createWorkspace(body);
    setWorkspaces((prev) => [...prev, ws]);
    return ws;
  }, []);

  const updateWorkspace = useCallback(async (id, body) => {
    const ws = await api.updateWorkspace(id, body);
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, ...ws } : w)));
    return ws;
  }, []);

  const deleteWorkspace = useCallback(async (id) => {
    await api.deleteWorkspace(id);
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return { workspaces, loading, error, createWorkspace, updateWorkspace, deleteWorkspace, reload: load };
}
