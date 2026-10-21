import { useState, useEffect } from 'react';
import * as React from 'react';
import {
  Link,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationState,
  useParams,
} from './SandboxRouter';
import './LivePreview.css';
import { previewModulePlugin } from './previewModulePlugin';

type Props = { code: string };

// 注入到生成组件沙箱中的路由 API，供生成代码（import 被剥离后）直接使用
const routerApi = {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
};

/**
 * fake-browser 外壳：模拟浏览器导航条（前进/后退 + 地址栏）。
 * 让生成组件内的路由跳转只发生在内存 history 中，不影响宿主页面 URL。
 */
function FakeBrowser({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { canGoBack, canGoForward } = useNavigationState();

  return (
    <div className="snapui-fake-browser">
      <div className="snapui-fake-browser__bar">
        <button
          className="snapui-fake-browser__nav"
          onClick={() => navigate(-1)}
          type="button"
          aria-label="后退"
          title="后退"
          disabled={!canGoBack}
        >
          ‹
        </button>
        <button
          className="snapui-fake-browser__nav"
          onClick={() => navigate(1)}
          type="button"
          aria-label="前进"
          title="前进"
          disabled={!canGoForward}
        >
          ›
        </button>
        <div className="snapui-fake-browser__url">
          <input
            aria-label="地址栏"
            onChange={(e) => navigate(e.target.value)}
            value={location.pathname}
          />
        </div>
      </div>
      <div className="snapui-fake-browser__content">{children}</div>
    </div>
  );
}

export function LivePreview({ code }: Props) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function compile() {
      try {
        const Babel = await import('@babel/standalone');
        const compiled = Babel.transform(code, {
          presets: ['react', 'typescript'],
          plugins: [previewModulePlugin],
          filename: 'live.tsx',
        }).code!;

        const preamble = [
          'var useState = React.useState;',
          'var useEffect = React.useEffect;',
          'var useRef = React.useRef;',
          'var useMemo = React.useMemo;',
          'var useCallback = React.useCallback;',
          'var useContext = React.useContext;',
          'var Link = Router.Link;',
          'var Navigate = Router.Navigate;',
          'var Route = Router.Route;',
          'var Routes = Router.Routes;',
          'var useNavigate = Router.useNavigate;',
          'var useLocation = Router.useLocation;',
          'var useParams = Router.useParams;',
        ].join('\n');

        const fn = new Function('React', 'Router', `${preamble}\n${compiled}; return typeof Component !== 'undefined' ? Component : __previewDefault;`);
        const Component = fn(React, routerApi) as React.ComponentType;

        if (!cancelled) {
          setComponent(() => Component);
          setError('');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '渲染失败');
          setComponent(null);
        }
      }
    }

    void compile();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) return <pre style={{ color: 'red', whiteSpace: 'pre-wrap' }}>{error}</pre>;
  if (!Component) return null;

  return (
    <MemoryRouter
      initialPath="/"
      key={code}
    >
      <FakeBrowser>
        <Component />
      </FakeBrowser>
    </MemoryRouter>
  );
}
