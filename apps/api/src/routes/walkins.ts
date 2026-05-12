/**
 * 散客目录路由。
 *
 * 散客 = `members.is_walkin = true` 的那一批行，自动由 POST /api/orders 在第一次
 * 录入 customer_name 订单时创建，开卡后（POST /api/cards）自动升为正式会员。
 *
 * 这里封装散客专属的"列表 + 详情"，带订单聚合字段（订单数 / 累计消费 / 最后一次订单日期）
 * 方便前端散客目录页渲染。更多修改操作（改名 / 归档）复用 /api/members 那套。
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { and, desc, eq, sql } from 'drizzle-orm';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { hydrateOrderProofs } from '../services/order-proof-hydrate.js';
import { requireAuth, type AuthVariables } from '../middleware/jwt.js';

export const walkinsRouter = new Hono<{ Variables: AuthVariables }>();

walkinsRouter.use('*', requireAuth());

// =========== 列表：散客 + 聚合订单统计 ===========

walkinsRouter.get('/', async (c) => {
  const db = requestDb(c);

  const rows = await db
    .select({
      member: schema.members,
      order_count: sql<number>`COUNT(${schema.daily_orders.id})`,
      active_order_count: sql<number>`COALESCE(SUM(CASE WHEN ${schema.daily_orders.status} != 'cancelled' THEN 1 ELSE 0 END), 0)`,
      total_meals: sql<number>`COALESCE(SUM(CASE WHEN ${schema.daily_orders.status} != 'cancelled' THEN ${schema.daily_orders.quantity} ELSE 0 END), 0)`,
      total_spent: sql<number>`COALESCE(SUM(CASE WHEN ${schema.daily_orders.status} != 'cancelled' THEN ${schema.daily_orders.amount} ELSE 0 END), 0)`,
      last_order_date: sql<string | null>`MAX(${schema.daily_orders.order_date})`,
      first_order_date: sql<string | null>`MIN(${schema.daily_orders.order_date})`,
    })
    .from(schema.members)
    .leftJoin(schema.daily_orders, eq(schema.daily_orders.member_id, schema.members.id))
    .where(
      and(
        eq(schema.members.is_walkin, true),
        eq(schema.members.is_active, true),
      ),
    )
    .groupBy(schema.members.id)
    .orderBy(
      sql`COALESCE(MAX(${schema.daily_orders.order_date}), '') DESC`,
      desc(schema.members.id),
    );

  return c.json({
    items: rows.map((r) => ({
      ...r.member,
      stats: {
        order_count: Number(r.order_count ?? 0),
        active_order_count: Number(r.active_order_count ?? 0),
        total_meals: Number(r.total_meals ?? 0),
        total_spent: Number(r.total_spent ?? 0),
        last_order_date: r.last_order_date,
        first_order_date: r.first_order_date,
      },
    })),
    total: rows.length,
  });
});

// =========== 详情：一位散客 + 其全部订单 ===========

walkinsRouter.get('/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'));
  const db = requestDb(c);

  const memberRows = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.id, id))
    .limit(1);
  const member = memberRows[0];
  if (!member) {
    throw new HTTPException(404, { message: '散客不存在' });
  }
  if (!member.is_walkin) {
    throw new HTTPException(422, {
      message: '该会员已不是散客（可能已开卡正式入会），请去会员详情页查看',
    });
  }

  const orderRows = await db
    .select()
    .from(schema.daily_orders)
    .where(eq(schema.daily_orders.member_id, id))
    .orderBy(desc(schema.daily_orders.order_date), desc(schema.daily_orders.id));

  const orders = await hydrateOrderProofs(db, orderRows);

  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const stats = {
    order_count: orders.length,
    active_order_count: activeOrders.length,
    total_meals: activeOrders.reduce((s, o) => s + o.quantity, 0),
    total_spent: activeOrders.reduce((s, o) => s + o.amount, 0),
    last_order_date: orders[0]?.order_date ?? null,
    first_order_date: orders[orders.length - 1]?.order_date ?? null,
  };

  return c.json({ member, orders, stats });
});
