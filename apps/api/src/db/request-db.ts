/**
 * 路由里用这个函数拿 db：
 * - 优先返回 c.var.dbOverride（测试注入）
 * - 否则返回全局单例 getDb()
 */

import type { Context } from 'hono';
import { getDb, type Db } from './client.js';

/**
 * Context 类型故意用 any 以兼容任何路由注册的 Variables/Bindings 组合。
 * 我们只关心 c.get('dbOverride') 的读取，其它细节不介入。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requestDb(c: Context<any, any, any>): Db {
  const injected = c.get('dbOverride') as Db | undefined;
  return injected ?? getDb();
}
