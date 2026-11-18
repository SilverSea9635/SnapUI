import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE, getAccessToken, refreshAccessToken } from './token';

export { API_BASE };

type AxiosRequestError = AxiosError<{ error?: unknown }>;

export class RequestError extends Error {
  override name = 'RequestError';
  readonly status?: number;
  readonly code?: string;
  readonly retryAfter?: string;

  constructor(
    message: string,
    error: AxiosRequestError
  ) {
    super(message);
    this.status = error.response?.status;
    this.code = error.code;
    const retryAfter = error.response?.headers['retry-after'];
    this.retryAfter = typeof retryAfter === 'string' ? retryAfter : undefined;
  }
}

const instance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

instance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processPendingQueue(
  error: unknown,
  token: string | null
) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  pendingQueue = [];
}

function requestErrorMessage(error: AxiosRequestError): string {
  if (error.code === 'ERR_CANCELED') return '请求已取消';
  const message = error.response?.data?.error;
  if (typeof message === 'string' && message.trim()) return message;
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return '请求超时，请稍后重试';
  }
  if (!error.response) return '网络连接失败，请检查网络后重试';
  if (error.response.status === 401) {
    return error.config?.url === '/api/auth/login' ? '邮箱或密码不正确' : '登录已失效，请重新登录';
  }
  return '请求失败，请稍后重试';
}

function normalizeRequestError(error: unknown): Error {
  if (axios.isAxiosError<{ error?: unknown }>(error)) {
    return new RequestError(requestErrorMessage(error), error);
  }
  return error instanceof Error ? error : new Error('请求失败，请稍后重试');
}

instance.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const originalRequest = err.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const requestError = normalizeRequestError(err);
    const isAuthSubmission = /^\/api\/auth\/(login|register|forgot-password|reset-password)$/.test(originalRequest?.url ?? '');

    if (err.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthSubmission) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((
          resolve,
          reject
        ) => {
          pendingQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(instance(originalRequest));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        const ok = await refreshAccessToken();
        if (ok) {
          const newToken = getAccessToken();
          processPendingQueue(null, newToken);
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return instance(originalRequest);
        }
        processPendingQueue(requestError, null);
        return Promise.reject(requestError);
      } catch (refreshErr) {
        const refreshError = normalizeRequestError(refreshErr);
        processPendingQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(requestError);
  },
);

// 响应拦截器已解包 res.data；Axios 第二个泛型将返回类型声明为 T。
export const get = <T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> =>
  instance.get<T, T>(url, config);
export const post = <T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> =>
  instance.post<T, T>(url, data, config);
export const put = <T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> =>
  instance.put<T, T>(url, data, config);
export const patch = <T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> =>
  instance.patch<T, T>(url, data, config);
export const del = <T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> =>
  instance.delete<T, T>(url, config);

export default instance;
