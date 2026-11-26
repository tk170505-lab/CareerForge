import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, getStoredToken, setStoredToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    if (!getStoredToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch('/api/auth/me');
      setUser(data.user);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshUser();
  }, []);

  async function login(email, password) {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: payload,
    });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setStoredToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
