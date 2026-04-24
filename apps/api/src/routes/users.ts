/**
 * 用户路由。
 *
 * - GET    /api/users                    所有 active 用户 {id, username, full_name, role, is_active, avatar_url}
 * - GET    /api/users/:id                单个用户信息（不含密码）
 * - GET    /api/users/:id/orders         该用户录入的订单列表（按 created_at 倒序）
 * - GET    /api/users/:id/order-summary  该用户录入的订单聚合统计
 * - PATCH  /api/users/me/avatar          当前登录用户头像上传（data URL）
 * - DELETE /api/users/me/avatar          清空当前用户头像
 *
 * 读接口任何登录用户都能用（卡/订单要把 *_user_id 映射成姓名 + 头像）。
 * 写接口只写"自己"，禁止改别人。admin 管理其他用户 Phase 4 再来。
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
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

// ==================== GET /api/users/:id ====================

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'id 必须是整数').transform((v) => parseInt(v, 10)),
});

usersRouter.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
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
    .where(eq(schema.users.id, id))
    .limit(1);

  if (!rows[0]) throw new HTTPException(404, { message: '用户不存在' });
  return c.json({ user: rows[0] });
});

// ==================== GET /api/users/:id/orders ====================

const userOrdersQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['pending', 'fulfilled', 'delivered', 'cancelled', 'all']).optional().default('all'),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v === undefined ? 100 : Number(v);
      return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 500) : 100;
    }),
  offset: z
    .string()
    .optional()
    .transform((v) => {
      const n = v === undefined ? 0 : Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    }),
});

usersRouter.get(
  '/:id/orders',
  zValidator('param', idParamSchema),
  zValidator('query', userOrdersQuerySchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { from, to, status, limit, offset } = c.req.valid('query');
    const db = requestDb(c);

    const conds: SQL[] = [eq(schema.daily_orders.created_by_user_id, id)];
    if (from) conds.push(gte(schema.daily_orders.order_date, from));
    if (to) conds.push(lte(schema.daily_orders.order_date, to));
    if (status !== 'all') conds.push(eq(schema.daily_orders.status, status));

    const rows = await db
      .select({
        order: schema.daily_orders,
        member: {
          id: schema.members.id,
          name: schema.members.name,
          nickname: schema.members.nickname,
          phone: schema.members.phone,
          is_hospital: schema.members.is_hospital,
          is_walkin: schema.members.is_walkin,
        },
      })
      .from(schema.daily_orders)
      .leftJoin(schema.members, eq(schema.daily_orders.member_id, schema.members.id))
      .where(and(...conds))
      .orderBy(desc(schema.daily_orders.order_date), desc(schema.daily_orders.created_at))
      .limit(limit)
      .offset(offset);

    return c.json({ orders: rows });
  },
);

// ==================== GET /api/users/:id/order-summary ====================

usersRouter.get(
  '/:id/order-summary',
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const db = requestDb(c);

    const summary = await db
      .select({
        total_orders: sql<number>`count(*)`,
        total_meals: sql<number>`sum(${schema.daily_orders.quantity})`,
        total_amount: sql<number>`sum(${schema.daily_orders.amount})`,
        pending_count: sql<number>`sum(case when ${schema.daily_orders.status} = 'pending' then 1 else 0 end)`,
        fulfilled_count: sql<number>`sum(case when ${schema.daily_orders.status} = 'fulfilled' then 1 else 0 end)`,
        delivered_count: sql<number>`sum(case when ${schema.daily_orders.status} = 'delivered' then 1 else 0 end)`,
        cancelled_count: sql<number>`sum(case when ${schema.daily_orders.status} = 'cancelled' then 1 else 0 end)`,
      })
      .from(schema.daily_orders)
      .where(eq(schema.daily_orders.created_by_user_id, id));

    const s = summary[0] ?? {
      total_orders: 0,
      total_meals: 0,
      total_amount: 0,
      pending_count: 0,
      fulfilled_count: 0,
      delivered_count: 0,
      cancelled_count: 0,
    };

    return c.json({
      total_orders: Number(s.total_orders ?? 0),
      total_meals: Number(s.total_meals ?? 0),
      total_amount: Number(s.total_amount ?? 0),
      pending_count: Number(s.pending_count ?? 0),
      fulfilled_count: Number(s.fulfilled_count ?? 0),
      delivered_count: Number(s.delivered_count ?? 0),
      cancelled_count: Number(s.cancelled_count ?? 0),
    });
  },
);
