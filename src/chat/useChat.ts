import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createConversationApi,
  deleteConversationApi,
  fetchConversationDetail,
  fetchConversations,
  type Conversation,
} from '@/api/chat';
import { chatErrorMessage, streamChat } from '@/api/chatStream';
import { updateWork } from '@/api/works';
import { useCreditsStore, useUIStore } from '@/stores';
import type { ChatComposePayload, ChatMessage } from './types';

/** 聊天业务的唯一状态入口：会话列表、历史加载、发送、停止与发布。 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const conversationRef = useRef<string | null>(null);
  const operationRef = useRef<AbortController | null>(null);
  const listRevisionRef = useRef(0);

  const refreshConversations = useCallback(async () => {
    const revision = ++listRevisionRef.current;
    try {
      const data = await fetchConversations(1, 30);
      if (revision === listRevisionRef.current) setConversations(data.conversations || []);
    } catch {
      // 侧栏刷新失败时保留已有列表，不打断当前聊天。
    }
  }, []);

  const cancelCurrentOperation = useCallback(() => {
    const controller = operationRef.current;
    operationRef.current = null;
    controller?.abort();
  }, []);

  useEffect(() => {
    const listRevision = listRevisionRef;
    void refreshConversations();
    return () => {
      listRevision.current++;
      cancelCurrentOperation();
    };
  }, [refreshConversations, cancelCurrentOperation]);

  const reset = useCallback(() => {
    cancelCurrentOperation();
    conversationRef.current = null;
    setConversationId(null);
    setMessages([]);
    setIsSending(false);
    setIsLoadingConversation(false);
  }, [cancelCurrentOperation]);

  const loadConversation = useCallback(async (id: string) => {
    cancelCurrentOperation();
    const controller = new AbortController();
    operationRef.current = controller;
    conversationRef.current = id;
    setConversationId(id);
    setMessages([]);
    setIsSending(false);
    setIsLoadingConversation(true);

    try {
      const detail = await fetchConversationDetail(id, controller.signal);
      if (operationRef.current !== controller) return;

      setMessages(detail.messages.map((message): ChatMessage => {
        const blocks = Array.isArray(message.content) ? message.content : [];
        const image = blocks.findLast((block) => block.type === 'image');
        return {
          id: message.id,
          type: message.role === 'user' ? 'user' : 'ai',
          content: typeof message.content === 'string'
            ? message.content
            : blocks.filter((block) => block.type === 'text').map((block) => block.text || '').join(''),
          attachment: image?.attachment,
          imageUnavailable: Boolean(image && !image.attachment),
          time: new Date(message.createdAt).getTime(),
        };
      }));
    } catch {
      if (operationRef.current === controller) setMessages([]);
    } finally {
      if (operationRef.current === controller) {
        operationRef.current = null;
        setIsLoadingConversation(false);
      }
    }
  }, [cancelCurrentOperation]);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await deleteConversationApi(id);
      // 让删除之前发出的列表请求失效，避免已删除的会话重新出现在侧栏。
      listRevisionRef.current++;
      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (conversationRef.current === id) reset();
    } catch {
      useUIStore.getState().showToast('error', '删除对话失败，请稍后重试');
    }
  }, [reset]);

  const stopGenerating = useCallback(() => {
    operationRef.current?.abort();
  }, []);

  const sendMessage = useCallback(async (payload: ChatComposePayload) => {
    // 1. 检查输入与积分；同步锁住本次操作，创建会话期间也不能重复发送。
    if (operationRef.current) return;
    const text = payload.text.trim();
    if (!text && !payload.attachment) return;
    const isReference = Boolean(payload.referenceWorkId);
    const mode = isReference ? 'adjust' : payload.mode || 'new';
    const cost = mode === 'adjust' ? 2 : 5;
    if (useCreditsStore.getState().balance < cost) {
      useUIStore.getState().showToast('error', '积分不足，请签到或充值后再试');
      return;
    }

    const controller = new AbortController();
    operationRef.current = controller;
    const userMessageId = crypto.randomUUID();
    const aiMessageId = crypto.randomUUID();
    setIsSending(true);
    setMessages((current) => [...current, {
      id: userMessageId,
      type: 'user',
      content: text,
      attachment: payload.attachment,
      time: Date.now(),
      reference: isReference
        ? { workId: payload.referenceWorkId!, title: payload.referenceTitle || '' }
        : undefined,
    }, { id: aiMessageId, type: 'ai', content: '', time: Date.now() }]);

    try {
      // 2. 复用当前会话，或先创建会话。保留原先创建失败后使用临时 ID 的兼容行为。
      let id = conversationRef.current;
      if (!id) {
        const title = isReference ? `引用：${payload.referenceTitle || ''}` : text;
        try {
          const created = await createConversationApi(title.slice(0, 50), controller.signal);
          id = created.conversationId;
        } catch (error) {
          if (controller.signal.aborted) throw error;
          id = Date.now().toString();
        }
        if (operationRef.current !== controller) return;
        conversationRef.current = id;
        setConversationId(id);
        void refreshConversations();
      }

      // 3. 发送原始需求，按顺序处理回复。SSE 解码与认证细节在 api/chatStream.ts。
      for await (const event of streamChat({
        message: text,
        conversationId: id,
        mode,
        attachmentId: payload.attachment?.id,
        refreshImageDescription: payload.refreshImageDescription || undefined,
        model: payload.model || undefined,
        modelProfileId: payload.modelProfileId || undefined,
        referenceWorkId: isReference ? payload.referenceWorkId : undefined,
      }, controller.signal)) {
        if (operationRef.current !== controller) return;
        switch (event.type) {
          case 'conversation':
            conversationRef.current = event.conversationId;
            setConversationId(event.conversationId);
            break;
          case 'text':
            setMessages((current) => current.map((message) => message.id === aiMessageId
              ? { ...message, content: message.content + event.text }
              : message));
            break;
          case 'work':
            setMessages((current) => current.map((message) => message.id === aiMessageId
              ? { ...message, savedWork: {
                id: event.workId,
                title: payload.referenceTitle || '引用调整的作品',
                isPublic: false,
              } }
              : message));
            break;
        }
      }

      // 4. 成功完成后扣积分。旧任务不能更新新会话的消息或结束新任务的发送状态。
      if (operationRef.current !== controller || controller.signal.aborted) return;
      void useCreditsStore.getState().deduct(cost, mode === 'adjust' ? 'AI 组件调整' : 'AI 组件生成').catch(() => {});
    } catch (error) {
      if (operationRef.current !== controller) return;
      const stopped = controller.signal.aborted;
      if (!stopped) console.error('[chat] AI 服务请求失败', error);
      setMessages((current) => current.map((message) => message.id === aiMessageId
        ? { ...message, content: stopped ? message.content || '（已停止生成）' : chatErrorMessage(error) }
        : message));
    } finally {
      if (operationRef.current === controller) {
        operationRef.current = null;
        setIsSending(false);
        void refreshConversations();
      }
    }
  }, [refreshConversations]);

  /** 引用生成的作品已保存为私有；用户确认后才公开，也可撤回。 */
  const publishWork = useCallback(async (
    workId: number,
    isPublic: boolean
  ) => {
    await updateWork(workId, { isPublic });
    setMessages((current) => current.map((message) => message.savedWork?.id === workId
      ? { ...message, savedWork: { ...message.savedWork, isPublic } }
      : message));
  }, []);

  return {
    messages, conversations, conversationId, isSending, isLoadingConversation,
    sendMessage, stopGenerating, reset, loadConversation, deleteConversation, publishWork,
  };
}
