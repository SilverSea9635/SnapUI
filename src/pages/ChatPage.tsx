import { UserAvatar } from '@/components/UserAvatar';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Chat, type ChatComposePayload } from '@/components/Chat/Chat.tsx';
import { CodeSurface } from '@/components/Works/CodeSurface.tsx';
import { useChat } from '@/hooks/useChat.ts';
import { fetchConversations, createConversationApi } from '@/hooks/chatApi.ts';
import { useAuthStore, useUIStore } from '@/stores';
import './ChatPage.css';

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
};

/** 从作品广场带过来的「引用调整」上下文 */
type ReferenceContext = {
  workId: number;
  title: string;
  author: string;
  code: string;
};

function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const showToast = useUIStore((s) => s.showToast);
  const logout = useAuthStore((s) => s.logout);

  const { messages, isSending, sendMessage, stopGenerating, reset, loadConversation, deleteConversation, publishWork } = useChat();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvoId, setCurrentConvoId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reference, setReference] = useState<ReferenceContext | null>(null);
  const [referenceCodeOpen, setReferenceCodeOpen] = useState(false);

  const state = location.state as
    | { prompt?: string; conversationId?: string; reference?: ReferenceContext }
    | null;

  const promptSentRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const referenceConsumedRef = useRef(false);

  // Load conversation list from server on mount
  useEffect(() => {
    fetchConversations(1, 30)
      .then((data) => {
        setConversations(data.conversations || []);
      })
      .catch(() => {});
  }, []);

  // 引用模式：从作品详情页带着源码进来，开一段新对话等用户描述要怎么改
  useEffect(() => {
    if (!state?.reference || referenceConsumedRef.current) return;
    referenceConsumedRef.current = true;

    const incoming = state.reference;
    reset();
    setCurrentConvoId(null);
    setReference(incoming);
    setReferenceCodeOpen(false);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 处理首页示例等入口携带的提示词，先创建会话再发送
  useEffect(() => {
    if (state?.prompt && !promptSentRef.current) {
      promptSentRef.current = true;
      const prompt = state.prompt;
      navigate(location.pathname, { replace: true, state: null });

      createConversationApi(prompt.slice(0, 50))
        .then(({ conversationId }) => {
          setCurrentConvoId(conversationId);
          sendMessage({ text: prompt }, conversationId);
          refreshConversations();
        })
        .catch(() => {
          // Fallback: send without pre-created conversation
          const tempId = Date.now().toString();
          setCurrentConvoId(tempId);
          sendMessage({ text: prompt }, tempId);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load conversation from history page
  useEffect(() => {
    if (state?.conversationId && !historyLoadedRef.current) {
      historyLoadedRef.current = true;
      const convoId = state.conversationId;
      loadConversation(convoId);
      setCurrentConvoId(convoId);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewChat = () => {
    reset();
    setCurrentConvoId(null);
    setReference(null);
  };

  const refreshConversations = () => {
    fetchConversations(1, 30)
      .then((data) => {
        setConversations(data.conversations || []);
      })
      .catch(() => {});
  };

  const handleSendMessage = (payload: ChatComposePayload) => {
    const outgoing = {
      ...payload,
      referenceWorkId: reference?.workId,
      referenceTitle: reference?.title,
    };

    if (currentConvoId) {
      sendMessage(outgoing, currentConvoId);
      setTimeout(refreshConversations, 1000);
      return;
    }

    // Create conversation on the server first, then send the message
    const titleBase = reference ? `引用：${reference.title}` : payload.text;
    createConversationApi((titleBase || '').slice(0, 50))
      .then(({ conversationId }) => {
        setCurrentConvoId(conversationId);
        sendMessage(outgoing, conversationId);
        refreshConversations();
      })
      .catch(() => {
        // Fallback: use temp ID
        const tempId = Date.now().toString();
        setCurrentConvoId(tempId);
        sendMessage(outgoing, tempId);
        setTimeout(refreshConversations, 1000);
      });
  };

  // AI 产出了新的组件 → 引用上下文已经完成使命，清掉提示条
  const handleLastCodeChange = (code: string | null) => {
    if (!reference || !code) return;
    if (code.trim() !== reference.code.trim()) {
      setReference(null);
      setReferenceCodeOpen(false);
    }
  };

  const handleSelectConvo = (id: string) => {
    if (id === currentConvoId) return;
    loadConversation(id);
    setCurrentConvoId(id);
    setReference(null);
  };

  const handleDeleteConvo = async (id: string) => {
    await deleteConversation(id);
    const next = conversations.filter((c) => c.id !== id);
    setConversations(next);
    if (currentConvoId === id) {
      setCurrentConvoId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // 引用产出的作品默认只存不公开，用户在这里手动确认发布（或撤回）
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
      {/* ─── Sidebar ─── */}
      <aside className={`chat-sidebar${sidebarOpen ? '' : ' chat-sidebar--collapsed'}`}>
        <div className="chat-sidebar__header">
          <button className="chat-sidebar__new-btn" onClick={handleNewChat} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>新对话</span>
          </button>
        </div>

        <div className="chat-sidebar__list">
          {conversations.length === 0 ? (
            <p className="chat-sidebar__empty">暂无对话记录</p>
          ) : (
            conversations.map((convo) => (
              <button
                key={convo.id}
                className={`chat-sidebar__item${convo.id === currentConvoId ? ' chat-sidebar__item--active' : ''}`}
                type="button"
                onClick={() => handleSelectConvo(convo.id)}
              >
                <svg className="chat-sidebar__item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                <span className="chat-sidebar__item-title">{convo.title || '新对话'}</span>
                <span
                  className="chat-sidebar__item-delete"
                  role="button"
                  tabIndex={0}
                  aria-label="删除对话"
                  onClick={(e) => { e.stopPropagation(); handleDeleteConvo(convo.id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleDeleteConvo(convo.id); } }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </span>
              </button>
            ))
          )}
        </div>

        <Link className="chat-sidebar__history-link" to="/history">查看全部对话 →</Link>

        <div className="chat-sidebar__footer">
          <Link to="/profile" className="chat-sidebar__user">
            <div className="chat-sidebar__avatar">
              <UserAvatar
                avatar={user?.avatar}
                nickname={user?.nickname}
              />
            </div>
            <div className="chat-sidebar__user-info">
              <span className="chat-sidebar__username">{user?.nickname || '用户'}</span>
              <span className="chat-sidebar__user-email">{user?.email || ''}</span>
            </div>
          </Link>
          <div className="chat-sidebar__footer-actions">
            <button className="chat-sidebar__icon-btn" onClick={toggleTheme} type="button"
              aria-label={theme === 'light' ? '暗色模式' : '亮色模式'}
            >
              {theme === 'light' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>
            <button className="chat-sidebar__icon-btn" onClick={handleLogout} type="button" aria-label="退出登录">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Sidebar Toggle ─── */}
      <button
        className="chat-sidebar-toggle"
        onClick={() => setSidebarOpen((v) => !v)}
        type="button"
        aria-label={sidebarOpen ? '收起侧栏' : '展开侧栏'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {sidebarOpen ? (
            <><line x1="15" y1="18" x2="9" y2="12" /><line x1="9" y1="12" x2="15" y2="6" /></>
          ) : (
            <><line x1="9" y1="18" x2="15" y2="12" /><line x1="15" y1="12" x2="9" y2="6" /></>
          )}
        </svg>
      </button>

      {/* ─── Main Chat ─── */}
      <main className="chat-main">
        {reference ? (
          <>
            <div className="chat-reference">
              <span className="chat-reference__mark" aria-hidden="true">↳</span>
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
                <CodeSurface code={reference.code} maxHeight={260} />
              </div>
            ) : null}
          </>
        ) : null}

        <Chat
          messages={messages}
          sessionKey={currentConvoId || 'new'}
          onSendMessage={handleSendMessage}
          onStop={stopGenerating}
          disabled={isSending}
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
