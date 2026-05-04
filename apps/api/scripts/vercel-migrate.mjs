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
  console.log('[vercel-migrate] migrations finished');
} finally {
  client.close();
}
