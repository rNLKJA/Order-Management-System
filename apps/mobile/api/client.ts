/**
 * API 客户端：封装 fetch + Authorization 注入 + 401 统一处理。
 *
 * ─────────────────────────────────────────────────────────────
 * baseUrl 解析优先级（从高到低）：
 *   1. EXPO_PUBLIC_API_BASE_URL  —— 构建期注入。来源有三：
 *        a) 根目录 .env（开发机，例如 http://192.168.x.x:3000）
 *        b) CI 显式 export
 *        c) apps/mobile/eas.json 的 build.<profile>.env.EXPO_PUBLIC_API_BASE_URL
 *           （本项目当前 development / preview / production 三个 profile 都显式写死，
 *            发版走的就是这条）
 *   2. app.json 的 extra.apiBaseUrl —— 随 native 二进制一起发布的兜底，
 *      仅当 1 缺失时生效。Expo Go 里没法读 EAS env，靠的就是这条。
 *   3. DEFAULT_BASE_URL = http://localhost:3000 —— 最终兜底。
 *
 * 配置守则：
 *   • 改正式 API 域名时三处一起改，避免漂移：
 *       - apps/mobile/app.json   → expo.extra.apiBaseUrl
 *       - apps/mobile/eas.json   → build.preview.env / build.production.env
 *       - .env.example           → 顶部说明段
 *   • 真机调试 LAN 调用：在根 .env 改 EXPO_PUBLIC_API_BASE_URL，别用 localhost（手机的 localhost 是它自己）。
 *   • 国内访问：不要用 *.vercel.app，绑自定义域名（DNS 不污染）。
 */

import Constants from 'expo-constants';
import { clearCredentials, getToken } from '../lib/authStorage';
import { emitAuthSessionReset } from '../lib/authSession';

// Web 本地预览在部分环境拿不到 expoConfig.extra，兜底统一走生产 API。
const DEFAULT_BASE_URL = 'https://api.anshun-healthy-food.com';

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
      await clearCredentials();
      emitAuthSessionReset();
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

export interface PostOptions {
  /** 与后端 CORS / POST /api/orders 幂等键一致 */
  headers?: Record<string, string>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: PostOptions) =>
    request<T>(path, {
      method: 'POST',
      body: body != null ? JSON.stringify(body) : undefined,
      headers: options?.headers,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
