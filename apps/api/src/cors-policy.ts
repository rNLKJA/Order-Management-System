/**
 * CORS 来源白名单。
 *
 * 设计目标：
 *  - 移动端 React Native 原生 fetch 不发 Origin header → 不需要 CORS 响应头，直接放行
 *  - 浏览器请求严格白名单：生产 web 域名 + 本地 Expo dev + Vercel preview
 *  - 运营临时加 origin 走环境变量 `CORS_ALLOWED_ORIGINS=a,b,c`，不用改代码发版
 *
 * 与 hono/cors 的契约：
 *  - callback 返回 string  → 写 Access-Control-Allow-Origin: <string>
 *  - callback 返回 ''/null → 不写头（移动端 OK；未授权浏览器会被拒）
 */

const PROD_WEB_ORIGINS = [
  'https://anshun-healthy-food.com',
  'https://www.anshun-healthy-food.com',
  'https://app.anshun-healthy-food.com',
];

/**
 * 本地开发时常见的 Expo / Web 起源端口。
 * - 8081: Expo SDK 50+ web 默认端口
 * - 19006: 旧版 Expo Web
 * - 3000:  备用（API 端口同号但 host 不同时也允许，便于本地 mocking）
 */
const DEV_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
  'http://127.0.0.1:3000',
];

function parseExtra(env: string | undefined): string[] {
  if (!env) return [];
  return env
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isVercelPreview(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.protocol === 'https:' && u.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

export interface CorsPolicyOptions {
  /** 额外允许的 origin 列表，通常来自 process.env.CORS_ALLOWED_ORIGINS */
  extra?: string[];
  /** 是否允许 https://*.vercel.app 子域名（预览部署）。默认 true。 */
  allowVercelPreview?: boolean;
}

/**
 * 构建一个适配 hono/cors `origin` 选项的判定函数。
 *
 * @example
 *   cors({ origin: buildCorsOriginChecker({ extra: parseExtra(process.env.CORS_ALLOWED_ORIGINS) }) })
 */
export function buildCorsOriginChecker(
  opts: CorsPolicyOptions = {},
): (origin: string) => string {
  const allowVercel = opts.allowVercelPreview ?? true;
  const set = new Set<string>([
    ...PROD_WEB_ORIGINS,
    ...DEV_ORIGINS,
    ...(opts.extra ?? []),
  ]);

  return (origin: string): string => {
    if (!origin) return '';
    if (set.has(origin)) return origin;
    if (allowVercel && isVercelPreview(origin)) return origin;
    return '';
  };
}

export const _internal = {
  PROD_WEB_ORIGINS,
  DEV_ORIGINS,
  parseExtra,
  isVercelPreview,
};
