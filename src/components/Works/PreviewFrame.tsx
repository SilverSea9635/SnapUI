import { useState } from 'react';
import { LivePreview } from '@/components/Chat/LivePreview';
import { CodeSurface } from './CodeSurface';
import { useInView } from './useInView';
import { countCodeLines } from '@/utils/works';
import { WorkThumbnail } from './WorkThumbnail';
import './PreviewFrame.css';

type Props = {
  code: string;
  title?: string;
  /** 是否延迟到进入视口才编译（广场卡片开启，详情页关闭） */
  lazy?: boolean;
  initialView?: 'preview' | 'source';
  /** 预览区高度，默认 260px；传 'auto' 时随内容撑开 */
  height?: number | 'auto';
  /**
   * 嵌在卡片里使用时置为 true：去掉外框与工具栏，仅展示缩略预览。源码在放大窗口中查看。
   */
  bare?: boolean;
};

/**
 * 作品展台：假浏览器外框 + 预览/源码切换。
 * 广场卡片、我的作品、作品详情共用这一个组件，保证三处呈现完全一致。
 */
export function PreviewFrame({
  code,
  title,
  lazy = false,
  initialView = 'preview',
  height = 260,
  bare = false,
}: Props) {
  const [view, setView] = useState<'preview' | 'source'>(initialView);
  const { ref, inView } = useInView<HTMLDivElement>();

  const shouldRender = !lazy || inView;
  const previewHeight = height === 'auto' ? undefined : height;

  return (
    <div
      className={`preview-frame${bare ? ' preview-frame--bare' : ''}`}
      ref={ref}
    >
      {!bare && <div className="preview-frame__chrome">
        {bare ? null : (
          <>
            <span
              className="preview-frame__dots"
              aria-hidden="true"
            >
              <i /><i /><i />
            </span>
            <span className="preview-frame__title">{title || 'Component.tsx'}</span>
          </>
        )}
        <span
          className="preview-frame__toggle"
          role="tablist"
          aria-label="预览或源码"
        >
          <button
            className={`preview-frame__toggle-btn${view === 'preview' ? ' is-active' : ''}`}
            onClick={() => setView('preview')}
            role="tab"
            aria-selected={view === 'preview'}
            type="button"
          >
            预览
          </button>
          <button
            className={`preview-frame__toggle-btn${view === 'source' ? ' is-active' : ''}`}
            onClick={() => setView('source')}
            role="tab"
            aria-selected={view === 'source'}
            type="button"
          >
            源码
          </button>
        </span>
                </div>}

      <div
        className="preview-frame__stage"
        style={previewHeight ? { height: previewHeight } : undefined}
      >
        {!bare && view === 'source' ? (
          shouldRender ? <CodeSurface
            code={code}
            maxHeight={height === 'auto' ? undefined : height - 40}
                         /> : null
        ) : shouldRender ? (
          bare && previewHeight ? <WorkThumbnail code={code} /> : <LivePreview code={code} />
        ) : (
          <div className="preview-frame__pending">
            <span className="preview-frame__pending-bar" />
            <span className="preview-frame__pending-bar preview-frame__pending-bar--short" />
            <span className="preview-frame__pending-bar" />
          </div>
        )}
      </div>

      {bare ? null : (
        <div className="preview-frame__meta">
          <span className="preview-frame__lines">{countCodeLines(code)} 行</span>
          <span className="preview-frame__hint">在沙箱内存路由中运行</span>
        </div>
      )}
    </div>
  );
}
