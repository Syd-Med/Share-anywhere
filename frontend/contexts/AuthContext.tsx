'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, AuthResponse, User } from '@/lib/api';
import { decryptMasterKey, encryptMasterKey, generateMasterKey } from '@/lib/crypto';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  masterKey: Uint8Array | null;
  needsUnlock: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<void | { requiresTotp: true }>;
  register: (email: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [encryptedMasterKey, setEncryptedMasterKey] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);

  const setTokens = (data: AuthResponse) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    setUser(data.user);
    if (data.encryptedMasterKey) {
      setEncryptedMasterKey(data.encryptedMasterKey);
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
    setUser(null);
    setEncryptedMasterKey(null);
    setMasterKey(null);
  };

  const login = async (email: string, password: string, totpCode?: string) => {
    const { data } = await api.post<AuthResponse & { requiresTotp?: boolean }>('/api/auth/login', {
      email,
      password,
      totpCode: totpCode || undefined,
    });
    if (data.requiresTotp) {
      return { requiresTotp: true as const };
    }
    setTokens(data);
    if (data.encryptedMasterKey) {
      const key = await decryptMasterKey(data.encryptedMasterKey, password);
      setMasterKey(key);
    }
  };

  const register = async (email: string, password: string) => {
    const masterKeyBytes = await generateMasterKey();
    const encrypted = await encryptMasterKey(masterKeyBytes, password);
    const { data } = await api.post<AuthResponse>('/api/auth/register', {
      email,
      password,
      encryptedMasterKey: encrypted,
    });
    setTokens(data);
    setMasterKey(masterKeyBytes);
  };

  const unlock = async (password: string) => {
    if (!encryptedMasterKey) throw new Error('No encrypted master key');
    const key = await decryptMasterKey(encryptedMasterKey, password);
    setMasterKey(key);
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: User; encryptedMasterKey?: string }>('/api/auth/me')
      .then((res) => {
        setUser(res.data.user);
        if (res.data.encryptedMasterKey) {
          setEncryptedMasterKey(res.data.encryptedMasterKey);
        }
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, []);

  const needsUnlock = !!user && !!encryptedMasterKey && !masterKey;

  return (
    <AuthContext.Provider
      value={{ user, loading, masterKey, needsUnlock, login, register, unlock, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
