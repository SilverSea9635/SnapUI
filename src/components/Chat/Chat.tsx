import { UserAvatar } from '@/components/UserAvatar';
import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Chat.css';
import { PublishWorkButton } from './PublishWorkButton';
import { COMPONENT_PROMPTS } from './componentPrompts';
import { LivePreview } from './LivePreview.tsx';
import { SourceModal } from './SourceModal.tsx';
import { FullscreenModal } from './FullscreenModal.tsx';
import { extractJSX, formatFileSize, formatTime, readFileAsDataUrl } from './chatUtils.ts';
import { discardImageAttachment, uploadImageAttachment, type ImageAttachment } from '@/hooks/attachmentsApi';
import { AttachmentImage } from './AttachmentImage';
import { useAuthStore } from '@/stores';
import { useModelsStore } from '@/stores/models';

export type ChatMessage = {
  id: string | number;
  type: 'user' | 'ai';
  content: string;
  time: Date | number | string;
  attachment?: ImageAttachment;
  imageUnavailable?: boolean;
  /** 这条消息是一次「引用调整」，记录来源作品 */
  reference?: { workId: number; title: string };
  /** 这条 AI 回复已被落库为当前用户的作品（待用户手动确认是否发布） */
  savedWork?: { id: number; title: string; isPublic: boolean };
};

export type ChatComposePayload = {
  text: string;
  attachment?: ImageAttachment;
  refreshImageDescription?: boolean;
  mode?: 'new' | 'adjust';
  model?: string;
  modelProfileId?: string;
  /** 引用调整：要二次调整的来源作品 */
  referenceWorkId?: number;
  referenceTitle?: string;
};

type ChatProps = {
  messages: ChatMessage[];
  sessionKey?: string;
  onSendMessage?: (payload: ChatComposePayload) => void;
  onStop?: () => void;
  welcomeText?: string;
  welcomeDescription?: string;
  showStarterPrompts?: boolean;
  inputPlaceholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  active?: boolean;
  /** 引用调整模式：锁定为「调整」，不允许切回「新建」 */
  referenceMode?: boolean;
  /** 最近一条 AI 消息里的代码（没有则 null），引用流程靠它判断改动是否已产出 */
  onLastCodeChange?: (code: string | null) => void;
  /** 引用产出已落库为作品，用户手动确认发布（或撤回）时回调 */
  onPublishWork?: (
    workId: number,
    isPublic: boolean
  ) => void;
};

type SelectedImage = { attachment: ImageAttachment; fromHistory?: boolean };

const MAX_IMAGE_SIZE = 2048 * 1024;

export function Chat({
                       messages,
                       sessionKey = '',
                       onSendMessage,
                       onStop,
                       welcomeText = '我是 AI 助手，很高兴见到你。',
                       welcomeDescription = '我可以帮你整理思路、回答问题，或继续扩展成真实对话页。',
                       showStarterPrompts = false,
                       inputPlaceholder = '输入消息，按 Enter 发送',
                       disabled = false,
                       isSending = false,
                       active = true,
                       referenceMode = false,
                       onLastCodeChange,
                       onPublishWork
                     }: ChatProps) {
  const [ inputMessage, setInputMessage ] = useState('');
  const [ showScrollTop, setShowScrollTop ] = useState(false);
  const [ selectedImage, setSelectedImage ] = useState<SelectedImage | null>(null);
  const [ uploadError, setUploadError ] = useState('');
  const [ imageUploading, setImageUploading ] = useState(false);
  const [ refreshImageDescription, setRefreshImageDescription ] = useState(false);
  const uploadEpoch = useRef(0);
  useEffect(() => {
    uploadEpoch.current++;
    setSelectedImage(null);
    setImageUploading(false);
    setRefreshImageDescription(false);
  }, [ sessionKey ]);
  const [ viewingCode, setViewingCode ] = useState<string | null>(null);
  const [ fullscreenCode, setFullscreenCode ] = useState<string | null>(null);
  const [ copiedId, setCopiedId ] = useState<string | number | null>(null);
  const [ mode, setMode ] = useState<'new' | 'adjust'>(referenceMode ? 'adjust' : 'new');
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const { platformModels:availableModels, platformDefault, profiles, accountId, load:loadModels } = useModelsStore();
  const ownProfiles = accountId === String(userId) ? profiles : [];
  const defaultSelection = ownProfiles.find((profile) => profile.isDefault);
  const fallbackModel = defaultSelection ? `profile:${ defaultSelection.id }` : platformDefault || availableModels[0] || '';
  const [ selectedModel, setSelectedModel ] = useState('');
  const modelSelection = selectedModel === 'platform:default' ? selectedModel : selectedModel.startsWith('profile:')
    ? ownProfiles.some((profile) => `profile:${ profile.id }` === selectedModel) ? selectedModel : fallbackModel
    : availableModels.includes(selectedModel) ? selectedModel : fallbackModel;
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

  // 没有可调整的代码时，强制切回"新增"模式（引用模式下不强制，源码在对话外）
  useEffect(() => {
    if (!hasLastCode && mode === 'adjust' && !referenceMode) {
      setMode('new');
    }
  }, [ hasLastCode, mode, referenceMode ]);

  // 把最近一条 AI 代码交给上层：引用流程靠它判断二次调整的结果是否已产出
  useEffect(() => {
    if (!onLastCodeChange) {
      return;
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'ai' && messages[i].content) {
        onLastCodeChange(extractJSX(messages[i].content));
        return;
      }
    }

    onLastCodeChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ messages ]);

  // 拉取可选生成模型列表
  useEffect(() => {
    if (userId != null) void loadModels(String(userId));
  }, [ userId, loadModels ]);

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
    () => ( inputMessage.trim().length > 0 || selectedImage !== null ) && !disabled && !imageUploading,
    [ disabled, imageUploading, inputMessage, selectedImage ]
  );

  const handleSelectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (![ 'image/png', 'image/jpeg', 'image/webp' ].includes(file.type)) {
      setSelectedImage(null);
      setUploadError('仅支持 PNG、JPEG、WebP 静态图片。');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setSelectedImage(null);
      setUploadError('图片大小不能超过 2MB。');
      event.target.value = '';
      return;
    }

    const epoch = ++uploadEpoch.current;
    setImageUploading(true);
    if (selectedImage && !selectedImage.fromHistory) void discardImageAttachment(selectedImage.attachment.id).catch(() => {
    });
    setSelectedImage(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await uploadImageAttachment(dataUrl, file.type, file.name);
      if (epoch !== uploadEpoch.current) {
        void discardImageAttachment(result.attachment.id).catch(() => {
        });
        return;
      }
      setSelectedImage({ attachment:result.attachment });
      setRefreshImageDescription(false);
      setUploadError('');
    } catch (error) {
      if (epoch !== uploadEpoch.current) return;
      setSelectedImage(null);
      setUploadError(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      if (epoch === uploadEpoch.current) setImageUploading(false);
      event.target.value = '';
    }
  };

  const clearSelectedImage = (keepAttachment = false) => {
    if (!keepAttachment && selectedImage && !selectedImage.fromHistory) void discardImageAttachment(selectedImage.attachment.id).catch(() => {
    });
    uploadEpoch.current++;
    setImageUploading(false);
    setRefreshImageDescription(false);
    setSelectedImage(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = () => {
    const text = inputMessage.trim();
    if (!canSend) {
      return;
    }
    onSendMessage?.({
      text,
      attachment:selectedImage?.attachment,
      refreshImageDescription,
      mode,
      model:modelSelection.startsWith('profile:') ? undefined : modelSelection === 'platform:default' ? undefined : modelSelection || undefined,
      modelProfileId:modelSelection.startsWith('profile:') ? modelSelection.slice(8) : undefined
    });
    setInputMessage('');
    clearSelectedImage(true);
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
    <section className="chat">
      <div
        className={ `chat__messages${ active ? '' : ' chat__messages--hidden' }` }
        ref={ messagesRef }
      >
        { messages.length === 0 ? (
          <div className="chat__welcome">
            <div className="chat__welcome-badge">AI</div>
            <h1 className="chat__welcome-title">{ welcomeText }</h1>
            <p className="chat__welcome-description">{ welcomeDescription }</p>
            { showStarterPrompts && !referenceMode && (
              <div className="chat__starters">
                <p className="chat__starter-guide">描述需求或上传截图 → AI 生成组件 → 预览与调整</p>
                <div className="chat__starter-grid">
                  { COMPONENT_PROMPTS.map((template) => (
                    <button
                      className="chat__starter"
                      type="button"
                      key={ template.title }
                      disabled={ disabled || isSending }
                      onClick={ () => {
                        setInputMessage(template.prompt);
                        messagesRef.current?.parentElement?.querySelector('textarea')?.focus();
                      } }
                    >
                      <strong>{ template.title }</strong><span>{ template.desc }</span>
                    </button>
                  )) }
                </div>
                <p className="chat__starter-hint">选择一个起点，按你的需求修改后发送；也可以<Link to="/gallery">去作品广场引用作品
                </Link>。
                </p>
              </div>
            ) }
          </div>
        ) : (
          messages.map((message) => (
            <article
              className={ `chat__message chat__message--${ message.type }` }
              key={ message.id }
            >
              <div
                className="chat__avatar"
                aria-hidden="true"
              >
                { message.type === 'user' ? (
                  <UserAvatar
                    avatar={ user?.avatar }
                    nickname={ user?.nickname }
                  />
                ) : (
                  '✦'
                ) }
              </div>
              <div className="chat__bubble">
                { message.reference ? (
                  <Link
                    className="chat__reference-chip"
                    to={ `/works/${ message.reference.workId }` }
                  >
                    <span aria-hidden="true">↳</span>
                    引用自《{ message.reference.title || '未命名作品' }》
                  </Link>
                ) : null }
                { message.attachment ? (
                  <div className="chat__image-block">
                    <AttachmentImage
                      attachment={ message.attachment }
                      className="chat__message-image"
                    />
                    <button
                      className="chat__code-btn"
                      type="button"
                      disabled={ disabled || imageUploading }
                      onClick={ () => {
                        uploadEpoch.current++;
                        setSelectedImage({ attachment:message.attachment!, fromHistory:true });
                        setRefreshImageDescription(false);
                        setUploadError('');
                        setMode(hasLastCode || referenceMode ? 'adjust' : 'new');
                        messagesRef.current?.parentElement?.querySelector('textarea')?.focus();
                      } }
                    >{ hasLastCode || referenceMode ? '用于调整' : '使用这张截图' }
                    </button>
                  </div>
                ) : message.imageUnavailable ?
                  <p className="chat__image-unavailable">旧截图未保存原图，需要重新上传</p> : null }
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
                            <polyline points="15 3 21 3 21 9"/>
                            <polyline points="9 21 3 21 3 15"/>
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
                          onClick={ () => setViewingCode(jsx) }
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
                              <path d="M20 6L9 17l-5-5"/>
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
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                            </svg>
                          ) }
                          <span>{ copiedId === message.id ? '已复制' : '复制代码' }</span>
                        </button>
                        { message.savedWork ? (
                          <button
                            className={ `chat__code-btn chat__code-btn--publish${ message.savedWork.isPublic ? ' is-published' : '' }` }
                            onClick={ () => onPublishWork?.(message.savedWork!.id, !message.savedWork!.isPublic) }
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
                              <path d="M12 19V5"/>
                              <path d="M5 12l7-7 7 7"/>
                            </svg>
                            <span>{ message.savedWork.isPublic ? '已发布 · 撤回' : '发布到广场' }</span>
                          </button>
                        ) : <PublishWorkButton
                          code={ jsx }
                          messageId={ message.id }
                          disabled={ isSending }
                        /> }
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

                { message.savedWork ? (
                  <div className={ `chat__saved-work${ message.savedWork.isPublic ? ' is-published' : '' }` }>
                    <span
                      className="chat__saved-work__mark"
                      aria-hidden="true"
                    >
                      { message.savedWork.isPublic ? '✓' : '★' }
                    </span>
                    <span className="chat__saved-work__text">
                      { message.savedWork.isPublic
                        ? `《${ message.savedWork.title }》已发布到作品广场`
                        : `《${ message.savedWork.title }》已记入你的作品（仅自己可见）` }
                    </span>
                    <Link
                      className="chat__saved-work__link"
                      to={ `/works/${ message.savedWork.id }` }
                    >
                      查看
                    </Link>
                    { !message.savedWork.isPublic ? (
                      <button
                        className="chat__saved-work__publish"
                        onClick={ () => onPublishWork?.(message.savedWork!.id, true) }
                        type="button"
                      >
                        确认发布
                      </button>
                    ) : null }
                  </div>
                ) : null }

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
            <AttachmentImage
              attachment={ selectedImage.attachment }
              className="chat__preview-image"
            />
            <div className="chat__preview-meta">
              <strong
                className="chat__preview-name">{ selectedImage.fromHistory ? '已选择历史截图 · ' : '' }{ selectedImage.attachment.fileName }</strong>
              <span className="chat__preview-size">{ formatFileSize(selectedImage.attachment.sizeBytes) }</span>
              { selectedImage.fromHistory && <label className="chat__image-refresh"><input
                type="checkbox"
                checked={ refreshImageDescription }
                onChange={ (event) => setRefreshImageDescription(event.target.checked) }
              />重新识别截图
              </label> }
            </div>
            <button
              className="chat__remove-image"
              disabled={ disabled }
              onClick={ () => clearSelectedImage() }
              type="button"
            >
              移除
            </button>
          </div>
        ) : null }

        { imageUploading && <p
          className="chat__upload-status"
          role="status"
        >图片上传中，请稍候…
        </p> }
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
              disabled={ referenceMode }
              title={ referenceMode ? '引用调整模式下只能做二次调整' : undefined }
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
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                />
                <line
                  x1="12"
                  y1="8"
                  x2="12"
                  y2="16"
                />
                <line
                  x1="8"
                  y1="12"
                  x2="16"
                  y2="12"
                />
              </svg>
              <span>新增</span>
            </button>
            <button
              className={ `chat__mode-btn${ mode === 'adjust' ? ' chat__mode-btn--active' : '' }` }
              onClick={ () => setMode('adjust') }
              disabled={ !hasLastCode && !referenceMode }
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
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span>调整</span>
            </button>
          </div>
          <input
            accept="image/png,image/jpeg,image/webp"
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
          <label className="chat__model-picker">
            <span className="chat__model-label">模型</span>
            <select
              className="chat__model-select"
              disabled={ disabled }
              onChange={ (event) => setSelectedModel(event.target.value) }
              value={ modelSelection }
            >
              <option value="platform:default">平台默认</option>
              { availableModels.length > 0 &&
                <optgroup label="平台模型">{ availableModels.map((model) => <option
                  key={ model }
                  value={ model }
                >{ model }
                </option>) }
                </optgroup> }
              { ownProfiles.length > 0 &&
                <optgroup label="我的模型">{ ownProfiles.map((profile) => <option
                  key={ profile.id }
                  value={ `profile:${ profile.id }` }
                >{ profile.label }
                </option>) }
                </optgroup> }
            </select>
          </label>
          { isSending ? (
            <button
              className="chat__stop-button"
              onClick={ onStop }
              type="button"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect
                  x="6"
                  y="6"
                  width="12"
                  height="12"
                  rx="2"
                />
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
        <SourceModal
          code={ viewingCode }
          copied={ copiedId === 'modal' }
          onCopy={ (code) => handleCopy(code, 'modal') }
          onClose={ () => setViewingCode(null) }
        />
      ) }

      { fullscreenCode !== null && (
        <FullscreenModal
          code={ fullscreenCode }
          copied={ copiedId === 'fullscreen' }
          onCopy={ (code) => handleCopy(code, 'fullscreen') }
          onClose={ () => setFullscreenCode(null) }
        />
      ) }
    </section>
  );
}
