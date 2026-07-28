import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getApiBaseUrl } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('tf_token'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tf_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveSession = (tok, usr) => {
    localStorage.setItem('tf_token', tok);
    localStorage.setItem('tf_user', JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
  };

  const clearSession = () => {
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
    setToken(null);
    setUser(null);
  };

  const authFetch = useCallback(async (path, options = {}) => {
    const BASE = getApiBaseUrl();
    const res = await fetch(BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      saveSession(data.token, data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      saveSession(data.token, data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => clearSession();

  const forgotPassword = async (email) => {
    setLoading(true);
    try {
      return await authFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (token, newPassword) => {
    setLoading(true);
    try {
      return await authFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permKey) => {
    if (!user) return false;
    if (user.role_name === 'Admin') return true;
    return Array.isArray(user.permissions) && user.permissions.includes(permKey);
  };

  // Refresh user from server when token changes
  useEffect(() => {
    if (token && !user) {
      authFetch('/auth/me').then(data => setUser(data.user)).catch(() => clearSession());
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{
      token, user, loading, error,
      login, register, logout, forgotPassword, resetPassword, hasPermission,
      isAuthenticated: !!token && !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
