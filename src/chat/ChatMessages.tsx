import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { UserAvatar } from '@/components/UserAvatar';
import { LivePreview } from '@/components/Preview/LivePreview';
import type { ImageAttachment } from '@/api/attachments';
import { useAuthStore } from '@/stores';
import { AttachmentImage } from './AttachmentImage';
import { PublishWorkButton } from './PublishWorkButton';
import { SourceModal } from './SourceModal';
import { FullscreenModal } from './FullscreenModal';
import { COMPONENT_PROMPTS } from './componentPrompts';
import { formatTime, parseAIReply } from './chatUtils';
import type { ChatMessage } from './types';

type ChatMessagesProps = {
  messages: ChatMessage[];
  disabled: boolean;
  isSending: boolean;
  active: boolean;
  welcomeText: string;
  welcomeDescription: string;
  showStarterPrompts: boolean;
  referenceMode: boolean;
  hasLastCode: boolean;
  imageUploading: boolean;
  onSelectPrompt: (prompt: string) => void;
  onSelectImage: (attachment: ImageAttachment) => void;
  onPublishWork?: (
    workId: number,
    isPublic: boolean
  ) => void;
};

/** 消息展示、历史截图入口与代码预览；输入草稿由 Chat 管理。 */
export function ChatMessages({
  messages, disabled, isSending, active, welcomeText, welcomeDescription,
  showStarterPrompts, referenceMode, hasLastCode, imageUploading,
  onSelectPrompt, onSelectImage, onPublishWork,
}: ChatMessagesProps) {
  const user = useAuthStore((s) => s.user);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [viewingCode, setViewingCode] = useState<string | null>(null);
  const [fullscreenCode, setFullscreenCode] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) {
      return;
    }

    const handleScroll = () => {
      setShowScrollTop(node.scrollTop > 20);
    };

    handleScroll();
    node.addEventListener('scroll', handleScroll);

    return () => {
      node.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    messagesRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    const node = messagesRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  };

  const handleCopy = (
    code: string,
    id: string | number
  ) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <>
      <div
        className={`chat__messages${active ? '' : ' chat__messages--hidden'}`}
        ref={messagesRef}
      >
        {messages.length === 0 ? (
          <div className="chat__welcome">
            <div className="chat__welcome-badge">AI</div>
            <h1 className="chat__welcome-title">{welcomeText}</h1>
            <p className="chat__welcome-description">{welcomeDescription}</p>
            {showStarterPrompts && !referenceMode && (
              <div className="chat__starters">
                <p className="chat__starter-guide">描述需求或上传截图 → AI 生成组件 → 预览与调整</p>
                <div className="chat__starter-grid">
                  {COMPONENT_PROMPTS.map((template) => (
                    <button
                      className="chat__starter"
                      type="button"
                      key={template.title}
                      disabled={disabled || isSending}
                      onClick={() => {
                        onSelectPrompt(template.prompt);
                      }}
                    >
                      <strong>{template.title}</strong><span>{template.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="chat__starter-hint">
                  选择一个起点，按你的需求修改后发送；也可以
                  <Link to="/gallery">去作品广场引用作品</Link>。
                </p>
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => {
            const reply = message.type === 'ai' ? parseAIReply(message.content) : null;
            const jsx = reply?.code;
            return (
              <article
                className={`chat__message chat__message--${message.type}`}
                key={message.id}
              >
                <div
                  className="chat__avatar"
                  aria-hidden="true"
                >
                  {message.type === 'user' ? (
                    <UserAvatar
                      avatar={user?.avatar}
                      nickname={user?.nickname}
                    />
                  ) : (
                    '✦'
                  )}
                </div>
                <div className="chat__bubble">
                  {message.reference ? (
                    <Link
                      className="chat__reference-chip"
                      to={`/works/${message.reference.workId}`}
                    >
                      <span aria-hidden="true">↳</span>
                      引用自《{message.reference.title || '未命名作品'}》
                    </Link>
                  ) : null}
                  {message.attachment ? (
                    <div className="chat__image-block">
                      <AttachmentImage
                        attachment={message.attachment}
                        className="chat__message-image"
                      />
                      <button
                        className="chat__code-btn"
                        type="button"
                        disabled={disabled || imageUploading}
                        onClick={() => {
                          onSelectImage(message.attachment!);
                        }}
                      >{hasLastCode || referenceMode ? '用于调整' : '使用这张截图'}
                      </button>
                    </div>
                  ) : message.imageUnavailable ?
                    <p className="chat__image-unavailable">旧截图未保存原图，需要重新上传</p> : null}
                  {jsx ? (
                    <>
                      <div className="chat__preview-container">
                        <LivePreview code={jsx} />
                      </div>
                      <div className="chat__code-actions">
                        <button
                          className="chat__code-btn"
                          onClick={() => setFullscreenCode(jsx)}
                          type="button"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line
                              x1="21"
                              y1="3"
                              x2="14"
                              y2="10"
                            />
                            <line
                              x1="3"
                              y1="21"
                              x2="10"
                              y2="14"
                            />
                          </svg>
                          <span>全屏预览</span>
                        </button>
                        <button
                          className="chat__code-btn"
                          onClick={() => setViewingCode(jsx)}
                          type="button"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M16 18l6-6-6-6" />
                            <path d="M8 6l-6 6 6 6" />
                          </svg>
                          <span>查看源码</span>
                        </button>
                        <button
                          className="chat__code-btn"
                          onClick={() => handleCopy(jsx, message.id)}
                          type="button"
                        >
                          {copiedId === message.id ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          ) : (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          )}
                          <span>{copiedId === message.id ? '已复制' : '复制代码'}</span>
                        </button>
                        {message.savedWork ? (
                          <button
                            className={`chat__code-btn chat__code-btn--publish${message.savedWork.isPublic ? ' is-published' : ''}`}
                            onClick={() => onPublishWork?.(message.savedWork!.id, !message.savedWork!.isPublic)}
                            type="button"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 19V5" />
                              <path d="M5 12l7-7 7 7" />
                            </svg>
                            <span>{message.savedWork.isPublic ? '已发布 · 撤回' : '发布到广场'}</span>
                          </button>
                        ) : <PublishWorkButton
                          code={jsx}
                          messageId={message.id}
                          disabled={isSending}
                            />}
                      </div>
                    </>
                  ) : null}
                  {reply?.markdown.trim() ? (
                    <div className="chat__markdown">
                      <Markdown remarkPlugins={[remarkGfm]}>{reply.markdown}</Markdown>
                    </div>
                  ) : !reply && message.content ? (
                    <p className="chat__text">{message.content}</p>
                  ) : reply && !jsx && isSending ? (
                    <div className="chat__typing">
                      <span className="chat__typing-dot" />
                      <span className="chat__typing-dot" />
                      <span className="chat__typing-dot" />
                    </div>
                  ) : null}

                  {message.savedWork ? (
                    <div className={`chat__saved-work${message.savedWork.isPublic ? ' is-published' : ''}`}>
                      <span
                        className="chat__saved-work__mark"
                        aria-hidden="true"
                      >
                        {message.savedWork.isPublic ? '✓' : '★'}
                      </span>
                      <span className="chat__saved-work__text">
                        {message.savedWork.isPublic
                          ? `《${message.savedWork.title}》已发布到作品广场`
                          : `《${message.savedWork.title}》已记入你的作品（仅自己可见）`}
                      </span>
                      <Link
                        className="chat__saved-work__link"
                        to={`/works/${message.savedWork.id}`}
                      >
                        查看
                      </Link>
                      {!message.savedWork.isPublic ? (
                        <button
                          className="chat__saved-work__publish"
                          onClick={() => onPublishWork?.(message.savedWork!.id, true)}
                          type="button"
                        >
                          确认发布
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <time className="chat__time">{formatTime(message.time)}</time>
                </div>
              </article>
            );
          })
        )}
      </div>

      {active && (
        <button
          className="chat__scroll-button"
          onClick={showScrollTop ? scrollToTop : scrollToBottom}
          type="button"
        >
          {showScrollTop ? '↑' : '↓'}
        </button>
      )}

      {viewingCode !== null && (
        <SourceModal
          code={viewingCode}
          copied={copiedId === 'modal'}
          onCopy={(code) => handleCopy(code, 'modal')}
          onClose={() => setViewingCode(null)}
        />
      )}

      {fullscreenCode !== null && (
        <FullscreenModal
          code={fullscreenCode}
          copied={copiedId === 'fullscreen'}
          onCopy={(code) => handleCopy(code, 'fullscreen')}
          onClose={() => setFullscreenCode(null)}
        />
      )}
    </>
  );
}
