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

dbtestRouter.get('/cmp', async (c) => {
  const t0 = Date.now();
  const out: Record<string, unknown> = {
    envTokenLen: (env.TURSO_AUTH_TOKEN ?? '').length,
    processEnvTokenLen: (process.env.TURSO_AUTH_TOKEN ?? '').length,
    envUrl: env.TURSO_DATABASE_URL,
  };

  // 测试 A：inline 构造 http client，url=libsql://（未转换）
  try {
    const { createClient } = await import('@libsql/client/http');
    const client = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
    const res = await client.execute('SELECT 1 AS ok');
    out.aLibsqlUrlOk = true;
    out.aLibsqlUrlRows = res.rows?.length;
  } catch (err: any) {
    out.aLibsqlUrlOk = false;
    out.aLibsqlUrlError = err?.message;
  }

  // 测试 B：和 intercept 等价但不记 log
  try {
    const { createClient } = await import('@libsql/client/http');
    const httpsUrl = env.TURSO_DATABASE_URL.replace(/^libsql:\/\//, 'https://');
    const loggingFetch: typeof fetch = async (input, init) => {
      const req = input instanceof Request ? input : new Request(input, init);
      return await fetch(req);
    };
    const client = createClient({
      url: httpsUrl,
      authToken: env.TURSO_AUTH_TOKEN,
      fetch: loggingFetch,
    });
    const res = await client.execute('SELECT 1 AS ok');
    out.bHttpsUrlOk = true;
    out.bHttpsUrlRows = res.rows?.length;
  } catch (err: any) {
    out.bHttpsUrlOk = false;
    out.bHttpsUrlError = err?.message;
  }

  // 测试 C：全局 getClient
  try {
    const { resetDbForTesting, getClient } = await import('../db/client.js');
    resetDbForTesting();
    const client = getClient();
    const res = await client.execute('SELECT 1 AS ok');
    out.cGlobalOk = true;
    out.cGlobalRows = res.rows?.length;
  } catch (err: any) {
    out.cGlobalOk = false;
    out.cGlobalError = err?.message;
  }

  out.elapsedMs = Date.now() - t0;
  return c.json(out);
});

dbtestRouter.get('/intercept', async (c) => {
  const t0 = Date.now();
  const raw = env.TURSO_DATABASE_URL;
  const httpUrl = raw.replace(/^libsql:\/\//, 'https://');
  const token = env.TURSO_AUTH_TOKEN ?? '';
  const logged: Array<{ url: string; method: string; status?: number; authSent?: boolean }> = [];
  const loggingFetch: typeof fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const authSent = req.headers.has('authorization');
    try {
      const res = await fetch(req);
      logged.push({ url: req.url, method: req.method, status: res.status, authSent });
      return res;
    } catch (e: any) {
      logged.push({ url: req.url, method: req.method, status: -1, authSent });
      throw e;
    }
  };
  try {
    const { createClient } = await import('@libsql/client/http');
    const client = createClient({ url: httpUrl, authToken: token, fetch: loggingFetch });
    const res = await client.execute('SELECT 1 AS ok');
    return c.json({ ok: true, elapsedMs: Date.now() - t0, result: res.rows, logged });
  } catch (err: any) {
    return c.json(
      { ok: false, message: err?.message, code: err?.code, elapsedMs: Date.now() - t0, logged },
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
