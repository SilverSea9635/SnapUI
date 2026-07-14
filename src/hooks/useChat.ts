import { useCallback, useRef, useState } from 'react';
import { type ChatComposePayload, type ChatMessage } from '@/components/Chat/Chat.tsx';
import { API_BASE } from '@/Utils/request';
import { useCreditsStore, useUIStore } from '@/stores';
import { refreshAccessToken } from '@/stores/auth';

const CHAT_SYSTEM_PROMPT = `你是一个简洁、准确的中文 AI 助手。
当用户要求生成 React 组件时，请严格使用以下格式，组件必须命名为 Component，不要使用 export。
\`\`\`tsx
function Component() {
  return <div>...</div>;
}
\`\`\``;
const CHAT_MODEL = '';
const DEFAULT_IMAGE_PROMPT = 'please describe the content of the image';

type ChatRequestContentItem =
  | {
  type: string,
  source: {
    type: string,
    media_type?: string
    data: string
  }
}
  | {
  type: 'text';
  text: string;
};

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = localStorage.getItem('snapui-token');
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

async function authFetch(url: string, init: RequestInit): Promise<Response> {
  let response = await fetch(url, init);
  if (response.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) {
      response = await fetch(url, { ...init, headers: buildHeaders() });
    }
  }
  return response;
}

export async function fetchConversations(page = 1, pageSize = 20, signal?: AbortSignal) {
  const response = await authFetch(`${API_BASE}/api/history?page=${page}&pageSize=${pageSize}`, {
    headers: buildHeaders(),
    signal,
  });
  if (!response.ok) throw new Error('获取对话列表失败');
  return response.json();
}

export async function fetchConversationDetail(conversationId: string) {
  const response = await authFetch(`${API_BASE}/api/history/${conversationId}`, {
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error('获取对话详情失败');
  return response.json();
}

export async function createConversationApi(title?: string) {
  const response = await authFetch(`${API_BASE}/api/history`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error('创建对话失败');
  return response.json() as Promise<{ conversationId: string }>;
}

export async function deleteConversationApi(conversationId: string) {
  const response = await authFetch(`${API_BASE}/api/history/${conversationId}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  if (!response.ok) throw new Error('删除对话失败');
  return response.json();
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const convoIdRef = useRef<string | null>(null);

  const stopGenerating = () => {
    abortRef.current?.abort();
  };

  const reset = () => {
    stopGenerating();
    setMessages([]);
    setConversationId(null);
    convoIdRef.current = null;
    setIsSending(false);
  };

  const loadConversation = useCallback(async (convoId: string) => {
    stopGenerating();
    setIsSending(false);

    try {
      const detail = await fetchConversationDetail(convoId);
      const loadedMessages: ChatMessage[] = detail.messages.map((m: {
        id: number;
        role: string;
        content: string | Array<{ type: string; text?: string }>;
        createdAt: string;
      }) => {
        let content = '';
        let imageUrl: string | undefined;

        if (typeof m.content === 'string') {
          content = m.content;
        } else if (Array.isArray(m.content)) {
          const textParts: string[] = [];
          for (const block of m.content) {
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
          imageUrl,
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
  }, []);

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

  const sendMessage = async ({ text, imageDataUrl, media_type, mode }: ChatComposePayload, targetConversationId?: string) => {
    // 根据模式确定扣费金额
    const cost = mode === 'adjust' ? 2 : 5;
    const { balance } = useCreditsStore.getState();
    if (balance < cost) {
      useUIStore.getState().showToast('error', '积分不足，请签到或充值后再试');
      return;
    }

    const now = Date.now();
    const normalizedText = text.trim();
    const promptText = normalizedText || DEFAULT_IMAGE_PROMPT;
    const userMessage: ChatMessage = {
      id: now,
      type: 'user',
      content: normalizedText,
      imageUrl: imageDataUrl,
      time: now,
    };

    if (targetConversationId) {
      convoIdRef.current = targetConversationId;
      setConversationId(targetConversationId);
    }
    const currentConvoId = convoIdRef.current;

    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    const commaIndex = imageDataUrl?.indexOf(',');
    if (commaIndex !== -1) {
      imageDataUrl && (imageDataUrl = imageDataUrl.substring(commaIndex ? commaIndex + 1 : 0));
    }

    const multimodalContent: ChatRequestContentItem[] | undefined = imageDataUrl
      ? [
        { type: 'image', source: { type: 'base64', media_type, data: imageDataUrl } },
        { type: 'text', text: promptText },
      ]
      : undefined;

    const aiMsgId = now + 1;
    setMessages((prev) => [...prev, { id: aiMsgId, type: 'ai' as const, content: '', time: Date.now() }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: buildHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          message: multimodalContent ?? promptText,
          conversationId: currentConvoId,
          system: CHAT_SYSTEM_PROMPT,
          model: CHAT_MODEL || undefined,
        }),
      });

      // Auto-refresh on 401
      if (response.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) {
          response = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: buildHeaders(),
            signal: controller.signal,
            body: JSON.stringify({
              message: multimodalContent ?? promptText,
              conversationId: currentConvoId,
              system: CHAT_SYSTEM_PROMPT,
              model: CHAT_MODEL || undefined,
            }),
          });
        }
      }

      if (!response.ok || !response.body) {
        throw new Error(`请求失败：${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('event: ')) continue;
          if (!line.startsWith('data: ')) continue;

          const json = line.slice(6);
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(json);
          } catch {
            continue;
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
          }
        }
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
        const errorMessage = error instanceof Error ? error.message : '请求失败，请稍后重试。';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: `请求失败：${errorMessage}` } : m,
          ),
        );
      }
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  };

  return { messages, conversationId, isSending, sendMessage, stopGenerating, reset, loadConversation, deleteConversation };
}
