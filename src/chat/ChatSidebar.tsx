import { Link, useNavigate } from 'react-router-dom';
import type { Conversation } from '@/api/chat';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuthStore, useUIStore } from '@/stores';

type ChatSidebarProps = {
  conversations: Conversation[];
  conversationId: string | null;
  sidebarOpen: boolean;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => Promise<void>;
};

export function ChatSidebar({
  conversations, conversationId, sidebarOpen, onNewChat, onSelectConversation, onDeleteConversation,
}: ChatSidebarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className={`chat-sidebar${sidebarOpen ? '' : ' chat-sidebar--collapsed'}`}>
      <div className="chat-sidebar__header">
        <button
          className="chat-sidebar__new-btn"
          onClick={onNewChat}
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line
              x1="12"
              y1="5"
              x2="12"
              y2="19"
            />
            <line
              x1="5"
              y1="12"
              x2="19"
              y2="12"
            />
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
              className={`chat-sidebar__item${convo.id === conversationId ? ' chat-sidebar__item--active' : ''}`}
              type="button"
              onClick={() => onSelectConversation(convo.id)}
            >
              <svg
                className="chat-sidebar__item-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <span className="chat-sidebar__item-title">{convo.title || '新对话'}</span>
              <span
                className="chat-sidebar__item-delete"
                role="button"
                tabIndex={0}
                aria-label="删除对话"
                onClick={(e) => { e.stopPropagation(); void onDeleteConversation(convo.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void onDeleteConversation(convo.id); } }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <line
                    x1="10"
                    y1="11"
                    x2="10"
                    y2="17"
                  />
                  <line
                    x1="14"
                    y1="11"
                    x2="14"
                    y2="17"
                  />
                </svg>
              </span>
            </button>
          ))
        )}
      </div>

      <Link
        className="chat-sidebar__history-link"
        to="/history"
      >查看全部对话 →
      </Link>

      <div className="chat-sidebar__footer">
        <Link
          to="/profile"
          className="chat-sidebar__user"
        >
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
          <button
            className="chat-sidebar__icon-btn"
            onClick={toggleTheme}
            type="button"
            aria-label={theme === 'light' ? '暗色模式' : '亮色模式'}
          >
            {theme === 'light' ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="5"
                />
                <line
                  x1="12"
                  y1="1"
                  x2="12"
                  y2="3"
                /><line
                  x1="12"
                  y1="21"
                  x2="12"
                  y2="23"
                  />
                <line
                  x1="4.22"
                  y1="4.22"
                  x2="5.64"
                  y2="5.64"
                /><line
                  x1="18.36"
                  y1="18.36"
                  x2="19.78"
                  y2="19.78"
                  />
                <line
                  x1="1"
                  y1="12"
                  x2="3"
                  y2="12"
                /><line
                  x1="21"
                  y1="12"
                  x2="23"
                  y2="12"
                  />
                <line
                  x1="4.22"
                  y1="19.78"
                  x2="5.64"
                  y2="18.36"
                /><line
                  x1="18.36"
                  y1="5.64"
                  x2="19.78"
                  y2="4.22"
                  />
              </svg>
            )}
          </button>
          <button
            className="chat-sidebar__icon-btn"
            onClick={handleLogout}
            type="button"
            aria-label="退出登录"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line
                x1="21"
                y1="12"
                x2="9"
                y2="12"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>

  );
}
