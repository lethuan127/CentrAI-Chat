'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { apiClient } from '@/lib/api-client';
import type { AuthResponse, Role } from '@centrai/types';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function useAuthProvider(): AuthContextValue {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const res = await apiClient.get<AuthUser>('/auth/me');
      setUser(res.data);
    } catch {
      setUser(null);
      apiClient.clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    const { user: u, tokens } = res.data;
    apiClient.setTokens(tokens.accessToken, tokens.refreshToken);
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/register', { email, password, name });
    const { user: u, tokens } = res.data;
    apiClient.setTokens(tokens.accessToken, tokens.refreshToken);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await apiClient.post('/auth/logout', { refreshToken });
    } catch {
      // ignore logout errors
    } finally {
      apiClient.clearTokens();
      setUser(null);
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };
}
