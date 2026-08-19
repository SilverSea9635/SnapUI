import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { refreshAccessToken } from '@/stores/auth';

export const API_BASE = import.meta.env.VITE_BASE_URL;

const instance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('snapui-token');
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

function processPendingQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  pendingQueue = [];
}

instance.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const originalRequest = err.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
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
          const newToken = localStorage.getItem('snapui-token');
          processPendingQueue(null, newToken);
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return instance(originalRequest);
        }
        processPendingQueue(err, null);
        return Promise.reject(err);
      } catch (refreshErr) {
        processPendingQueue(refreshErr, null);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const message = err.response?.data?.error || err.message || '请求失败';
    return Promise.reject(new Error(message));
  },
);

// 响应拦截器已解包 res.data，第二个泛型让返回类型从 AxiosResponse<T> 变为 T
type UnwrappedAxios = {
  get: <T>(url: string, config?: AxiosRequestConfig) => Promise<T>;
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>;
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>;
  delete: <T>(url: string, config?: AxiosRequestConfig) => Promise<T>;
};

const api = instance as unknown as UnwrappedAxios;

export const get = <T = unknown>(url: string, config?: AxiosRequestConfig) => api.get<T>(url, config);
export const post = <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => api.post<T>(url, data, config);
export const put = <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => api.put<T>(url, data, config);
export const del = <T = unknown>(url: string, config?: AxiosRequestConfig) => api.delete<T>(url, config);

export default instance;
