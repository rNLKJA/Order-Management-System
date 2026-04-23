/**
 * 临时：连通性测试接口
 *
 * GET /api/dbtest   → drizzle+libsql client 的查询
 * GET /api/dbtest/raw  → 手写 fetch 直接打 Turso Hrana HTTP 端点
 */
import { Hono } from 'hono';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { env } from '../env.js';

export const dbtestRouter = new Hono();

dbtestRouter.get('/', async (c) => {
  const t0 = Date.now();
  try {
    const db = requestDb(c);
    const t1 = Date.now();
    const rows = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
    const t2 = Date.now();
    return c.json({
      ok: true,
      getDbMs: t1 - t0,
      queryMs: t2 - t1,
      totalMs: t2 - t0,
      userCount: rows.length,
    });
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        message: err?.message,
        code: err?.code,
        stack: err?.stack?.split('\n').slice(0, 5),
        elapsedMs: Date.now() - t0,
      },
      500,
    );
  }
});

dbtestRouter.get('/raw', async (c) => {
  const t0 = Date.now();
  const raw = env.TURSO_DATABASE_URL;
  const httpUrl = raw.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '');
  const token = env.TURSO_AUTH_TOKEN ?? '';
  try {
    const res = await fetch(`${httpUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ type: 'execute', stmt: { sql: 'SELECT 1 AS ok' } }],
      }),
    });
    const text = await res.text();
    return c.json({
      ok: res.ok,
      status: res.status,
      url: httpUrl,
      tokenLen: token.length,
      tokenPrefix: token.slice(0, 20),
      tokenSuffix: token.slice(-20),
      body: text.slice(0, 500),
      elapsedMs: Date.now() - t0,
    });
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        message: err?.message,
        code: err?.code,
        elapsedMs: Date.now() - t0,
      },
      500,
    );
  }
});
