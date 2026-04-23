/**
 * 手动新增账号（admin / staff）。
 *
 * 用法：
 *   pnpm --filter @meal/scripts create-user <username> [full_name] [--role=staff|admin] [--password=xxx] [--length=8]
 *
 * 例：
 *   pnpm --filter @meal/scripts create-user sunny
 *   pnpm --filter @meal/scripts create-user sunny 测试账号 --role=staff --length=8
 *
 * 行为：
 *   - 若未提供密码，随机生成指定长度（默认 12 位，最小 8 位）
 *   - 密码只打印一次，不入库明文
 *   - username 冲突则直接退出（不覆盖）
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
import { users, type NewUser } from '../../apps/api/src/db/schema';

interface Args {
  username: string;
  full_name: string;
  role: 'admin' | 'staff';
  password: string | null;
  length: number;
}

function parseArgs(): Args {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith('--')) {
      const eq = raw.indexOf('=');
      if (eq === -1) {
        flags[raw.slice(2)] = 'true';
      } else {
        flags[raw.slice(2, eq)] = raw.slice(eq + 1);
      }
    } else {
      positional.push(raw);
    }
  }
  const username = positional[0];
  if (!username) {
    console.error('用法：create-user <username> [full_name] [--role=staff|admin] [--password=xxx] [--length=8]');
    process.exit(1);
  }
  const role = (flags.role ?? 'staff') as 'admin' | 'staff';
  if (role !== 'admin' && role !== 'staff') {
    console.error(`--role 必须是 admin 或 staff，当前：${flags.role}`);
    process.exit(1);
  }
  const length = flags.length ? Number.parseInt(flags.length, 10) : 12;
  if (!Number.isFinite(length) || length < 8) {
    console.error('--length 最少 8 位');
    process.exit(1);
  }
  return {
    username,
    full_name: positional[1] ?? username,
    role,
    password: flags.password ?? null,
    length,
  };
}

function generateRandomPassword(length: number): string {
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*+-=?';
  const all = lowers + uppers + digits + symbols;

  const buf = new Uint8Array(length);
  for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 256);
  const pick = (set: string, idx: number) => set.charAt((buf[idx] ?? 0) % set.length);

  const required = [pick(lowers, 0), pick(uppers, 1), pick(digits, 2), pick(symbols, 3)];
  const rest: string[] = [];
  for (let i = 4; i < length; i++) rest.push(pick(all, i));
  const chars = [...required, ...rest];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

async function main() {
  const args = parseArgs();
  const dbUrl = process.env.TURSO_DATABASE_URL;
  if (!dbUrl) {
    console.error('TURSO_DATABASE_URL 未设置');
    process.exit(1);
  }

  const client = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, args.username))
    .limit(1);
  if (existing[0]) {
    console.error(`用户 ${args.username} 已存在（id=${existing[0].id}），退出`);
    client.close();
    process.exit(1);
  }

  const password = args.password ?? generateRandomPassword(args.length);
  const password_hash = await hash(password, {
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
  });

  const row: NewUser = {
    username: args.username,
    full_name: args.full_name,
    role: args.role,
    password_hash,
  };
  const inserted = await db.insert(users).values(row).returning({ id: users.id });

  console.log('\n========== 账号已创建（密码仅此一次展示，请立即抄下） ==========');
  console.log(`  id        : ${inserted[0]!.id}`);
  console.log(`  username  : ${args.username}`);
  console.log(`  full_name : ${args.full_name}`);
  console.log(`  role      : ${args.role}`);
  console.log(`  password  : ${password}`);
  console.log('================================================================\n');

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
