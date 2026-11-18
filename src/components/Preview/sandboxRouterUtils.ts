// 这些类型和函数不依赖 React，负责路径解析、历史更新和路由匹配。
export type RouteParams = Record<string, string>;

export interface RouterLocation {
  pathname: string;
  search: string;
  hash: string;
  key: string;
  state: unknown;
}

export interface RouterHistory {
  stack: string[];
  index: number;
}

export interface NavigateOptions {
  replace?: boolean;
}

export type NavigateFn = (
  to: string | number,
  options?: NavigateOptions
) => void;

export function createLocation(path: string): RouterLocation {
  const [pathname, query = ''] = path.split('?');

  return {
    pathname,
    search: query ? `?${query}` : '',
    hash: '',
    key: path,
    state: null,
  };
}

export function getNextHistory(
  history: RouterHistory,
  to: string | number,
  options?: NavigateOptions
): RouterHistory {
  // 数字表示前进或后退；超出历史范围时保持原状态。
  if (typeof to === 'number') {
    const nextIndex = history.index + to;
    if (nextIndex < 0 || nextIndex >= history.stack.length) return history;
    return { ...history, index: nextIndex };
  }

  // 跳转到具体地址时，保留当前项及之前的历史，丢弃前进记录。
  const stack = history.stack.slice(0, history.index + 1);

  if (options?.replace) {
    stack[history.index] = to;
    return { stack, index: history.index };
  }

  // 重复导航不新增记录，避免 StrictMode 重复执行重定向时产生冗余历史。
  if (history.stack[history.index] === to) return history;

  return {
    stack: [...stack, to],
    index: history.index + 1,
  };
}

export function matchPath(
  pattern: string,
  pathname: string
): RouteParams | null {
  if (pattern === '*') return {};

  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return null;

  const params: RouteParams = {};

  for (let index = 0; index < patternSegments.length; index++) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];

    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
    } else if (patternSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}
