/**
 * Drizzle + libSQL 客户端。
 *
 * 本地开发：TURSO_DATABASE_URL 可以是 `file:./local.db`
 * 生产 / Turso 云：libsql://xxx.turso.io，并带 TURSO_AUTH_TOKEN
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '../env.js';
import * as schema from './schema.js';

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
  _client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN ?? env.TURSO_AUTH_TOKEN,
  });
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
