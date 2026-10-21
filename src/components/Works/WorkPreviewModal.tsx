import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LivePreview } from '@/components/Chat/LivePreview';
import { CodeSurface } from './CodeSurface';
import './WorkPreviewModal.css';

export function WorkPreviewModal({ code, title, onClose }: { code: string; title: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="work-preview-modal"
      aria-label={`作品预览：${title}`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <header className="work-preview-modal__header">
        <h2>{title || '作品预览'}</h2>
        <div className="work-preview-modal__actions">
          <button
            type="button"
            onClick={() => setShowSource((value) => !value)}
          >
            {showSource ? '返回预览' : '查看源码'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭放大预览"
          >关闭
          </button>
        </div>
      </header>
      <div className="work-preview-modal__body">
        <div hidden={showSource}>
          <LivePreview code={code} />
        </div>
        {showSource && <div className="work-preview-modal__source"><CodeSurface code={code} /></div>}
      </div>
    </dialog>,
    document.body,
  );
}
