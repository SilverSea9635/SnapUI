import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface UIState {
  theme: Theme;
  toast: Toast | null;

  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  showToast: (type: Toast['type'], message: string, duration?: number) => void;
  hideToast: () => void;
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('snapui-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('snapui-theme', theme);
}

let toastId = 0;

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  toast: null,

  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      return { theme: next };
    });
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  showToast: (type, message, duration = 3000) => {
    const id = ++toastId;
    set({ toast: { id, type, message } });
    setTimeout(() => {
      set((state) => {
        if (state.toast?.id === id) return { toast: null };
        return state;
      });
    }, duration);
  },

  hideToast: () => set({ toast: null }),
}));