import { create } from 'zustand';
import { get, post } from '@/utils/request';
import { useCreditsStore } from './credits';

interface SigninStatus {
  signedToday: boolean;
  consecutiveDays: number;
  nextReward: number;
}

interface SigninState {
  signedToday: boolean;
  consecutiveDays: number;
  nextReward: number;
  isLoading: boolean;
  error: string | null;

  fetchSigninStatus: () => Promise<void>;
  signin: () => Promise<{ reward: number; tomorrowReward: number } | null>;
}

// 与后端一致：连续签到以七天为一个奖励周期。
const SIGNIN_REWARDS = [5, 5, 5, 10, 10, 10, 20] as const;

export const useSigninStore = create<SigninState>((set) => ({
  signedToday: false,
  consecutiveDays: 0,
  nextReward: 5,
  isLoading: false,
  error: null,

  fetchSigninStatus: async () => {
    try {
      const status = await get<SigninStatus>('/api/signin/status');
      set({
        signedToday: status.signedToday,
        consecutiveDays: status.consecutiveDays,
        nextReward: status.nextReward,
      });
    } catch {
      // Silently fail — user may not be logged in
    }
  },

  signin: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await post<{ consecutiveDays: number; reward: number; balance: number }>('/api/signin');
      const tomorrowReward = SIGNIN_REWARDS[result.consecutiveDays % SIGNIN_REWARDS.length];
      set({
        signedToday: true,
        consecutiveDays: result.consecutiveDays,
        nextReward: tomorrowReward,
        isLoading: false,
      });
      // 签到奖励积分，同步积分余额
      useCreditsStore.setState({ balance: result.balance });
      return { reward: result.reward, tomorrowReward };
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      return null;
    }
  },
}));
