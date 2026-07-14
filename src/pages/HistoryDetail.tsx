import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import 'highlight.js/styles/github-dark.css';
import { fetchConversationDetail } from '@/hooks/useChat.ts';
import { LivePreview } from '@/components/Chat/LivePreview.tsx';
import { useUIStore } from '@/stores';
import './HistoryDetail.css';

hljs.registerLanguage('typescript', typescript);

type MessageItem = {
  id: number;
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string }>;
  createdAt: string;
};

type ConversationDetail = {
  conversationId: string;
  title: string;
  createdAt: string;
  messages: MessageItem[];
};

function extractJSX(content: string): string | null {
  const match = content.match(/```(?:tsx?|jsx?)\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function getTextContent(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text!)
      .join('');
  }
  return '';
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HistoryDetail() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [fullscreenCode, setFullscreenCode] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    fetchConversationDetail(conversationId)
      .then((data) => setDetail(data))
      .catch(() => showToast('error', '获取对话详情失败'))
      .finally(() => setLoading(false));
  }, [conversationId, showToast]);

  const handleCopy = async (code: string, msgId: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('error', '复制失败');
    }
  };

  if (loading) {
    return (
      <div className="detail-page">
        <div className="detail-loading">
          <div className="detail-spinner" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="detail-page">
        <div className="detail-empty">
          <p>对话不存在或已被删除</p>
          <button className="detail-back-btn" onClick={() => navigate('/history')} type="button">
            返回历史列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-page">
      {/* ─── Header ─── */}
      <div className="detail-header">
        <button className="detail-back" onClick={() => navigate('/history')} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          返回
        </button>
        <h1 className="detail-title">{detail.title || '新对话'}</h1>
        <span className="detail-date">
          {new Date(detail.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* ─── Messages ─── */}
      <div className="detail-messages">
        {detail.messages.map((msg) => {
          const text = getTextContent(msg.content);
          const jsx = msg.role === 'assistant' ? extractJSX(text) : null;

          return (
            <div key={msg.id} className={`detail-msg detail-msg--${msg.role}`}>
              <div className="detail-msg__avatar">
                {msg.role === 'user' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1.27a2 2 0 01-3.46 0H6.73a2 2 0 01-3.46 0H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
                  </svg>
                )}
              </div>

              <div className="detail-msg__body">
                <div className="detail-msg__header">
                  <span className="detail-msg__role">{msg.role === 'user' ? '你' : 'AI'}</span>
                  <span className="detail-msg__time">{formatTime(msg.createdAt)}</span>
                </div>

                {jsx ? (
                  <>
                    <div className="detail-msg__preview">
                      <LivePreview code={jsx} />
                    </div>
                    <div className="detail-msg__actions">
                      <button
                        className="detail-msg__action-btn"
                        onClick={() => setFullscreenCode(jsx)}
                        type="button"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                          <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                        全屏预览
                      </button>
                      <button
                        className="detail-msg__action-btn"
                        onClick={() => handleCopy(jsx, msg.id)}
                        type="button"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                        {copiedId === msg.id ? '已复制' : '复制代码'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="detail-msg__text">
                    {text.split('```').map((part, i) => {
                      if (i % 2 === 1) {
                        // Code block
                        const lines = part.split('\n');
                        const lang = lines[0]?.trim() || '';
                        const code = (lang ? lines.slice(1) : lines).join('\n').trim();
                        const highlighted = lang
                          ? hljs.highlight(code, { language: lang === 'tsx' || lang === 'ts' ? 'typescript' : lang }).value
                          : hljs.highlightAuto(code).value;
                        return (
                          <pre key={i} className="detail-msg__code">
                            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                          </pre>
                        );
                      }
                      // Regular text - split by newlines
                      return part.split('\n').map((line, j) => (
                        <span key={`${i}-${j}`}>
                          {line}
                          {j < part.split('\n').length - 1 && <br />}
                        </span>
                      ));
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Continue Chat Button ─── */}
      <div className="detail-footer">
        <button
          className="detail-continue-btn"
          onClick={() => navigate('/chat', { state: { conversationId: detail.conversationId } })}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          继续对话
        </button>
      </div>

      {/* ─── Fullscreen Code Modal ─── */}
      {fullscreenCode && (
        <div className="detail-fullscreen" onClick={() => setFullscreenCode(null)}>
          <div className="detail-fullscreen__content" onClick={(e) => e.stopPropagation()}>
            <div className="detail-fullscreen__header">
              <span>组件预览</span>
              <button className="detail-fullscreen__close" onClick={() => setFullscreenCode(null)} type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="detail-fullscreen__body">
              <LivePreview code={fullscreenCode} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryDetail;
