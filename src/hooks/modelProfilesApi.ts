import { del, get, post, put } from '@/utils/request';

export type ModelProfile = {
  id: string;
  label: string;
  provider: 'openai-compatible';
  baseUrl: string;
  modelName: string;
  keyMask: string;
  isDefault: boolean;
};
export type ModelProfileDraft = {
  label: string;
  baseUrl: string;
  modelName: string;
  apiKey?: string;
  isDefault: boolean;
};
export const fetchModelProfiles = () => get<{ profiles: ModelProfile[] }>('/api/model-profiles');
export const saveModelProfile = (
  draft: ModelProfileDraft,
  id?: string
) => id
  ? put<{ profile: ModelProfile }>(`/api/model-profiles/${id}`, draft)
  : post<{ profile: ModelProfile }>('/api/model-profiles', draft);
export const deleteModelProfile = (id: string) => del(`/api/model-profiles/${id}`);
