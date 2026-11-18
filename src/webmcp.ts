import { z } from 'zod';
import { fetchWorks } from '@/api/works';
import { router } from '@/router';
import { RequestError } from '@/utils/request';
import { gallerySearchPath } from '@/utils/works';

type ToolExecuteOptions = { signal: AbortSignal };

type ToolExecute = (
  args: unknown,
  options: ToolExecuteOptions
) => Promise<object>;

type NativeModelContext = {
  registerTool(tool: {
    name: string;
    description: string;
    inputSchema: object;
    annotations?: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: ToolExecute;
  }): Promise<void>;
};

type FailureDetails = {
  retryable?: boolean;
  maxRetries?: number;
  retryAfterMs?: number;
  fields?: string[];
  fallback?: { action: 'open_url'; url: string };
};

class GalleryNavigationError extends Error {
  readonly url: string;

  constructor(
    url: string,
    cause: unknown
  ) {
    super('作品广场导航失败', { cause });
    this.url = url;
  }
}

const query = z.string().max(120).trim().optional();
const galleryInput = z.strictObject({ query });
const searchInput = galleryInput.extend({ page: z.number().int().min(1).optional() });

function failure(
  code: string,
  message: string,
  details: FailureDetails = {}
) {
  return { ok: false, code, message, retryable: false, ...details };
}

function retryFailure(
  code: string,
  message: string,
  retryAfterMs = 1000
) {
  return failure(code, `${message}等待指定时间后，用相同参数最多重试一次。`, {
    retryable: true,
    maxRetries: 1,
    retryAfterMs,
  });
}

function parseRetryAfter(header: string | undefined): number | undefined {
  const value = header?.trim();
  if (!value) return undefined;

  const isDelay = /^\d+$/.test(value);
  if (!isDelay && !/^\w{3}.* \d{2}:\d{2}:\d{2} /.test(value)) return undefined;

  const delay = isDelay ? Number(value) * 1000 : Date.parse(value) - Date.now();
  return Number.isSafeInteger(delay) ? Math.max(0, delay) : undefined;
}

function handleRequestFailure(error: RequestError) {
  const { status, code, retryAfter } = error;
  if (status === 429) {
    const delay = parseRetryAfter(retryAfter);
    if (delay !== undefined) return retryFailure('RATE_LIMITED', '作品搜索暂时被限流。', delay);
    return failure('RATE_LIMITED', '作品搜索暂时被限流，且没有可用的等待时间。请停止自动重试。');
  }
  if (status === 401) return failure('AUTH_REQUIRED', '请先在 SnapUI 登录，再重新调用工具。');
  if (status === 403) return failure('ACCESS_DENIED', '当前用户没有访问权限。请停止重试。');
  if (status === 408 || status === 504 || code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return retryFailure('SEARCH_TIMEOUT', '作品搜索超时。');
  }
  if (status === 502 || status === 503) {
    return retryFailure('SERVICE_UNAVAILABLE', '作品服务暂时不可用。', parseRetryAfter(retryAfter));
  }
  if (code === 'ERR_NETWORK') return retryFailure('NETWORK_ERROR', '无法连接作品服务。');
  return failure('SEARCH_FAILED', '作品服务未能完成搜索。请停止自动重试。');
}

function withToolErrorHandling(execute: ToolExecute): ToolExecute {
  return async (
    args,
    options
  ) => {
    const { signal } = options;
    try {
      signal.throwIfAborted();
      const result = await execute(args, options);
      signal.throwIfAborted();
      return result;
    } catch (error) {
      if (signal.aborted || (error instanceof RequestError && error.code === 'ERR_CANCELED')) {
        return failure('CANCELLED', '工具调用已取消。请停止重试。');
      }
      if (error instanceof z.ZodError) {
        const fields = [...new Set(error.issues.map(({ path }) => path.join('.') || 'arguments'))];
        return failure('INVALID_ARGUMENT', '请按输入定义修正列出的字段后再调用。', { fields });
      }
      if (error instanceof RequestError) return handleRequestFailure(error);

      console.error('WebMCP 工具执行失败', error);
      if (error instanceof GalleryNavigationError) {
        return failure('NAVIGATION_FAILED', '页面内跳转失败。可直接打开返回的作品广场 URL。', {
          fallback: { action: 'open_url', url: error.url },
        });
      }
      return failure('INTERNAL_ERROR', '工具执行遇到意外错误。请停止自动重试。');
    }
  };
}

class WebMcpTools {
  @withToolErrorHandling
  static async openGallery(
    args: unknown,
    { signal }: ToolExecuteOptions
  ): Promise<object> {
    const { query } = galleryInput.parse(args ?? {});
    const path = gallerySearchPath(query ?? '');
    const url = new URL(path, window.location.origin);
    try {
      await router.navigate(path);
    } catch (error) {
      throw new GalleryNavigationError(url.href, error);
    }
    signal.throwIfAborted();
    const { location, errors } = router.state;
    if (location.pathname !== url.pathname || location.search !== url.search) {
      return failure('NAVIGATION_INTERRUPTED', '页面已转到其他地址。请检查当前标签页再决定下一步。');
    }
    if (errors) throw new GalleryNavigationError(url.href, errors);
    return { url: url.href };
  }

  @withToolErrorHandling
  static async searchPublicWorks(
    args: unknown,
    { signal }: ToolExecuteOptions
  ): Promise<object> {
    const { query, page = 1 } = searchInput.parse(args ?? {});
    const data = await fetchWorks({ scope: 'public', q: query || undefined, page, signal });
    return {
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      works: data.works.filter((work) => work.isPublic).map((work) => ({
        id: work.id,
        title: work.title,
        description: work.description,
        tags: work.tags,
        author: work.author?.nickname,
        url: new URL(`/works/${work.id}`, window.location.origin).href,
      })),
    };
  }
}

export async function initializeWebMcp() {
  const modelContext = (document as Document & { modelContext?: NativeModelContext }).modelContext;
  if (!modelContext) return;

  await Promise.all([
    modelContext.registerTool({
      name: 'open_gallery',
      description: '在当前 SnapUI 标签页打开作品广场，可按作品名称或标签筛选。',
      inputSchema: z.toJSONSchema(galleryInput),
      execute: WebMcpTools.openGallery,
    }),
    modelContext.registerTool({
      name: 'search_public_works',
      description: '按作品名称或标签搜索 SnapUI 公开作品。每页最多返回 12 条作品摘要和链接。',
      inputSchema: z.toJSONSchema(searchInput),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: WebMcpTools.searchPublicWorks,
    }),
  ]);
}
