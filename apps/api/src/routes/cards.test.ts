import { describe, expect, it, beforeEach } from 'vitest';
import type { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { createApp } from '../app.js';
import {
  setupTestDb,
  seedUser,
  seedMember,
  seedCard,
} from '../test-helpers.js';
import * as schema from '../db/schema.js';
import { signToken } from '../services/jwt.js';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

interface Ctx {
  db: TestDb;
  app: ReturnType<typeof createApp>;
  token: string;
  userId: number;
}

/**
 * 直接用 signToken 签发 JWT，绕过 /api/auth/login 端点的限流（在跨测试 Map 里累加）。
 * 之所以不调 login：cards.test 有 10+ 测试，共享同一个内存 rate-limit store 会触 429。
 */
async function buildCtx(): Promise<Ctx> {
  const { db } = await setupTestDb();
  const app = createApp({ db });
  const u = await seedUser(db, {
    username: 'staff1',
    full_name: '员工一号',
    role: 'staff',
    password: 'StaffPw!1',
  });
  const token = await signToken({
    user_id: u.id,
    role: 'staff',
    token_version: 1,
  });
  return { db, app, token, userId: u.id };
}

function authedFetch(app: Ctx['app'], token: string, path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return app.fetch(new Request(`http://test.local${path}`, { ...init, headers }));
}

describe('GET /api/cards', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await buildCtx();
  });

  it('未登录 401', async () => {
    const res = await ctx.app.fetch(
      new Request('http://test.local/api/cards?member_id=1'),
    );
    expect(res.status).toBe(401);
  });

  it('按 member_id 过滤，默认列出全部历史卡（倒序）', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      unit_price: 28,
      paid_amount: 280,
      status: 'upgraded',
    });
    await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'month',
      is_hospital: false,
      total_meals: 40,
      unit_price: 25,
      paid_amount: 1000,
      status: 'active',
    });

    const res = await authedFetch(ctx.app, ctx.token, `/api/cards?member_id=${memberId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: Array<{ card_code: string; status: string }> };
    expect(body.cards).toHaveLength(2);
  });

  it('status=active 只返回在用卡', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      unit_price: 28,
      paid_amount: 280,
      status: 'upgraded',
    });
    await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'month',
      is_hospital: false,
      total_meals: 40,
      unit_price: 25,
      paid_amount: 1000,
      status: 'active',
    });

    const res = await authedFetch(
      ctx.app,
      ctx.token,
      `/api/cards?member_id=${memberId}&status=active`,
    );
    const body = (await res.json()) as { cards: Array<{ status: string }> };
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0]!.status).toBe('active');
  });

  it('缺 member_id 400', async () => {
    const res = await authedFetch(ctx.app, ctx.token, '/api/cards');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/cards (新购)', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await buildCtx();
  });

  it('未登录 401', async () => {
    const res = await ctx.app.fetch(
      new Request('http://test.local/api/cards', { method: 'POST', body: '{}' }),
    );
    expect(res.status).toBe(401);
  });

  it('院外月卡：写卡 + 自动入账 ¥1000 regular_sub', async () => {
    const { id: memberId } = await seedMember(ctx.db, {
      created_by_user_id: ctx.userId,
      is_hospital: false,
    });

    const res = await authedFetch(ctx.app, ctx.token, '/api/cards', {
      method: 'POST',
      body: JSON.stringify({
        member_id: memberId,
        card_code: 'month',
        is_hospital: false,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      card: { id: number; paid_amount: number; total_meals: number; remaining_meals: number; status: string };
      financeEntry: { id: number; category: string; entry_date: string };
    };
    expect(body.card.paid_amount).toBe(1000);
    expect(body.card.total_meals).toBe(40);
    expect(body.card.remaining_meals).toBe(40);
    expect(body.card.status).toBe('active');
    expect(body.financeEntry.category).toBe('regular_sub');

    const finance = await ctx.db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.id, body.financeEntry.id));
    expect(finance[0]!.amount).toBe(1000);
    expect(finance[0]!.type).toBe('income');
    expect(finance[0]!.source).toBe('auto');
    expect(finance[0]!.ref_card_id).toBe(body.card.id);
  });

  it('院内体验卡：category=hospital_sub，¥50，meals=2', async () => {
    const { id: memberId } = await seedMember(ctx.db, {
      created_by_user_id: ctx.userId,
      is_hospital: true,
    });

    const res = await authedFetch(ctx.app, ctx.token, '/api/cards', {
      method: 'POST',
      body: JSON.stringify({
        member_id: memberId,
        card_code: 'experience',
        is_hospital: true,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      card: { total_meals: number; paid_amount: number; unit_price: number };
      financeEntry: { category: string };
    };
    expect(body.card.total_meals).toBe(2);
    expect(body.card.paid_amount).toBe(50);
    expect(body.card.unit_price).toBe(25);
    expect(body.financeEntry.category).toBe('hospital_sub');
  });

  it('会员已有 active 卡 → 409', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      unit_price: 28,
      paid_amount: 280,
      status: 'active',
    });

    const res = await authedFetch(ctx.app, ctx.token, '/api/cards', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId, card_code: 'month', is_hospital: false }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('CONFLICT');
  });

  it('旧卡 exhausted 后可再新购（换卡，任意等级）', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'year',
      is_hospital: false,
      total_meals: 480,
      used_meals: 480,
      unit_price: 20,
      paid_amount: 9600,
      status: 'exhausted',
    });

    const res = await authedFetch(ctx.app, ctx.token, '/api/cards', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId, card_code: 'week', is_hospital: false }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { card: { total_meals: number; paid_amount: number } };
    expect(body.card.total_meals).toBe(10);
    expect(body.card.paid_amount).toBe(280);
  });

  it('会员不存在 → 404', async () => {
    const res = await authedFetch(ctx.app, ctx.token, '/api/cards', {
      method: 'POST',
      body: JSON.stringify({ member_id: 99999, card_code: 'week', is_hospital: false }),
    });
    expect(res.status).toBe(404);
  });

  it('会员被归档（is_active=false）→ 422', async () => {
    const { id: memberId } = await seedMember(ctx.db, {
      created_by_user_id: ctx.userId,
      is_active: false,
    });
    const res = await authedFetch(ctx.app, ctx.token, '/api/cards', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId, card_code: 'week', is_hospital: false }),
    });
    expect(res.status).toBe(422);
  });

  it('非法 card_code → 400', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    const res = await authedFetch(ctx.app, ctx.token, '/api/cards', {
      method: 'POST',
      body: JSON.stringify({
        member_id: memberId,
        card_code: 'galaxy_pass',
        is_hospital: false,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('院外不存在 experience（院外无体验卡）→ 400', async () => {
    const { id: memberId } = await seedMember(ctx.db, {
      created_by_user_id: ctx.userId,
      is_hospital: false,
    });
    const res = await authedFetch(ctx.app, ctx.token, '/api/cards', {
      method: 'POST',
      body: JSON.stringify({
        member_id: memberId,
        card_code: 'experience',
        is_hospital: false,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('collector_user_id 未传 → 默认取当前登录用户', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    const res = await authedFetch(ctx.app, ctx.token, '/api/cards', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId, card_code: 'week', is_hospital: false }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      card: { collector_user_id: number; created_by_user_id: number };
    };
    expect(body.card.collector_user_id).toBe(ctx.userId);
    expect(body.card.created_by_user_id).toBe(ctx.userId);
  });

  it('settings.default_collector_user_id 存在时，未传 collector 默认指向它', async () => {
    const other = await seedUser(ctx.db, { username: 'collector', password: 'Pw!12345' });
    await ctx.db.insert(schema.settings).values({
      key: 'default_collector_user_id',
      value: String(other.id),
    });
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });

    const res = await authedFetch(ctx.app, ctx.token, '/api/cards', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId, card_code: 'week', is_hospital: false }),
    });
    const body = (await res.json()) as { card: { collector_user_id: number } };
    expect(body.card.collector_user_id).toBe(other.id);
  });
});

describe('POST /api/cards/:id/upgrade', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await buildCtx();
  });

  it('未登录 401', async () => {
    const res = await ctx.app.fetch(
      new Request('http://test.local/api/cards/1/upgrade', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('成功升级：体验卡 → 月卡；差价 830；旧卡 upgraded；新卡继承已用', async () => {
    const { id: memberId } = await seedMember(ctx.db, {
      created_by_user_id: ctx.userId,
      is_hospital: true,
    });
    const old = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'experience',
      is_hospital: true,
      total_meals: 2,
      used_meals: 1,
      unit_price: 25,
      paid_amount: 50,
      status: 'active',
    });

    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${old.id}/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ card_code: 'month', is_hospital: true }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      old_card: { status: string; upgraded_from_id: number | null };
      new_card: {
        id: number;
        card_code: string;
        total_meals: number;
        used_meals: number;
        remaining_meals: number;
        paid_amount: number;
        status: string;
        upgraded_from_id: number | null;
      };
      financeEntry: { category: string; amount: number };
      diff: number;
    };
    expect(body.diff).toBe(830);
    expect(body.old_card.status).toBe('upgraded');
    expect(body.new_card.card_code).toBe('month');
    expect(body.new_card.total_meals).toBe(40);
    expect(body.new_card.used_meals).toBe(1);
    expect(body.new_card.remaining_meals).toBe(39);
    expect(body.new_card.paid_amount).toBe(880);
    expect(body.new_card.upgraded_from_id).toBe(old.id);
    expect(body.financeEntry.amount).toBe(830);
    expect(body.financeEntry.category).toBe('hospital_sub');

    const financeRows = await ctx.db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.ref_card_id, body.new_card.id));
    expect(financeRows).toHaveLength(1);
  });

  it('升级到同价卡 → 422 UPGRADE_NOT_ALLOWED', async () => {
    const { id: memberId } = await seedMember(ctx.db, {
      created_by_user_id: ctx.userId,
      is_hospital: true,
    });
    const old = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'month',
      is_hospital: true,
      total_meals: 40,
      used_meals: 5,
      unit_price: 22,
      paid_amount: 880,
      status: 'active',
    });
    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${old.id}/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ card_code: 'month', is_hospital: true }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UPGRADE_NOT_ALLOWED');
  });

  it('升级到更低等级 → 422 UPGRADE_NOT_ALLOWED', async () => {
    const { id: memberId } = await seedMember(ctx.db, {
      created_by_user_id: ctx.userId,
      is_hospital: true,
    });
    const old = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'month',
      is_hospital: true,
      total_meals: 40,
      unit_price: 22,
      paid_amount: 880,
      status: 'active',
    });
    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${old.id}/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ card_code: 'week', is_hospital: true }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UPGRADE_NOT_ALLOWED');
  });

  it('旧卡非 active（已 exhausted）→ 422', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    const old = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      used_meals: 10,
      unit_price: 28,
      paid_amount: 280,
      status: 'exhausted',
    });
    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${old.id}/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ card_code: 'month', is_hospital: false }),
    });
    expect(res.status).toBe(422);
  });

  it('升级目标新卡总数 < 已用 → 422 INVALID_UPGRADE_MEALS', async () => {
    const { id: memberId } = await seedMember(ctx.db, {
      created_by_user_id: ctx.userId,
      is_hospital: true,
    });
    const old = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'experience',
      is_hospital: true,
      total_meals: 2,
      used_meals: 2,
      unit_price: 25,
      paid_amount: 50,
      status: 'active',
    });
    // 用一张"总数比已用少"的目标理论上不可能在 catalog 里出现；这里用同价的 small_week(125, meals=5) 也会先 UPGRADE_NOT_ALLOWED。
    // 所以我们构造 used_meals=6 的 experience 卡 → 升级到 small_week (5 meals) 触发 INVALID_UPGRADE_MEALS
    await ctx.db
      .update(schema.cards)
      .set({ used_meals: 6, remaining_meals: -4 })
      .where(eq(schema.cards.id, old.id));

    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${old.id}/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ card_code: 'small_week', is_hospital: true }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('INVALID_UPGRADE_MEALS');
  });

  it('卡不存在 → 404', async () => {
    const res = await authedFetch(ctx.app, ctx.token, '/api/cards/99999/upgrade', {
      method: 'POST',
      body: JSON.stringify({ card_code: 'month', is_hospital: false }),
    });
    expect(res.status).toBe(404);
  });

  it('升级后 GET /api/cards?status=active 只剩新卡', async () => {
    const { id: memberId } = await seedMember(ctx.db, {
      created_by_user_id: ctx.userId,
      is_hospital: true,
    });
    const old = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'small_week',
      is_hospital: true,
      total_meals: 5,
      used_meals: 2,
      unit_price: 25,
      paid_amount: 125,
      status: 'active',
    });
    const up = await authedFetch(ctx.app, ctx.token, `/api/cards/${old.id}/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ card_code: 'week', is_hospital: true }),
    });
    expect(up.status).toBe(201);

    const listRes = await authedFetch(
      ctx.app,
      ctx.token,
      `/api/cards?member_id=${memberId}&status=active`,
    );
    const list = (await listRes.json()) as { cards: Array<{ card_code: string }> };
    expect(list.cards).toHaveLength(1);
    expect(list.cards[0]!.card_code).toBe('week');
  });
});

// ============================================================
// PATCH /api/cards/:id  (MEA-17)
// ============================================================

describe('PATCH /api/cards/:id', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await buildCtx();
  });

  it('未登录 401', async () => {
    const res = await ctx.app.fetch(
      new Request('http://test.local/api/cards/1', { method: 'PATCH', body: '{}' }),
    );
    expect(res.status).toBe(401);
  });

  it('改 notes 成功，并写入 audit_log', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    const { id: cardId } = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'month',
      is_hospital: false,
      total_meals: 40,
      unit_price: 25,
      paid_amount: 1000,
      status: 'active',
    });

    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes: '客户偏好无辣' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { card: { notes: string } };
    expect(body.card.notes).toBe('客户偏好无辣');

    const audits = await ctx.db
      .select()
      .from(schema.audit_logs)
      .where(eq(schema.audit_logs.entity_id, cardId));
    const updateAudit = audits.find((a) => a.action === 'update' && a.entity === 'card');
    expect(updateAudit).toBeDefined();
    expect(updateAudit!.user_id).toBe(ctx.userId);
    const diff = JSON.parse(updateAudit!.diff_json) as Record<string, unknown>;
    expect(diff).toHaveProperty('notes');
  });

  it('改 collector_user_id 成功', async () => {
    const collector = await seedUser(ctx.db, { username: 'newcollector', password: 'Pw!12345' });
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    const { id: cardId } = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      unit_price: 28,
      paid_amount: 280,
    });

    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ collector_user_id: collector.id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { card: { collector_user_id: number } };
    expect(body.card.collector_user_id).toBe(collector.id);
  });

  it('改 purchased_at 为有效时间（无订单冲突）→ 成功', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    const { id: cardId } = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'month',
      is_hospital: false,
      total_meals: 40,
      unit_price: 25,
      paid_amount: 1000,
    });

    const newPurchasedAt = '2026-01-01T08:00:00+08:00';
    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ purchased_at: newPurchasedAt }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { card: { purchased_at: string | number } };
    expect(body.card.purchased_at).toBeDefined();
  });

  it('改 purchased_at 与现有订单冲突 → 422 PURCHASED_AT_CONFLICT', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    const { id: cardId } = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'month',
      is_hospital: false,
      total_meals: 40,
      unit_price: 25,
      paid_amount: 1000,
    });

    // 插入一条 order_date = 2026-03-10 的订单（早于新 purchased_at 2026-04-01）
    await ctx.db.insert(schema.daily_orders).values({
      member_id: memberId,
      card_id: cardId,
      order_date: '2026-03-10',
      meal_type: 'lunch',
      quantity: 1,
      amount: 0,
      status: 'pending',
      created_by_user_id: ctx.userId,
    });

    // 新的 purchased_at 是 2026-04-01，而订单是 2026-03-10，冲突
    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ purchased_at: '2026-04-01T00:00:00+00:00' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PURCHASED_AT_CONFLICT');
  });

  it('尝试改 card_code → 422（不允许）', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    const { id: cardId } = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      unit_price: 28,
      paid_amount: 280,
    });

    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ card_code: 'month' }),
    });
    expect(res.status).toBe(422);
  });

  it('尝试改 paid_amount → 422（不允许）', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    const { id: cardId } = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      unit_price: 28,
      paid_amount: 280,
    });

    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ paid_amount: 500 }),
    });
    expect(res.status).toBe(422);
  });

  it('卡不存在 → 404', async () => {
    const res = await authedFetch(ctx.app, ctx.token, '/api/cards/99999', {
      method: 'PATCH',
      body: JSON.stringify({ notes: '测试' }),
    });
    expect(res.status).toBe(404);
  });

  it('空 body（无更改字段）→ 200 幂等', async () => {
    const { id: memberId } = await seedMember(ctx.db, { created_by_user_id: ctx.userId });
    const { id: cardId } = await seedCard(ctx.db, {
      member_id: memberId,
      created_by_user_id: ctx.userId,
      collector_user_id: ctx.userId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      unit_price: 28,
      paid_amount: 280,
    });

    const res = await authedFetch(ctx.app, ctx.token, `/api/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
  });
});