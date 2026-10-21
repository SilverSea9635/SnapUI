import { useLayoutEffect, useRef, useState } from 'react';
import { LivePreview } from '@/components/Chat/LivePreview';

/** 列表缩略预览：先按正常组件宽度排版，再整体缩放到卡片内。 */
export function WorkThumbnail({ code }: { code: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ width: 480, scale: 1, left: 0 });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;

    const measure = () => {
      const width = Math.max(360, viewport.clientWidth);
      // 先让画布完成正常宽度下的排版，下一次观察再计算缩放。
      if (canvas.offsetWidth !== width) {
        setLayout({ width, scale: 1, left: 0 });
        return;
      }
      const contentWidth = Math.max(width, canvas.scrollWidth);
      const contentHeight = Math.max(1, canvas.scrollHeight);
      const scale = Math.min(1, viewport.clientWidth / contentWidth, viewport.clientHeight / contentHeight);
      const left = Math.max(0, (viewport.clientWidth - contentWidth * scale) / 2);
      setLayout((previous) => previous.width === width && previous.scale === scale && previous.left === left
        ? previous : { width, scale, left });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(canvas);
    measure();
    return () => observer.disconnect();
  }, [code]);

  return (
    <div
      className="work-thumbnail"
      ref={viewportRef}
    >
      <div
        className="work-thumbnail__canvas"
        ref={canvasRef}
        style={{ width: layout.width, left: layout.left, transform: `scale(${layout.scale})` }}
      >
        <LivePreview code={code} />
      </div>
    </div>
  );
}
