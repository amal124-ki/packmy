'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface UserProfile {
  home_state: string;
  travel_style: string;
  pace: string;
  default_budget: number;
  interests: string[];
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  is_admin: boolean;
  is_active_account: boolean;
  created_at: string;
  profile: UserProfile;
}

export interface FlashMessage {
  id: number;
  category: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export type ThemeMode = 'light' | 'dark';

interface AppContextValue {
  user: AuthUser | null;
  loadingAuth: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
  flashes: FlashMessage[];
  flash: (message: string, category?: 'success' | 'error' | 'warning' | 'info') => void;
  dismissFlash: (id: number) => void;
  clearFlashes: () => void;
  theme: ThemeMode;
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [flashes, setFlashes] = useState<FlashMessage[]>([]);
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem('packmy-theme', next);
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await apiFetch<{ user: AuthUser | null }>('/api/auth/me');
    const nextUser = res.ok ? res.data.user : null;
    setUser(nextUser);
    setLoadingAuth(false);
    return nextUser;
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const flash = useCallback(
    (message: string, category: 'success' | 'error' | 'warning' | 'info' = 'info') => {
      setFlashes((prev) => [...prev, { id: Date.now() + Math.random(), category, message }]);
    },
    []
  );

  const dismissFlash = useCallback((id: number) => {
    setFlashes((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearFlashes = useCallback(() => {
    setFlashes([]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        loadingAuth,
        refreshUser,
        setUser,
        flashes,
        flash,
        dismissFlash,
        clearFlashes,
        theme,
        toggleTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
