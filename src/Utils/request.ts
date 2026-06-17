import axios, { type AxiosRequestConfig } from 'axios';

export const API_BASE = 'http://127.0.0.1:3000';

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

instance.interceptors.response.use(
  (res) => res.data,
  (err) => {
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
