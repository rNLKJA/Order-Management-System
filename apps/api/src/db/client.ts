/**
 * Drizzle + libSQL 客户端。
 *
 * 本地开发 / 测试：TURSO_DATABASE_URL 可以是 `file:./local.db` 或 `:memory:`
 *   → 走 node 版本的 @libsql/client（支持 file:/sqlite3 本地存储）
 * 生产 / Turso 云：libsql://xxx.turso.io + TURSO_AUTH_TOKEN
 *   → 走 /http 变体，强制 Hrana-over-HTTP，不开 WebSocket。
 *     Vercel serverless 的出站 WebSocket 会把请求挂住，
 *     所以云端一律 HTTP。
 */

import { createClient as createNodeClient, type Client } from '@libsql/client';
import { createClient as createHttpClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '../env.js';
import * as schema from './schema.js';

function toHttpUrl(url: string): string {
  if (url.startsWith('libsql://')) return 'https://' + url.slice('libsql://'.length);
  if (url.startsWith('wss://')) return 'https://' + url.slice('wss://'.length);
  if (url.startsWith('ws://')) return 'http://' + url.slice('ws://'.length);
  return url;
}

function createClient(config: { url: string; authToken?: string }): Client {
  const url = config.url;
  // 远程 Turso：走纯 HTTP 的 client
  if (
    url.startsWith('libsql://') ||
    url.startsWith('wss://') ||
    url.startsWith('ws://') ||
    url.startsWith('https://') ||
    url.startsWith('http://')
  ) {
    return createHttpClient({
      url: toHttpUrl(url),
      authToken: config.authToken,
    });
  }
  // 本地 file:/:memory: → node client
  return createNodeClient({ url, authToken: config.authToken });
}

let _cachedUrl: string | null = null;
let _client: Client | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * 当前生效的 DB URL。
 * 优先 process.env（测试里每个 case 会切换），fallback 到启动时冻结的 env。
 */
function currentUrl(): string {
  return process.env.TURSO_DATABASE_URL ?? env.TURSO_DATABASE_URL;
}

export function getClient(): Client {
  const url = currentUrl();
  if (_client && _cachedUrl === url) return _client;
  const authToken = process.env.TURSO_AUTH_TOKEN ?? env.TURSO_AUTH_TOKEN;
  // eslint-disable-next-line no-console
  console.log('[db] creating libsql client', {
    url,
    tokenLen: authToken?.length ?? 0,
    tokenPrefix: authToken?.slice(0, 20),
    tokenSuffix: authToken?.slice(-20),
  });
  _client = createClient({ url, authToken });
  _cachedUrl = url;
  _db = null;
  return _client;
}

export function getDb() {
  const client = getClient();
  if (!_db) {
    _db = drizzle(client, { schema });
  }
  return _db;
}

/**
 * 测试辅助：强制下一次 getClient / getDb 重建。
 * 生产代码不要调。
 */
export function resetDbForTesting() {
  _client = null;
  _db = null;
  _cachedUrl = null;
}

/**
 * 测试辅助：直接把预先创建的 client 注入到全局单例里。
 * 用来在同一个 :memory: 实例上共享 setup 数据和 app 运行时查询。
 */
export function setClientForTesting(client: Client) {
  _client = client;
  _cachedUrl = 'TESTING_INJECTED';
  _db = drizzle(client, { schema });
}

export { schema };
export type Db = ReturnType<typeof getDb>;
