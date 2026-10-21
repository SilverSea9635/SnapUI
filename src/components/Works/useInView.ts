import { useEffect, useRef, useState } from 'react';

/**
 * 元素是否进入过视口（进入一次后就保持 true）。
 *
 * 用途：广场卡片会同时挂载几十个 LivePreview，而每个 LivePreview 都要跑一次
 * @babel/standalone 编译（几十毫秒级）。这里让卡片滚动到可视区域才真正编译，
 * 避免首屏被编译任务堵住。
 */
export function useInView<T extends HTMLElement>(rootMargin = '200px') {
  const ref = useRef<T | null>(null);
  // 老浏览器没有 IntersectionObserver 时直接渲染，功能优先于性能
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
