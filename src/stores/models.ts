import { create } from 'zustand';
import { fetchModels } from '@/hooks/chatApi';
import { fetchModelProfiles, type ModelProfile } from '@/hooks/modelProfilesApi';

type ModelsState = {
  platformModels: string[];
  platformDefault: string;
  profiles: ModelProfile[];
  accountId: string | null;
  error: string | null;
  loading: boolean;
  load: (accountId: string) => Promise<void>;
};
let revision = 0;
export const useModelsStore = create<ModelsState>((set) => ({
  platformModels: [], platformDefault: '', profiles: [], accountId: null, error: null, loading: false,
  load: async (accountId) => {
    const requestRevision = ++revision;
    set((state) => ({ loading: true, error: null, accountId,
      ...(state.accountId !== accountId ? { profiles: [], platformModels: [], platformDefault: '' } : {}) }));
    const [platform, personal] = await Promise.allSettled([fetchModels(), fetchModelProfiles()]);
    if (requestRevision !== revision) return;
    set({ loading: false,
      platformModels: platform.status === 'fulfilled' ? platform.value.models : [],
      platformDefault: platform.status === 'fulfilled' ? platform.value.default : '',
      profiles: personal.status === 'fulfilled' ? personal.value.profiles : [],
      error: personal.status === 'rejected' ? personal.reason.message : null,
    });
  },
}));
