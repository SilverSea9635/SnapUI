import { useCallback, useRef, useState } from 'react';
import { type ChatComposePayload, type ChatMessage } from '@/components/Chat/Chat.tsx';
import { API_BASE } from '@/utils/request';
import { useCreditsStore, useUIStore } from '@/stores';
import { getAccessToken, refreshAccessToken } from '@/utils/token';
import { deleteConversationApi, fetchConversationDetail } from './chatApi';
import { updateWork } from './worksApi';
import type { ImageAttachment } from './attachmentsApi';

class ChatRequestError extends Error {
  status?: number;
  detail?: unknown;
  constructor(
    status?: number,
    detail?: unknown
  ) {
    super('Chat request failed');
    this.status = status;
    this.detail = detail;
  }
}

function chatErrorMessage(error: unknown): string {
  if (error instanceof ChatRequestError) {
    if (error.status === 401) return '登录已过期，请重新登录后再试。';
    if (error.status === 403) return '暂时无法使用 AI 服务，请检查账号权限后再试。';
    if (error.status === 429) return 'AI 服务当前请求较多，请稍等片刻后重新发送。';
    if (error.status === 504) return 'AI 服务响应超时，请稍后重新发送消息。';
  }
  if (error instanceof TypeError) return '暂时无法连接 AI 服务，请检查网络连接，稍后重新发送消息。';
  return 'AI 服务暂时不可用，本次回复未能完成。请稍后重新发送消息；如果持续失败，请联系管理员。';
}

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = getAccessToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const convoIdRef = useRef<string | null>(null);
  // AI 产出的作品 id 先落在这里：SSE 的 done 帧可能早于最后一个 delta 被处理
  const pendingWorkIdRef = useRef<number | null>(null);
  // 当务之急是让作品能被用户手动确认发布，所以这里只记录 id + 标题
  const pendingWorkTitleRef = useRef<string>('');

  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    stopGenerating();
    setMessages([]);
    setConversationId(null);
    convoIdRef.current = null;
    setIsSending(false);
  }, [stopGenerating]);

  const loadConversation = useCallback(async (convoId: string) => {
    stopGenerating();
    setIsSending(false);

    try {
      const detail = await fetchConversationDetail(convoId);
      const loadedMessages: ChatMessage[] = detail.messages.map((m: {
        id: number;
        role: string;
        content: string | Array<{ type: string; text?: string; attachment?: ImageAttachment; imageUnavailable?: boolean }>;
        createdAt: string;
      }) => {
        let content = '';
        let attachment: ImageAttachment | undefined;
        let imageUnavailable = false;

        if (typeof m.content === 'string') {
          content = m.content;
        } else if (Array.isArray(m.content)) {
          const textParts: string[] = [];
          for (const block of m.content) {
            if (block.type === 'image') { attachment = block.attachment; imageUnavailable = !block.attachment; }
            if (block.type === 'text' && block.text) {
              textParts.push(block.text);
            }
          }
          content = textParts.join('');
        }

        return {
          id: m.id,
          type: m.role === 'user' ? 'user' : 'ai',
          content,
          attachment,
          imageUnavailable,
          time: new Date(m.createdAt).getTime(),
        } as ChatMessage;
      });

      setMessages(loadedMessages);
      setConversationId(convoId);
      convoIdRef.current = convoId;
    } catch {
      // Fallback: set empty state
      setMessages([]);
      setConversationId(convoId);
      convoIdRef.current = convoId;
    }
  }, [stopGenerating]);

  const deleteConversation = useCallback(async (convoId: string) => {
    try {
      await deleteConversationApi(convoId);
    } catch {
      // ignore API error, still remove from local state
    }
    if (convoIdRef.current === convoId) {
      reset();
    }
  }, [reset]);

  const sendMessage = async (
    { text, attachment, refreshImageDescription, mode, model, modelProfileId, referenceWorkId, referenceTitle }: ChatComposePayload,
    targetConversationId?: string,
  ) => {
    // 引用调整属于「调整」：同样按 2 积分计费
    const isReference = Boolean(referenceWorkId);
    const cost = mode === 'adjust' || isReference ? 2 : 5;
    const { balance } = useCreditsStore.getState();
    if (balance < cost) {
      useUIStore.getState().showToast('error', '积分不足，请签到或充值后再试');
      return;
    }

    const now = Date.now();
    const normalizedText = text.trim();

    const userMessage: ChatMessage = {
      id: now,
      type: 'user',
      content: normalizedText,
      attachment,
      time: now,
      reference: isReference
        ? { workId: referenceWorkId!, title: referenceTitle || '' }
        : undefined,
    };

    if (targetConversationId) {
      convoIdRef.current = targetConversationId;
      setConversationId(targetConversationId);
    }
    const currentConvoId = convoIdRef.current;

    // 记下这次引用的标题，作品落库后挂到 AI 消息上给用户确认发布
    if (isReference) {
      pendingWorkTitleRef.current = referenceTitle || '引用调整的作品';
    }

    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    const requestBody = JSON.stringify({
      message: normalizedText,
      attachmentId: attachment?.id,
      refreshImageDescription: refreshImageDescription || undefined,
      conversationId: currentConvoId,
      mode: isReference ? 'adjust' : mode || 'new',
      model: model || undefined,
      modelProfileId: modelProfileId || undefined,
      // 引用调整：交给后端在生成结束后把成品存成当前用户的新作品
      referenceWorkId: isReference ? referenceWorkId : undefined,
    });

    const aiMsgId = now + 1;
    setMessages((prev) => [...prev, { id: aiMsgId, type: 'ai' as const, content: '', time: Date.now() }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: buildHeaders(),
        signal: controller.signal,
        body: requestBody,
      });

      // Auto-refresh on 401
      if (response.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) {
          response = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: buildHeaders(),
            signal: controller.signal,
            body: requestBody,
          });
        }
      }

      if (!response.ok || !response.body) {
        throw new ChatRequestError(response.status, await response.text());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventType = '';
      const processLine = (rawLine: string) => {
        const line = rawLine.replace(/\r$/, '');

        if (!line) { eventType = ''; return; }
        if (line.startsWith('event:')) { eventType = line.slice(6).trim(); return; }
        if (!line.startsWith('data:')) return;

        const json = line.slice(5).trimStart();
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(json);
        } catch {
          if (eventType === 'error') throw new ChatRequestError(undefined, json);
          return;
        }
        if (!parsed || typeof parsed !== 'object') {
          if (eventType === 'error') throw new ChatRequestError(undefined, parsed);
          return;
        }
        if (eventType === 'error' || 'error' in parsed || parsed.type === 'error') {
          throw new ChatRequestError(undefined, parsed);
        }

        if ('text' in parsed && typeof parsed.text === 'string') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: m.content + parsed.text } : m,
            ),
          );
        } else if ('conversationId' in parsed && typeof parsed.conversationId === 'string') {
          setConversationId(parsed.conversationId);
          convoIdRef.current = parsed.conversationId;
        } else if ('workId' in parsed && typeof parsed.workId === 'number') {
          // 引用调整产出已由后端存成当前用户的作品（默认未公开，等用户确认）
          pendingWorkIdRef.current = parsed.workId;
          attachPendingWork(aiMsgId);
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) processLine(line);
        }
        for (const line of (buffer + decoder.decode()).split('\n')) processLine(line);
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      // Deduct credits after successful generation
      useCreditsStore.getState().deduct(cost, mode === 'adjust' ? 'AI 组件调整' : 'AI 组件生成').catch(() => {});
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: m.content || '（已停止生成）' } : m,
          ),
        );
      } else {
        console.error('[chat] AI 服务请求失败', error);
        const errorMessage = chatErrorMessage(error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: errorMessage } : m,
          ),
        );
      }
    } finally {
      abortRef.current = null;
      setIsSending(false);
      // done 帧可能先于最后一个 delta 被处理，收尾时再挂一次确保落到位
      attachPendingWork(aiMsgId);
    }
  };

  /**
   * 把"引用调整产出的作品"挂到对应 AI 消息上。
   * 后端默认存为未公开（仅自己可见），用户在气泡里手动确认后才发布到广场。
   */
  const attachPendingWork = useCallback((aiMsgId: number) => {
    const workId = pendingWorkIdRef.current;
    if (!workId) return;

    pendingWorkIdRef.current = null;
    const title = pendingWorkTitleRef.current;
    pendingWorkTitleRef.current = '';

    setMessages((prev) =>
      prev.map((m) =>
        m.id === aiMsgId
          ? { ...m, savedWork: { id: workId, title: title || '引用调整的作品', isPublic: false } }
          : m,
      ),
    );
  }, []);

  /** 用户确认发布：把刚生成的作品公开到广场（也可撤回为仅自己可见） */
  const publishWork = useCallback(async (
    workId: number,
    isPublic: boolean
  ) => {
    await updateWork(workId, { isPublic });
    setMessages((prev) =>
      prev.map((m) =>
        m.savedWork?.id === workId ? { ...m, savedWork: { ...m.savedWork, isPublic } } : m,
      ),
    );
  }, []);

  return {
    messages,
    conversationId,
    isSending,
    sendMessage,
    stopGenerating,
    reset,
    loadConversation,
    deleteConversation,
    publishWork,
  };
}
