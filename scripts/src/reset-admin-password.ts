/**
 * admin 忘密 后门脚本（本地跑）。
 *
 * 用法：
 *   pnpm --filter @meal/scripts reset-admin-password <新密码>
 *
 * 要求：已配置 TURSO_DATABASE_URL + TURSO_AUTH_TOKEN，
 *       从能访问 Turso 的机器上运行。
 *
 * 行为：
 *   1. 按 BOOTSTRAP_ADMIN_USERNAME（默认 rNLKJA）找 admin 账号
 *   2. 把 password_hash 改为新密码的 argon2id
 *   3. token_version += 1，旧 token 立刻失效
 */

import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@libsql/client';

const here = dirname(fileURLToPath(import.meta.url));
for (const path of [resolve(here, '../../.env'), resolve(here, '../.env')]) {
  if (existsSync(path)) loadDotenv({ path });
}
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { users } from '../../apps/api/src/db/schema';

async function main() {
  const password = process.argv[2];
  if (!password || password.length < 8) {
    console.error('用法：pnpm --filter @meal/scripts reset-admin-password <至少 8 位的新密码>');
    process.exit(1);
  }

  const dbUrl = process.env.TURSO_DATABASE_URL;
  if (!dbUrl) {
    console.error('TURSO_DATABASE_URL 未设置');
    process.exit(1);
  }

  const adminUsername = process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'rNLKJA';

  const client = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  const current = await db
    .select()
    .from(users)
    .where(eq(users.username, adminUsername))
    .limit(1);

  const row = current[0];
  if (!row) {
    console.error(`未找到 admin 账号 ${adminUsername}`);
    process.exit(1);
  }

  const password_hash = await hash(password, {
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
  });

  await db
    .update(users)
    .set({
      password_hash,
      token_version: row.token_version + 1,
    })
    .where(eq(users.id, row.id));

  console.log(`admin 账号 ${adminUsername} 密码已重置；旧 token 已全部失效。`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
