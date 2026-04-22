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

let _client: Client | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getClient(): Client {
  if (!_client) {
    _client = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

export { schema };
export type Db = ReturnType<typeof getDb>;
