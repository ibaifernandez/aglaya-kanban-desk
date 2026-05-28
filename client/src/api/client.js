import { getAuthToken, setAuthToken, clearAuthToken } from '../utils/session.js';

const BASE = '/api';

function getToken() {
  return getAuthToken();
}

// B-02 audit Mariana: interceptor 401 → /api/auth/refresh → retry.
//
// Si access token expira (15 min), un único intento de refresh transparente.
// Refresh token va en HttpOnly cookie (credentials: 'include').
//
// Mutex para evitar refresh concurrente: múltiples requests que reciben 401
// simultáneamente esperan el primero. Si refresh falla, todas reciben 401
// y se redirigen a login.

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        clearAuthToken();
        return null;
      }
      const data = await res.json();
      if (data?.token) {
        setAuthToken(data.token);
        return data.token;
      }
      return null;
    } catch (_) {
      return null;
    } finally {
      // Liberar mutex tras la siguiente microtask para que requests en flight
      // que esperaban este refresh lean el resultado.
      setTimeout(() => { refreshPromise = null; }, 0);
    }
  })();

  return refreshPromise;
}

async function fetchWithAuth(path, options = {}, isRetry = false) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',  // refresh cookie HttpOnly
    ...options,
    headers,
  });

  // Si 401 y no es retry ni endpoint de auth → intentar refresh + retry una vez
  if (res.status === 401 && !isRetry && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/login')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return fetchWithAuth(path, options, true);
    }
  }

  return res;
}

async function request(path, options = {}) {
  const res = await fetchWithAuth(path, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
}

export const api = {
  // Auth — B-02: credentials:'include' para que el refresh cookie HttpOnly
  // se setee en respuesta a login + se envíe en /auth/refresh + /auth/logout.
  login:    (body) => fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
    return json;
  }),

  // B-02: logout invalida refresh cookie en server. Access token muere en TTL.
  logout: () => fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  }).then(() => true).catch(() => true),  // best-effort, no fallar logout local

  // Boards
  getBoards:     ()         => request('/boards'),
  createBoard:   (body)     => request('/boards', { method: 'POST', body: JSON.stringify(body) }),
  reorderBoards: (ids, workspaceId) => request('/boards/reorder', { method: 'PUT', body: JSON.stringify({ ids, workspaceId }) }),
  updateBoard:   (id, body) => request(`/boards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteBoard:   (id)       => request(`/boards/${id}`, { method: 'DELETE' }),

  // Columns
  getColumns:   (boardId)       => request(`/boards/${boardId}/columns`),
  createColumn: (boardId, body) => request(`/boards/${boardId}/columns`, { method: 'POST', body: JSON.stringify(body) }),
  updateColumn: (id, body)      => request(`/columns/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteColumn: (id)            => request(`/columns/${id}`, { method: 'DELETE' }),

  // Cards
  getCards:    (boardId) => request(`/boards/${boardId}/cards`),
  searchCards: (q)       => request(`/cards/search?q=${encodeURIComponent(q)}`),
  createCard:  (body)    => request('/cards', { method: 'POST', body: JSON.stringify(body) }),
  updateCard:  (id, body)=> request(`/cards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  moveCard:    (id, body)=> request(`/cards/${id}/move`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCard:  (id, body = null) => request(`/cards/${id}`, {
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {}),
  }),

  // Uploads
  uploadFile: (file) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch('/api/uploads', { method: 'POST', body: form, headers })
      .then((r) => r.json())
      .then((j) => { if (!j.data) throw new Error(j.error); return j.data; });
  },
  deleteFile: (filename) => request(`/uploads/${filename}`, { method: 'DELETE' }),

  // Categories
  getCategories:  (boardId)  => request(`/categories${boardId ? `?boardId=${boardId}` : ''}`),
  createCategory: (body)     => request('/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id, body) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: (id)       => request(`/categories/${id}`, { method: 'DELETE' }),

  // Workspaces
  getWorkspaces:          ()               => request('/workspaces'),
  createWorkspace:        (body)           => request('/workspaces', { method: 'POST', body: JSON.stringify(body) }),
  getWorkspace:           (id)             => request(`/workspaces/${id}`),
  updateWorkspace:        (id, body)       => request(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWorkspace:        (id)             => request(`/workspaces/${id}`, { method: 'DELETE' }),
  getWorkspaceMembers:    (id)             => request(`/workspaces/${id}/members`),
  getWorkspaceAvailableUsers: (id)         => request(`/workspaces/${id}/available-users`),
  addWorkspaceMember:     (id, body)       => request(`/workspaces/${id}/members`, { method: 'POST', body: JSON.stringify(body) }),
  updateWorkspaceMember:  (id, uid, body)  => request(`/workspaces/${id}/members/${uid}`, { method: 'PATCH', body: JSON.stringify(body) }),
  removeWorkspaceMember:  (id, uid)        => request(`/workspaces/${id}/members/${uid}`, { method: 'DELETE' }),
  getWorkspaceBoards:     (id)             => request(`/workspaces/${id}/boards`),

  // Media uploads (Supabase Storage)
  uploadAvatar: (file) => {
    const token = getToken();
    const form  = new FormData();
    form.append('file', file);
    return fetch('/api/media/users/me/avatar', {
      method:  'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body:    form,
    }).then(async (r) => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      return json.data?.avatarUrl;
    });
  },

  uploadWorkspaceCover: (workspaceId, file) => {
    const token = getToken();
    const form  = new FormData();
    form.append('file', file);
    return fetch(`/api/media/workspaces/${workspaceId}/cover`, {
      method:  'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body:    form,
    }).then(async (r) => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      return json.data?.coverUrl;
    });
  },

  // Admin — user management
  getAdminUsers:   ()               => request('/admin/users').then((data) => ({ data })),
  updateUserRole:  (id, role)       => request(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }).then((data) => ({ data })),
  deleteUser:      (id)             => request(`/admin/users/${id}`, { method: 'DELETE' }),
  inviteUser:      (body)           => {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch('/api/admin/users/invite', { method: 'POST', headers, body: JSON.stringify(body) })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
        return { data: json.data, message: json.message };
      });
  },

  // Notifications
  getNotifications:         ()    => request('/notifications'),
  markNotificationRead:     (id)  => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: ()    => request('/notifications/read-all', { method: 'PATCH' }),

  // User preferences (digest hour, digest enabled)
  updatePreferences: (body) => request('/auth/me/preferences', { method: 'PATCH', body: JSON.stringify(body) }),

  sendPersonalDigest: (body = {}) => {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    return fetch('/api/digest/send-my-digest', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }).then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
      return json;
    });
  },
};
