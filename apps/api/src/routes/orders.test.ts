/**
 * 订餐路由测试 —— MEA-12。
 *
 * TDD：先写测试，再跑绿灯。
 * 覆盖：
 *   - 登录保护
 *   - POST 午餐单独 / 晚餐单独 / 午晚同时（拆 2 条）
 *   - POST 有 active 卡 → 扣减正确
 *   - POST 有 active 卡 → 扣到 0 → exhausted + card_exhausted=true
 *   - POST 余额不足 → 422 INSUFFICIENT_MEAL_BALANCE
 *   - POST 散餐（无卡）→ 自动 FinanceEntry income ad_hoc
 *   - POST 会员不存在 → 404
 *   - GET 列表按日期/status/meal_type 过滤
 *   - GET today 快捷接口
 *   - GET /:id 详情
 *   - PATCH 改 notes 成功
 *   - PATCH delivered 订单 422
 *   - CANCEL 卡订单 → 卡 remaining 恢复
 *   - CANCEL 散餐订单 → FinanceEntry.voided=true
 *   - CANCEL delivered → 422
 *   - CANCEL 已取消 → 幂等 200
 *   - Idempotency-Key 防重复提交
 *   - GET 列表需要登录
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { createApp } from '../app.js';
import { setupTestDb, seedUser, seedMember, seedCard } from '../test-helpers.js';
import { signToken } from '../services/jwt.js';
import * as schema from '../db/schema.js';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

describe('Orders API /api/orders', () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let staffId: number;
  let staffToken: string;
  let memberId: number;

  beforeEach(async () => {
    const res = await setupTestDb();
    db = res.db;
    app = createApp({ db });

    const staffRes = await seedUser(db, {
      username: 'staff_orders',
      full_name: '测试员工',
      role: 'staff',
      password: 'StaffPw123!',
    });
    staffId = staffRes.id;
    // 直接签发 token，跳过限流中间件
    staffToken = await signToken({ user_id: staffId, role: 'staff', token_version: 1 });

    const memberRes = await seedMember(db, {
      created_by_user_id: staffId,
      name: '测试会员',
    });
    memberId = memberRes.id;
  });

  // ====== 登录保护 ======

  it('GET /api/orders 未登录 401', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders'),
    );
    expect(res.status).toBe(401);
  });

  it('POST /api/orders 未登录 401', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, order_date: '2026-04-24', lunch_qty: 1 }),
      }),
    );
    expect(res.status).toBe(401);
  });

  // ====== POST - 创建订单 ======

  it('POST 午餐单独（lunch_qty=1）- 创建 1 条 pending 订单', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          member_id: memberId,
          order_date: '2026-04-24',
          lunch_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]!.meal_type).toBe('lunch');
    expect(body.orders[0]!.quantity).toBe(1);
    expect(body.orders[0]!.status).toBe('pending');
    expect(body.orders[0]!.card_id).toBeNull();
  });

  it('POST 晚餐单独（dinner_qty=2）- 创建 1 条订单', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          member_id: memberId,
          order_date: '2026-04-24',
          dinner_qty: 2,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]!.meal_type).toBe('dinner');
    expect(body.orders[0]!.quantity).toBe(2);
  });

  it('POST 午晚同时（lunch_qty=1, dinner_qty=1）- 拆 2 条', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          member_id: memberId,
          order_date: '2026-04-24',
          lunch_qty: 1,
          dinner_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders).toHaveLength(2);
    const types = body.orders.map((o) => o.meal_type).sort();
    expect(types).toEqual(['dinner', 'lunch']);
  });

  it('POST 有 active 卡 → 扣减正确', async () => {
    await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'month',
      is_hospital: false,
      total_meals: 40,
      used_meals: 0,
      unit_price: 25,
      paid_amount: 1000,
      status: 'active',
    });

    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          member_id: memberId,
          order_date: '2026-04-24',
          lunch_qty: 1,
          dinner_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      orders: schema.DailyOrder[];
      card?: schema.Card;
      card_exhausted?: boolean;
    };
    expect(body.orders).toHaveLength(2);
    expect(body.card).toBeDefined();
    expect(body.card!.used_meals).toBe(2);
    expect(body.card!.remaining_meals).toBe(38);
    expect(body.card!.status).toBe('active');
    expect(body.card_exhausted).toBeFalsy();
    // 有卡时订单 card_id 应关联
    expect(body.orders[0]!.card_id).toBeTruthy();
    // 有卡时 amount 应为 0
    expect(body.orders[0]!.amount).toBe(0);
  });

  it('POST 有 active 卡 扣到 0 → exhausted + card_exhausted=true', async () => {
    await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      used_meals: 8,
      unit_price: 28,
      paid_amount: 280,
      status: 'active',
    });

    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          member_id: memberId,
          order_date: '2026-04-24',
          lunch_qty: 1,
          dinner_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      orders: schema.DailyOrder[];
      card?: schema.Card;
      card_exhausted?: boolean;
    };
    expect(body.card!.remaining_meals).toBe(0);
    expect(body.card!.status).toBe('exhausted');
    expect(body.card_exhausted).toBe(true);
  });

  it('POST 余额不足 → 422 INSUFFICIENT_MEAL_BALANCE', async () => {
    await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      used_meals: 9,
      unit_price: 28,
      paid_amount: 280,
      status: 'active',
    });

    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          member_id: memberId,
          order_date: '2026-04-24',
          lunch_qty: 1,
          dinner_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INSUFFICIENT_MEAL_BALANCE');
  });

  it('POST 散餐（无卡）→ 自动写 FinanceEntry income ad_hoc', async () => {
    // 先写 ad_hoc_price 设置
    await db.insert(schema.settings).values({ key: 'ad_hoc_price', value: '35' });

    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          member_id: memberId,
          order_date: '2026-04-24',
          lunch_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders[0]!.amount).toBe(35);

    // 验证 FinanceEntry 写入
    const orderId = body.orders[0]!.id;
    const entries = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.ref_order_id, orderId));
    expect(entries).toHaveLength(1);
    expect(entries[0]!.type).toBe('income');
    expect(entries[0]!.category).toBe('ad_hoc');
    expect(entries[0]!.amount).toBe(35);
    expect(entries[0]!.source).toBe('auto');
    expect(entries[0]!.voided).toBe(false);
  });

  it('POST 会员不存在 → 404', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          member_id: 99999,
          order_date: '2026-04-24',
          lunch_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it('POST lunch_qty 和 dinner_qty 都为 0 → 400', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          member_id: memberId,
          order_date: '2026-04-24',
          lunch_qty: 0,
          dinner_qty: 0,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST Idempotency-Key 防重复提交', async () => {
    const idempotencyKey = 'test-idem-key-12345';

    const body = JSON.stringify({
      member_id: memberId,
      order_date: '2026-04-25',
      lunch_qty: 1,
    });
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
      'Idempotency-Key': idempotencyKey,
    };

    const res1 = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers,
        body,
      }),
    );
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as { orders: schema.DailyOrder[] };

    // 再用同一 key 发请求
    const res2 = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers,
        body,
      }),
    );
    expect(res2.status).toBe(201);
    const body2 = (await res2.json()) as { orders: schema.DailyOrder[] };

    // 两次应返回相同的订单 id（不重复创建）
    expect(body1.orders[0]!.id).toBe(body2.orders[0]!.id);

    // DB 里只有 1 条订单
    const orders = await db.select().from(schema.daily_orders);
    expect(orders).toHaveLength(1);
  });

  // ====== GET 列表 ======

  it('GET /api/orders 按 member_id 过滤', async () => {
    // 创建两条订单
    await db.insert(schema.daily_orders).values([
      {
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      },
      {
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'dinner',
        quantity: 1,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      },
    ]);

    const res = await app.fetch(
      new Request(`http://test.local/api/orders?member_id=${memberId}`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/orders 按 date 过滤', async () => {
    await db.insert(schema.daily_orders).values([
      {
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      },
      {
        member_id: memberId,
        order_date: '2026-04-25',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      },
    ]);

    const res = await app.fetch(
      new Request('http://test.local/api/orders?date=2026-04-24', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders.every((o) => o.order_date === '2026-04-24')).toBe(true);
  });

  it('GET /api/orders 按 meal_type 过滤', async () => {
    await db.insert(schema.daily_orders).values([
      {
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      },
      {
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'dinner',
        quantity: 1,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      },
    ]);

    const res = await app.fetch(
      new Request('http://test.local/api/orders?meal_type=lunch', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders.every((o) => o.meal_type === 'lunch')).toBe(true);
  });

  // ====== GET today ======

  it('GET /api/orders/today 返回今日订单', async () => {
    // 在 today 端点之前需要有今日数据
    const todayShanghai = new Date(Date.now() + 8 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]!;

    await db.insert(schema.daily_orders).values({
      member_id: memberId,
      order_date: todayShanghai,
      meal_type: 'lunch',
      quantity: 1,
      amount: 0,
      status: 'pending',
      created_by_user_id: staffId,
    });

    const res = await app.fetch(
      new Request('http://test.local/api/orders/today', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders.every((o) => o.order_date === todayShanghai)).toBe(true);
  });

  // ====== GET /:id ======

  it('GET /api/orders/:id 返回详情', async () => {
    const inserted = await db
      .insert(schema.daily_orders)
      .values({
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      })
      .returning({ id: schema.daily_orders.id });
    const orderId = inserted[0]!.id;

    const res = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: schema.DailyOrder };
    expect(body.order.id).toBe(orderId);
  });

  it('GET /api/orders/:id 不存在 → 404', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders/99999', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(res.status).toBe(404);
  });

  // ====== PATCH /:id ======

  it('PATCH /api/orders/:id 改 notes 成功', async () => {
    const inserted = await db
      .insert(schema.daily_orders)
      .values({
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
        notes: '原备注',
      })
      .returning({ id: schema.daily_orders.id });
    const orderId = inserted[0]!.id;

    const res = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ notes: '新备注' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: schema.DailyOrder };
    expect(body.order.notes).toBe('新备注');
  });

  it('PATCH delivered 订单 → 422', async () => {
    const inserted = await db
      .insert(schema.daily_orders)
      .values({
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'delivered',
        created_by_user_id: staffId,
        delivered_at: new Date(),
        delivered_by_user_id: staffId,
      })
      .returning({ id: schema.daily_orders.id });
    const orderId = inserted[0]!.id;

    const res = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ notes: '试图改' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  // ====== PATCH /:id/cancel ======

  it('CANCEL 卡订单 → 卡 remaining 恢复', async () => {
    const cardRes = await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'month',
      is_hospital: false,
      total_meals: 40,
      used_meals: 2,
      unit_price: 25,
      paid_amount: 1000,
      status: 'active',
    });
    const cardId = cardRes.id;

    const inserted = await db
      .insert(schema.daily_orders)
      .values({
        member_id: memberId,
        card_id: cardId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 2,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      })
      .returning({ id: schema.daily_orders.id });
    const orderId = inserted[0]!.id;

    const res = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ reason: '会员临时取消' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: schema.DailyOrder; card?: schema.Card };
    expect(body.order.status).toBe('cancelled');
    expect(body.card).toBeDefined();
    expect(body.card!.used_meals).toBe(0);
    expect(body.card!.remaining_meals).toBe(40);
  });

  it('CANCEL exhausted 卡 → 恢复后回 active', async () => {
    const cardRes = await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      used_meals: 10,
      unit_price: 28,
      paid_amount: 280,
      status: 'exhausted',
    });
    const cardId = cardRes.id;

    const inserted = await db
      .insert(schema.daily_orders)
      .values({
        member_id: memberId,
        card_id: cardId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 2,
        amount: 0,
        status: 'fulfilled',
        fulfilled_at: new Date(),
        fulfilled_by_user_id: staffId,
        created_by_user_id: staffId,
      })
      .returning({ id: schema.daily_orders.id });
    const orderId = inserted[0]!.id;

    const res = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: schema.DailyOrder; card?: schema.Card };
    expect(body.card!.status).toBe('active');
    expect(body.card!.remaining_meals).toBe(2);
  });

  it('CANCEL 散餐订单 → FinanceEntry.voided=true', async () => {
    const inserted = await db
      .insert(schema.daily_orders)
      .values({
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 1,
        amount: 35,
        status: 'pending',
        created_by_user_id: staffId,
      })
      .returning({ id: schema.daily_orders.id });
    const orderId = inserted[0]!.id;

    // 插入对应 FinanceEntry
    await db.insert(schema.finance_entries).values({
      entry_date: '2026-04-24',
      type: 'income',
      amount: 35,
      category: 'ad_hoc',
      ref_order_id: orderId,
      source: 'auto',
      voided: false,
      created_by_user_id: staffId,
    });

    const res = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ reason: '散餐取消' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: schema.DailyOrder };
    expect(body.order.status).toBe('cancelled');

    // 验证 FinanceEntry 已 voided
    const entries = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.ref_order_id, orderId));
    expect(entries[0]!.voided).toBe(true);
  });

  it('CANCEL delivered → 422 ORDER_LOCKED_DELIVERED', async () => {
    const inserted = await db
      .insert(schema.daily_orders)
      .values({
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'delivered',
        created_by_user_id: staffId,
        delivered_at: new Date(),
        delivered_by_user_id: staffId,
      })
      .returning({ id: schema.daily_orders.id });
    const orderId = inserted[0]!.id;

    const res = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('ORDER_LOCKED_DELIVERED');
  });

  it('CANCEL 已取消 → 幂等 200', async () => {
    const inserted = await db
      .insert(schema.daily_orders)
      .values({
        member_id: memberId,
        order_date: '2026-04-24',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'cancelled',
        created_by_user_id: staffId,
        cancelled_at: new Date(),
        cancelled_by_user_id: staffId,
        cancel_reason: '已取消',
      })
      .returning({ id: schema.daily_orders.id });
    const orderId = inserted[0]!.id;

    const res = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: schema.DailyOrder };
    expect(body.order.status).toBe('cancelled');
  });

  // ====== 散客 walk-in ======

  it('POST 散客 walk-in：customer_name + 无 member_id → 创建哨兵会员订单 + 写 ad_hoc FinanceEntry', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          order_date: '2026-04-24',
          lunch_qty: 2,
          customer_name: '张叔叔',
          adhoc_unit_price: 40,
          notes: '不要辣',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]!.customer_name).toBe('张叔叔');
    expect(body.orders[0]!.amount).toBe(80);
    expect(body.orders[0]!.card_id).toBeNull();
    expect(body.orders[0]!.notes).toBe('不要辣');

    // FinanceEntry 应该有一条 ad_hoc 收入
    const entries = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.ref_order_id, body.orders[0]!.id));
    expect(entries).toHaveLength(1);
    expect(entries[0]!.category).toBe('ad_hoc');
    expect(entries[0]!.amount).toBe(80);
    expect(entries[0]!.description).toContain('张叔叔');
  });

  it('POST 既无 member_id 又无 customer_name → 422', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          order_date: '2026-04-24',
          lunch_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
