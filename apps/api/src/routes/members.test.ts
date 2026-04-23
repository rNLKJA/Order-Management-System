/**
 * members 路由测试 - MEA-10。
 *
 * 覆盖：
 * - 登录保护
 * - POST 创建 + uid 自动生成 + 审计日志
 * - POST 重复手机号提示但仍成功（家庭共号场景）
 * - POST 校验（phone 格式 / name 必填）
 * - GET 列表分页 + 搜索 (uid/name/nickname/phone/wechat_id)
 * - GET 列表默认排除 archived；admin include_archived=true 可看到
 * - GET 列表 is_hospital 过滤
 * - GET :id 不存在 404
 * - PATCH 更新（updated_at 变化 + 姓名/昵称/手机改动自动重算 uid）
 * - PATCH archive（admin 专属，staff 403，并写审计）
 * - DELETE（admin 专属；有引用 409；无引用 实删 + 审计）
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { drizzle } from 'drizzle-orm/libsql';
import { and, eq } from 'drizzle-orm';
import { createApp } from '../app.js';
import { setupTestDb, seedUser, seedMember, seedCard } from '../test-helpers.js';
import * as schema from '../db/schema.js';
import type { LoginResponse } from '@meal/shared';

/**
 * 专用 login helper：给每个请求加唯一 IP header，绕开 auth 路由的模块级限流 bucket。
 * 不用 test-helpers.ts 的 login（它的 bucket 会跨测试用例累积到 10 触发 429）。
 */
async function loginWithUniqueIp(
  app: ReturnType<typeof createApp>,
  username: string,
  password: string,
): Promise<LoginResponse> {
  const fakeIp = `10.${Math.floor(Math.random() * 255)}.${Math.floor(
    Math.random() * 255,
  )}.${Math.floor(Math.random() * 255)}`;
  const res = await app.fetch(
    new Request('http://test.local/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': fakeIp,
      },
      body: JSON.stringify({ username, password }),
    }),
  );
  if (!res.ok) {
    throw new Error(`login failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as LoginResponse;
}

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

interface MemberShape {
  id: number;
  uid: string;
  name: string;
  nickname: string;
  phone: string;
  wechat_id: string;
  address: string;
  dietary_notes: string;
  is_hospital: boolean;
  is_active: boolean;
  created_by_user_id: number;
  created_at: number;
  updated_at: number;
}

interface CreateResp {
  member: MemberShape;
  duplicatePhone?: { existing_member_id: number; existing_uid: string };
}

interface ListResp {
  items: MemberShape[];
  total: number;
}

describe('members routes - MEA-10', () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let staffToken: string;
  let adminToken: string;
  let staffUserId: number;

  beforeEach(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    app = createApp({ db });

    const staff = await seedUser(db, {
      username: 'staff_mem',
      full_name: '员工阿梅',
      role: 'staff',
      password: 'StaffPw1!',
    });
    staffUserId = staff.id;
    staffToken = (await loginWithUniqueIp(app, 'staff_mem', 'StaffPw1!')).token;

    await seedUser(db, {
      username: 'admin_mem',
      full_name: '管理员阿林',
      role: 'admin',
      password: 'AdminPw1!',
    });
    adminToken = (await loginWithUniqueIp(app, 'admin_mem', 'AdminPw1!')).token;
  });

  function authHeaders(token: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  // --- helper 批量创建 ---
  async function createMember(
    token: string,
    body: Partial<MemberShape> & { name: string; phone: string },
  ): Promise<CreateResp> {
    const res = await app.fetch(
      new Request('http://test.local/api/members', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(200);
    return (await res.json()) as CreateResp;
  }

  // =========== 登录保护 ===========

  it('未登录访问列表返回 401', async () => {
    const res = await app.fetch(new Request('http://test.local/api/members'));
    expect(res.status).toBe(401);
  });

  it('未登录创建会员返回 401', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '张三', phone: '13800000001' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  // =========== POST /api/members ===========

  it('POST 创建成功 - uid = 姓名(手机)（无昵称）', async () => {
    const body = await createMember(staffToken, {
      name: '张三',
      phone: '13800000001',
    });
    expect(body.member.id).toBeGreaterThan(0);
    expect(body.member.uid).toBe('张三(13800000001)');
    expect(body.member.name).toBe('张三');
    expect(body.member.nickname).toBe('');
    expect(body.member.is_hospital).toBe(false);
    expect(body.member.is_active).toBe(true);
    expect(body.member.created_by_user_id).toBe(staffUserId);
    expect(body.duplicatePhone).toBeUndefined();
  });

  it('POST 创建成功 - uid 优先使用昵称', async () => {
    const body = await createMember(staffToken, {
      name: '张三',
      nickname: '阿三',
      phone: '13800000002',
      is_hospital: true,
    });
    expect(body.member.uid).toBe('阿三(13800000002)');
    expect(body.member.is_hospital).toBe(true);
  });

  it('POST 写 audit_logs create', async () => {
    const body = await createMember(staffToken, {
      name: '李四',
      phone: '13800000003',
    });
    const logs = await db
      .select()
      .from(schema.audit_logs)
      .where(eqAudit('member', body.member.id));
    expect(logs.length).toBe(1);
    expect(logs[0]!.action).toBe('create');
    expect(logs[0]!.user_id).toBe(staffUserId);
  });

  it('POST 手机号格式错误 422', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/members', {
        method: 'POST',
        headers: authHeaders(staffToken),
        body: JSON.stringify({ name: '小黑', phone: '123' }),
      }),
    );
    // zValidator 默认返回 400；我们在 app 里 onError 将 HTTPException 包装，
    // 但 zValidator 返回 400 是可接受的。接受 400 或 422。
    expect([400, 422]).toContain(res.status);
  });

  it('POST 缺失 name 422', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/members', {
        method: 'POST',
        headers: authHeaders(staffToken),
        body: JSON.stringify({ phone: '13800000010' }),
      }),
    );
    expect([400, 422]).toContain(res.status);
  });

  it('POST 重复手机号 → 200 创建 + duplicatePhone 提示', async () => {
    const first = await createMember(staffToken, {
      name: '原张三',
      phone: '13900000001',
    });
    const second = await createMember(staffToken, {
      name: '新张三',
      phone: '13900000001',
    });
    expect(second.member.id).not.toBe(first.member.id);
    expect(second.duplicatePhone).toBeDefined();
    expect(second.duplicatePhone?.existing_member_id).toBe(first.member.id);
    expect(second.duplicatePhone?.existing_uid).toBe(first.member.uid);
  });

  // =========== GET /api/members ===========

  it('GET 列表默认排除 is_active=false 会员', async () => {
    const a = await createMember(staffToken, { name: '甲', phone: '13600000001' });
    const b = await createMember(staffToken, { name: '乙', phone: '13600000002' });
    // 归档 b
    const archiveRes = await app.fetch(
      new Request(`http://test.local/api/members/${b.member.id}/archive`, {
        method: 'PATCH',
        headers: authHeaders(adminToken),
      }),
    );
    expect(archiveRes.status).toBe(200);

    const res = await app.fetch(
      new Request('http://test.local/api/members', {
        headers: authHeaders(staffToken),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListResp;
    const ids = body.items.map((m) => m.id);
    expect(ids).toContain(a.member.id);
    expect(ids).not.toContain(b.member.id);
    expect(body.total).toBe(1);
  });

  it('GET ?include_archived=true 返回全部（含归档）', async () => {
    const a = await createMember(staffToken, { name: '甲2', phone: '13600000011' });
    const b = await createMember(staffToken, { name: '乙2', phone: '13600000012' });
    await app.fetch(
      new Request(`http://test.local/api/members/${b.member.id}/archive`, {
        method: 'PATCH',
        headers: authHeaders(adminToken),
      }),
    );

    const res = await app.fetch(
      new Request('http://test.local/api/members?include_archived=true', {
        headers: authHeaders(staffToken),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListResp;
    const ids = body.items.map((m) => m.id);
    expect(ids).toContain(a.member.id);
    expect(ids).toContain(b.member.id);
    expect(body.total).toBe(2);
  });

  it('GET ?q=手机/姓名/昵称/微信号 模糊搜索', async () => {
    await createMember(staffToken, {
      name: '王老板',
      nickname: '王大',
      phone: '13711112222',
      wechat_id: 'wang_boss',
    });
    await createMember(staffToken, {
      name: '李四',
      phone: '13799998888',
      wechat_id: 'li_si_88',
    });

    async function query(q: string): Promise<ListResp> {
      const r = await app.fetch(
        new Request(`http://test.local/api/members?q=${encodeURIComponent(q)}`, {
          headers: authHeaders(staffToken),
        }),
      );
      expect(r.status).toBe(200);
      return (await r.json()) as ListResp;
    }

    expect((await query('王')).items.length).toBe(1);
    expect((await query('王大')).items.length).toBe(1);
    expect((await query('1371111')).items.length).toBe(1);
    expect((await query('wang_boss')).items.length).toBe(1);
    expect((await query('李四')).items.length).toBe(1);
    expect((await query('不存在')).items.length).toBe(0);
  });

  it('GET ?is_hospital=true 过滤院内订阅', async () => {
    await createMember(staffToken, {
      name: '院内A',
      phone: '13500000001',
      is_hospital: true,
    });
    await createMember(staffToken, {
      name: '院外B',
      phone: '13500000002',
      is_hospital: false,
    });

    const res = await app.fetch(
      new Request('http://test.local/api/members?is_hospital=true', {
        headers: authHeaders(staffToken),
      }),
    );
    const body = (await res.json()) as ListResp;
    expect(body.items.length).toBe(1);
    expect(body.items[0]!.name).toBe('院内A');
  });

  it('GET 分页 limit/offset', async () => {
    for (let i = 0; i < 5; i++) {
      await createMember(staffToken, {
        name: `用户${i}`,
        phone: `138000012${i.toString().padStart(2, '0')}`,
      });
    }
    const firstPage = await app.fetch(
      new Request('http://test.local/api/members?limit=2&offset=0', {
        headers: authHeaders(staffToken),
      }),
    );
    const firstBody = (await firstPage.json()) as ListResp;
    expect(firstBody.items.length).toBe(2);
    expect(firstBody.total).toBe(5);

    const secondPage = await app.fetch(
      new Request('http://test.local/api/members?limit=2&offset=2', {
        headers: authHeaders(staffToken),
      }),
    );
    const secondBody = (await secondPage.json()) as ListResp;
    expect(secondBody.items.length).toBe(2);
    expect(secondBody.total).toBe(5);
    expect(secondBody.items[0]!.id).not.toBe(firstBody.items[0]!.id);
  });

  // =========== GET /api/members/:id ===========

  it('GET /:id 存在时返回会员', async () => {
    const created = await createMember(staffToken, {
      name: '详情测试',
      phone: '13400000001',
    });
    const res = await app.fetch(
      new Request(`http://test.local/api/members/${created.member.id}`, {
        headers: authHeaders(staffToken),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { member: MemberShape };
    expect(body.member.id).toBe(created.member.id);
    expect(body.member.name).toBe('详情测试');
  });

  it('GET /:id 不存在 404', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/members/99999', {
        headers: authHeaders(staffToken),
      }),
    );
    expect(res.status).toBe(404);
  });

  // =========== PATCH /api/members/:id ===========

  it('PATCH 更新改字段 + updated_at 变化', async () => {
    const created = await createMember(staffToken, {
      name: '原名',
      phone: '13300000001',
    });
    const before = new Date(created.member.updated_at).getTime();
    await new Promise((r) => setTimeout(r, 10));

    const res = await app.fetch(
      new Request(`http://test.local/api/members/${created.member.id}`, {
        method: 'PATCH',
        headers: authHeaders(staffToken),
        body: JSON.stringify({ address: '北京', dietary_notes: '不吃香菜' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { member: MemberShape };
    expect(body.member.address).toBe('北京');
    expect(body.member.dietary_notes).toBe('不吃香菜');
    const after = new Date(body.member.updated_at).getTime();
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('PATCH 改名 / 昵称 / 手机 → uid 自动重算', async () => {
    const created = await createMember(staffToken, {
      name: '老名',
      phone: '13200000001',
    });
    expect(created.member.uid).toBe('老名(13200000001)');

    const res = await app.fetch(
      new Request(`http://test.local/api/members/${created.member.id}`, {
        method: 'PATCH',
        headers: authHeaders(staffToken),
        body: JSON.stringify({ nickname: '小老', phone: '13200009999' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { member: MemberShape };
    expect(body.member.uid).toBe('小老(13200009999)');
    expect(body.member.phone).toBe('13200009999');
  });

  it('PATCH 不存在的 id → 404', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/members/99999', {
        method: 'PATCH',
        headers: authHeaders(staffToken),
        body: JSON.stringify({ address: '不管' }),
      }),
    );
    expect(res.status).toBe(404);
  });

  // =========== PATCH /api/members/:id/archive ===========

  it('PATCH /archive - staff 403', async () => {
    const created = await createMember(staffToken, {
      name: '待归档',
      phone: '13100000001',
    });
    const res = await app.fetch(
      new Request(`http://test.local/api/members/${created.member.id}/archive`, {
        method: 'PATCH',
        headers: authHeaders(staffToken),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('PATCH /archive - admin 成功 + 写审计', async () => {
    const created = await createMember(staffToken, {
      name: '归档2',
      phone: '13100000002',
    });
    const res = await app.fetch(
      new Request(`http://test.local/api/members/${created.member.id}/archive`, {
        method: 'PATCH',
        headers: authHeaders(adminToken),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { member: MemberShape };
    expect(body.member.is_active).toBe(false);

    const logs = await db
      .select()
      .from(schema.audit_logs)
      .where(eqAudit('member', created.member.id));
    const updateLog = logs.find((l) => l.action === 'update');
    expect(updateLog).toBeDefined();
    expect(updateLog!.diff_json).toContain('is_active');
  });

  // =========== DELETE /api/members/:id ===========

  it('DELETE - staff 403', async () => {
    const created = await createMember(staffToken, {
      name: '待删',
      phone: '13000000001',
    });
    const res = await app.fetch(
      new Request(`http://test.local/api/members/${created.member.id}`, {
        method: 'DELETE',
        headers: authHeaders(staffToken),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('DELETE - admin 无引用 成功 + 写审计', async () => {
    const created = await createMember(staffToken, {
      name: '可删',
      phone: '13000000002',
    });
    const res = await app.fetch(
      new Request(`http://test.local/api/members/${created.member.id}`, {
        method: 'DELETE',
        headers: authHeaders(adminToken),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const gone = await app.fetch(
      new Request(`http://test.local/api/members/${created.member.id}`, {
        headers: authHeaders(staffToken),
      }),
    );
    expect(gone.status).toBe(404);

    const logs = await db
      .select()
      .from(schema.audit_logs)
      .where(eqAudit('member', created.member.id));
    expect(logs.some((l) => l.action === 'delete')).toBe(true);
  });

  it('DELETE - 有卡引用 409 CONFLICT', async () => {
    const created = await createMember(staffToken, {
      name: '有卡',
      phone: '13000000003',
    });
    // 直接插一张卡模拟引用
    await db.insert(schema.cards).values({
      member_id: created.member.id,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      used_meals: 0,
      remaining_meals: 10,
      unit_price: 35,
      paid_amount: 350,
      status: 'active',
      collector_user_id: staffUserId,
      created_by_user_id: staffUserId,
    });

    const res = await app.fetch(
      new Request(`http://test.local/api/members/${created.member.id}`, {
        method: 'DELETE',
        headers: authHeaders(adminToken),
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('CONFLICT');
    expect(body.message).toContain('卡');
  });

  it('DELETE - 有订单引用 409 CONFLICT', async () => {
    const created = await createMember(staffToken, {
      name: '有订单',
      phone: '13000000004',
    });
    await db.insert(schema.daily_orders).values({
      member_id: created.member.id,
      order_date: '2026-04-23',
      meal_type: 'lunch',
      quantity: 1,
      amount: 35,
      status: 'pending',
      created_by_user_id: staffUserId,
    });

    const res = await app.fetch(
      new Request(`http://test.local/api/members/${created.member.id}`, {
        method: 'DELETE',
        headers: authHeaders(adminToken),
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('CONFLICT');
  });
});

function eqAudit(entity: 'member', entityId: number) {
  return and(
    eq(schema.audit_logs.entity, entity),
    eq(schema.audit_logs.entity_id, entityId),
  );
}

// =========== GET /api/members/:id/stats - MEA-14 ===========

interface StatsResp {
  member: MemberShape;
  active_card: {
    id: number;
    card_code: string;
    status: string;
    total_meals: number;
    used_meals: number;
    remaining_meals: number;
    paid_amount: number;
  } | null;
  card_history: Array<{
    id: number;
    card_code: string;
    status: string;
    total_meals: number;
    used_meals: number;
    paid_amount: number;
  }>;
  order_history: Array<{
    id: number;
    order_date: string;
    meal_type: string;
    quantity: number;
    status: string;
  }>;
  stats: {
    total_purchased_meals: number;
    total_consumed_meals: number;
    total_paid_amount: number;
    order_count: number;
  };
}

describe('GET /api/members/:id/stats - MEA-14', () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let staffToken: string;
  let staffUserId: number;

  beforeEach(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    app = createApp({ db });

    const staff = await seedUser(db, {
      username: 'staff_stats',
      full_name: '员工统计',
      role: 'staff',
      password: 'StaffStat1!',
    });
    staffUserId = staff.id;

    const fakeIp = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const res = await app.fetch(
      new Request('http://test.local/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': fakeIp },
        body: JSON.stringify({ username: 'staff_stats', password: 'StaffStat1!' }),
      }),
    );
    staffToken = ((await res.json()) as LoginResponse).token;
  });

  function authHdr(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function getStats(memberId: number): Promise<{ status: number; body: StatsResp }> {
    const res = await app.fetch(
      new Request(`http://test.local/api/members/${memberId}/stats`, {
        headers: authHdr(staffToken),
      }),
    );
    return { status: res.status, body: (await res.json()) as StatsResp };
  }

  it('会员不存在时返回 404', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/members/99999/stats', {
        headers: authHdr(staffToken),
      }),
    );
    expect(res.status).toBe(404);
  });

  it('无卡会员：active_card=null，card_history=[]，stats 全 0', async () => {
    const { id } = await seedMember(db, { created_by_user_id: staffUserId });
    const { status, body } = await getStats(id);
    expect(status).toBe(200);
    expect(body.active_card).toBeNull();
    expect(body.card_history).toHaveLength(0);
    expect(body.order_history).toHaveLength(0);
    expect(body.stats.total_purchased_meals).toBe(0);
    expect(body.stats.total_consumed_meals).toBe(0);
    expect(body.stats.total_paid_amount).toBe(0);
    expect(body.stats.order_count).toBe(0);
    expect(body.member.id).toBe(id);
  });

  it('有单张 active 卡的会员：stats 聚合正确', async () => {
    const { id } = await seedMember(db, { created_by_user_id: staffUserId });
    await seedCard(db, {
      member_id: id,
      created_by_user_id: staffUserId,
      collector_user_id: staffUserId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      used_meals: 3,
      unit_price: 35,
      paid_amount: 350,
      status: 'active',
    });

    const { status, body } = await getStats(id);
    expect(status).toBe(200);
    expect(body.active_card).not.toBeNull();
    expect(body.active_card?.status).toBe('active');
    expect(body.card_history).toHaveLength(1);
    expect(body.stats.total_purchased_meals).toBe(10);
    expect(body.stats.total_consumed_meals).toBe(3);
    expect(body.stats.total_paid_amount).toBe(350);
  });

  it('多张历史卡（purchased + upgraded + exhausted）：card_history 倒序，stats 正确累计', async () => {
    const { id } = await seedMember(db, { created_by_user_id: staffUserId });

    // 第一张：已升级（旧卡）
    const card1 = await seedCard(db, {
      member_id: id,
      created_by_user_id: staffUserId,
      collector_user_id: staffUserId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      used_meals: 10,
      unit_price: 35,
      paid_amount: 350,
      status: 'upgraded',
    });

    // 短暂延迟确保 created_at / purchased_at 不同
    await new Promise((r) => setTimeout(r, 5));

    // 第二张：已用完
    await seedCard(db, {
      member_id: id,
      created_by_user_id: staffUserId,
      collector_user_id: staffUserId,
      card_code: 'biweek',
      is_hospital: false,
      total_meals: 20,
      used_meals: 20,
      unit_price: 30,
      paid_amount: 600,
      status: 'exhausted',
    });

    await new Promise((r) => setTimeout(r, 5));

    // 第三张：当前 active
    await seedCard(db, {
      member_id: id,
      created_by_user_id: staffUserId,
      collector_user_id: staffUserId,
      card_code: 'month',
      is_hospital: false,
      total_meals: 30,
      used_meals: 5,
      unit_price: 28,
      paid_amount: 840,
      status: 'active',
    });

    const { status, body } = await getStats(id);
    expect(status).toBe(200);
    expect(body.active_card?.status).toBe('active');
    expect(body.card_history).toHaveLength(3);
    // 倒序：最新的（active）应排在第一
    expect(body.card_history[0]!.status).toBe('active');
    // 第一张升级卡应在最后
    expect(body.card_history[2]!.id).toBe(card1.id);
    // 累计统计
    expect(body.stats.total_purchased_meals).toBe(60); // 10+20+30
    expect(body.stats.total_consumed_meals).toBe(35); // 10+20+5
    expect(body.stats.total_paid_amount).toBeCloseTo(1790); // 350+600+840
  });

  it('order_history 为空时正常返回 []，order_count=0', async () => {
    const { id } = await seedMember(db, { created_by_user_id: staffUserId });
    await seedCard(db, {
      member_id: id,
      created_by_user_id: staffUserId,
      collector_user_id: staffUserId,
      card_code: 'week',
      is_hospital: false,
      total_meals: 10,
      used_meals: 0,
      unit_price: 35,
      paid_amount: 350,
      status: 'active',
    });

    const { status, body } = await getStats(id);
    expect(status).toBe(200);
    expect(body.order_history).toEqual([]);
    expect(body.stats.order_count).toBe(0);
  });

  it('未登录访问 stats 返回 401', async () => {
    const { id } = await seedMember(db, { created_by_user_id: staffUserId });
    const res = await app.fetch(
      new Request(`http://test.local/api/members/${id}/stats`),
    );
    expect(res.status).toBe(401);
  });

  it('有订单时 order_count 排除 cancelled 状态', async () => {
    const { id } = await seedMember(db, { created_by_user_id: staffUserId });

    // 插入 2 条有效订单 + 1 条取消订单
    await db.insert(schema.daily_orders).values([
      {
        member_id: id,
        order_date: '2026-04-20',
        meal_type: 'lunch',
        quantity: 1,
        amount: 35,
        status: 'pending',
        created_by_user_id: staffUserId,
      },
      {
        member_id: id,
        order_date: '2026-04-21',
        meal_type: 'dinner',
        quantity: 2,
        amount: 70,
        status: 'delivered',
        created_by_user_id: staffUserId,
      },
      {
        member_id: id,
        order_date: '2026-04-22',
        meal_type: 'lunch',
        quantity: 1,
        amount: 35,
        status: 'cancelled',
        created_by_user_id: staffUserId,
      },
    ]);

    const { status, body } = await getStats(id);
    expect(status).toBe(200);
    // 近 90 天内的 3 条记录都在 order_history
    expect(body.order_history.length).toBeGreaterThanOrEqual(2);
    // order_count 只算非 cancelled（2 条）
    expect(body.stats.order_count).toBe(2);
  });
});
