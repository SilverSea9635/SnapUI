import type { ImageAttachment } from '@/api/attachments';

export type ChatMessage = {
  id: string | number;
  type: 'user' | 'ai';
  content: string;
  time: Date | number | string;
  attachment?: ImageAttachment;
  imageUnavailable?: boolean;
  /** 这条消息是一次「引用调整」，记录来源作品 */
  reference?: { workId: number; title: string };
  /** 这条 AI 回复已被落库为当前用户的作品（待用户手动确认是否发布） */
  savedWork?: { id: number; title: string; isPublic: boolean };
};

export type ChatComposePayload = {
  text: string;
  attachment?: ImageAttachment;
  refreshImageDescription?: boolean;
  mode?: 'new' | 'adjust';
  model?: string;
  modelProfileId?: string;
  /** 引用调整：要二次调整的来源作品 */
  referenceWorkId?: number;
  referenceTitle?: string;
};

/** 从首页、历史列表或作品详情进入聊天的上下文。 */
export type ReferenceContext = {
  workId: number;
  title: string;
  author: string;
  code: string;
};

export type ChatRouteState = {
  prompt?: string;
  conversationId?: string;
  reference?: ReferenceContext;
} | null;
