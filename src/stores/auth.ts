import { create } from 'zustand';
import { get as httpGet, post, put } from '@/Utils/request';
import { hashPassword } from '@/Utils';

interface User {
  id: number;
  nickname: string;
  email: string;
  avatar?: string;
  credits: number;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, nickname: string) => Promise<boolean>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  updateProfile: (fields: { nickname?: string; avatar?: string }) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<boolean>;
  setToken: (token: string) => void;
  refreshAccessToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('snapui-token'),
  refreshToken: localStorage.getItem('snapui-refresh-token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const hashed = await hashPassword(password);
      const { token, refreshToken, user } = await post<{ token: string; refreshToken?: string; user: User }>('/api/auth/login', { email, password: hashed });
      localStorage.setItem('snapui-token', token);
      if (refreshToken) localStorage.setItem('snapui-refresh-token', refreshToken);
      set({ token, refreshToken: refreshToken ?? get().refreshToken, user, isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  register: async (email, password, nickname) => {
    set({ isLoading: true, error: null });
    try {
      const hashed = await hashPassword(password);
      const { token, refreshToken, user } = await post<{ token: string; refreshToken?: string; user: User }>('/api/auth/register', { email, password: hashed, nickname });
      localStorage.setItem('snapui-token', token);
      if (refreshToken) localStorage.setItem('snapui-refresh-token', refreshToken);
      set({ token, refreshToken: refreshToken ?? get().refreshToken, user, isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('snapui-token');
    localStorage.removeItem('snapui-refresh-token');
    set({ user: null, token: null, refreshToken: null, error: null });
  },

  fetchUser: async () => {
    try {
      const user = await httpGet<User>('/api/auth/me');
      set({ user });
    } catch {
      get().logout();
    }
  },

  updateProfile: async (fields) => {
    set({ isLoading: true, error: null });
    try {
      const user = await put<User>('/api/auth/profile', fields);
      set({ user, isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      const hashedCurrent = await hashPassword(currentPassword);
      const hashedNew = await hashPassword(newPassword);
      await put('/api/auth/profile', { currentPassword: hashedCurrent, newPassword: hashedNew });
      set({ isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  forgotPassword: async (email) => {
    set({ isLoading: true, error: null });
    try {
      await post('/api/auth/forgot-password', { email });
      set({ isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  resetPassword: async (email, code, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      const hashed = await hashPassword(newPassword);
      await post('/api/auth/reset-password', { email, code, newPassword: hashed });
      set({ isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  setToken: (token) => {
    localStorage.setItem('snapui-token', token);
    set({ token });
  },

  refreshAccessToken: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;
    try {
      const { token, refreshToken: newRefreshToken } = await post<{ token: string; refreshToken?: string }>('/api/auth/refresh', { refreshToken });
      localStorage.setItem('snapui-token', token);
      if (newRefreshToken) localStorage.setItem('snapui-refresh-token', newRefreshToken);
      set({ token, refreshToken: newRefreshToken ?? refreshToken });
      return true;
    } catch {
      get().logout();
      return false;
    }
  },
}));

/** Standalone refresh function for use outside React components (e.g. axios interceptor) */
export async function refreshAccessToken(): Promise<boolean> {
  return useAuthStore.getState().refreshAccessToken();
}
