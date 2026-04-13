import { createContext, useContext, useState, useCallback } from 'react';
import {
  clearAuthSession,
  readAuthSession,
  updateAuthSessionUser,
  writeAuthSession,
} from '../utils/session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readAuthSession().token);
  const [user,  setUser]  = useState(() => readAuthSession().user);

  const login = useCallback((newToken, newUser) => {
    writeAuthSession(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const updated = updateAuthSessionUser(patch);
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
