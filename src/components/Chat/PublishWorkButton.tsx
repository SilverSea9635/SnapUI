import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createWork } from '@/hooks/worksApi';
import { useUIStore } from '@/stores';
import { guessTitleFromCode, parseTagsInput } from '@/utils/works';
import './PublishWorkButton.css';

export function PublishWorkButton({ code, messageId, disabled = false }: { code: string; messageId: string | number; disabled?: boolean }) {
  const showToast = useUIStore((s) => s.showToast);
  // 手动发布：作品绝不会因为生成而过自动上架，必须由用户在这里确认
  const [publishState, setPublishState] = useState<Record<string, 'idle' | 'saving' | 'done'>>({});
  const [publishOpen, setPublishOpen] = useState<{ msgId: string | number; code: string; title: string } | null>(null);
  const [publishTags, setPublishTags] = useState('');
  const [publishPublic, setPublishPublic] = useState(true);

  /** 打开发布确认框：标题用源码注释/函数名兜底，用户可改 */
  const openPublish = (
    msgId: string | number,
    code: string
  ) => {
    setPublishOpen({ msgId, code, title: guessTitleFromCode(code) || '未命名作品' });
    setPublishTags('');
    setPublishPublic(true);
  };

  /** 确认发布：这一步之后作品才会出现在广场或「我的作品」里 */
  const confirmPublish = async () => {
    if (!publishOpen) return;
    const title = publishOpen.title.trim();
    if (!title) {
      showToast('error', '请填写作品标题');
      return;
    }

    setPublishState((prev) => ({ ...prev, [publishOpen.msgId]: 'saving' as const }));
    try {
      await createWork({
        title,
        sourceCode: publishOpen.code,
        description: '',
        tags: parseTagsInput(publishTags),
        isPublic: publishPublic,
      });
      setPublishState((prev) => ({ ...prev, [publishOpen.msgId]: 'done' as const }));
      setPublishOpen(null);
      showToast('success', publishPublic ? '已发布到作品广场' : '已保存为仅自己可见的作品');
    } catch {
      setPublishState((prev) => ({ ...prev, [publishOpen.msgId]: 'idle' as const }));
      showToast('error', '发布失败，请稍后重试');
    }
  };

  return <>
    <button className="chat__code-btn chat__code-btn--publish" type="button" disabled={disabled || publishState[messageId] === 'saving'} onClick={() => openPublish(messageId, code)}>
      {publishState[messageId] === 'done' ? '已发布 · 再发一次' : '发布为作品'}
    </button>
    {publishOpen ? createPortal(
      <div className="chat-publish" onClick={() => publishOpen && publishState[publishOpen.msgId] !== 'saving' && setPublishOpen(null)} role="presentation">
        <div className="chat-publish__panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="发布为作品">
          <h2 className="chat-publish__title">发布为作品</h2>
          <p className="chat-publish__hint">
            确认后这份组件会记入「我的作品」；勾选公开则同时出现在作品广场，供其他人浏览、收藏与引用。
          </p>

          <label className="chat-publish__field">
            <span>作品标题</span>
            <input
              value={publishOpen.title}
              onChange={(e) => setPublishOpen({ ...publishOpen, title: e.target.value })}
              maxLength={60}
              placeholder="给作品起个名字"
              autoFocus
            />
          </label>

          <label className="chat-publish__field">
            <span>标签<span className="chat-publish__sub">（空格或逗号分隔，最多 6 个）</span></span>
            <input
              value={publishTags}
              onChange={(e) => setPublishTags(e.target.value)}
              placeholder="仪表盘 图表 深色"
            />
          </label>

          <label className="chat-publish__checkbox">
            <input
              type="checkbox"
              checked={publishPublic}
              onChange={(e) => setPublishPublic(e.target.checked)}
            />
            公开到作品广场
          </label>

          <div className="chat-publish__actions">
            <button className="chat-publish__btn" onClick={() => setPublishOpen(null)} disabled={publishState[publishOpen.msgId] === 'saving'} type="button">
              取消
            </button>
            <button
              className="chat-publish__btn chat-publish__btn--primary"
              onClick={confirmPublish}
              disabled={publishState[publishOpen.msgId] === 'saving'}
              type="button"
            >
              {publishState[publishOpen.msgId] === 'saving' ? '发布中...' : '确认发布'}
            </button>
          </div>
        </div>
      </div>
      , document.body) : null}
         </>;
}
