/**
 * 订餐路由 —— MEA-12。
 *
 * - GET    /api/orders?member_id=&date=&status=&meal_type=&zone=
 * - GET    /api/orders/today?meal_type=&zone=
 * - GET    /api/orders/:id
 * - POST   /api/orders                 拆 1~2 条 DailyOrder，原子扣卡；散客/会员餐收入在「已送达」时入账
 * - PATCH  /api/orders/:id             仅修改 notes + created_by_user_id
 * - PATCH  /api/orders/:id/status      pending/fulfilled/delivered 流转
 * - PATCH  /api/orders/:id/delivery-failed  已出餐送餐失败，或已送达后管理员纠错（退餐理由 + 原子退餐）
 * - PATCH  /api/orders/:id/cancel      原子冲销
 *
 * 所有接口需要登录。
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { and, asc, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { requireAuth, requireDataOperator, type AuthVariables } from '../middleware/jwt.js';
import {
  cancelOrder,
  todayShanghai,
  InsufficientMealBalanceError,
  OrderLockedDeliveredError,
  OrderNotFoundError,
} from '../services/orders.js';
import { createMealEarnedIncome } from '../services/finance.js';
import { insertOrdersInTransaction } from '../services/order-create.js';
import { orderCreateSchema, orderBatchCreateSchema, type OrderCreateInput } from '@meal/shared';

export const ordersRouter = new Hono<{ Variables: AuthVariables }>();

ordersRouter.use('*', requireAuth());
ordersRouter.use('*', requireDataOperator());

// ==================== GET /today (先注册，避免 :id 匹配 "today") ====================

const todayQuerySchema = z.object({
  meal_type: z.enum(['lunch', 'dinner', 'all']).optional().default('all'),
  zone: z.enum(['all', 'hospital', 'regular']).optional().default('all'),
});

ordersRouter.get('/today', zValidator('query', todayQuerySchema), async (c) => {
  const { meal_type, zone } = c.req.valid('query');
  const db = requestDb(c);
  const today = todayShanghai();

  const conds: SQL[] = [eq(schema.daily_orders.order_date, today)];

  if (meal_type !== 'all') {
    conds.push(eq(schema.daily_orders.meal_type, meal_type));
  }

  let rows = await db
    .select({
      order: schema.daily_orders,
      member: {
        id: schema.members.id,
        name: schema.members.name,
        is_hospital: schema.members.is_hospital,
      },
    })
    .from(schema.daily_orders)
    .leftJoin(schema.members, eq(schema.daily_orders.member_id, schema.members.id))
    .where(and(...conds))
    .orderBy(asc(schema.daily_orders.status), asc(schema.daily_orders.created_at));

  if (zone !== 'all') {
    const isHospital = zone === 'hospital';
    rows = rows.filter((r) => r.member?.is_hospital === isHospital);
  }

  return c.json({ orders: rows.map((r) => r.order) });
});

// ==================== GET /api/orders ====================

const listQuerySchema = z.object({
  member_id: z
    .string()
    .regex(/^\d+$/, 'member_id 必须是整数')
    .transform((v) => parseInt(v, 10))
    .optional(),
  /** 按录入员工筛选（"某人录了哪些单"） */
  created_by_user_id: z
    .string()
    .regex(/^\d+$/, 'created_by_user_id 必须是整数')
    .transform((v) => parseInt(v, 10))
    .optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date 格式 YYYY-MM-DD').optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from 格式 YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to 格式 YYYY-MM-DD').optional(),
  status: z
    .enum(['pending', 'fulfilled', 'delivered', 'cancelled', 'all'])
    .optional()
    .default('all'),
  meal_type: z.enum(['lunch', 'dinner', 'all']).optional().default('all'),
  zone: z.enum(['all', 'hospital', 'regular']).optional().default('all'),
  /** 送餐渠道（为未来交给快递做准备，现在默认 'all'） */
  delivery_channel: z.enum(['all', 'self', 'courier']).optional().default('all'),
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

ordersRouter.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { member_id, created_by_user_id, date, from, to, status, meal_type, zone, delivery_channel, limit, offset } = c.req.valid('query');
  const db = requestDb(c);

  const conds: SQL[] = [];
  if (member_id !== undefined) conds.push(eq(schema.daily_orders.member_id, member_id));
  if (created_by_user_id !== undefined) conds.push(eq(schema.daily_orders.created_by_user_id, created_by_user_id));
  if (date) {
    conds.push(eq(schema.daily_orders.order_date, date));
  } else {
    if (from) conds.push(gte(schema.daily_orders.order_date, from));
    if (to) conds.push(lte(schema.daily_orders.order_date, to));
  }
  if (status !== 'all') conds.push(eq(schema.daily_orders.status, status));
  if (meal_type !== 'all') conds.push(eq(schema.daily_orders.meal_type, meal_type));
  if (delivery_channel !== 'all') conds.push(eq(schema.daily_orders.delivery_channel, delivery_channel));

  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  if (zone !== 'all') {
    // 需要 join members 做 zone 过滤
    const isHospital = zone === 'hospital';
    const rows = await db
      .select({
        order: schema.daily_orders,
        is_hospital: schema.members.is_hospital,
      })
      .from(schema.daily_orders)
      .leftJoin(schema.members, eq(schema.daily_orders.member_id, schema.members.id))
      .where(whereClause)
      .orderBy(desc(schema.daily_orders.order_date), desc(schema.daily_orders.created_at))
      .limit(limit)
      .offset(offset);

    const filtered = rows.filter((r) => r.is_hospital === isHospital).map((r) => r.order);
    return c.json({ orders: filtered });
  }

  const rows = await db
    .select()
    .from(schema.daily_orders)
    .where(whereClause)
    .orderBy(desc(schema.daily_orders.order_date), desc(schema.daily_orders.created_at))
    .limit(limit)
    .offset(offset);

  return c.json({ orders: rows });
});

// ==================== GET /api/orders/:id ====================

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'id 必须是整数').transform((v) => parseInt(v, 10)),
});

ordersRouter.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const db = requestDb(c);

  const rows = await db
    .select()
    .from(schema.daily_orders)
    .where(eq(schema.daily_orders.id, id))
    .limit(1);

  if (!rows[0]) {
    throw new HTTPException(404, { message: '订单不存在' });
  }

  return c.json({ order: rows[0] });
});

// ==================== POST /api/orders ====================

ordersRouter.post('/', zValidator('json', orderCreateSchema), async (c) => {
  const input = c.req.valid('json');
  const authUser = c.get('authUser');
  const db = requestDb(c);

  const idempotencyKey = c.req.header('Idempotency-Key');
  if (idempotencyKey) {
    const existing = await db
      .select()
      .from(schema.idempotency_keys)
      .where(eq(schema.idempotency_keys.key, idempotencyKey))
      .limit(1);

    if (existing[0]) {
      const age = Date.now() - existing[0].created_at.getTime();
      if (age < 10 * 60 * 1000) {
        const cached = JSON.parse(existing[0].response_json) as object;
        return c.json(cached, 201);
      }
    }
  }

  const createdByUserId = input.created_by_user_id ?? authUser.id;

  let result: Awaited<ReturnType<typeof insertOrdersInTransaction>>;
  try {
    result = await db.transaction(async (tx) => {
      return insertOrdersInTransaction(tx, input, createdByUserId);
    });
  } catch (err) {
    if (err instanceof InsufficientMealBalanceError) {
      return c.json({ code: err.code, message: err.message }, 422);
    }
    throw err;
  }

  const responseBody = {
    orders: result.orders,
    ...(result.card ? { card: result.card, card_exhausted: result.card_exhausted } : {}),
  };

  if (idempotencyKey) {
    await db
      .insert(schema.idempotency_keys)
      .values({
        key: idempotencyKey,
        response_json: JSON.stringify(responseBody),
      })
      .onConflictDoNothing();
  }

  return c.json(responseBody, 201);
});

// ==================== POST /api/orders/batch ====================

ordersRouter.post('/batch', zValidator('json', orderBatchCreateSchema), async (c) => {
  const { proof_images, entries } = c.req.valid('json');
  const authUser = c.get('authUser');
  const db = requestDb(c);

  try {
    const batchResult = await db.transaction(async (tx) => {
      const allOrders: (typeof schema.daily_orders.$inferSelect)[] = [];
      let lastCard: typeof schema.cards.$inferSelect | null = null;
      let anyExhausted = false;
      for (const entry of entries) {
        const createdBy = entry.created_by_user_id ?? authUser.id;
        const merged: OrderCreateInput = { ...entry, proof_images };
        const r = await insertOrdersInTransaction(tx, merged, createdBy);
        allOrders.push(...r.orders);
        if (r.card) {
          lastCard = r.card;
          anyExhausted = anyExhausted || r.card_exhausted;
        }
      }
      return { orders: allOrders, card: lastCard, card_exhausted: anyExhausted };
    });

    const responseBody = {
      orders: batchResult.orders,
      ...(batchResult.card
        ? { card: batchResult.card, card_exhausted: batchResult.card_exhausted }
        : {}),
    };
    return c.json(responseBody, 201);
  } catch (err) {
    if (err instanceof InsufficientMealBalanceError) {
      return c.json({ code: err.code, message: err.message }, 422);
    }
    throw err;
  }
});

// ==================== PATCH /api/orders/:id ====================

const updateOrderSchema = z.object({
  notes: z.string().optional(),
  created_by_user_id: z.number().int().positive().optional(),
});

ordersRouter.patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateOrderSchema), async (c) => {
  const { id } = c.req.valid('param');
  const input = c.req.valid('json');
  const authUser = c.get('authUser');
  const db = requestDb(c);

  const rows = await db
    .select()
    .from(schema.daily_orders)
    .where(eq(schema.daily_orders.id, id))
    .limit(1);

  const order = rows[0];
  if (!order) {
    throw new HTTPException(404, { message: '订单不存在' });
  }
  if (order.status === 'delivered') {
    throw new HTTPException(422, { message: '已送达的订单不可编辑' });
  }
  if (order.status === 'cancelled') {
    throw new HTTPException(422, { message: '已取消的订单不可编辑' });
  }

  const setValues: Partial<typeof schema.daily_orders.$inferInsert> = {
    updated_at: new Date(),
  };
  if (input.notes !== undefined) setValues.notes = input.notes;
  if (input.created_by_user_id !== undefined) setValues.created_by_user_id = input.created_by_user_id;

  await db
    .update(schema.daily_orders)
    .set(setValues)
    .where(eq(schema.daily_orders.id, id));

  // 写 audit_log
  await db.insert(schema.audit_logs).values({
    user_id: authUser.id,
    action: 'update',
    entity: 'daily_order',
    entity_id: id,
    diff_json: JSON.stringify({ before: order, patch: input }),
  });

  const updated = await db
    .select()
    .from(schema.daily_orders)
    .where(eq(schema.daily_orders.id, id))
    .limit(1);

  return c.json({ order: updated[0] });
});

// ==================== PATCH /api/orders/:id/status ====================

/**
 * 订单状态流转（pending → fulfilled → delivered，送达后锁死）。
 *
 * 规则：
 *  - pending   → fulfilled（或走 /cancel 取消）
 *  - fulfilled → delivered / pending（回退到待出餐，清 fulfilled_at）
 *  - delivered → **终态，不可变更**（保留送达审计证据）。如果需要纠错，只能走 /cancel 冲销
 *    重新建单；保证已交付餐品不会被静默篡改。
 *  - cancelled → 终态：不能由本路由回退。
 *
 * 变更 fulfilled_at / delivered_at / fulfilled_by_user_id / delivered_by_user_id：
 *  - 进入 fulfilled：set fulfilled_at/by = now / authUser
 *  - 从 fulfilled 回退：clear fulfilled_at/by
 *  - 进入 delivered：set delivered_at/by
 */

const statusTransitionBodySchema = z.object({
  status: z.enum(['pending', 'fulfilled', 'delivered']),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['fulfilled'],
  fulfilled: ['pending', 'delivered'],
  delivered: [], // 终态锁死
  cancelled: [],
};

ordersRouter.patch(
  '/:id/status',
  zValidator('param', idParamSchema),
  zValidator('json', statusTransitionBodySchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { status: nextStatus } = c.req.valid('json');
    const authUser = c.get('authUser');
    const db = requestDb(c);

    const rows = await db
      .select()
      .from(schema.daily_orders)
      .where(eq(schema.daily_orders.id, id))
      .limit(1);
    const order = rows[0];
    if (!order) {
      throw new HTTPException(404, { message: '订单不存在' });
    }

    if (order.status === nextStatus) {
      return c.json({ order });
    }

    // 送达 / 取消 均为终态，明确拒绝
    if (order.status === 'delivered') {
      return c.json(
        {
          code: 'ORDER_LOCKED_DELIVERED',
          message: '订单已送达，状态已锁定。如需纠错请走「取消」走冲销流程后重新建单。',
        },
        422,
      );
    }
    if (order.status === 'cancelled') {
      return c.json(
        {
          code: 'ORDER_LOCKED_CANCELLED',
          message: '订单已取消，状态不可变更',
        },
        422,
      );
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      return c.json(
        {
          code: 'INVALID_STATUS_TRANSITION',
          message: `不允许从 ${order.status} 流转到 ${nextStatus}`,
        },
        422,
      );
    }

    const now = new Date();
    const patch: Partial<typeof schema.daily_orders.$inferInsert> = {
      status: nextStatus,
      updated_at: now,
    };

    // fulfilled_at / fulfilled_by
    if (nextStatus === 'fulfilled' && order.status === 'pending') {
      patch.fulfilled_at = now;
      patch.fulfilled_by_user_id = authUser.id;
    }
    if (nextStatus === 'pending' && order.status === 'fulfilled') {
      patch.fulfilled_at = null;
      patch.fulfilled_by_user_id = null;
    }

    // delivered_at / delivered_by（只有 fulfilled → delivered 一条路径；delivered 是终态）
    if (nextStatus === 'delivered' && order.status === 'fulfilled') {
      patch.delivered_at = now;
      patch.delivered_by_user_id = authUser.id;
    }

    let cardRow: typeof schema.cards.$inferSelect | null = null;
    if (nextStatus === 'delivered' && order.status === 'fulfilled' && order.card_id != null) {
      const cr = await db
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, order.card_id))
        .limit(1);
      cardRow = cr[0] ?? null;
      if (!cardRow) {
        throw new HTTPException(422, { message: '订单关联的卡不存在，无法确认餐费' });
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.daily_orders)
        .set(patch)
        .where(eq(schema.daily_orders.id, id));

      if (nextStatus === 'delivered' && order.status === 'fulfilled' && !order.is_gift) {
        await createMealEarnedIncome(tx, {
          order,
          card: cardRow,
          created_by_user_id: authUser.id,
        });
      }

      await tx.insert(schema.audit_logs).values({
        user_id: authUser.id,
        action: 'update',
        entity: 'daily_order',
        entity_id: id,
        diff_json: JSON.stringify({
          status: [order.status, nextStatus],
        }),
      });
    });

    const updated = await db
      .select()
      .from(schema.daily_orders)
      .where(eq(schema.daily_orders.id, id))
      .limit(1);

    return c.json({ order: updated[0] });
  },
);

// ==================== PATCH /api/orders/:id/delivery-failed ====================

const deliveryFailedBodySchema = z.object({
  reason: z.string().trim().min(1, '请填写送餐失败原因'),
});

ordersRouter.patch(
  '/:id/delivery-failed',
  zValidator('param', idParamSchema),
  zValidator('json', deliveryFailedBodySchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { reason } = c.req.valid('json');
    const authUser = c.get('authUser');
    const db = requestDb(c);

    const rows = await db
      .select()
      .from(schema.daily_orders)
      .where(eq(schema.daily_orders.id, id))
      .limit(1);
    const order = rows[0];
    if (!order) {
      throw new HTTPException(404, { message: '订单不存在' });
    }
    if (order.status === 'fulfilled') {
      try {
        const result = await db.transaction(async (tx) => {
          return cancelOrder(tx, {
            orderId: id,
            cancelledByUserId: authUser.id,
            reason: `配送失败：${reason}`,
          });
        });

        return c.json({
          order: result.order,
          ...(result.card ? { card: result.card } : {}),
        });
      } catch (err) {
        if (err instanceof OrderLockedDeliveredError) {
          return c.json({ code: err.code, message: err.message }, 422);
        }
        if (err instanceof OrderNotFoundError) {
          throw new HTTPException(404, { message: err.message });
        }
        throw err;
      }
    }

    if (order.status === 'delivered') {
      if (authUser.role !== 'admin') {
        return c.json(
          {
            code: 'DELIVERY_FAILED_ADMIN_ONLY',
            message: '只有管理员能修改',
          },
          403,
        );
      }
      try {
        const result = await db.transaction(async (tx) => {
          return cancelOrder(tx, {
            orderId: id,
            cancelledByUserId: authUser.id,
            reason: `误点已送达后纠正 · 配送失败：${reason}`,
            allowFromDelivered: true,
          });
        });

        return c.json({
          order: result.order,
          ...(result.card ? { card: result.card } : {}),
        });
      } catch (err) {
        if (err instanceof OrderNotFoundError) {
          throw new HTTPException(404, { message: err.message });
        }
        throw err;
      }
    }

    return c.json(
      {
        code: 'DELIVERY_FAILED_INVALID_STATUS',
        message: '仅「已出餐」或「已送达」（管理员纠错）可标记送餐失败',
      },
      422,
    );
  },
);

// ==================== PATCH /api/orders/:id/cancel ====================

const cancelBodySchema = z.object({
  reason: z.string().optional(),
});

ordersRouter.patch(
  '/:id/cancel',
  zValidator('param', idParamSchema),
  zValidator('json', cancelBodySchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { reason } = c.req.valid('json');
    const authUser = c.get('authUser');
    const db = requestDb(c);

    try {
      const result = await db.transaction(async (tx) => {
        return cancelOrder(tx, {
          orderId: id,
          cancelledByUserId: authUser.id,
          reason,
        });
      });

      return c.json({
        order: result.order,
        ...(result.card ? { card: result.card } : {}),
      });
    } catch (err) {
      if (err instanceof OrderLockedDeliveredError) {
        return c.json({ code: err.code, message: err.message }, 422);
      }
      if (err instanceof OrderNotFoundError) {
        throw new HTTPException(404, { message: err.message });
      }
      throw err;
    }
  },
);
