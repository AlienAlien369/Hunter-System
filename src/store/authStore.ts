import { create } from 'zustand';
import type { User } from '../lib/api';
import { api } from '../lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  login: (userData: { id: number; username: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  login: async (userData) => {
    set({ loading: true, error: null });
    try {
      // Fetch full user data
      const response = await api.getMe();
      set({
        user: response.user,
        isAuthenticated: true,
        loading: false,
        error: null,
      });
    } catch (error) {
      set({
        user: {
          id: userData.id,
          username: userData.username,
          name: userData.name,
          rank: 'E',
          xp: 0,
          hp: 80,
          mp: 60,
          str: 10,
          agi: 10,
          vit: 10,
          int: 10,
          sen: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        isAuthenticated: true,
        loading: false,
        error: null,
      });
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      });
    }
  },

  checkAuth: async () => {
    set({ loading: true });
    try {
      const response = await api.getMe();
      set({
        user: response.user,
        isAuthenticated: true,
        loading: false,
      });
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
