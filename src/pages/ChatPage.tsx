import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Chat } from '@/components/Chat/Chat.tsx';
import { useChat, fetchConversations, createConversationApi } from '@/hooks/useChat.ts';
import { useAuthStore, useUIStore } from '@/stores';
import './ChatPage.css';

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
};

function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const logout = useAuthStore((s) => s.logout);

  const { messages, isSending, sendMessage, stopGenerating, reset, loadConversation, deleteConversation } = useChat();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvoId, setCurrentConvoId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const state = location.state as { prompt?: string; conversationId?: string } | null;

  const promptSentRef = useRef(false);
  const historyLoadedRef = useRef(false);

  // Load conversation list from server on mount
  useEffect(() => {
    fetchConversations()
      .then((data) => {
        setConversations(data.conversations || []);
      })
      .catch(() => {});
  }, []);

  // Send initial prompt from QuickStart — proactively create conversation first
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
  };

  const refreshConversations = () => {
    fetchConversations()
      .then((data) => {
        setConversations(data.conversations || []);
      })
      .catch(() => {});
  };

  const handleSendMessage = (payload: { text: string; imageDataUrl?: string; media_type?: string }) => {
    if (currentConvoId) {
      sendMessage(payload, currentConvoId);
      setTimeout(refreshConversations, 1000);
    } else {
      // Create conversation on the server first, then send the message
      const title = payload.text?.slice(0, 50) || '';
      createConversationApi(title)
        .then(({ conversationId }) => {
          setCurrentConvoId(conversationId);
          sendMessage(payload, conversationId);
          refreshConversations();
        })
        .catch(() => {
          // Fallback: use temp ID
          const tempId = Date.now().toString();
          setCurrentConvoId(tempId);
          sendMessage(payload, tempId);
          setTimeout(refreshConversations, 1000);
        });
    }
  };

  const handleSelectConvo = (id: string) => {
    if (id === currentConvoId) return;
    loadConversation(id);
    setCurrentConvoId(id);
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

        <div className="chat-sidebar__footer">
          <Link to="/profile" className="chat-sidebar__user">
            <div className="chat-sidebar__avatar">
              {user?.nickname?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="chat-sidebar__user-info">
              <span className="chat-sidebar__username">{user?.nickname || '用户'}</span>
              <span className="chat-sidebar__user-email">{user?.email || ''}</span>
            </div>
          </Link>
          <div className="chat-sidebar__footer-actions">
            <button className="chat-sidebar__icon-btn" onClick={toggleTheme} type="button"
              aria-label={theme === 'light' ? '暗色模式' : '亮色模式'}>
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
        <Chat
          messages={messages}
          onSendMessage={handleSendMessage}
          onStop={stopGenerating}
          disabled={isSending}
          isSending={isSending}
          active={messages.length > 0}
          welcomeText="我是 SnapUI，专注于将想法变为组件"
          welcomeDescription="上传一张截图、粘贴一段设计稿，或用一句话描述你要的组件，我来生成可运行的代码。"
          inputPlaceholder="描述你想要的组件，或上传截图，按 Enter 发送"
        />
      </main>
    </div>
  );
}

export default ChatPage;
