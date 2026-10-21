import { create } from 'zustand';
import { get as httpGet, post, put } from '@/utils/request';
import { hashPassword } from '@/utils';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/utils/token';

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

  login: (
    email: string,
    password: string
  ) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    nickname: string
  ) => Promise<boolean>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  updateProfile: (fields: { nickname?: string; avatar?: string }) => Promise<boolean>;
  uploadAvatar: (
    data: string,
    mimeType: string
  ) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (
    email: string,
    code: string,
    newPassword: string
  ) => Promise<boolean>;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((
  set,
  get
) => ({
  user: null,
  token: getAccessToken(),
  refreshToken: getRefreshToken(),
  isLoading: false,
  error: null,

  login: async (
    email,
    password
  ) => {
    set({ isLoading: true, error: null });
    try {
      const hashed = await hashPassword(password);
      const { token, refreshToken, user } = await post<{ token: string; refreshToken?: string; user: User }>('/api/auth/login', { email, password: hashed });
      setTokens(token, refreshToken);
      set({ token, refreshToken: refreshToken ?? get().refreshToken, user, isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  register: async (
    email,
    password,
    nickname
  ) => {
    set({ isLoading: true, error: null });
    try {
      const hashed = await hashPassword(password);
      const { token, refreshToken, user } = await post<{ token: string; refreshToken?: string; user: User }>('/api/auth/register', { email, password: hashed, nickname });
      setTokens(token, refreshToken);
      set({ token, refreshToken: refreshToken ?? get().refreshToken, user, isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    clearTokens();
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

  uploadAvatar: async (
    data,
    mimeType
  ) => {
    const token = get().token;
    const user = await post<User>('/api/auth/avatar', { data, mimeType });
    if (get().token === token && get().user?.id === user.id) set({ user });
  },

  changePassword: async (
    currentPassword,
    newPassword
  ) => {
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

  resetPassword: async (
    email,
    code,
    newPassword
  ) => {
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
    setTokens(token);
    set({ token });
  },
}));
