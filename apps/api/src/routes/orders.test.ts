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
 *   - POST 散餐（无卡）→ 不产生流水；PATCH 已送达后写入 meal_earned_walkin
 *   - POST 会员不存在 → 404
 *   - GET 列表按日期/status/meal_type 过滤
 *   - GET today 快捷接口
 *   - GET /:id 详情
 *   - PATCH 改 notes 成功
 *   - PATCH delivered 订单 422
 *   - CANCEL 卡订单 → 卡 remaining 恢复
 *   - CANCEL 散餐订单 → FinanceEntry.voided=true
 *   - CANCEL delivered → 422
 *   - PATCH delivery-failed：已送达 + 员工 → 403；已送达 + 管理员 → 冲销退餐
 *   - CANCEL 已取消 → 幂等 200
 *   - Idempotency-Key 防重复提交
 *   - GET 列表需要登录
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { drizzle } from 'drizzle-orm/libsql';
import { eq, and } from 'drizzle-orm';
import { createApp } from '../app.js';
import { setupTestDb, seedUser, seedMember, seedCard } from '../test-helpers.js';
import { signToken } from '../services/jwt.js';
import { STAFF_CARD_POOL_MEALS } from '@meal/shared';
import * as schema from '../db/schema.js';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

describe('Orders API /api/orders', () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let staffId: number;
  let staffToken: string;
  let memberId: number;
  let defaultCardId: number;

  /** 订餐 API 必填：凭证截图（测试中 1×1 PNG data URL） */
  const TEST_PROOF =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  function withProof(body: Record<string, unknown>): string {
    return JSON.stringify({ ...body, proof_images: [TEST_PROOF] });
  }

  /** 把默认卡标成 exhausted，给"需要自己定制卡"的用例用 */
  async function deactivateDefaultCard() {
    await db
      .update(schema.cards)
      .set({ status: 'exhausted' })
      .where(eq(schema.cards.id, defaultCardId));
  }

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

    // 默认给每个会员开一张够用的 active 卡（1000 餐），避免每个用例都要手动 seed。
    // 需要测"无卡"、"余额不足"、"卡扣到 0"等场景的用例可以调 deactivateDefaultCard() 把它挪开。
    const defaultCard = await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'year',
      is_hospital: false,
      total_meals: 1000,
      used_meals: 0,
      unit_price: 20,
      paid_amount: 20000,
      status: 'active',
    });
    defaultCardId = defaultCard.id;
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
        body: withProof({ member_id: memberId, order_date: '2026-04-24', lunch_qty: 1 }),
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
        body: withProof({
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
    // 会员订单一定扣到默认卡上，card_id 非空
    expect(body.orders[0]!.card_id).toBe(defaultCardId);
  });

  it('POST 缺凭证截图 → 400', async () => {
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
    expect(res.status).toBe(400);
  });

  it('POST 赠送餐：无 active 卡也可录入，不扣卡', async () => {
    await deactivateDefaultCard();
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          member_id: memberId,
          order_date: '2026-04-26',
          lunch_qty: 2,
          is_gift: true,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders[0]!.is_gift).toBe(true);
    expect(body.orders[0]!.card_id).toBeNull();
    expect(body.orders[0]!.amount).toBe(0);
  });

  it('POST 员工餐：有 active 卡也不扣次，金额 0', async () => {
    const before = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, defaultCardId))
      .limit(1);
    expect(before[0]!.used_meals).toBe(0);

    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          member_id: memberId,
          order_date: '2026-04-29',
          lunch_qty: 1,
          is_staff_meal: true,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders[0]!.is_staff_meal).toBe(true);
    expect(body.orders[0]!.card_id).toBeNull();
    expect(body.orders[0]!.amount).toBe(0);

    const after = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, defaultCardId))
      .limit(1);
    expect(after[0]!.used_meals).toBe(0);
  });

  it('POST 员工卡：扣 used、remaining 不变，订单标员工餐', async () => {
    await deactivateDefaultCard();
    await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'staff',
      is_hospital: false,
      total_meals: STAFF_CARD_POOL_MEALS,
      used_meals: 0,
      unit_price: 0,
      paid_amount: 0,
      status: 'active',
    });

    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          member_id: memberId,
          order_date: '2026-05-02',
          lunch_qty: 2,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders[0]!.is_staff_meal).toBe(true);
    expect(body.orders[0]!.card_id).not.toBeNull();
    expect(body.orders[0]!.amount).toBe(0);

    const cardRows = await db
      .select()
      .from(schema.cards)
      .where(and(eq(schema.cards.member_id, memberId), eq(schema.cards.status, 'active')))
      .limit(1);
    expect(cardRows[0]!.card_code).toBe('staff');
    expect(cardRows[0]!.used_meals).toBe(2);
    expect(cardRows[0]!.remaining_meals).toBe(STAFF_CARD_POOL_MEALS);
  });

  it('POST 仅档案 is_staff、无 active 卡：422', async () => {
    await deactivateDefaultCard();
    const { id: sid } = await seedMember(db, {
      created_by_user_id: staffId,
      name: '档内员工',
      phone: '13800007777',
    });
    await db.update(schema.members).set({ is_staff: true }).where(eq(schema.members.id, sid));

    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          member_id: sid,
          order_date: '2026-05-01',
          lunch_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST /api/orders/batch 一次录入多条', async () => {
    const m2 = await seedMember(db, { created_by_user_id: staffId, name: '会员乙' });
    await seedCard(db, {
      member_id: m2.id,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'year',
      is_hospital: false,
      total_meals: 100,
      used_meals: 0,
      unit_price: 20,
      paid_amount: 2000,
      status: 'active',
    });
    const res = await app.fetch(
      new Request('http://test.local/api/orders/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          proof_images: [TEST_PROOF],
          entries: [
            {
              member_id: memberId,
              order_date: '2026-04-27',
              lunch_qty: 1,
              dinner_qty: 0,
            },
            {
              member_id: m2.id,
              order_date: '2026-04-27',
              lunch_qty: 0,
              dinner_qty: 1,
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(201);
    const j = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(j.orders).toHaveLength(2);
  });

  it('PATCH 赠送餐已送达 → 不写 meal_earned', async () => {
    await deactivateDefaultCard();
    await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'giftcard',
      is_hospital: false,
      total_meals: 5,
      used_meals: 0,
      unit_price: 20,
      paid_amount: 100,
      status: 'active',
    });
    const cr = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          member_id: memberId,
          order_date: '2026-04-28',
          lunch_qty: 1,
          is_gift: true,
        }),
      }),
    );
    expect(cr.status).toBe(201);
    const ord = ((await cr.json()) as { orders: schema.DailyOrder[] }).orders[0]!;
    const oid = ord.id;
    await app.fetch(
      new Request(`http://test.local/api/orders/${oid}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status: 'fulfilled' }),
      }),
    );
    await app.fetch(
      new Request(`http://test.local/api/orders/${oid}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status: 'delivered' }),
      }),
    );
    const fin = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.ref_order_id, oid));
    expect(fin).toHaveLength(0);
  });

  it('PATCH 员工餐已送达 → 不写 meal_earned', async () => {
    const cr = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          member_id: memberId,
          order_date: '2026-04-30',
          lunch_qty: 1,
          is_staff_meal: true,
        }),
      }),
    );
    expect(cr.status).toBe(201);
    const ord = ((await cr.json()) as { orders: schema.DailyOrder[] }).orders[0]!;
    const oid = ord.id;
    await app.fetch(
      new Request(`http://test.local/api/orders/${oid}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status: 'fulfilled' }),
      }),
    );
    await app.fetch(
      new Request(`http://test.local/api/orders/${oid}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status: 'delivered' }),
      }),
    );
    const fin = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.ref_order_id, oid));
    expect(fin).toHaveLength(0);
  });

  it('POST 晚餐单独（dinner_qty=2）- 创建 1 条订单', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
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
        body: withProof({
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
    await deactivateDefaultCard();
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
        body: withProof({
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
    await deactivateDefaultCard();
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
        body: withProof({
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
    await deactivateDefaultCard();
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
        body: withProof({
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

  it('PATCH 卡订单 出餐→送达 → meal_earned_hospital（单价×份数）', async () => {
    await deactivateDefaultCard();
    await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'month',
      is_hospital: true,
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
        body: withProof({
          member_id: memberId,
          order_date: '2026-04-25',
          lunch_qty: 3,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    const orderId = body.orders[0]!.id;

    const before = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.ref_order_id, orderId));
    expect(before).toHaveLength(0);

    const r2 = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status: 'fulfilled' }),
      }),
    );
    expect(r2.status).toBe(200);

    const r3 = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status: 'delivered' }),
      }),
    );
    expect(r3.status).toBe(200);

    const entries = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.ref_order_id, orderId));
    expect(entries).toHaveLength(1);
    expect(entries[0]!.category).toBe('meal_earned_hospital');
    expect(entries[0]!.amount).toBe(75);
    expect(entries[0]!.entry_date).toBe('2026-04-25');
  });

  it('POST 会员无 active 卡 → 422，提示先开卡或走散客录单', async () => {
    await deactivateDefaultCard();
    // 这个 memberId 现在没有任何 active 卡。会员模式下必须有卡才能下单，
    // 想做无卡订单只能走 customer_name 散客分支。
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          member_id: memberId,
          order_date: '2026-04-24',
          lunch_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain('开卡');
  });

  it('POST 会员不存在 → 404', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
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
        body: withProof({
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

    const body = withProof({
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

  it('GET /api/orders 按 from/to 日期范围过滤', async () => {
    await db.insert(schema.daily_orders).values([
      {
        member_id: memberId,
        order_date: '2026-04-20',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      },
      {
        member_id: memberId,
        order_date: '2026-04-22',
        meal_type: 'dinner',
        quantity: 2,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      },
      {
        member_id: memberId,
        order_date: '2026-04-26',
        meal_type: 'lunch',
        quantity: 1,
        amount: 0,
        status: 'pending',
        created_by_user_id: staffId,
      },
    ]);

    const res = await app.fetch(
      new Request('http://test.local/api/orders?from=2026-04-21&to=2026-04-25', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orders: schema.DailyOrder[] };
    expect(body.orders.length).toBe(1);
    expect(body.orders[0]?.order_date).toBe('2026-04-22');
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
    await deactivateDefaultCard();
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

  it('CANCEL 员工卡订单：只恢复 used，remaining 不变', async () => {
    await deactivateDefaultCard();
    const cardRes = await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'staff',
      is_hospital: false,
      total_meals: 1000,
      used_meals: 5,
      unit_price: 0,
      paid_amount: 0,
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
        body: JSON.stringify({ reason: '测员工卡冲销' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: schema.DailyOrder; card?: schema.Card };
    expect(body.card).toBeDefined();
    expect(body.card!.used_meals).toBe(3);
    expect(body.card!.remaining_meals).toBe(995);
  });

  it('CANCEL exhausted 卡 → 恢复后回 active', async () => {
    await deactivateDefaultCard();
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
      category: 'meal_earned_walkin',
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

  it('PATCH delivery-failed：已送达 + 员工 → 403', async () => {
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
      new Request(`http://test.local/api/orders/${orderId}/delivery-failed`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ reason: '客户取消' }),
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('DELIVERY_FAILED_ADMIN_ONLY');
    expect(body.message).toBe('只有管理员能修改');
  });

  it('PATCH delivery-failed：已送达 + 管理员 → 冲销并退卡餐', async () => {
    await deactivateDefaultCard();
    const cardRes = await seedCard(db, {
      member_id: memberId,
      created_by_user_id: staffId,
      collector_user_id: staffId,
      card_code: 'month',
      is_hospital: false,
      total_meals: 40,
      used_meals: 3,
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
        quantity: 3,
        amount: 0,
        status: 'delivered',
        created_by_user_id: staffId,
        delivered_at: new Date(),
        delivered_by_user_id: staffId,
      })
      .returning({ id: schema.daily_orders.id });
    const orderId = inserted[0]!.id;

    const adminUser = await seedUser(db, {
      username: 'admin_delivery_undo',
      full_name: '测试管理员',
      role: 'admin',
      password: 'AdminPw123!',
    });
    const adminToken = await signToken({
      user_id: adminUser.id,
      role: 'admin',
      token_version: 1,
    });

    const res = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}/delivery-failed`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason: '客户取消' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: schema.DailyOrder; card?: schema.Card };
    expect(body.order.status).toBe('cancelled');
    expect(body.order.cancel_reason).toContain('误点已送达后纠正');
    expect(body.card).toBeDefined();
    expect(body.card!.used_meals).toBe(0);
    expect(body.card!.remaining_meals).toBe(40);
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

  it('POST 散客 walk-in：下单不产生流水；出餐→送达后写入 meal_earned_walkin', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          order_date: '2026-04-24',
          lunch_qty: 2,
          customer_name: '张叔叔',
          customer_phone: '13800001111',
          customer_wechat: 'zhang_shushu',
          customer_address: '江北区测试路 66 号',
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

    const orderId = body.orders[0]!.id;
    const none = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.ref_order_id, orderId));
    expect(none).toHaveLength(0);

    const r2 = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status: 'fulfilled' }),
      }),
    );
    expect(r2.status).toBe(200);

    const r3 = await app.fetch(
      new Request(`http://test.local/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status: 'delivered' }),
      }),
    );
    expect(r3.status).toBe(200);

    const entries = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.ref_order_id, orderId));
    expect(entries).toHaveLength(1);
    expect(entries[0]!.category).toBe('meal_earned_walkin');
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
        body: withProof({
          order_date: '2026-04-24',
          lunch_qty: 1,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST 散客 walk-in 缺手机号 → 400', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          order_date: '2026-04-24',
          lunch_qty: 1,
          customer_name: '没填手机',
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST 散客 walk-in 手机号格式不对 → 400', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          order_date: '2026-04-24',
          lunch_qty: 1,
          customer_name: '格式错',
          customer_phone: '1234',
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST 散客 walk-in 缺微信号 → 400', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          order_date: '2026-04-24',
          lunch_qty: 1,
          customer_name: '没填微信',
          customer_phone: '13888889999',
          customer_address: '江北区测试路 3 号',
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST 散客 walk-in 缺地址 → 400', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          order_date: '2026-04-24',
          lunch_qty: 1,
          customer_name: '没填地址',
          customer_phone: '13877776666',
          customer_wechat: 'nofill_address',
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST 散客附带手机+地址：写回 walk-in member，下次留空不被洗掉', async () => {
    const post = (body: Record<string, unknown>) =>
      app.fetch(
        new Request('http://test.local/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${staffToken}`,
          },
          body: withProof(body),
        }),
      );

    // 第一次：带手机 + 地址
    const r1 = await post({
      order_date: '2026-04-24',
      lunch_qty: 1,
      customer_name: '刘大爷',
      customer_phone: '13800008888',
      customer_wechat: 'liu_daye',
      customer_address: '江北区测试路 1 号',
    });
    expect(r1.status).toBe(201);
    const b1 = (await r1.json()) as { orders: schema.DailyOrder[] };
    const memberId = b1.orders[0]!.member_id;

    let rows = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, memberId));
    expect(rows[0]!.phone).toBe('13800008888');
    expect(rows[0]!.wechat_id).toBe('liu_daye');
    expect(rows[0]!.address).toBe('江北区测试路 1 号');
    expect(rows[0]!.is_walkin).toBe(true);

    // 第二次：同名再录，仍要带手机（系统强制必填，避免数据缺失）；不传地址 → 不应该洗掉
    const r2 = await post({
      order_date: '2026-04-25',
      dinner_qty: 1,
      customer_name: '刘大爷',
      customer_phone: '13800008888',
      customer_wechat: 'liu_daye',
      customer_address: '江北区测试路 1 号',
    });
    expect(r2.status).toBe(201);
    rows = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, memberId));
    expect(rows[0]!.phone).toBe('13800008888');
    expect(rows[0]!.wechat_id).toBe('liu_daye');
    expect(rows[0]!.address).toBe('江北区测试路 1 号');

    // 第三次：同名，只改地址 → 手机保留，地址更新
    const r3 = await post({
      order_date: '2026-04-26',
      lunch_qty: 1,
      customer_name: '刘大爷',
      customer_phone: '13800008888',
      customer_wechat: 'liu_daye_new',
      customer_address: '新地址 88 号',
    });
    expect(r3.status).toBe(201);
    rows = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, memberId));
    expect(rows[0]!.phone).toBe('13800008888');
    expect(rows[0]!.wechat_id).toBe('liu_daye_new');
    expect(rows[0]!.address).toBe('新地址 88 号');
  });

  it('POST 散客同名复用：两次同名 walk-in → 同一 is_walkin member_id', async () => {
    const post = (name: string) =>
      app.fetch(
        new Request('http://test.local/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${staffToken}`,
          },
          body: withProof({
            order_date: '2026-04-24',
            lunch_qty: 1,
            customer_name: name,
            customer_phone: '13900002222',
            customer_wechat: `${name}_wx`,
            customer_address: `${name}测试地址 1 号`,
          }),
        }),
      );

    const r1 = await post('李四');
    expect(r1.status).toBe(201);
    const b1 = (await r1.json()) as { orders: schema.DailyOrder[] };

    const r2 = await post('李四');
    expect(r2.status).toBe(201);
    const b2 = (await r2.json()) as { orders: schema.DailyOrder[] };

    expect(b1.orders[0]!.member_id).toBe(b2.orders[0]!.member_id);

    // 这个 member 应该是 is_walkin=true
    const members = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, b1.orders[0]!.member_id));
    expect(members[0]!.is_walkin).toBe(true);
    expect(members[0]!.uid).toBe('__WALKIN__李四');
  });

  it('GET /api/walkins 返回聚合统计，/api/members 默认不返回散客', async () => {
    // 建一个会员订单
    const memberOrderRes = await app.fetch(
      new Request('http://test.local/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: withProof({
          member_id: memberId,
          order_date: '2026-04-24',
          lunch_qty: 1,
        }),
      }),
    );
    expect(memberOrderRes.status).toBe(201);

    // 建两条散客 walk-in 订单
    let phoneIdx = 0;
    for (const name of ['赵六', '王七']) {
      const phones = ['13900003333', '13900004444'];
      await app.fetch(
        new Request('http://test.local/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${staffToken}`,
          },
          body: withProof({
            order_date: '2026-04-24',
            lunch_qty: 2,
            customer_name: name,
            customer_phone: phones[phoneIdx++]!,
            customer_wechat: `${name}_wx`,
            customer_address: `${name}测试路 2 号`,
            adhoc_unit_price: 35,
          }),
        }),
      );
    }

    // /api/walkins → 2 位，每人 1 单 2 份 ¥70
    const walkinRes = await app.fetch(
      new Request('http://test.local/api/walkins', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(walkinRes.status).toBe(200);
    const walkinBody = (await walkinRes.json()) as {
      items: Array<{
        name: string;
        is_walkin: boolean;
        stats: { total_meals: number; total_spent: number };
      }>;
      total: number;
    };
    expect(walkinBody.total).toBe(2);
    expect(walkinBody.items.every((w) => w.is_walkin === true)).toBe(true);
    expect(walkinBody.items.every((w) => w.stats.total_meals === 2)).toBe(true);
    expect(walkinBody.items.every((w) => w.stats.total_spent === 70)).toBe(true);

    // /api/members 默认 type=member，应该只返回正式会员（散客 is_walkin=true 不在此）
    const memberListRes = await app.fetch(
      new Request('http://test.local/api/members', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(memberListRes.status).toBe(200);
    const memberListBody = (await memberListRes.json()) as {
      items: Array<{ is_walkin: boolean }>;
    };
    expect(memberListBody.items.every((m) => m.is_walkin === false)).toBe(true);

    // type=walkin 只返回散客
    const walkinTypeRes = await app.fetch(
      new Request('http://test.local/api/members?type=walkin', {
        headers: { Authorization: `Bearer ${staffToken}` },
      }),
    );
    expect(walkinTypeRes.status).toBe(200);
    const walkinTypeBody = (await walkinTypeRes.json()) as {
      items: Array<{ is_walkin: boolean }>;
    };
    expect(walkinTypeBody.items).toHaveLength(2);
    expect(walkinTypeBody.items.every((m) => m.is_walkin === true)).toBe(true);
  });
});
