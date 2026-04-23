/**
 * 临时诊断路由。
 *
 * - GET  /api/debug/select-user  → 直接用全局 getDb 查一次 users
 * - POST /api/debug/argon        → 纯 argon2 verify benchmark
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { verifyPassword } from '../services/password.js';

export const debugRouter = new Hono();

debugRouter.get('/select-user', async (c) => {
  const t0 = Date.now();
  try {
    const db = requestDb(c);
    const t1 = Date.now();
    const rows = await db
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.username, 'rNLKJA'))
      .limit(1);
    return c.json({
      ok: true,
      getDbMs: t1 - t0,
      queryMs: Date.now() - t1,
      found: rows.length,
      username: rows[0]?.username,
    });
  } catch (err: any) {
    return c.json(
      { ok: false, message: err?.message, code: err?.code, elapsedMs: Date.now() - t0 },
      500,
    );
  }
});

debugRouter.post('/argon', async (c) => {
  const t0 = Date.now();
  // 已知哈希 + 明文
  const hash =
    '$argon2id$v=19$m=65536,t=3,p=1$iQPvzhj5Y01EsMVqqQxnIg$0w5YjZiuTq6pVRVBD4NJBA1evhbDl0NYoSDt/sFsgpo';
  const ok = await verifyPassword('hello', hash);
  return c.json({ ok, elapsedMs: Date.now() - t0 });
});
