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
  // Con `FormData` NO se pone `Content-Type`: lo tiene que poner el navegador,
  // porque lleva el `boundary` que separa las partes. Ponerlo a mano rompe la
  // subida — y ésa era la razón por la que `uploadFile` se salía de este camino
  // y llamaba a `fetch` directamente, quedándose sin el reintento con token
  // renovado (tarjeta `48946335`). Se arregla aquí, que es donde estaba el
  // motivo, en vez de duplicar el reintento allí.
  const esFormulario = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(esFormulario ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };
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

// `completo` entrega el sobre entero en vez de solo `data`. Existe por
// `inviteUser`, que devuelve además un `message` que la pantalla de
// administración **pinta en un aviso** (`AdminPage.jsx:190-193`): pasarla por
// aquí sin esta salida se lo comería en silencio. Se comprobó quién lo usa
// ANTES de tocarla, que era la parte que podía romperse sin verse.
async function request(path, options = {}, { completo = false } = {}) {
  const res = await fetchWithAuth(path, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return completo ? json : json.data;
}

export const api = {
  // Auth — B-02: credentials:'include' para que el refresh cookie HttpOnly
  // se setee en respuesta a login + se envíe en /auth/refresh + /auth/logout.
  // También por el envoltorio, aunque no necesiten reintento: `fetchWithAuth` ya
  // excluye `/auth/login` y `/auth/refresh` de él. Pasan por aquí para que la
  // regla sea una regla —nadie en este fichero llama a `fetch`— y no una lista
  // de excepciones que hay que recordar.
  login:    (body) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  }, { completo: true }),

  // B-02: logout invalida refresh cookie en server. Access token muere en TTL.
  // Best-effort a propósito: si falla, la sesión local se cierra igual.
  logout: () => request('/auth/logout', { method: 'POST' }).then(() => true).catch(() => true),

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
  // `replacesDescriptionOnPurpose` va SIEMPRE desde el navegador, y no es un
  // pasaporte para saltarse la compuerta: es la verdad de este llamante. El
  // editor trae la descripción actual dentro, así que quien la sustituye desde
  // aquí **está mirando lo que borra**. La compuerta existe para el llamante
  // ciego —el riel, que manda una cadena que armó en otro sitio—, y ése tiene
  // que decirlo a mano. Ver `server/routes/cards.js` → updateCard.
  updateCard:  (id, body)=> request(`/cards/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ replacesDescriptionOnPurpose: true, ...body }),
  }),
  moveCard:    (id, body)=> request(`/cards/${id}/move`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCard:  (id, body = null) => request(`/cards/${id}`, {
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {}),
  }),

  // Uploads
  //
  // Va por `request` como todas las demás llamadas de TARJETAS. Antes llamaba a
  // `fetch` a pelo, así que se quedaba sin el reintento cuando el token de
  // acceso caduca a los 15 minutos: el adjunto no subía y el usuario veía un
  // error genérico, en una sesión que creía abierta.
  //
  // ⚠️ AQUÍ DECÍA «era la ÚNICA del fichero que se saltaba el envoltorio», Y ERA
  // FALSO: había cuatro. `uploadAvatar` y `uploadWorkspaceCover` las midió el
  // vigilante; `inviteUser`, yo al comprobar las suyas. Las cuatro entran en
  // esta obra por decisión del delineante, así que hoy **no queda ninguna**: la
  // regla la fija `client.sin-fetch-suelto.test.js`, no este comentario — un
  // conteo escrito a mano envejece, y éste envejeció en una tarde.
  uploadFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/uploads', { method: 'POST', body: form });
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
    const form = new FormData();
    form.append('file', file);
    return request('/media/users/me/avatar', { method: 'POST', body: form })
      .then((data) => data?.avatarUrl);
  },

  uploadWorkspaceCover: (workspaceId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/media/workspaces/${workspaceId}/cover`, { method: 'POST', body: form })
      .then((data) => data?.coverUrl);
  },

  // Admin — user management
  getAdminUsers:   ()               => request('/admin/users').then((data) => ({ data })),
  updateUserRole:  (id, role)       => request(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }).then((data) => ({ data })),
  deleteUser:      (id)             => request(`/admin/users/${id}`, { method: 'DELETE' }),
  // `completo`, porque la pantalla de administración pinta el `message` que
  // devuelve esta ruta. Sin él, pasarla por el envoltorio se lo comería.
  inviteUser:      (body)           => request('/admin/users/invite', {
    method: 'POST',
    body: JSON.stringify(body),
  }, { completo: true }).then((json) => ({ data: json.data, message: json.message })),

  reorderWorkspaces: (ids) =>
    request('/workspaces/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),

  // Notifications
  getNotifications:         ()    => request('/notifications'),
  markNotificationRead:     (id)  => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: ()    => request('/notifications/read-all', { method: 'PATCH' }),
};
