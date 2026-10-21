import type { ImageAttachment } from './attachmentsApi';
import { del, get, post } from '@/utils/request';

export function fetchConversations(
  page = 1,
  pageSize = 20,
  signal?: AbortSignal
) {
  return get<{
    total: number;
    page: number;
    pageSize: number;
    conversations: Array<{ id: string; title: string; createdAt: string }>;
  }>(`/api/history?page=${page}&pageSize=${pageSize}`, { signal });
}

export function fetchConversationDetail(conversationId: string) {
  return get<{
    conversationId: string;
    title: string;
    createdAt: string;
    messages: Array<{
      id: number;
      role: 'user' | 'assistant';
      content: string | Array<{ type: string; text?: string; attachment?: ImageAttachment; imageUnavailable?: boolean }>;
      createdAt: string;
    }>;
  }>(`/api/history/${conversationId}`);
}

export function fetchModels() {
  return get<{ models: string[]; default: string }>('/api/models');
}

export function createConversationApi(title?: string) {
  return post<{ conversationId: string }>('/api/history', { title });
}

export function deleteConversationApi(conversationId: string) {
  return del<{ conversationId: string; cleared: boolean }>(`/api/history/${conversationId}`);
}
