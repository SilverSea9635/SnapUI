import { useEffect, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import 'highlight.js/styles/github-dark.css';
import './CodeSurface.css';

hljs.registerLanguage('typescript', typescript);

type Props = {
  code: string;
  /** 传给 highlight.js 的语言，默认 typescript（TSX 用它高亮效果最接近） */
  language?: string;
  maxHeight?: number;
};

/** 只读代码展示：等宽字体 + 语法高亮 + 一键复制 */
export function CodeSurface({ code, language = 'typescript', maxHeight }: Props) {
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  const highlighted = (() => {
    try {
      return hljs.highlight(code, { language }).value;
    } catch {
      return hljs.highlightAuto(code).value;
    }
  })();

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(code);
      button.dataset.copied = 'true';
      button.textContent = '已复制';
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => {
        button.dataset.copied = 'false';
        button.textContent = '复制';
      }, 1800);
    } catch {
      button.textContent = '复制失败';
    }
  };

  return (
    <div className="code-surface">
      <button className="code-surface__copy" onClick={handleCopy} type="button">
        复制
      </button>
      <pre className="code-surface__pre" style={maxHeight ? { maxHeight } : undefined}>
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}
