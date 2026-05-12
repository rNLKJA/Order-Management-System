/**
 * Vercel 构建阶段：对 Turso（或 file: 本地库）执行 Drizzle SQL 迁移。
 * - 仅当 VERCEL=1 时执行（避免本地 pnpm build 误连生产）。
 * - 可设 SKIP_DB_MIGRATE=1 跳过。
 * - 未配置 TURSO_DATABASE_URL 时跳过（并打印提示）。
 *
 * 使用 drizzle-orm 内置 migrator，不依赖 drizzle-kit CLI（与 @libsql/client fetch 行为一致）。
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '..');
const migrationsFolder = join(apiRoot, 'drizzle');

function toHttpUrl(url) {
  if (url.startsWith('libsql://')) return 'https://' + url.slice('libsql://'.length);
  if (url.startsWith('wss://')) return 'https://' + url.slice('wss://'.length);
  if (url.startsWith('ws://')) return 'http://' + url.slice('ws://'.length);
  return url;
}

const fetchGlobal = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  return globalThis.fetch(req);
};

if (process.env.SKIP_DB_MIGRATE === '1') {
  console.log('[vercel-migrate] SKIP_DB_MIGRATE=1, skipping');
  process.exit(0);
}

if (!process.env.VERCEL) {
  console.log('[vercel-migrate] not a Vercel build, skipping migrations');
  process.exit(0);
}

const rawUrl = process.env.TURSO_DATABASE_URL?.trim();
if (!rawUrl) {
  console.warn('[vercel-migrate] TURSO_DATABASE_URL missing, skipping migrations');
  process.exit(0);
}

const useRemote =
  rawUrl.startsWith('libsql://') ||
  rawUrl.startsWith('wss://') ||
  rawUrl.startsWith('ws://') ||
  rawUrl.startsWith('https://') ||
  rawUrl.startsWith('http://');

const url = useRemote ? toHttpUrl(rawUrl) : rawUrl;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url,
  authToken: authToken || undefined,
  ...(useRemote ? { fetch: fetchGlobal } : {}),
});

const db = drizzle(client);

function isAlreadyExistsError(err) {
  const msg = err?.message ?? String(err);
  const causeMsg = err?.cause?.message ?? '';
  return /already exists/i.test(msg) || /already exists/i.test(causeMsg);
}

async function migrationJournalRowCount() {
  const { rows } = await client.execute(
    'SELECT COUNT(*) AS c FROM "__drizzle_migrations"'
  );
  const row = rows?.[0];
  const c = row?.c ?? row?.C ?? (Array.isArray(row) ? row[0] : 0);
  return Number(c);
}

/**
 * Production DBs that were provisioned without Drizzle migrate often have
 * schema applied but an empty __drizzle_migrations. migrate() would then replay
 * 0000 and fail on "table already exists". Backfill journal rows for every
 * migration except the last (newest SQL file) so only pending DDL runs.
 */
async function backfillLegacyJournalExcludingLast() {
  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length < 2) return;
  const prefix = migrations.slice(0, -1);
  console.warn(
    '[vercel-migrate] backfilling __drizzle_migrations for',
    prefix.length,
    'already-applied migration(s); will apply latest migration only'
  );
  for (const m of prefix) {
    await client.execute({
      sql: 'INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)',
      args: [m.hash, m.folderMillis],
    });
  }
}

async function runMigrate() {
  await migrate(db, { migrationsFolder });
}

/**
 * 若曾对「已有表结构、空 journal」做过 journal backfill，会跳过 0001–0005 的真实 SQL，
 * 只留下最新一条迁移执行。这里幂等补执行历史上可能缺失的列 / 索引（与 drizzle/*.sql 对齐），
 * 避免 INSERT … RETURNING 读到 ORM 里有、库里没有的列（典型：members.is_walkin）→ 500。
 */
async function repairLegacyColumnsAfterJournalSkip() {
  const repairs = [
    'ALTER TABLE `cards` ADD `refund_amount` real',
    'ALTER TABLE `cards` ADD `refund_reason` text',
    'ALTER TABLE `cards` ADD `refunded_at` integer',
    'ALTER TABLE `cards` ADD `refunded_by_user_id` integer REFERENCES users(id)',
    "ALTER TABLE `daily_orders` ADD `customer_name` text DEFAULT '' NOT NULL",
    'ALTER TABLE `members` ADD `is_walkin` integer DEFAULT false NOT NULL',
    'ALTER TABLE `users` ADD `avatar_url` text',
    "ALTER TABLE `daily_orders` ADD `delivery_channel` text DEFAULT 'self' NOT NULL",
    "ALTER TABLE `daily_orders` ADD `courier_ref` text DEFAULT '' NOT NULL",
    'ALTER TABLE `daily_orders` ADD `is_gift` integer DEFAULT false NOT NULL',
    "ALTER TABLE `daily_orders` ADD `proof_images_json` text DEFAULT '[]' NOT NULL",
    'CREATE INDEX IF NOT EXISTS `orders_delivery_channel_idx` ON `daily_orders` (`delivery_channel`)',
    'CREATE TABLE IF NOT EXISTS `order_proof_sets` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `proof_images_json` text NOT NULL, `created_by_user_id` integer NOT NULL REFERENCES users(id), `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL)',
    'ALTER TABLE `daily_orders` ADD `proof_set_id` integer REFERENCES order_proof_sets(id)',
    'CREATE INDEX IF NOT EXISTS `daily_orders_proof_set_idx` ON `daily_orders` (`proof_set_id`)',
    'CREATE INDEX IF NOT EXISTS `order_proof_sets_created_by_idx` ON `order_proof_sets` (`created_by_user_id`)',
  ];

  for (const statement of repairs) {
    try {
      await client.execute(statement);
      console.warn('[vercel-migrate] schema repair applied:', statement.slice(0, 72));
    } catch (err) {
      const blob = `${err?.message ?? ''} ${err?.cause?.message ?? ''}`;
      if (/duplicate column name/i.test(blob) || /already exists/i.test(blob)) {
        continue;
      }
      throw err;
    }
  }

  try {
    await client.execute(
      "UPDATE `members` SET `is_walkin` = 1 WHERE `uid` LIKE '__WALKIN__%' AND `is_walkin` = 0",
    );
  } catch (err) {
    const blob = `${err?.message ?? ''} ${err?.cause?.message ?? ''}`;
    if (/no such column/i.test(blob)) {
      console.warn('[vercel-migrate] walkin backfill skipped (is_walkin missing)');
      return;
    }
    throw err;
  }
}

try {
  console.log('[vercel-migrate] applying migrations from', migrationsFolder);
  try {
    await runMigrate();
  } catch (err) {
    if (!isAlreadyExistsError(err)) throw err;
    const n = await migrationJournalRowCount();
    if (n > 0) throw err;
    await backfillLegacyJournalExcludingLast();
    await runMigrate();
  }
  await repairLegacyColumnsAfterJournalSkip();
  console.log('[vercel-migrate] migrations finished');
} finally {
  client.close();
}
