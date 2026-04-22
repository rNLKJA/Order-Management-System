/**
 * API 客户端：封装 fetch + Authorization 注入 + 401 统一处理。
 *
 * 生产的 API baseUrl 从 app.json 里的 extra.apiBaseUrl 读（或 EXPO_PUBLIC_API_BASE_URL）。
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
