import { del, get, patch, post } from '@/utils/request';

/** 作品作者精简信息 */
export type WorkAuthor = {
  id: number;
  nickname: string;
  avatar: string | null;
};

/** 引用来源（详情页展示「引用自」） */
export type WorkSource = {
  id: number;
  title: string;
  author: { id: number; nickname: string };
};

/**
 * 作品对象：列表项与详情同一形状。
 * 列表项也带 sourceCode —— 广场卡片需要就地编译预览。
 */
export type Work = {
  id: number;
  title: string;
  description: string;
  sourceCode: string;
  tags: string[];
  isPublic: boolean;
  previewImage: string | null;
  createdAt: string;
  updatedAt: string;
  author: WorkAuthor;
  favoriteCount: number;
  referenceCount: number;
  favorited: boolean;
  isOwner: boolean;
  sourceWork: WorkSource | null;
  /** 由本作品派生出去的作品（详情接口可选返回，列表接口不返回） */
  sourceWorks?: WorkSource[];
};

/** 列表范围：公开广场 / 我的作品 / 我的收藏 */
export type WorkScope = 'public' | 'mine' | 'favorites';
/** 排序：最新 / 最热（按收藏数） */
export type WorkSort = 'latest' | 'hot';

export type WorkListResult = {
  total: number;
  page: number;
  pageSize: number;
  works: Work[];
};

export type WorkListParams = {
  scope?: WorkScope;
  sort?: WorkSort;
  q?: string;
  page?: number;
  pageSize?: number;
};

function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === null) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function fetchWorks({ scope = 'public', sort = 'latest', q, page = 1, pageSize = 12 }: WorkListParams = {}) {
  return get<WorkListResult>(`/api/works${toQuery({ scope, sort, q, page, pageSize })}`);
}

export function fetchWork(id: number | string) {
  return get<{ work: Work }>(`/api/works/${id}`);
}

export function createWork(payload: {
  title?: string;
  description?: string;
  sourceCode: string;
  tags?: string[];
  isPublic?: boolean;
  /** 引用发布：记录血缘来源 */
  sourceWorkId?: number;
}) {
  return post<{ work: Work }>('/api/works', payload);
}

export function updateWork(
  id: number | string,
  payload: { title?: string; description?: string; tags?: string[]; isPublic?: boolean },
) {
  return patch<{ work: Work }>(`/api/works/${id}`, payload);
}

export function deleteWork(id: number | string) {
  return del<{ deleted: boolean }>(`/api/works/${id}`);
}

/** 收藏开关：favorited=true 走 POST，false 走 DELETE —— 一个入口两种结果 */
export function toggleWorkFavorite(
  id: number | string,
  favorited: boolean
) {
  const url = `/api/works/${id}/favorite`;
  return favorited
    ? post<{ favorited: boolean; favoriteCount: number }>(url)
    : del<{ favorited: boolean; favoriteCount: number }>(url);
}

/** 记录一次「引用」（进入调整流程时调用，用于统计引用链路） */
export function recordWorkReference(
  id: number | string,
  prompt = ''
) {
  return post<{ recorded: boolean; sourceWorkId: number }>(`/api/works/${id}/reference`, { prompt });
}

/** 从 AI 回复里抽取可渲染的 TSX 代码块 */
export function extractTsx(content: string): string | null {
  const match = content.match(/```(?:tsx?|jsx?)\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  if (/function\s+Component\b/.test(content)) return content.trim();
  return null;
}
