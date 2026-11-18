import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { discardImageAttachment, uploadImageAttachment, type ImageAttachment } from '@/api/attachments';
import { useAuthStore } from '@/stores';
import { useModelsStore } from '@/stores/models';
import { AttachmentImage } from './AttachmentImage';
import { ChatMessages } from './ChatMessages';
import { formatFileSize, parseAIReply } from './chatUtils';
import { readFileAsDataUrl } from '@/utils/file';
import type { ChatComposePayload, ChatMessage } from './types';
import './Chat.css';

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
  const [inputMessage, setInputMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [refreshImageDescription, setRefreshImageDescription] = useState(false);
  const uploadEpoch = useRef(0);  // 上传记录版本号
  useEffect(() => {
    const uploads = uploadEpoch;
    uploads.current++;
    setSelectedImage(null);
    setImageUploading(false);
    setRefreshImageDescription(false);
    setUploadError('');
    // 切换会话或离开页面后，正在上传的结果失效。
    return () => { uploads.current++; };
  }, [sessionKey]);
  const [selectedMode, setMode] = useState<'new' | 'adjust'>(referenceMode ? 'adjust' : 'new');
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const { platformModels: availableModels, platformDefault, profiles, accountId, load: loadModels } = useModelsStore();
  const ownProfiles = accountId === String(userId) ? profiles : [];
  const defaultSelection = ownProfiles.find((profile) => profile.isDefault);
  const fallbackModel = defaultSelection ? `profile:${defaultSelection.id}` : platformDefault || availableModels[0] || '';
  const [selectedModel, setSelectedModel] = useState('');
  const modelSelection = selectedModel === 'platform:default' ? selectedModel : selectedModel.startsWith('profile:')
    ? ownProfiles.some((profile) => `profile:${profile.id}` === selectedModel) ? selectedModel : fallbackModel
    : availableModels.includes(selectedModel) ? selectedModel : fallbackModel;
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const lastCode = useMemo(() => {
    const lastReply = messages.findLast((message) => message.type === 'ai' && message.content);
    return lastReply ? parseAIReply(lastReply.content).code : null;
  }, [messages]);
  const hasLastCode = lastCode !== null;
  const mode = referenceMode ? 'adjust' : hasLastCode ? selectedMode : 'new';

  // 没有可调整的代码时，强制切回"新增"模式（引用模式下不强制，源码在对话外）
  useEffect(() => {
    if (!hasLastCode && selectedMode === 'adjust' && !referenceMode) {
      setMode('new');
    }
  }, [hasLastCode, selectedMode, referenceMode]);

  useEffect(() => {
    onLastCodeChange?.(lastCode);
  }, [lastCode, onLastCodeChange]);

  // 拉取可选生成模型列表
  useEffect(() => {
    if (userId != null) void loadModels(String(userId));
  }, [userId, loadModels]);

  const canSend = useMemo(
    () => (inputMessage.trim().length > 0 || selectedImage !== null) && !disabled && !imageUploading,
    [disabled, imageUploading, inputMessage, selectedImage]
  );

  const handleSelectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const epoch = ++uploadEpoch.current;
    if (selectedImage && !selectedImage.fromHistory) {
      void discardImageAttachment(selectedImage.attachment.id).catch(() => { });
    }
    setSelectedImage(null);
    setImageUploading(false);
    setRefreshImageDescription(false);
    setUploadError('');

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setUploadError('仅支持 PNG、JPEG、WebP 静态图片。');
      input.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError('图片大小不能超过 2MB。');
      input.value = '';
      return;
    }

    setImageUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (epoch !== uploadEpoch.current) return;
      const result = await uploadImageAttachment(dataUrl, file.type, file.name);
      if (epoch !== uploadEpoch.current) {
        // 本次上传已过期，清理上传的附件，不再更新界面
        void discardImageAttachment(result.attachment.id).catch(() => {
        });
        return;
      }
      setSelectedImage({ attachment: result.attachment });
      setRefreshImageDescription(false);
      setUploadError('');
    } catch (error) {
      if (epoch !== uploadEpoch.current) return;
      setSelectedImage(null);
      setUploadError(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      if (epoch === uploadEpoch.current) {
        setImageUploading(false);
        input.value = '';
      }
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
      attachment: selectedImage?.attachment,
      refreshImageDescription,
      mode,
      model: modelSelection.startsWith('profile:') ? undefined : modelSelection === 'platform:default' ? undefined : modelSelection || undefined,
      modelProfileId: modelSelection.startsWith('profile:') ? modelSelection.slice(8) : undefined
    });
    setInputMessage('');
    clearSelectedImage(true);
    setUploadError('');
  };

  const handleSelectPrompt = (prompt: string) => {
    setInputMessage(prompt);
    inputRef.current?.focus();
  };

  const handleUseImage = (attachment: ImageAttachment) => {
    if (selectedImage && !selectedImage.fromHistory) {
      void discardImageAttachment(selectedImage.attachment.id).catch(() => { });
    }
    uploadEpoch.current++;
    setSelectedImage({ attachment, fromHistory: true });
    setImageUploading(false);
    setRefreshImageDescription(false);
    setUploadError('');
    setMode(hasLastCode || referenceMode ? 'adjust' : 'new');
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <section className="chat">
      <ChatMessages
        messages={messages}
        disabled={disabled}
        isSending={isSending}
        active={active}
        welcomeText={welcomeText}
        welcomeDescription={welcomeDescription}
        showStarterPrompts={showStarterPrompts}
        referenceMode={referenceMode}
        hasLastCode={hasLastCode}
        imageUploading={imageUploading}
        onSelectPrompt={handleSelectPrompt}
        onSelectImage={handleUseImage}
        onPublishWork={onPublishWork}
      />
      <div className="chat__input-area">
        {selectedImage ? (
          <div className="chat__upload-preview">
            <AttachmentImage
              attachment={selectedImage.attachment}
              className="chat__preview-image"
            />
            <div className="chat__preview-meta">
              <strong className="chat__preview-name">
                {selectedImage.fromHistory ? '已选择历史截图 · ' : ''}{selectedImage.attachment.fileName}
              </strong>
              <span className="chat__preview-size">{formatFileSize(selectedImage.attachment.sizeBytes)}</span>
              {selectedImage.fromHistory && (
                <label className="chat__image-refresh">
                  <input
                    type="checkbox"
                    checked={refreshImageDescription}
                    onChange={(event) => setRefreshImageDescription(event.target.checked)}
                  />
                  重新识别截图
                </label>
              )}
            </div>
            <button
              className="chat__remove-image"
              disabled={disabled}
              onClick={() => clearSelectedImage()}
              type="button"
            >
              移除
            </button>
          </div>
        ) : null}

        {imageUploading && (
          <p
            className="chat__upload-status"
            role="status"
          >
            图片上传中，请稍候…
          </p>
        )}
        <textarea
          className="chat__input"
          disabled={disabled}
          onChange={(event) => setInputMessage(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={inputPlaceholder}
          ref={inputRef}
          rows={4}
          value={inputMessage}
        />

        <div className="chat__actions">
          <div className="chat__mode-toggle">
            <button
              className={`chat__mode-btn${mode === 'new' ? ' chat__mode-btn--active' : ''}`}
              onClick={() => setMode('new')}
              disabled={referenceMode}
              title={referenceMode ? '引用调整模式下只能做二次调整' : undefined}
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
              className={`chat__mode-btn${mode === 'adjust' ? ' chat__mode-btn--active' : ''}`}
              onClick={() => setMode('adjust')}
              disabled={!hasLastCode && !referenceMode}
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
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>调整</span>
            </button>
          </div>
          <input
            accept="image/png,image/jpeg,image/webp"
            className="chat__file-input"
            disabled={disabled}
            onChange={handleSelectImage}
            ref={fileInputRef}
            type="file"
          />
          <button
            className="chat__upload-button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            上传图片
          </button>
          <span className="chat__hint">支持图片，大小不超过 2MB</span>
          <label className="chat__model-picker">
            <span className="chat__model-label">模型</span>
            <select
              className="chat__model-select"
              disabled={disabled}
              onChange={(event) => setSelectedModel(event.target.value)}
              value={modelSelection}
            >
              <option value="platform:default">平台默认</option>
              {availableModels.length > 0 && (
                <optgroup label="平台模型">
                  {availableModels.map((model) => (
                    <option
                      key={model}
                      value={model}
                    >
                      {model}
                    </option>
                  ))}
                </optgroup>
              )}
              {ownProfiles.length > 0 && (
                <optgroup label="我的模型">
                  {ownProfiles.map((profile) => (
                    <option
                      key={profile.id}
                      value={`profile:${profile.id}`}
                    >
                      {profile.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {isSending ? (
            <button
              className="chat__stop-button"
              onClick={onStop}
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
              disabled={!canSend}
              onClick={sendMessage}
              type="button"
            >
              发送
            </button>
          )}
        </div>

        {uploadError ? <p className="chat__error">{uploadError}</p> : null}
      </div>

    </section>
  );
}
