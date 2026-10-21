/**
 * Token 存储与刷新（基础设施层）。
 *
 * 独立于 auth store 与 request 封装：
 * - request.ts 依赖这里（读取 token、401 时刷新）；
 * - auth store 依赖这里（登录/登出时读写 token）。
 * 从而打破 request ↔ auth 的循环依赖。
 */

const ACCESS_KEY = 'snapui-token';
const REFRESH_KEY = 'snapui-refresh-token';

export const API_BASE = import.meta.env.VITE_BASE_URL;

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(
  accessToken: string,
  refreshToken?: string
): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** 使用原生 fetch 直调刷新接口，避免经过 axios 拦截器（否则刷新自身 401 会递归） */
export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      clearTokens();
      return false;
    }
    const data = (await response.json()) as { token: string; refreshToken?: string };
    setTokens(data.token, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}
