/**
 * 简易限流中间件（内存版 token bucket）。
 *
 * MVP 够用；部署多实例 serverless 时会失效（每个 lambda 实例一个 bucket）。
 * Phase 4+ 可以换成基于 Turso 或 Upstash 的分布式限流。
 *
 * 用法：
 *   app.post('/login', rateLimit({ windowMs: 60_000, max: 10 }), ...)
 */

import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

interface Bucket {
  count: number;
  resetAt: number;
}

interface Options {
  /** 窗口期（ms） */
  windowMs: number;
  /** 窗口期内最大请求数 */
  max: number;
  /** 自定义 key 提取器 */
  keyFn?: (c: Parameters<MiddlewareHandler>[0]) => string;
  /** 超限错误文案 */
  message?: string;
}

export function rateLimit(opts: Options): MiddlewareHandler {
  const store = new Map<string, Bucket>();

  return async (c, next) => {
    const key = opts.keyFn
      ? opts.keyFn(c)
      : (c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'anon').split(
          ',',
        )[0]?.trim() || 'anon';

    const now = Date.now();
    const bucket = store.get(key);

    if (!bucket || bucket.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > opts.max) {
        const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
        c.header('Retry-After', String(retryAfter));
        throw new HTTPException(429, {
          message: opts.message ?? `请求过于频繁，请 ${retryAfter} 秒后重试`,
        });
      }
    }

    // 周期性清理过期 bucket
    if (store.size > 1000) {
      for (const [k, v] of store.entries()) {
        if (v.resetAt < now) store.delete(k);
      }
    }

    await next();
  };
}
