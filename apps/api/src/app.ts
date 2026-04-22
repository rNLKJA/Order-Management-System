/**
 * Hono 应用组装。
 *
 * server.ts 本地跑时引用它，vercel.ts 部署到 Vercel 时也引用它，
 * 实现"一套代码，本地/云端都能跑"。
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';

import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';

export function createApp() {
  const app = new Hono();

  // 全局中间件
  app.use('*', logger());
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: (origin) => origin ?? '*',
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      credentials: true,
      maxAge: 600,
    }),
  );

  // 路由
  app.route('/api/health', healthRouter);
  app.route('/api/auth', authRouter);

  // 根路径
  app.get('/', (c) =>
    c.json({
      name: 'meal-membership-api',
      status: 'ok',
      version: '0.1.0',
    }),
  );

  // 404
  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: '接口不存在' }, 404));

  // 统一异常 → JSON
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json(
        { code: codeFromStatus(err.status), message: err.message },
        err.status,
      );
    }
    // eslint-disable-next-line no-console
    console.error('[unhandled]', err);
    return c.json({ code: 'INTERNAL_ERROR', message: '服务器内部错误' }, 500);
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;

function codeFromStatus(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'SERVER_ERROR' : 'ERROR';
  }
}
