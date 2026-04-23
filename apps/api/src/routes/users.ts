/**
 * 用户只读查询路由。
 *
 * - GET /api/users 返回所有 active 用户的 { id, username, full_name, role, is_active }
 *
 * 用途：前端把卡 / 订单 / 财务条目里的 `*_user_id` 映射到可展示的名字
 * （比如卡片上的"收款人：孙梦瑶"）。无 PII 敏感字段返回（不含密码哈希 / token_version）。
 *
 * 任何登录用户都能读，不区分 admin/staff。admin 侧的用户管理（创建 / 停用 / 改角色）
 * 走另一个路由（Phase 4）。
 */

import { Hono } from 'hono';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { requireAuth, type AuthVariables } from '../middleware/jwt.js';

export const usersRouter = new Hono<{ Variables: AuthVariables }>();

usersRouter.use('*', requireAuth());

usersRouter.get('/', async (c) => {
  const db = requestDb(c);
  const rows = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      full_name: schema.users.full_name,
      role: schema.users.role,
      is_active: schema.users.is_active,
    })
    .from(schema.users)
    .orderBy(schema.users.id);

  return c.json({ users: rows });
});
