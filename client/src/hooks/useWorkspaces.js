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

  // Reordena una SECCIÓN. Optimista: la pantalla se mueve al soltar y, si el
  // servidor lo rechaza, se recarga lo que la base tenga de verdad — nunca se
  // deja una pantalla que muestra un orden que no está guardado.
  const reordenarEspacios = useCallback(async (idsOrdenados) => {
    setWorkspaces((prev) => {
      const posicion = new Map(idsOrdenados.map((id, i) => [id, i + 1]));
      return prev.map((w) => (posicion.has(w.id) ? { ...w, order: posicion.get(w.id) } : w));
    });

    try {
      await api.reorderWorkspaces(idsOrdenados);
    } catch (e) {
      setError(e.message);
      load();
    }
  }, [load]);

  return { workspaces, loading, error, createWorkspace, updateWorkspace, deleteWorkspace, reordenarEspacios, reload: load };
}
