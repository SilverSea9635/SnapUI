import { useState, useEffect } from 'react';
import * as Babel from '@babel/standalone';
import * as React from 'react';

type Props = { code: string };

export function LivePreview({ code }: Props) {
  const [element, setElement] = useState<React.ReactNode>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const compiled = Babel.transform(code, {
        presets: ['react', 'typescript'],
        filename: 'live.tsx',
      }).code!;

      const stripped = compiled.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm, '');
      const preamble = [
        'var useState = React.useState;',
        'var useEffect = React.useEffect;',
        'var useRef = React.useRef;',
        'var useMemo = React.useMemo;',
        'var useCallback = React.useCallback;',
        'var useContext = React.useContext;',
      ].join('\n');

      const fn = new Function('React', `${preamble}\n${stripped}; return Component;`);
      const Component = fn(React) as React.ComponentType;

      setElement(React.createElement(Component));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '渲染失败');
      setElement(null);
    }
  }, [code]);

  if (error) return <pre style={{ color: 'red', whiteSpace: 'pre-wrap' }}>{error}</pre>;
  return <>{element}</>;
}