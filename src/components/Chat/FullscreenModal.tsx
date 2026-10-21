import { LivePreview } from './LivePreview.tsx';

type FullscreenModalProps = {
  code: string;
  copied: boolean;
  onCopy: (code: string) => void;
  onClose: () => void;
};

export function FullscreenModal({ code, copied, onCopy, onClose }: FullscreenModalProps) {
  return (
    <div className="chat__fullscreen-overlay" onClick={onClose}>
      <div className="chat__fullscreen-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chat__fullscreen-header">
          <span className="chat__modal-title">组件预览</span>
          <div className="chat__modal-actions">
            <button
              className="chat__code-btn"
              onClick={() => onCopy(code)}
              type="button"
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              )}
              <span>{copied ? '已复制' : '复制代码'}</span>
            </button>
            <button
              className="chat__modal-close"
              onClick={onClose}
              type="button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="chat__fullscreen-body">
          <LivePreview code={code}/>
        </div>
      </div>
    </div>
  );
}
