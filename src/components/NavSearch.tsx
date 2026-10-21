import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import './NavSearch.css';

/**
 * 导航栏搜索（GitHub 风格）。
 *
 * 交互约定：
 * - 在首页/其它页输入并回车 → 跳转到 `/gallery?q=xxx` 展示结果；
 * - 已在 /gallery 上输入 → 实时把 `q` 写进地址栏（页面按 URL 上的 q 拉数据，避免两处状态打架）；
 * - 清空 → 回到不带 q 的 /gallery。
 *
 * 实现说明：input 走**非受控**（DOM 值由用户输入决定），只在地址栏 q 变化时把 DOM 值同步回来。
 * 这样既不会每敲一个字就 setState 触发整页重渲染，也避免了"effect 里 setState"的级联渲染问题。
 */
export function NavSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  // 连续输入期间用 replace，避免每敲一个字就往历史里塞一条
  const composingSearch = useRef(false);

  const onGallery = location.pathname === '/gallery';
  const urlQ = onGallery ? searchParams.get('q') ?? '' : '';

  // 地址栏 q 变化（点标签跳转、点清空、浏览器前进后退）时回填输入框。
  // 这里只写 DOM，不 setState —— 清除按钮的显隐交给 CSS 的 :placeholder-shown 判断。
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    if (node.value !== urlQ) node.value = urlQ;
    composingSearch.current = false;
  }, [urlQ]);

  const submit = (next: string) => {
    const trimmed = next.trim();
    const target = trimmed ? `/gallery?q=${encodeURIComponent(trimmed)}` : '/gallery';

    // 已经在广场上：改写地址栏即可，由页面自己按 q 重新拉数据。
    // 首次改动 push（保留"从广场返回上一页"的能力），后续连续输入 replace。
    if (onGallery) {
      navigate(target, { replace: composingSearch.current });
      composingSearch.current = true;
      return;
    }

    // 在首页/其它页：跳到广场并带上查询
    navigate(target);
  };

  const clear = () => {
    if (inputRef.current) inputRef.current.value = '';
    composingSearch.current = false;
    submit('');
  };

  return (
    <div className={`nav-search${onGallery ? ' nav-search--wide' : ''}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        className="nav-search__input"
        defaultValue=""
        onChange={(e) => {
          // 在广场页内联筛选，边打边出结果；其它页面等回车再跳
          if (onGallery) submit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit(e.currentTarget.value);
          }
          if (e.key === 'Escape') clear();
        }}
        placeholder="搜作品、标签…"
        aria-label="搜索作品"
      />
      {/* 显隐由 CSS 的 :placeholder-shown 控制（空值时隐藏），无需 React 状态 */}
      <button className="nav-search__clear" onClick={clear} type="button" aria-label="清空搜索">
        ×
      </button>
    </div>
  );
}
