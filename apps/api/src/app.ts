/**
 * Hono 应用组装。
 *
 * server.ts 本地跑时引用它，vercel.ts 部署到 Vercel 时也引用它，
 * 实现"一套代码，本地/云端都能跑"。
 *
 * createApp 接受可选的 deps（用于测试注入）：
 * - deps.db：强制用传入的 Drizzle 实例，跳过全局单例
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';

import { buildCorsOriginChecker, _internal as corsInternal } from './cors-policy.js';
import { authRouter } from './routes/auth.js';
import { auditRouter } from './routes/audit.js';
import { cardsRouter } from './routes/cards.js';
import { financeRouter } from './routes/finance.js';
import { healthRouter } from './routes/health.js';
import { membersRouter } from './routes/members.js';
import { ordersRouter } from './routes/orders.js';
import { usersRouter } from './routes/users.js';
import { walkinsRouter } from './routes/walkins.js';
import type { Db } from './db/client.js';

export interface AppDeps {
  db?: Db;
}

export type AppVariables = {
  dbOverride?: Db;
};

export function createApp(deps: AppDeps = {}) {
  const app = new Hono<{ Variables: AppVariables }>();

  // 注入 deps.db 到 c.var（仅测试用）
  if (deps.db) {
    app.use('*', async (c, next) => {
      c.set('dbOverride', deps.db);
      await next();
    });
  }

  // 全局中间件
  app.use('*', logger());
  // 默认 secureHeaders 带 Cross-Origin-Resource-Policy: same-origin，浏览器跨站 fetch
  //（如 Expo Web → 独立 API 域名）会在已通过 CORS 的情况下仍读不到 JSON。
  app.use(
    '*',
    secureHeaders({
      crossOriginResourcePolicy: 'cross-origin',
    }),
  );
  // CORS：白名单 + 移动端透传（详见 cors-policy.ts）
  const corsOrigin = buildCorsOriginChecker({
    extra: corsInternal.parseExtra(process.env.CORS_ALLOWED_ORIGINS),
  });
  app.use(
    '*',
    cors({
      origin: corsOrigin,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      // 不设 allowHeaders：OPTIONS 预检时回显浏览器的 Access-Control-Request-Headers，
      // 避免 Expo Web / 监控 SDK 多带标头时预检被拒（固定白名单易漏）。
      credentials: true,
      maxAge: 600,
    }),
  );

  // 路由
  app.route('/api/health', healthRouter);
  app.route('/api/auth', authRouter);
  app.route('/api/members', membersRouter);
  app.route('/api/walkins', walkinsRouter);
  app.route('/api/cards', cardsRouter);
  app.route('/api/finance', financeRouter);
  app.route('/api/orders', ordersRouter);
  app.route('/api/users', usersRouter);
  app.route('/api/audit-logs', auditRouter);

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
    if (isSqlSchemaMismatchError(err)) {
      return c.json(
        {
          code: 'SCHEMA_MISMATCH',
          message:
            '数据库结构与当前代码不一致（常见：未执行迁移）。请在服务端执行 apps/api 下的 pnpm db:migrate 后再试。',
        },
        503,
      );
    }
    if (isSqlForeignKeyError(err)) {
      return c.json(
        {
          code: 'CONSTRAINT_FAILED',
          message:
            '数据约束失败：请确认收款人、录入者等仍是在职账号，或刷新员工列表后重试。',
        },
        409,
      );
    }
    if (isSqlUniqueConstraintError(err)) {
      const msg = err instanceof Error ? err.message : String(err);
      const uidHint = msg.includes('members.uid') || msg.includes('uid');
      return c.json(
        {
          code: 'DUPLICATE_KEY',
          message: uidHint
            ? '「姓名/昵称 + 手机号」与已有会员冲突，请区分姓名或昵称后再试。'
            : '记录与已有数据冲突，请检查后重试。',
        },
        409,
      );
    }
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

function isSqlSchemaMismatchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('no such column') || msg.includes('has no column named');
}

function isSqlForeignKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('FOREIGN KEY constraint failed') ||
    msg.includes('SQLITE_CONSTRAINT_FOREIGNKEY')
  );
}

function isSqlUniqueConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('UNIQUE constraint failed') ||
    msg.includes('SQLITE_CONSTRAINT_UNIQUE')
  );
}
