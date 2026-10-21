/** 作品广场相关纯函数工具（无副作用，便于复用与测试） */

/** 相对时间：刚刚 / 12 分钟前 / 3 小时前 / 昨天 / 09-21 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 2 * day) return '昨天';
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;

  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

/** 完整时间：2026-09-21 14:30 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 把管理端可能返回的任意形状转为 string[]（后端字段演进时的兜底） */
export function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6);
  }
  if (typeof tags === 'string' && tags.trim()) {
    return parseTagsInput(tags);
  }
  return [];
}

/** 解析用户输入的标签：逗号 / 顿号 / 空格分隔，去重，最多 6 个，每个 24 字 */
export function parseTagsInput(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,，、\s]+/)
        .map((t) => t.trim().slice(0, 24))
        .filter(Boolean),
    ),
  ).slice(0, 6);
}

/**
 * 从源码里猜一个标题：优先取 `// 标题：xxx` 注释，其次取第一个函数名，
 * 都拿不到就返回空串（由调用方兜底）。
 */
export function guessTitleFromCode(code: string): string {
  const commentMatch = code.match(/\/\/\s*(?:标题|title|name)\s*[:：]\s*(.+)/i);
  if (commentMatch) return commentMatch[1].trim().slice(0, 60);

  const fnMatch = code.match(/function\s+([A-Z][A-Za-z0-9_]*)/);
  if (fnMatch) return fnMatch[1];

  const constMatch = code.match(/const\s+([A-Z][A-Za-z0-9_]*)\s*=/);
  if (constMatch) return constMatch[1];

  return '';
}

/** 统计源码行数，广场卡片上作为「体量」标签展示 */
export function countCodeLines(code: string): number {
  if (!code) return 0;
  return code.split('\n').filter((line) => line.trim()).length;
}
