import { useCallback, useRef, useState } from 'react';
import { type ChatComposePayload, type ChatMessage } from '@/components/Chat/Chat.tsx';
import { API_BASE } from '@/Utils/request';
import { useCreditsStore, useUIStore } from '@/stores';

const CHAT_SYSTEM_PROMPT = `你是一个简洁、准确的中文 AI 助手。
当用户要求生成 React 组件时，请严格使用以下格式，组件必须命名为 Component，不要使用 export。
\`\`\`tsx
function Component() {
  return <div>...</div>;
}
\`\`\``;
const CHAT_MODEL = '';
const DEFAULT_IMAGE_PROMPT = 'please describe the content of the image';

const MESSAGES_KEY = 'snapui-messages';

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

function loadMessagesMap(): Record<string, ChatMessage[]> {
  try {
    return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMessages(conversationId: string, messages: ChatMessage[]) {
  const map = loadMessagesMap();
  map[conversationId] = messages;
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(map));
}

function removeMessages(conversationId: string) {
  const map = loadMessagesMap();
  delete map[conversationId];
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(map));
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

  const reset = useCallback(() => {
    stopGenerating();
    setMessages([]);
    setConversationId(null);
    convoIdRef.current = null;
    setIsSending(false);
  }, []);

  const loadConversation = useCallback((convoId: string) => {
    stopGenerating();
    const map = loadMessagesMap();
    setMessages(map[convoId] || []);
    setConversationId(convoId);
    convoIdRef.current = convoId;
    setIsSending(false);
  }, []);

  const deleteConversation = useCallback((convoId: string) => {
    removeMessages(convoId);
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

    setMessages((prev) => {
      const next = [...prev, userMessage];
      if (currentConvoId) saveMessages(currentConvoId, next);
      return next;
    });
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
    setMessages((prev) => {
      const next = [...prev, { id: aiMsgId, type: 'ai' as const, content: '', time: Date.now() }];
      if (currentConvoId) saveMessages(currentConvoId, next);
      return next;
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = localStorage.getItem('snapui-token');
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          message: multimodalContent ?? promptText,
          conversationId,
          system: CHAT_SYSTEM_PROMPT,
          model: CHAT_MODEL || undefined,
        }),
      });

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
            setMessages((prev) => {
              const next = prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: m.content + parsed.text } : m,
              );
              if (convoIdRef.current) saveMessages(convoIdRef.current, next);
              return next;
            });
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
        // 用户主动停止，不显示错误
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: m.content || '（已停止生成）' } : m,
          );
          if (convoIdRef.current) saveMessages(convoIdRef.current, next);
          return next;
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : '请求失败，请稍后重试。';
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: `请求失败：${errorMessage}` } : m,
          );
          if (convoIdRef.current) saveMessages(convoIdRef.current, next);
          return next;
        });
      }
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  };

  return { messages, isSending, sendMessage, stopGenerating, reset, loadConversation, deleteConversation };
}
