/**
 * 用户路由。
 *
 * - GET    /api/users              所有 active 用户 {id, username, full_name, role, is_active, avatar_url}
 * - PATCH  /api/users/me/avatar    当前登录用户头像上传（data URL）
 * - DELETE /api/users/me/avatar    清空当前用户头像
 *
 * 读接口任何登录用户都能用（卡/订单要把 *_user_id 映射成姓名 + 头像）。
 * 写接口只写"自己"，禁止改别人。admin 管理其他用户 Phase 4 再来。
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { userAvatarUpdateSchema } from '@meal/shared';
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
      avatar_url: schema.users.avatar_url,
    })
    .from(schema.users)
    .orderBy(schema.users.id);

  return c.json({ users: rows });
});

usersRouter.patch(
  '/me/avatar',
  zValidator('json', userAvatarUpdateSchema),
  async (c) => {
    const authUser = c.get('authUser');
    const { avatar } = c.req.valid('json');
    const db = requestDb(c);

    const updated = await db
      .update(schema.users)
      .set({ avatar_url: avatar })
      .where(eq(schema.users.id, authUser.id))
      .returning({
        id: schema.users.id,
        username: schema.users.username,
        full_name: schema.users.full_name,
        role: schema.users.role,
        avatar_url: schema.users.avatar_url,
      });

    return c.json({ user: updated[0] });
  },
);

usersRouter.delete('/me/avatar', async (c) => {
  const authUser = c.get('authUser');
  const db = requestDb(c);

  const updated = await db
    .update(schema.users)
    .set({ avatar_url: null })
    .where(eq(schema.users.id, authUser.id))
    .returning({
      id: schema.users.id,
      username: schema.users.username,
      full_name: schema.users.full_name,
      role: schema.users.role,
      avatar_url: schema.users.avatar_url,
    });

  return c.json({ user: updated[0] });
});
