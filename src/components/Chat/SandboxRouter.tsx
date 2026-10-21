/* eslint-disable react-refresh/only-export-components -- 该文件是内聚的“库”模块，刻意同时导出组件与 hooks */
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as React from 'react';

/**
 * 极简内存路由（沙箱路由）。
 *
 * 为什么不用 react-router 的 MemoryRouter：
 * 宿主应用本身已经用 RouterProvider 包了一层 React Router，
 * 若在 LivePreview 内再套 <MemoryRouter> 会触发
 * "You cannot render a <Router> inside another <Router>"。
 *
 * 因此这里自实现一套 API 表面兼容 react-router 的内存路由，
 * 通过独立的 Context 维护路径，跳转只发生在内存栈中，不影响宿主 URL。
 */

type NavigateFn = (
  to: string | number,
  options?: { replace?: boolean }
) => void;

interface Location {
  pathname: string;
  search: string;
  hash: string;
  key: string;
  state: unknown;
}

const RouterContext = createContext<{
  location: Location;
  navigate: NavigateFn;
  canGoBack: boolean;
  canGoForward: boolean;
}>({
  location: { pathname: '/', search: '', hash: '', key: '/', state: null },
  navigate: () => {},
  canGoBack: false,
  canGoForward: false,
});

const ParamsContext = createContext<Record<string, string>>({});

/* ───────────────────────── Hooks ───────────────────────── */

export function useLocation(): Location {
  return useContext(RouterContext).location;
}

export function useNavigate(): NavigateFn {
  return useContext(RouterContext).navigate;
}

export function useParams(): Record<string, string> {
  return useContext(ParamsContext);
}

export function useNavigationState(): { canGoBack: boolean; canGoForward: boolean } {
  const { canGoBack, canGoForward } = useContext(RouterContext);
  return { canGoBack, canGoForward };
}

/* ───────────────────────── 组件 ───────────────────────── */

interface LinkProps {
  to: string;
  children?: React.ReactNode;
  replace?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  [key: string]: unknown;
}

export function Link({ to, children, replace, onClick, ...rest }: LinkProps) {
  const { navigate } = useContext(RouterContext);
  return (
    <a
      href={to}
      {...rest}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
        navigate(to, { replace });
      }}
    >
      {children}
    </a>
  );
}

export function Navigate({ to }: { to: string }) {
  const { navigate } = useContext(RouterContext);
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);
  return null;
}

export function Route() {
  // 声明式占位，真正的匹配渲染由 <Routes> 完成。
  return null;
}

function matchPath(
  pattern: string,
  pathname: string
): Record<string, string> | null {
  if (pattern === '*') return {};
  const split = (p: string) => p.split('/').filter(Boolean);
  const patternSegs = split(pattern);
  const pathSegs = split(pathname);
  if (patternSegs.length !== pathSegs.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegs.length; i++) {
    const p = patternSegs[i];
    const s = pathSegs[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(s);
    } else if (p !== s) {
      return null;
    }
  }
  return params;
}

export function Routes({ children }: { children: React.ReactNode }) {
  const { location } = useContext(RouterContext);
  const routes = Children.toArray(children).filter(
    (c): c is React.ReactElement<{ path: string; element: React.ReactNode }> =>
      isValidElement(c) && c.type === Route,
  );

  for (const route of routes) {
    const params = matchPath(route.props.path, location.pathname);
    if (params) {
      return <ParamsContext.Provider value={params}>{route.props.element}</ParamsContext.Provider>;
    }
  }
  return null;
}

/* ───────────────────────── 内存路由 Provider ───────────────────────── */

export function MemoryRouter({ children, initialPath = '/' }: { children: ReactNode; initialPath?: string }) {
  const [history, setHistory] = useState<{ stack: string[]; index: number }>({
    stack: [initialPath],
    index: 0,
  });

  const currentPath = history.stack[history.index];
  const [pathname, query = ''] = currentPath.split('?');
  const location: Location = {
    pathname,
    search: query ? `?${query}` : '',
    hash: '',
    key: currentPath,
    state: null,
  };

  const navigate = useCallback<NavigateFn>((
    to,
    options
  ) => {
    setHistory((h) => {
      if (typeof to === 'number') {
        const next = h.index + to;
        if (next < 0 || next >= h.stack.length) return h;
        return { ...h, index: next };
      }

      const trimmed = h.stack.slice(0, h.index + 1);
      const last = trimmed[trimmed.length - 1];

      if (options?.replace) {
        trimmed[trimmed.length - 1] = to;
        return { stack: trimmed, index: h.index };
      }

      // 连续重复导航去重，避免 StrictMode 下 effect 双调用产生冗余历史
      if (last === to) return h;

      return { stack: [...trimmed, to], index: h.index + 1 };
    });
  }, []);

  return (
    <RouterContext.Provider
      value={{
        location,
        navigate,
        canGoBack: history.index > 0,
        canGoForward: history.index < history.stack.length - 1,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
}
