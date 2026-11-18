import { API_BASE, getAccessToken, refreshAccessToken } from '@/utils/token';

export type ChatRequest = {
  message: string;
  conversationId: string;
  mode: 'new' | 'adjust';
  attachmentId?: string;
  refreshImageDescription?: boolean;
  model?: string;
  modelProfileId?: string;
  referenceWorkId?: number;
};

export type ChatStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'conversation'; conversationId: string }
  | { type: 'work'; workId: number };

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

/** 只处理认证与传输；会话、消息和作品状态由 useChat 按事件更新。 */
export async function* streamChat(
  request: ChatRequest,
  signal: AbortSignal
): AsyncGenerator<ChatStreamEvent> {
  const body = JSON.stringify(request);
  const send = () => {
    const token = getAccessToken();
    return fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
      body,
    });
  };

  let response = await send();
  if (response.status === 401 && await refreshAccessToken()) {
    signal.throwIfAborted();
    response = await send();
  }
  if (!response.ok || !response.body) {
    throw new ChatRequestError(response.status, await response.text());
  }

  for await (const event of readChatEvents(response.body)) {
    signal.throwIfAborted();
    yield event;
  }
  signal.throwIfAborted();
}

/** 按 SSE 帧读取，兼容跨网络分片、CRLF、多行 data 和末尾没有空行的情况。 */
export async function* readChatEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<ChatStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';
  let dataLines: string[] = [];

  function* processLine(rawLine: string): Generator<ChatStreamEvent> {
    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
      return;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
      return;
    }
    if (line !== '') return;

    const type = eventType;
    const data = dataLines.join('\n');
    eventType = '';
    dataLines = [];
    if (!data) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      if (type === 'error') throw new ChatRequestError(undefined, data);
      return;
    }
    if (!parsed || typeof parsed !== 'object') {
      if (type === 'error') throw new ChatRequestError(undefined, parsed);
      return;
    }
    if (type === 'error' || 'error' in parsed || ('type' in parsed && parsed.type === 'error')) {
      throw new ChatRequestError(undefined, parsed);
    }

    // done 帧可能同时携带 conversationId 和 workId，两者都需要交给业务层。
    if ('conversationId' in parsed && typeof parsed.conversationId === 'string') {
      yield { type: 'conversation', conversationId: parsed.conversationId };
    }
    if ('text' in parsed && typeof parsed.text === 'string') {
      yield { type: 'text', text: parsed.text };
    }
    if ('workId' in parsed && typeof parsed.workId === 'number') {
      yield { type: 'work', workId: parsed.workId };
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) yield* processLine(line);
      if (done) break;
    }
    yield* processLine(buffer);
    yield* processLine('');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function chatErrorMessage(error: unknown): string {
  if (error instanceof ChatRequestError) {
    if (error.status === 401) return '登录已过期，请重新登录后再试。';
    if (error.status === 403) return '暂时无法使用 AI 服务，请检查账号权限后再试。';
    if (error.status === 429) return 'AI 服务当前请求较多，请稍等片刻后重新发送。';
    if (error.status === 504) return 'AI 服务响应超时，请稍后重新发送消息。';
  }
  if (error instanceof TypeError) return '暂时无法连接 AI 服务，请检查网络连接，稍后重新发送消息。';
  return 'AI 服务暂时不可用，本次回复未能完成。请稍后重新发送消息；如果持续失败，请联系管理员。';
}
