/**
 * 5 账号初始 seed。
 *
 * 约定（plan §14.1）：
 *   admin  rNLKJA      管理员   初始密码 = BOOTSTRAP_ADMIN_PASSWORD env
 *   staff  sunmanlin   孙漫林   初始密码 = crypto 随机 12 位
 *   staff  sunmengyao  孙梦瑶   同上
 *   staff  gaoping     高平     同上
 *   staff  xuchao      徐超     同上
 *
 * 运行后把所有初始密码打印到控制台一次；admin 抄下来通过安全渠道告知员工。
 * **密码只打印这一次**，不入库明文，不写日志。
 *
 * 同时写入 settings 默认值：
 *   default_collector_user_id     -> sunmengyao.id
 *   default_recorder_user_id      -> gaoping.id
 *   default_delivery_hospital_*   -> sunmanlin.id
 *   default_delivery_regular_*    -> xuchao.id
 *   ad_hoc_price                  -> 35
 *   order_cutoff_hour             -> 22
 *   renewal_threshold             -> 2
 *   income_auto_categories        -> {"hospital_sub":true,"regular_sub":true,"ad_hoc":true}
 *
 * 重复运行是幂等的：已存在的账号不重建，缺失的补建。settings 不覆盖已有值。
 */

import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@libsql/client';

// 优先加载 monorepo 根 .env
const here = dirname(fileURLToPath(import.meta.url));
for (const path of [resolve(here, '../../.env'), resolve(here, '../.env')]) {
  if (existsSync(path)) loadDotenv({ path });
}
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { SETTING_KEYS } from '@meal/shared';
import {
  users,
  settings,
  type NewUser,
} from '../../apps/api/src/db/schema';

interface StaffSpec {
  username: string;
  full_name: string;
}

const ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'rNLKJA';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;

const STAFF_LIST: StaffSpec[] = [
  { username: 'sunmanlin', full_name: '孙漫林' },
  { username: 'sunmengyao', full_name: '孙梦瑶' },
  { username: 'gaoping', full_name: '高平' },
  { username: 'xuchao', full_name: '徐超' },
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[seed] 环境变量 ${name} 未设置`);
    process.exit(1);
  }
  return v;
}

function generateRandomPassword(length = 12): string {
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*+-=?';
  const all = lowers + uppers + digits + symbols;

  const buf = new Uint8Array(length);
  for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 256);

  const pick = (set: string, idx: number) =>
    set.charAt((buf[idx] ?? 0) % set.length);

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

async function hashPw(plain: string): Promise<string> {
  // argon2id 是 @node-rs/argon2 的默认算法
  return hash(plain, {
    memoryCost: 64 * 1024,
    timeCost: 3,
    parallelism: 1,
  });
}

async function main() {
  const dbUrl = requireEnv('TURSO_DATABASE_URL');
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = createClient({ url: dbUrl, authToken });
  const db = drizzle(client);

  if (!ADMIN_PASSWORD) {
    console.error('[seed] BOOTSTRAP_ADMIN_PASSWORD 未设置，admin 账号无法初始化');
    process.exit(1);
  }

  const created: Array<{ username: string; role: string; password: string }> = [];

  async function ensureUser(spec: {
    username: string;
    full_name: string;
    role: 'admin' | 'staff';
    password: string;
  }) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, spec.username))
      .limit(1);
    if (existing[0]) {
      console.log(`[seed] 用户 ${spec.username} 已存在，跳过`);
      return existing[0].id;
    }
    const password_hash = await hashPw(spec.password);
    const row: NewUser = {
      username: spec.username,
      full_name: spec.full_name,
      role: spec.role,
      password_hash,
    };
    const inserted = await db.insert(users).values(row).returning({ id: users.id });
    const newId = inserted[0]!.id;
    created.push({ username: spec.username, role: spec.role, password: spec.password });
    console.log(`[seed] 已创建 ${spec.role} 账号 ${spec.username} (id=${newId})`);
    return newId;
  }

  // 1. admin
  await ensureUser({
    username: ADMIN_USERNAME,
    full_name: '管理员',
    role: 'admin',
    password: ADMIN_PASSWORD,
  });

  // 2. 4 个 staff
  const staffIds: Record<string, number> = {};
  for (const s of STAFF_LIST) {
    const pw = generateRandomPassword(12);
    const id = await ensureUser({
      username: s.username,
      full_name: s.full_name,
      role: 'staff',
      password: pw,
    });
    staffIds[s.username] = id;
  }

  // 3. settings 默认值（已存在则跳过）
  async function ensureSetting(key: string, value: string) {
    const existing = await db
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    if (existing[0]) {
      console.log(`[seed] settings.${key} 已存在，跳过`);
      return;
    }
    await db.insert(settings).values({ key, value });
    console.log(`[seed] settings.${key} = ${value}`);
  }

  // staffIds 可能因为"已存在"而为空 → 从 DB 回读一次
  async function resolveUserId(username: string): Promise<number | null> {
    if (staffIds[username]) return staffIds[username]!;
    const row = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return row[0]?.id ?? null;
  }

  const smyId = await resolveUserId('sunmengyao');
  const gpId = await resolveUserId('gaoping');
  const smlId = await resolveUserId('sunmanlin');
  const xcId = await resolveUserId('xuchao');

  if (smyId) await ensureSetting(SETTING_KEYS.DEFAULT_COLLECTOR_USER_ID, String(smyId));
  if (gpId) await ensureSetting(SETTING_KEYS.DEFAULT_RECORDER_USER_ID, String(gpId));
  if (smlId)
    await ensureSetting(SETTING_KEYS.DEFAULT_DELIVERY_HOSPITAL_USER_ID, String(smlId));
  if (xcId)
    await ensureSetting(SETTING_KEYS.DEFAULT_DELIVERY_REGULAR_USER_ID, String(xcId));
  await ensureSetting(SETTING_KEYS.AD_HOC_PRICE, '35');
  await ensureSetting(SETTING_KEYS.ORDER_CUTOFF_HOUR, '22');
  await ensureSetting(SETTING_KEYS.RENEWAL_THRESHOLD, '2');
  await ensureSetting(
    SETTING_KEYS.INCOME_AUTO_CATEGORIES,
    JSON.stringify({ hospital_sub: true, regular_sub: true, ad_hoc: true }),
  );

  // 4. 打印本次新建的密码（一次性）
  if (created.length > 0) {
    console.log('\n========== 本次新建账号的初始密码（请立即抄下并通过安全渠道分发） ==========');
    for (const c of created) {
      console.log(`  ${c.role.padEnd(6)} ${c.username.padEnd(12)} => ${c.password}`);
    }
    console.log('================================================================\n');
  } else {
    console.log('\n[seed] 本次没有新建账号；若需重置密码，使用 reset-admin-password.ts 或 admin UI');
  }

  client.close();
}

main().catch((err) => {
  console.error('[seed] 失败：', err);
  process.exit(1);
});
