/**
 * API 客户端：封装 fetch + Authorization 注入 + 401 统一处理。
 *
 * ─────────────────────────────────────────────────────────────
 * baseUrl 解析优先级（从高到低）：
 *   1. EXPO_PUBLIC_API_BASE_URL  —— 构建期注入（根目录 .env / CI / `EXPO_PUBLIC_API_BASE_URL=... pnpm mobile`）。
 *      适合本地开发与不同环境切换（preview / staging），不需要改 app.json。
 *   2. app.json 的 extra.apiBaseUrl —— 随 native 二进制一起发布。
 *      适合生产/TestFlight 发版的兜底值，保证没有 .env 的裸装包也能连上生产 API。
 *   3. DEFAULT_BASE_URL = http://localhost:3000 —— 最后兜底。
 *
 * 使用建议：
 *   • 开发机：在项目根 .env 设 EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:3000（真机调试时别用 localhost）。
 *   • EAS / 应用商店构建：只依赖 app.json 的 extra.apiBaseUrl，不要在 build profile 里再塞 EXPO_PUBLIC_*，
 *     否则两处不一致时排查很痛苦。
 *   • 任何变更请同步更新根目录 .env.example 的说明段落。
 */

import Constants from 'expo-constants';
import { getToken, clearToken } from '../hooks/useAuth';

const DEFAULT_BASE_URL = 'http://localhost:3000';

function getBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl;
  return fromExtra ?? DEFAULT_BASE_URL;
}

export interface ApiErrorShape {
  code?: string;
  message: string;
  status: number;
}

export class ApiError extends Error implements ApiErrorShape {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const url = getBaseUrl() + path;
  const res = await fetch(url, { ...init, headers });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string')
      ? data.message
      : `请求失败 (${res.status})`;
    const code = data && typeof data === 'object' && 'code' in data && typeof data.code === 'string'
      ? data.code
      : undefined;

    if (res.status === 401) {
      await clearToken();
    }
    throw new ApiError(msg, res.status, code);
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
