import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/stores/ui';
import appStyles from '@/App.css?inline';
import browserStyles from './LivePreview.css?inline';
import { hash, script } from 'virtual:snapui-preview-runtime';
import { previewModulePlugin } from './previewModulePlugin';
import type { PreviewInit, PreviewMessage } from './previewMessages';

type Props = { code: string; compact?: boolean };

const policy = [
  "default-src 'none'",
  `script-src 'sha256-${hash}' 'unsafe-eval'`,
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'media-src data: blob:',
  'font-src data:',
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Only bundled assets are embedded here. Generated code crosses the boundary
// as a structured message after the sandbox has started.
const previewDocument = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${policy}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${appStyles}\n${browserStyles}</style>
</head>
<body>
<div id="preview-root"></div>
<script>${script}</script>
</body>
</html>`;

function PreviewError({ message }: { message: string }) {
  return (
    <pre
      role="alert"
      style={{ color: '#d33', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
    >
      {message}
    </pre>
  );
}

function IsolatedPreview({ compiled, compact }: { compiled: string; compact: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(150);
  const [error, setError] = useState('');

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const channel = new MessageChannel();
    const timer = window.setTimeout(() => fail('预览加载超时'), 8000);
    const unsubscribe = useUIStore.subscribe((
      state,
      previous
    ) => {
      if (state.theme !== previous.theme) channel.port1.postMessage(state.theme);
    });

    function disconnect() {
      window.removeEventListener('message', connect);
      window.clearTimeout(timer);
      unsubscribe();
      channel.port1.close();
      channel.port2.close();
    }

    function fail(message: string) {
      disconnect();
      setError(message);
    }

    channel.port1.onmessage = ({ data }: MessageEvent<PreviewMessage>) => {
      if (data?.type === 'size' && Number.isFinite(data.height) && data.height > 0) {
        window.clearTimeout(timer);
        setHeight(Math.min(4096, Math.ceil(data.height)));
      } else if (data?.type === 'error' && typeof data.message === 'string') {
        fail(data.message.slice(0, 1500) || '渲染失败');
      }
    };

    function connect(event: MessageEvent) {
      const target = frameRef.current?.contentWindow;
      if (!target || event.source !== target || event.origin !== 'null' || event.data !== 'snapui-preview:ready') return;

      window.removeEventListener('message', connect);
      const message: PreviewInit = {
        type: 'snapui-preview:init',
        script: compiled,
        compact,
        theme: useUIStore.getState().theme,
      };
      // A sandbox without allow-same-origin has an opaque origin. The target
      // window and one-time ready message identify this specific preview.
      target.postMessage(message, '*', [channel.port2]);
    }

    window.addEventListener('message', connect);
    if (frame.srcdoc !== previewDocument) frame.srcdoc = previewDocument;
    return disconnect;
  }, [compiled, compact]);

  if (error) return <PreviewError message={error} />;

  return (
    <iframe
      ref={frameRef}
      className="snapui-live-preview"
      title="组件实时预览"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      style={{ display: 'block', width: '100%', height, border: 0, colorScheme: 'normal' }}
    />
  );
}

function PreviewCode({ code, compact = false }: Props) {
  const [result, setResult] = useState<{ compiled: string } | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function compile() {
      try {
        const Babel = await import('@babel/standalone');
        const compiled = Babel.transform(code, {
          presets: ['react', 'typescript'],
          plugins: [previewModulePlugin],
          filename: 'live.tsx',
        }).code;

        if (!compiled?.trim()) throw new Error('源码没有可预览的 React 组件');
        if (!cancelled) setResult({ compiled });
      } catch (error) {
        if (!cancelled) setResult({ error: error instanceof Error ? error.message : '编译失败' });
      }
    }

    void compile();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!result) return null;
  if ('error' in result) return <PreviewError message={result.error} />;
  return (
    <IsolatedPreview
      key={String(compact)}
      compiled={result.compiled}
      compact={compact}
    />
  );
}

export function LivePreview({ code, compact }: Props) {
  return (
    <PreviewCode
      key={code}
      code={code}
      compact={compact}
    />
  );
}
