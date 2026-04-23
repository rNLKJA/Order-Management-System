/**
 * 临时：DB 连通性测试接口
 *
 * GET /api/dbtest
 * 用于调试生产环境 Turso 连接。
 */
import { Hono } from 'hono';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';

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
