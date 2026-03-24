const BASE = '/api';

function getToken() {
  return localStorage.getItem('myboardlfi_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
}

export const api = {
  // Auth
  login:    (body) => fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
    return json;
  }),

  // Boards
  getBoards:     ()         => request('/boards'),
  createBoard:   (body)     => request('/boards', { method: 'POST', body: JSON.stringify(body) }),
  reorderBoards: (ids)      => request('/boards/reorder', { method: 'PUT', body: JSON.stringify({ ids }) }),
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
  deleteCard:  (id)      => request(`/cards/${id}`, { method: 'DELETE' }),

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
  getCategories:  ()         => request('/categories'),
  createCategory: (body)     => request('/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id, body) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: (id)       => request(`/categories/${id}`, { method: 'DELETE' }),

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
};
