/* eslint-disable react-refresh/only-export-components -- iframe 的独立入口 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { PreviewInit, PreviewMessage, PreviewTheme } from './previewMessages';
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
function FakeBrowser({ children, compact }: { children: React.ReactNode; compact: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { canGoBack, canGoForward } = useNavigationState();

  return (
    <div className={compact ? 'snapui-fake-browser snapui-fake-browser--compact' : 'snapui-fake-browser'}>
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

function renderPreview(
  { script, compact, theme }: PreviewInit,
  port: MessagePort
) {
  const container = document.getElementById('preview-root')!;
  const send = (message: PreviewMessage) => port.postMessage(message);
  const reportError = (error: unknown) => send({
    type: 'error',
    message: error instanceof Error ? error.message : '渲染失败',
  });
  const applyTheme = (value: PreviewTheme) => {
    document.documentElement.dataset.theme = value;
  };

  applyTheme(theme);
  port.onmessage = ({ data }: MessageEvent<unknown>) => {
    if (data === 'light' || data === 'dark') applyTheme(data);
  };

  try {
    const evaluate = new Function(
      'React',
      'Router',
      `${preamble}\n${script}\nreturn typeof Component !== 'undefined' ? Component : typeof __previewDefault !== 'undefined' ? __previewDefault : null;`,
    );
    const Component = evaluate(React, routerApi) as React.ComponentType | null;
    if (!Component) throw new Error('源码没有可预览的 React 组件');

    createRoot(container, { onUncaughtError: reportError }).render(
      <MemoryRouter>
        <FakeBrowser compact={compact}>
          <Component />
        </FakeBrowser>
      </MemoryRouter>,
    );

    const resizeObserver = new ResizeObserver(() => {
      send({ type: 'size', height: Math.ceil(container.getBoundingClientRect().height) });
    });
    resizeObserver.observe(container);
  } catch (error) {
    reportError(error);
  }
}

function initialize(event: MessageEvent<PreviewInit>) {
  const { data, ports, source } = event;
  if (source !== window.parent || ports.length !== 1 || data?.type !== 'snapui-preview:init') return;
  if (typeof data.script !== 'string' || typeof data.compact !== 'boolean') return;
  if (data.theme !== 'light' && data.theme !== 'dark') return;

  window.removeEventListener('message', initialize);
  renderPreview(data, ports[0]);
}

if (window.parent !== window) {
  window.addEventListener('message', initialize);
  window.parent.postMessage('snapui-preview:ready', '*');
}
