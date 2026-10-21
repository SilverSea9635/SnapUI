import { create } from 'zustand';
import { get, post } from '@/utils/request';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  description?: string;
}

interface Transaction {
  id: string;
  type: 'deduct' | 'recharge' | 'gift';
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

interface CreditsState {
  balance: number;
  packages: CreditPackage[];
  transactions: Transaction[];
  transactionsTotal: number;
  transactionsPage: number;
  isLoading: boolean;
  error: string | null;

  fetchBalance: () => Promise<void>;
  deduct: (
    amount: number,
    description?: string
  ) => Promise<boolean>;
  fetchPackages: () => Promise<void>;
  fetchTransactions: (page?: number) => Promise<void>;
}

export const useCreditsStore = create<CreditsState>((set) => ({
  balance: 0,
  packages: [],
  transactions: [],
  transactionsTotal: 0,
  transactionsPage: 1,
  isLoading: false,
  error: null,

  fetchBalance: async () => {
    try {
      const { balance } = await get<{ balance: number }>('/api/credits/balance');
      set({ balance });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deduct: async (
    amount,
    description = 'AI 组件生成'
  ) => {
    set({ isLoading: true, error: null });
    try {
      const { balance } = await post<{ balance: number }>('/api/credits/deduct', { amount, description });
      set({ balance, isLoading: false });
      return true;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return false;
    }
  },

  fetchPackages: async () => {
    try {
      const packages = await get<CreditPackage[]>('/api/credits/packages');
      set({ packages });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchTransactions: async (page = 1) => {
    set({ isLoading: true });
    try {
      const res = await get<{ data: Array<Record<string, unknown>>; total: number; page: number }>(`/api/credits/transactions?page=${page}`);
      const transactions: Transaction[] = res.data.map((row) => ({
        id: String(row.id),
        type: row.type as Transaction['type'],
        amount: Number(row.amount),
        balance: Number(row.balance),
        description: String(row.description || ''),
        createdAt: String(row.created_at || row.createdAt),
      }));
      set({ transactions, transactionsTotal: res.total, transactionsPage: res.page, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
}));
