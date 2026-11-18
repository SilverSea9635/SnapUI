import type { ImageAttachment } from './attachments';
import { del, get, post } from '@/utils/request';

export type Conversation = { id: string; title: string; createdAt: string };

export type ConversationMessage = {
  id: string | number;
  role: 'user' | 'assistant';
  content: string | Array<{
    type: string;
    text?: string;
    attachment?: ImageAttachment;
    imageUnavailable?: boolean;
  }>;
  createdAt: string;
};

export function fetchConversations(
  page = 1,
  pageSize = 20,
  signal?: AbortSignal
) {
  return get<{
    total: number;
    page: number;
    pageSize: number;
    conversations: Conversation[];
  }>(`/api/history?page=${page}&pageSize=${pageSize}`, { signal });
}

export function fetchConversationDetail(
  conversationId: string,
  signal?: AbortSignal
) {
  return get<{
    conversationId: string;
    title: string;
    createdAt: string;
    messages: ConversationMessage[];
  }>(`/api/history/${conversationId}`, { signal });
}

export function fetchModels() {
  return get<{ models: string[]; default: string }>('/api/models');
}

export function createConversationApi(
  title?: string,
  signal?: AbortSignal
) {
  return post<{ conversationId: string }>('/api/history', { title }, { signal });
}

export function deleteConversationApi(conversationId: string) {
  return del<{ conversationId: string; cleared: boolean }>(`/api/history/${conversationId}`);
}
