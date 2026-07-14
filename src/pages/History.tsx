import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchConversations, deleteConversationApi } from '@/hooks/useChat.ts';
import { useUIStore } from '@/stores';
import './History.css';

type ConversationItem = {
  id: string;
  title: string;
  createdAt: string;
};

function History() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  const loadPage = (p: number) => {
    setLoading(true);
    fetchConversations(p, pageSize)
      .then((data) => {
        setConversations(data.conversations || []);
        setTotal(data.total || 0);
        setPage(p);
      })
      .catch(() => {
        showToast('error', '获取对话历史失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversationApi(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => prev - 1);
      showToast('success', '对话已删除');
    } catch {
      showToast('error', '删除失败');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const dayMs = 86400000;

    if (diff < dayMs && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 2 * dayMs) return '昨天';
    if (diff < 7 * dayMs) return `${Math.floor(diff / dayMs)}天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="history-page">
      <div className="history-container">
        <div className="history-header">
          <button className="history-back" onClick={() => navigate(-1)} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            返回
          </button>
          <h1 className="history-title">对话历史</h1>
          <span className="history-count">{total} 条对话</span>
        </div>

        {loading ? (
          <div className="history-loading">
            <div className="history-spinner" />
            <span>加载中...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="history-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.3">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p>暂无对话记录</p>
            <button className="history-empty-btn" onClick={() => navigate('/chat')} type="button">
              开始新对话
            </button>
          </div>
        ) : (
          <>
            <div className="history-list">
              {conversations.map((convo) => (
                <div
                  key={convo.id}
                  className="history-card"
                  onClick={() => navigate(`/history/${convo.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/history/${convo.id}`); }}
                >
                  <div className="history-card__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div className="history-card__body">
                    <h3 className="history-card__title">{convo.title || '新对话'}</h3>
                    <span className="history-card__date">{formatDate(convo.createdAt)}</span>
                  </div>
                  <button
                    className="history-card__delete"
                    onClick={(e) => handleDelete(convo.id, e)}
                    type="button"
                    aria-label="删除对话"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="history-pagination">
                <button
                  className="history-page-btn"
                  disabled={page <= 1}
                  onClick={() => loadPage(page - 1)}
                  type="button"
                >
                  上一页
                </button>
                <span className="history-page-info">{page} / {totalPages}</span>
                <button
                  className="history-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => loadPage(page + 1)}
                  type="button"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default History;
