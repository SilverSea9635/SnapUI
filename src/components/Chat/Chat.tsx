import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import 'highlight.js/styles/github-dark.css';
import './Chat.css';
import { LivePreview } from './LivePreview.tsx';

hljs.registerLanguage('typescript', typescript);

export type ChatMessage = {
  id: string | number;
  type: 'user' | 'ai';
  content: string;
  time: Date | number | string;
  imageUrl?: string;
};

export type ChatComposePayload = {
  text: string;
  imageDataUrl?: string;
  media_type?: string;
  imageName?: string;
  mode?: 'new' | 'adjust';
};

type ChatProps = {
  messages: ChatMessage[];
  onSendMessage?: (payload: ChatComposePayload) => void;
  onStop?: () => void;
  welcomeText?: string;
  welcomeDescription?: string;
  inputPlaceholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  active?: boolean;
};

type SelectedImage = {
  dataUrl: string;
  name: string;
  size: number;
  media_type: string;
};

const MAX_IMAGE_SIZE = 2048 * 1024;

function formatTime(time: ChatMessage['time']) {
  const date = time instanceof Date ? time : new Date(time);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour:'2-digit',
    minute:'2-digit'
  }).format(date);
}

function formatFileSize(size: number) {
  return `${ ( size / 1024 ).toFixed(0) } KB`;
}

// 提取完整的代码块（```tsx 或 ```jsx 包裹，且已闭合）
function extractJSX(content: string): string | null {
  const match = content.match(/```(?:tsx?|jsx?)\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('图片读取失败'));
    };

    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

export function Chat({
                       messages,
                       onSendMessage,
                       onStop,
                       welcomeText = '我是 AI 助手，很高兴见到你。',
                       welcomeDescription = '我可以帮你整理思路、回答问题，或继续扩展成真实对话页。',
                       inputPlaceholder = '输入消息，按 Enter 发送',
                       disabled = false,
                       isSending = false,
                       active = true
                     }: ChatProps) {
  const [ inputMessage, setInputMessage ] = useState('');
  const [ showScrollTop, setShowScrollTop ] = useState(false);
  const [ selectedImage, setSelectedImage ] = useState<SelectedImage | null>(null);
  const [ uploadError, setUploadError ] = useState('');
  const [ viewingCode, setViewingCode ] = useState<string | null>(null);
  const [ fullscreenCode, setFullscreenCode ] = useState<string | null>(null);
  const [ copiedId, setCopiedId ] = useState<string | number | null>(null);
  const [ mode, setMode ] = useState<'new' | 'adjust'>('new');
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 检测最近一条 AI 消息是否包含代码块
  const hasLastCode = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'ai' && messages[i].content) {
        return extractJSX(messages[i].content) !== null;
      }
    }
    return false;
  }, [ messages ]);

  // 没有可调整的代码时，强制切回"新增"模式
  useEffect(() => {
    if (!hasLastCode && mode === 'adjust') {
      setMode('new');
    }
  }, [ hasLastCode, mode ]);

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [ messages ]);

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

  const canSend = useMemo(
    () => ( inputMessage.trim().length > 0 || selectedImage !== null ) && !disabled,
    [ disabled, inputMessage, selectedImage ]
  );

  const handleSelectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setSelectedImage(null);
      setUploadError('只能上传图片文件。');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setSelectedImage(null);
      setUploadError('图片大小不能超过 2MB。');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      console.log(file);
      setSelectedImage({
        dataUrl,
        name:file.name,
        size:file.size,
        media_type:file.type
      });
      setUploadError('');
    } catch (error) {
      setSelectedImage(null);
      setUploadError(error instanceof Error ? error.message : '图片读取失败');
    } finally {
      event.target.value = '';
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = () => {
    const text = inputMessage.trim();
    if (!text && !selectedImage) {
      return;
    }
    onSendMessage?.({
      text,
      imageDataUrl:selectedImage?.dataUrl,
      media_type:selectedImage?.media_type,
      imageName:selectedImage?.name || '',
      mode
    });
    setInputMessage('');
    clearSelectedImage();
    setUploadError('');
  };

  const scrollToTop = () => {
    messagesRef.current?.scrollTo({ top:0, behavior:'smooth' });
  };

  const scrollToBottom = () => {
    const node = messagesRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({ top:node.scrollHeight, behavior:'smooth' });
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleCopy = (code: string, id: string | number) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <section className="chat">
      <div className={ `chat__messages${ active ? '' : ' chat__messages--hidden' }` } ref={ messagesRef }>
        { messages.length === 0 ? (
          <div className="chat__welcome">
            <div className="chat__welcome-badge">AI</div>
            <h1 className="chat__welcome-title">{ welcomeText }</h1>
            <p className="chat__welcome-description">{ welcomeDescription }</p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              className={ `chat__message chat__message--${ message.type }` }
              key={ message.id }
            >
              <div className="chat__avatar" aria-hidden="true">
                { message.type === 'user' ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M3.5 17c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2l1.8 4.6L17 7.8l-3.8 3.2L14.2 16 10 13.4 5.8 16l1-5L3 7.8l5.2-1.2L10 2z"
                          stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>
                ) }
              </div>
              <div className="chat__bubble">
                { message.imageUrl ? (
                  <img
                    alt="用户上传内容"
                    className="chat__message-image"
                    src={ message.imageUrl }
                  />
                ) : null }
                { message.content ? ( () => {
                  const jsx = message.type === 'ai' ? extractJSX(message.content) : null;
                  return jsx
                    ? <>
                      <div className="chat__preview-container">
                        <LivePreview code={ jsx }/>
                      </div>
                      <div className="chat__code-actions">
                        <button
                          className="chat__code-btn"
                          onClick={ () => setFullscreenCode(jsx) }
                          type="button"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9"/>
                            <polyline points="9 21 3 21 3 15"/>
                            <line x1="21" y1="3" x2="14" y2="10"/>
                            <line x1="3" y1="21" x2="10" y2="14"/>
                          </svg>
                          <span>全屏预览</span>
                        </button>
                        <button
                          className="chat__code-btn"
                          onClick={ () => setViewingCode(jsx) }
                          type="button"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 18l6-6-6-6"/>
                            <path d="M8 6l-6 6 6 6"/>
                          </svg>
                          <span>查看源码</span>
                        </button>
                        <button
                          className="chat__code-btn"
                          onClick={ () => handleCopy(jsx, message.id) }
                          type="button"
                        >
                          { copiedId === message.id ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                            </svg>
                          ) }
                          <span>{ copiedId === message.id ? '已复制' : '复制代码' }</span>
                        </button>
                      </div>
                    </>
                    : <p className="chat__text">{ message.content }</p>;
                } )() : ( message.type === 'ai' && isSending ? (
                  <div className="chat__typing">
                    <span className="chat__typing-dot"/>
                    <span className="chat__typing-dot"/>
                    <span className="chat__typing-dot"/>
                  </div>
                ) : null ) }
                <time className="chat__time">{ formatTime(message.time) }</time>
              </div>
            </article>
          ))
        ) }
      </div>

      { active && (
        <button
          className="chat__scroll-button"
          onClick={ showScrollTop ? scrollToTop : scrollToBottom }
          type="button"
        >
          { showScrollTop ? '↑' : '↓' }
        </button>
      ) }

      <div className="chat__input-area">
        { selectedImage ? (
          <div className="chat__upload-preview">
            <img
              alt={ selectedImage.name }
              className="chat__preview-image"
              src={ selectedImage.dataUrl }
            />
            <div className="chat__preview-meta">
              <strong className="chat__preview-name">{ selectedImage.name }</strong>
              <span className="chat__preview-size">{ formatFileSize(selectedImage.size) }</span>
            </div>
            <button
              className="chat__remove-image"
              disabled={ disabled }
              onClick={ clearSelectedImage }
              type="button"
            >
              移除
            </button>
          </div>
        ) : null }

        <textarea
          className="chat__input"
          disabled={ disabled }
          onChange={ (event) => setInputMessage(event.target.value) }
          onKeyDown={ handleInputKeyDown }
          placeholder={ inputPlaceholder }
          rows={ 4 }
          value={ inputMessage }
        />

        <div className="chat__actions">
          <div className="chat__mode-toggle">
            <button
              className={ `chat__mode-btn${ mode === 'new' ? ' chat__mode-btn--active' : '' }` }
              onClick={ () => setMode('new') }
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              <span>新增</span>
            </button>
            <button
              className={ `chat__mode-btn${ mode === 'adjust' ? ' chat__mode-btn--active' : '' }` }
              onClick={ () => setMode('adjust') }
              disabled={ !hasLastCode }
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span>调整</span>
            </button>
          </div>
          <input
            accept="image/*"
            className="chat__file-input"
            disabled={ disabled }
            onChange={ handleSelectImage }
            ref={ fileInputRef }
            type="file"
          />
          <button
            className="chat__upload-button"
            disabled={ disabled }
            onClick={ () => fileInputRef.current?.click() }
            type="button"
          >
            上传图片
          </button>
          <span className="chat__hint">支持图片，大小不超过 2MB</span>
          { isSending ? (
            <button
              className="chat__stop-button"
              onClick={ onStop }
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              <span>停止</span>
            </button>
          ) : (
            <button
              className="chat__send-button"
              disabled={ !canSend }
              onClick={ sendMessage }
              type="button"
            >
              发送
            </button>
          ) }
        </div>

        { uploadError ? <p className="chat__error">{ uploadError }</p> : null }
      </div>

      { viewingCode !== null && (
        <div className="chat__modal-overlay" onClick={ () => setViewingCode(null) }>
          <div className="chat__modal" onClick={ (e) => e.stopPropagation() }>
            <div className="chat__modal-header">
              <span className="chat__modal-title">源码</span>
              <div className="chat__modal-actions">
                <button
                  className="chat__code-btn"
                  onClick={ () => handleCopy(viewingCode, 'modal') }
                  type="button"
                >
                  { copiedId === 'modal' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  ) }
                  <span>{ copiedId === 'modal' ? '已复制' : '复制' }</span>
                </button>
                <button
                  className="chat__modal-close"
                  onClick={ () => setViewingCode(null) }
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <pre className="chat__modal-code">
              <code
                className="hljs"
                dangerouslySetInnerHTML={ { __html:hljs.highlight(viewingCode, { language:'typescript' }).value } }
              /></pre>
          </div>
        </div>
      ) }

      { fullscreenCode !== null && (
        <div className="chat__fullscreen-overlay" onClick={ () => setFullscreenCode(null) }>
          <div className="chat__fullscreen-modal" onClick={ (e) => e.stopPropagation() }>
            <div className="chat__fullscreen-header">
              <span className="chat__modal-title">组件预览</span>
              <div className="chat__modal-actions">
                <button
                  className="chat__code-btn"
                  onClick={ () => handleCopy(fullscreenCode, 'fullscreen') }
                  type="button"
                >
                  { copiedId === 'fullscreen' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  ) }
                  <span>{ copiedId === 'fullscreen' ? '已复制' : '复制代码' }</span>
                </button>
                <button
                  className="chat__modal-close"
                  onClick={ () => setFullscreenCode(null) }
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="chat__fullscreen-body">
              <LivePreview code={ fullscreenCode }/>
            </div>
          </div>
        </div>
      ) }
    </section>
  );
}
