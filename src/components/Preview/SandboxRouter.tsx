/* eslint-disable react-refresh/only-export-components -- 预览路由的统一入口，同时导出组件与 hooks */
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type FC,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  createLocation,
  getNextHistory,
  matchPath,
  type NavigateFn,
  type RouteParams,
  type RouterHistory,
  type RouterLocation,
} from './sandboxRouterUtils';

/**
 * 预览专用内存路由，提供生成组件需要的路由 API。
 * 所有路由跳转都留在预览内部。
 */

interface NavigationState {
  canGoBack: boolean;
  canGoForward: boolean;
}

interface RouterContextValue extends NavigationState {
  location: RouterLocation;
  navigate: NavigateFn;
}

interface MemoryRouterProps {
  children: ReactNode;
  initialPath?: string;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  replace?: boolean;
}

interface RouteProps {
  path: string;
  element: ReactNode;
}

// Context 定义共享数据的入口；实际值由每个 MemoryRouter 的 Provider 提供。
const RouterContext = createContext<RouterContextValue>({
  location: createLocation('/'),
  navigate: () => {},
  canGoBack: false,
  canGoForward: false,
});

const ParamsContext = createContext<RouteParams>({});

export function MemoryRouter({ children, initialPath = '/' }: MemoryRouterProps) {
  // 每个组件实例单独保存历史，不与其他预览或宿主页面共享。
  const [history, setHistory] = useState<RouterHistory>({
    stack: [initialPath],
    index: 0,
  });

  const navigate = useCallback<NavigateFn>((
    to,
    options
  ) => {
    setHistory((currentHistory) => getNextHistory(currentHistory, to, options));
  }, []);

  const routerValue: RouterContextValue = {
    location: createLocation(history.stack[history.index]),
    navigate,
    canGoBack: history.index > 0,
    canGoForward: history.index < history.stack.length - 1,
  };

  return (
    <RouterContext.Provider value={routerValue}>
      {children}
    </RouterContext.Provider>
  );
}

// 后代组件通过这些 hooks 读取最近一层 Provider 的数据。
export function useLocation(): RouterLocation {
  return useContext(RouterContext).location;
}

export function useNavigate(): NavigateFn {
  return useContext(RouterContext).navigate;
}

export function useParams(): RouteParams {
  return useContext(ParamsContext);
}

export function useNavigationState(): NavigationState {
  const { canGoBack, canGoForward } = useContext(RouterContext);
  return { canGoBack, canGoForward };
}

export function Link({ to, children, replace, onClick, ...anchorProps }: LinkProps) {
  const navigate = useNavigate();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onClick?.(event);
    navigate(to, { replace });
  };

  return (
    <a
      href={to}
      {...anchorProps}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}

export function Navigate({ to }: { to: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);

  return null;
}

// Route 只声明匹配规则，真正的匹配和渲染由 Routes 负责。
export const Route: FC<RouteProps> = () => null;

export function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const routes = Children.toArray(children).filter(isRouteElement);

  for (const route of routes) {
    const params = matchPath(route.props.path, pathname);
    if (params === null) continue;

    return (
      <ParamsContext.Provider value={params}>
        {route.props.element}
      </ParamsContext.Provider>
    );
  }

  return null;
}

function isRouteElement(child: ReactNode): child is ReactElement<RouteProps> {
  return isValidElement<RouteProps>(child) && child.type === Route;
}
