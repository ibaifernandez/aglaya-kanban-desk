const AUTH_SESSION_KEY = 'aglaya_session';
const UI_STATE_KEY = 'aglaya_ui_state';
const LEGACY_TOKEN_KEY = 'aglaya_token';
const LEGACY_USER_KEY = 'aglaya_user';

function parseJson(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function removeLegacyAuthStorage() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    // Ignore storage access failures.
  }
}

export function readAuthSession() {
  const currentSession = parseJson(sessionStorage.getItem(AUTH_SESSION_KEY));
  if (currentSession?.token) return currentSession;

  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  const legacyUser = parseJson(localStorage.getItem(LEGACY_USER_KEY));

  if (!legacyToken) return { token: null, user: null };

  const migratedSession = { token: legacyToken, user: legacyUser ?? null };
  writeAuthSession(migratedSession.token, migratedSession.user);
  removeLegacyAuthStorage();
  return migratedSession;
}

export function writeAuthSession(token, user) {
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ token, user }));
  removeLegacyAuthStorage();
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  removeLegacyAuthStorage();
}

export function updateAuthSessionUser(patch) {
  const session = readAuthSession();
  const user = { ...(session.user || {}), ...patch };
  writeAuthSession(session.token, user);
  return user;
}

export function getAuthToken() {
  return readAuthSession().token;
}

export function readUiState() {
  const currentState = parseJson(sessionStorage.getItem(UI_STATE_KEY));
  if (currentState) return currentState;

  const legacyState = parseJson(sessionStorage.getItem(AUTH_SESSION_KEY));
  if (legacyState && !legacyState.token && (legacyState.view || legacyState.workspace || legacyState.boardId)) {
    writeUiState(legacyState);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return legacyState;
  }

  return null;
}

export function writeUiState(state) {
  sessionStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
}

export function clearUiState() {
  sessionStorage.removeItem(UI_STATE_KEY);
}
