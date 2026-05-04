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

try {
  console.log('[vercel-migrate] applying migrations from', migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log('[vercel-migrate] migrations finished');
} finally {
  client.close();
}
