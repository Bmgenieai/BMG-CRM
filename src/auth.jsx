import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      setPermissions([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api('/auth/me');
      setUser(data.user);
      setPermissions(data.permissions || []);
    } catch {
      clearToken();
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(data.token);
    setUser(data.user);
    setPermissions(data.permissions || []);
    return data;
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setPermissions([]);
  };

  const can = (permission) => permissions.includes(permission);

  const value = useMemo(
    () => ({ user, permissions, loading, login, logout, can, refresh }),
    [user, permissions, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
