import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CodeSurface } from '@/components/Works/CodeSurface';
import { useUIStore } from '@/stores';
import { Chat } from './Chat';
import { ChatSidebar } from './ChatSidebar';
import { useChat } from './useChat';
import type { ChatComposePayload, ChatRouteState, ReferenceContext } from './types';
import './ChatPage.css';

/** 页面只处理路由入口、作品引用上下文和布局；会话状态统一由 useChat 管理。 */
function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useUIStore((s) => s.showToast);
  const {
    messages, conversations, conversationId, isSending, isLoadingConversation,
    sendMessage, stopGenerating, reset, loadConversation, deleteConversation, publishWork,
  } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reference, setReference] = useState<ReferenceContext | null>(null);
  const [referenceCodeOpen, setReferenceCodeOpen] = useState(false);
  const state = location.state as ChatRouteState;

  // 统一消费首页需求、历史会话和作品引用入口。清理可避免 StrictMode 重复提交。
  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      navigate(location.pathname, { replace: true, state: null });
      if (state.reference) {
        reset();
        setReference(state.reference);
        setReferenceCodeOpen(false);
      } else if (state.prompt) {
        void sendMessage({ text: state.prompt });
      } else if (state.conversationId) {
        setReference(null);
        void loadConversation(state.conversationId);
      }
    });
    return () => { cancelled = true; };
  }, [state, navigate, location.pathname, reset, sendMessage, loadConversation]);

  const handleNewChat = () => {
    reset();
    setReference(null);
    setReferenceCodeOpen(false);
  };

  const handleSelectConvo = (id: string) => {
    if (id === conversationId) return;
    setReference(null);
    setReferenceCodeOpen(false);
    void loadConversation(id);
  };

  const handleSendMessage = (payload: ChatComposePayload) => {
    void sendMessage({
      ...payload,
      referenceWorkId: reference?.workId,
      referenceTitle: reference?.title,
    });
  };

  // 引用组件产生新代码后，结束引用提示；来源仍保存在这轮用户消息上。
  const handleLastCodeChange = (code: string | null) => {
    if (reference && code && code.trim() !== reference.code.trim()) {
      setReference(null);
      setReferenceCodeOpen(false);
    }
  };

  const handlePublishWork = async (
    workId: number,
    isPublic: boolean
  ) => {
    try {
      await publishWork(workId, isPublic);
      showToast('success', isPublic ? '已发布到作品广场' : '已撤回，改为仅自己可见');
    } catch {
      showToast('error', isPublic ? '发布失败，请稍后重试' : '撤回失败，请稍后重试');
    }
  };

  return (
    <div className="chat-page">
      <ChatSidebar
        conversations={conversations}
        conversationId={conversationId}
        sidebarOpen={sidebarOpen}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConvo}
        onDeleteConversation={deleteConversation}
      />
      {/* ─── Sidebar Toggle ─── */}
      <button
        className="chat-sidebar-toggle"
        onClick={() => setSidebarOpen((v) => !v)}
        type="button"
        aria-label={sidebarOpen ? '收起侧栏' : '展开侧栏'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <polyline points={sidebarOpen ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
        </svg>
      </button>

      {/* ─── Main Chat ─── */}
      <main className="chat-main">
        {reference ? (
          <>
            <div className="chat-reference">
              <span
                className="chat-reference__mark"
                aria-hidden="true"
              >↳
              </span>
              <span className="chat-reference__body">
                <span className="chat-reference__title">正在引用 {reference.author}《{reference.title}》</span>
                <span className="chat-reference__hint">
                  描述你要改的地方（配色、布局、文案都行），产出的新组件会自动记到你的作品里。
                </span>
              </span>
              <button
                className="chat-reference__toggle"
                onClick={() => setReferenceCodeOpen((v) => !v)}
                type="button"
              >
                {referenceCodeOpen ? '收起源码' : '看源码'}
              </button>
              <button
                className="chat-reference__close"
                onClick={() => { setReference(null); setReferenceCodeOpen(false); }}
                type="button"
                aria-label="取消引用"
                title="取消引用"
              >
                ×
              </button>
            </div>
            {referenceCodeOpen ? (
              <div className="chat-reference__code">
                <CodeSurface
                  code={reference.code}
                  maxHeight={260}
                />
              </div>
            ) : null}
          </>
        ) : null}

        <Chat
          messages={messages}
          sessionKey={conversationId || 'new'}
          onSendMessage={handleSendMessage}
          onStop={stopGenerating}
          disabled={isSending || isLoadingConversation}
          isSending={isSending}
          active
          referenceMode={Boolean(reference)}
          onLastCodeChange={handleLastCodeChange}
          onPublishWork={handlePublishWork}
          showStarterPrompts
          welcomeText={reference ? `引用《${reference.title}》，告诉我你想改什么` : '我是 SnapUI，专注于将想法变为组件'}
          welcomeDescription={
            reference
              ? '例如：把主色换成墨绿、卡片改成两列、标题字号加大一档。我会在原组件基础上改，不会从零重写。'
              : '上传一张截图、粘贴一段设计稿，或用一句话描述你要的组件，我来生成可运行的代码。'
          }
          inputPlaceholder={
            reference ? '描述要调整的地方，按 Enter 发送' : '描述你想要的组件，或上传截图，按 Enter 发送'
          }
        />
      </main>
    </div>
  );
}

export default ChatPage;
