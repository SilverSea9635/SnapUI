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
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, nickname: string) => Promise<boolean>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  updateProfile: (fields: { nickname?: string; avatar?: string }) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('snapui-token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const hashed = await hashPassword(password);
      const { token, user } = await post<{ token: string; user: User }>('/api/auth/login', { email, password: hashed });
      localStorage.setItem('snapui-token', token);
      set({ token, user, isLoading: false });
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
      const { token, user } = await post<{ token: string; user: User }>('/api/auth/register', { email, password: hashed, nickname });
      localStorage.setItem('snapui-token', token);
      set({ token, user, isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('snapui-token');
    set({ user: null, token: null, error: null });
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

  setToken: (token) => {
    localStorage.setItem('snapui-token', token);
    set({ token });
  },
}));
