import { fromMarkdown } from 'mdast-util-from-markdown';

export function formatTime(time: Date | number | string) {
  const date = time instanceof Date ? time : new Date(time);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatFileSize(size: number) {
  return `${(size / 1024).toFixed(0)} KB`;
}

const componentDeclaration = /^\s*(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+Component\b/m;
const defaultExport = /^\s*export\s+default\s+/m;
const reactMarkup = /<>|<\/[A-Za-z][\w.:-]*\s*>|<[A-Za-z][\w.:-]*(?:\s[^>]*?)?\/>|\bReact\.createElement\s*\(/;

export function parseAIReply(content: string): { code: string | null; markdown: string } {
  if (!content.includes('```') && !content.includes('~~~')) {
    return { code: null, markdown: content };
  }

  for (const block of fromMarkdown(content).children) {
    if (block.type !== 'code' || !block.position || !/^(?:tsx?|jsx?|javascript)$/i.test(block.lang ?? '')) continue;

    const { start, end } = block.position;
    const source = content.slice(start.offset, end.offset);
    const opening = source.match(/^(`{3,}|~{3,})/)?.[1];
    const closing = source.match(/[\r\n] {0,3}(`{3,}|~{3,})[ \t]*$/)?.[1];
    // Markdown 会解析尚未闭合的围栏，流式回复需要等结束标记再预览。
    if (!opening || !closing?.startsWith(opening)) continue;

    const code = block.value.trim();
    if (!componentDeclaration.test(code) && !(defaultExport.test(code) && reactMarkup.test(code))) continue;

    return {
      code,
      markdown: `${content.slice(0, start.offset)}\n${content.slice(end.offset)}`,
    };
  }

  return { code: null, markdown: content };
}

