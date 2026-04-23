/**
 * 测试辅助工具。
 *
 * - 每个测试一个全新的 in-memory SQLite + schema
 * - 用 hono 的 `app.fetch()` 原生测试（无需 supertest / node-server）
 * - 辅助函数 `seedUser()` 创建账号，`login()` 一步拿 token
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { hash } from '@node-rs/argon2';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, readdirSync, unlinkSync, mkdtempSync } from 'node:fs';
import { afterEach } from 'vitest';

import * as schema from './db/schema.js';
import { resetDbForTesting, setClientForTesting } from './db/client.js';
import { createApp } from './app.js';
import type { LoginResponse, UserRole } from '@meal/shared';

const here = fileURLToPath(new URL('.', import.meta.url));
const drizzleDir = resolve(here, '../drizzle');

/**
 * 创建一个全新的内存 SQLite DB + schema。
 * 每个测试 beforeEach 调一次，隔离干净。
 */
const tempDbs: string[] = [];
// 测试结束后清掉临时文件
afterEach(() => {
  while (tempDbs.length) {
    const path = tempDbs.pop()!;
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  }
});

export async function setupTestDb() {
  // 用临时文件 DB，避免 :memory: 在 libsql native 驱动下的怪异行为
  const dir = mkdtempSync(resolve(tmpdir(), 'meal-test-'));
  const path = resolve(dir, 'test.db');
  const url = `file:${path}`;
  tempDbs.push(path);

  resetDbForTesting();
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  setClientForTesting(client);

  // 直接运行建表 SQL
  if (!existsSync(drizzleDir)) {
    throw new Error(
      'drizzle/ 目录为空，请先跑 `pnpm --filter @meal/api exec drizzle-kit generate`',
    );
  }
  const files = readdirSync(drizzleDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    throw new Error('drizzle/ 目录下没有 .sql 文件');
  }

  for (const f of files) {
    const sql = readFileSync(resolve(drizzleDir, f), 'utf-8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const statement of statements) {
      try {
        await client.execute(statement);
      } catch (err) {
        throw new Error(
          `migration 失败在语句:\n${statement.slice(0, 120)}...\n原因：${(err as Error).message}`,
        );
      }
    }
  }

  // 立即验证 users 表存在
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );
  const tableNames = tables.rows.map((r) => r.name as string);
  if (!tableNames.includes('users')) {
    throw new Error(
      `schema 建表失败；建好的表：${tableNames.join(', ') || '(无)'}`,
    );
  }

  return { db, client };
}

/**
 * 建一个可登录的用户，返回 id + 明文密码。
 */
export async function seedUser(
  db: ReturnType<typeof drizzle<typeof schema>>,
  opts: {
    username: string;
    full_name?: string;
    role?: UserRole;
    password?: string;
    is_active?: boolean;
  },
): Promise<{ id: number; password: string }> {
  const password = opts.password ?? 'TestPassword123!';
  const password_hash = await hash(password, {
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
  });
  const rows = await db
    .insert(schema.users)
    .values({
      username: opts.username,
      full_name: opts.full_name ?? opts.username,
      role: opts.role ?? 'staff',
      password_hash,
      is_active: opts.is_active ?? true,
    })
    .returning({ id: schema.users.id });
  return { id: rows[0]!.id, password };
}

type FetchLike = {
  fetch: (req: Request) => Response | Promise<Response>;
};

/**
 * 登录并返回 token。传 app（已注入 db）。
 */
export async function login(
  app: FetchLike,
  username: string,
  password: string,
): Promise<LoginResponse> {
  const res = await app.fetch(
    new Request('http://test.local/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`login failed (${res.status}): ${body}`);
  }
  return (await res.json()) as LoginResponse;
}

export { createApp, schema };
