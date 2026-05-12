/**
 * 财务路由测试（MEA-13）。
 *
 * 覆盖：
 * - 登录保护（所有接口）
 * - GET /api/finance 列表 + summary 聚合
 * - GET 按 from/to/type/category/include_voided 过滤
 * - POST /api/finance/expense 手动支出（amount > 0 校验）
 * - PATCH /api/finance/:id 更新（审计写入）
 * - DELETE /api/finance/:id 软删除（仅 admin）
 *
 * 注意：本 slice 只负责「查询 + 编辑 + 手动支出 + 软删除」。
 * 自动入账（购卡、升级、散餐、订阅）由 MEA-11 cards/orders slice 负责。
 * 测试里直接 insert 一些 source='auto' 的条目来验证查询和编辑行为。
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { createApp } from '../app.js';
import { setupTestDb, seedUser } from '../test-helpers.js';
import * as schema from '../db/schema.js';
import type { LoginResponse } from '@meal/shared';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * 每次登录都给一个独立的 x-forwarded-for，绕开 auth 模块的内存限流（它的 bucket 在模块作用域内，跨测试共享）。
 */
let loginSeq = 0;
async function loginWithUniqueIp(
  app: ReturnType<typeof createApp>,
  username: string,
  password: string,
): Promise<LoginResponse> {
  loginSeq += 1;
  const ip = `10.${(loginSeq >> 16) & 255}.${(loginSeq >> 8) & 255}.${loginSeq & 255}`;
  const res = await app.fetch(
    new Request('http://test.local/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ username, password }),
    }),
  );
  if (!res.ok) {
    throw new Error(`login failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as LoginResponse;
}

/** 直接插一条 finance_entry，模拟 cards/orders slice 的自动入账。 */
async function seedEntry(
  db: TestDb,
  values: Partial<schema.NewFinanceEntry> & {
    created_by_user_id: number;
    entry_date: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
  },
): Promise<schema.FinanceEntry> {
  const rows = await db
    .insert(schema.finance_entries)
    .values(values)
    .returning();
  return rows[0]!;
}

describe('财务接口 /api/finance', () => {
  let db: TestDb;
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let staffToken: string;
  let adminId: number;
  let staffId: number;

  beforeEach(async () => {
    const res = await setupTestDb();
    db = res.db;
    app = createApp({ db });

    const admin = await seedUser(db, {
      username: 'fin_admin',
      full_name: '财务管理员',
      role: 'admin',
      password: 'AdminPw1!',
    });
    const staff = await seedUser(db, {
      username: 'fin_staff',
      full_name: '财务员工',
      role: 'staff',
      password: 'StaffPw1!',
    });
    adminId = admin.id;
    staffId = staff.id;
    adminToken = (await loginWithUniqueIp(app, 'fin_admin', 'AdminPw1!')).token;
    staffToken = (await loginWithUniqueIp(app, 'fin_staff', 'StaffPw1!')).token;
  });

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  // ========== 登录保护 ==========

  it('未登录 GET 列表 401', async () => {
    const res = await app.fetch(new Request('http://test.local/api/finance'));
    expect(res.status).toBe(401);
  });

  it('未登录 POST 手动支出 401', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/finance/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: '2026-04-23',
          amount: 50,
          description: '买菜',
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  // ========== GET 列表 ==========

  it('默认排除 voided 条目', async () => {
    await seedEntry(db, {
      entry_date: '2026-04-10',
      type: 'income',
      amount: 100,
      category: 'hospital_sub',
      created_by_user_id: adminId,
      source: 'auto',
    });
    await seedEntry(db, {
      entry_date: '2026-04-11',
      type: 'income',
      amount: 200,
      category: 'regular_sub',
      created_by_user_id: adminId,
      source: 'auto',
      voided: true,
    });

    const res = await app.fetch(
      new Request('http://test.local/api/finance', {
        headers: authHeader(adminToken),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: schema.FinanceEntry[];
      total: number;
      summary: { income: number; expense: number; net: number };
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.voided).toBe(false);
    expect(body.total).toBe(1);
    expect(body.summary.income).toBe(100);
    expect(body.summary.expense).toBe(0);
    expect(body.summary.net).toBe(100);
  });

  it('include_voided=true 会把冲销条目也返回', async () => {
    await seedEntry(db, {
      entry_date: '2026-04-10',
      type: 'income',
      amount: 100,
      category: 'hospital_sub',
      created_by_user_id: adminId,
    });
    await seedEntry(db, {
      entry_date: '2026-04-11',
      type: 'income',
      amount: 200,
      category: 'regular_sub',
      created_by_user_id: adminId,
      voided: true,
    });

    const res = await app.fetch(
      new Request('http://test.local/api/finance?include_voided=true', {
        headers: authHeader(adminToken),
      }),
    );
    const body = (await res.json()) as {
      items: schema.FinanceEntry[];
      summary: { income: number };
    };
    expect(body.items).toHaveLength(2);
    // summary 仍然排除 voided（汇总只算有效数据）
    expect(body.summary.income).toBe(100);
  });

  it('按 from/to 日期区间过滤', async () => {
    await seedEntry(db, {
      entry_date: '2026-03-31',
      type: 'income',
      amount: 10,
      category: 'hospital_sub',
      created_by_user_id: adminId,
    });
    await seedEntry(db, {
      entry_date: '2026-04-01',
      type: 'income',
      amount: 20,
      category: 'hospital_sub',
      created_by_user_id: adminId,
    });
    await seedEntry(db, {
      entry_date: '2026-04-30',
      type: 'income',
      amount: 30,
      category: 'hospital_sub',
      created_by_user_id: adminId,
    });
    await seedEntry(db, {
      entry_date: '2026-05-01',
      type: 'income',
      amount: 40,
      category: 'hospital_sub',
      created_by_user_id: adminId,
    });

    const res = await app.fetch(
      new Request('http://test.local/api/finance?from=2026-04-01&to=2026-04-30', {
        headers: authHeader(adminToken),
      }),
    );
    const body = (await res.json()) as {
      items: schema.FinanceEntry[];
      summary: { income: number };
    };
    expect(body.items).toHaveLength(2);
    expect(body.summary.income).toBe(50);
  });

  it('按 type 过滤（只看 expense）', async () => {
    await seedEntry(db, {
      entry_date: '2026-04-10',
      type: 'income',
      amount: 100,
      category: 'hospital_sub',
      created_by_user_id: adminId,
    });
    await seedEntry(db, {
      entry_date: '2026-04-11',
      type: 'expense',
      amount: 30,
      category: 'manual_expense',
      created_by_user_id: adminId,
    });

    const res = await app.fetch(
      new Request('http://test.local/api/finance?type=expense', {
        headers: authHeader(adminToken),
      }),
    );
    const body = (await res.json()) as {
      items: schema.FinanceEntry[];
      summary: { expense: number; income: number };
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.type).toBe('expense');
    expect(body.summary.expense).toBe(30);
    expect(body.summary.income).toBe(0);
  });

  it('按 category 过滤', async () => {
    await seedEntry(db, {
      entry_date: '2026-04-10',
      type: 'income',
      amount: 100,
      category: 'hospital_sub',
      created_by_user_id: adminId,
    });
    await seedEntry(db, {
      entry_date: '2026-04-11',
      type: 'income',
      amount: 200,
      category: 'regular_sub',
      created_by_user_id: adminId,
    });

    const res = await app.fetch(
      new Request('http://test.local/api/finance?category=regular_sub', {
        headers: authHeader(adminToken),
      }),
    );
    const body = (await res.json()) as {
      items: schema.FinanceEntry[];
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.category).toBe('regular_sub');
  });

  it('summary 按分类聚合正确', async () => {
    await seedEntry(db, {
      entry_date: '2026-04-10',
      type: 'income',
      amount: 100,
      category: 'hospital_sub',
      created_by_user_id: adminId,
    });
    await seedEntry(db, {
      entry_date: '2026-04-11',
      type: 'income',
      amount: 50,
      category: 'hospital_sub',
      created_by_user_id: adminId,
    });
    await seedEntry(db, {
      entry_date: '2026-04-12',
      type: 'income',
      amount: 200,
      category: 'regular_sub',
      created_by_user_id: adminId,
    });
    await seedEntry(db, {
      entry_date: '2026-04-13',
      type: 'expense',
      amount: 30,
      category: 'manual_expense',
      created_by_user_id: adminId,
    });

    const res = await app.fetch(
      new Request('http://test.local/api/finance', {
        headers: authHeader(adminToken),
      }),
    );
    const body = (await res.json()) as {
      summary: {
        income: number;
        expense: number;
        net: number;
        prepaid_income: number;
        realized_income: number;
        realized_net: number;
        realized_by_channel: { hospital: number; regular: number; walkin: number };
        byCategory: Record<string, number>;
      };
    };
    expect(body.summary.income).toBe(350);
    expect(body.summary.expense).toBe(30);
    expect(body.summary.net).toBe(320);
    expect(body.summary.prepaid_income).toBe(350);
    expect(body.summary.realized_income).toBe(0);
    expect(body.summary.realized_net).toBe(-30);
    expect(body.summary.realized_by_channel.hospital).toBe(0);
    expect(body.summary.realized_by_channel.regular).toBe(0);
    expect(body.summary.realized_by_channel.walkin).toBe(0);
    expect(body.summary.byCategory.hospital_sub).toBe(150);
    expect(body.summary.byCategory.regular_sub).toBe(200);
    expect(body.summary.byCategory.manual_expense).toBe(30);
  });

  it('列表按日期倒序 + 支持分页 limit/offset', async () => {
    for (const d of ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04']) {
      await seedEntry(db, {
        entry_date: d,
        type: 'income',
        amount: 10,
        category: 'hospital_sub',
        created_by_user_id: adminId,
      });
    }

    const res = await app.fetch(
      new Request('http://test.local/api/finance?limit=2&offset=0', {
        headers: authHeader(adminToken),
      }),
    );
    const body = (await res.json()) as {
      items: schema.FinanceEntry[];
      total: number;
    };
    expect(body.total).toBe(4);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]!.entry_date).toBe('2026-04-04');
    expect(body.items[1]!.entry_date).toBe('2026-04-03');
  });

  // ========== POST 手动支出 ==========

  it('POST expense 成功创建条目', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/finance/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(staffToken) },
        body: JSON.stringify({
          entry_date: '2026-04-23',
          amount: 45.5,
          description: '买一次性餐盒',
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: schema.FinanceEntry };
    expect(body.entry.type).toBe('expense');
    expect(body.entry.category).toBe('manual_expense');
    expect(body.entry.source).toBe('manual');
    expect(body.entry.amount).toBe(45.5);
    expect(body.entry.description).toBe('买一次性餐盒');
    expect(body.entry.created_by_user_id).toBe(staffId);
    expect(body.entry.voided).toBe(false);
  });

  it('POST expense expense_kind=salary → salary_expense', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/finance/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(staffToken) },
        body: JSON.stringify({
          entry_date: '2026-04-23',
          amount: 8000,
          description: '厨房组 4 月工资',
          expense_kind: 'salary',
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: schema.FinanceEntry };
    expect(body.entry.category).toBe('salary_expense');
  });

  it('POST expense amount <= 0 返回 422', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/finance/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(staffToken) },
        body: JSON.stringify({
          entry_date: '2026-04-23',
          amount: 0,
          description: '零元购',
        }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST expense 缺少 description 返回 422', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/finance/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(staffToken) },
        body: JSON.stringify({ entry_date: '2026-04-23', amount: 10 }),
      }),
    );
    expect(res.status).toBe(422);
  });

  // ========== PATCH 更新 ==========

  it('PATCH 更新 amount + description 并写入 audit_log', async () => {
    const entry = await seedEntry(db, {
      entry_date: '2026-04-10',
      type: 'income',
      amount: 100,
      category: 'hospital_sub',
      created_by_user_id: adminId,
      source: 'auto',
    });

    const res = await app.fetch(
      new Request(`http://test.local/api/finance/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(adminToken) },
        body: JSON.stringify({ amount: 120, description: '修正金额' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: schema.FinanceEntry };
    expect(body.entry.amount).toBe(120);
    expect(body.entry.description).toBe('修正金额');
    // source 保持不变（不升级）
    expect(body.entry.source).toBe('auto');

    const audits = await db
      .select()
      .from(schema.audit_logs)
      .where(eq(schema.audit_logs.entity_id, entry.id));
    expect(audits.length).toBeGreaterThanOrEqual(1);
    const a = audits.find((x) => x.action === 'update');
    expect(a).toBeDefined();
    expect(a!.entity).toBe('finance_entry');
    expect(a!.user_id).toBe(adminId);
  });

  it('PATCH 不存在的 id 返回 404', async () => {
    const res = await app.fetch(
      new Request('http://test.local/api/finance/9999', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(adminToken) },
        body: JSON.stringify({ amount: 1 }),
      }),
    );
    expect(res.status).toBe(404);
  });

  // ========== DELETE 软删 ==========

  it('DELETE 仅 admin 能调用；staff 返回 403', async () => {
    const entry = await seedEntry(db, {
      entry_date: '2026-04-10',
      type: 'expense',
      amount: 30,
      category: 'manual_expense',
      created_by_user_id: staffId,
    });
    const res = await app.fetch(
      new Request(`http://test.local/api/finance/${entry.id}`, {
        method: 'DELETE',
        headers: authHeader(staffToken),
      }),
    );
    expect(res.status).toBe(403);

    // 确认没被软删
    const rows = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.id, entry.id));
    expect(rows[0]!.voided).toBe(false);
  });

  it('DELETE admin 调用 -> 设 voided=true（软删），写 audit_log(cancel)', async () => {
    const entry = await seedEntry(db, {
      entry_date: '2026-04-10',
      type: 'income',
      amount: 100,
      category: 'hospital_sub',
      created_by_user_id: adminId,
      source: 'auto',
    });
    const res = await app.fetch(
      new Request(`http://test.local/api/finance/${entry.id}`, {
        method: 'DELETE',
        headers: authHeader(adminToken),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: schema.FinanceEntry };
    expect(body.entry.voided).toBe(true);

    // 实际条目仍然存在，只是 voided=true
    const rows = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.id, entry.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.voided).toBe(true);

    // audit 写入
    const audits = await db
      .select()
      .from(schema.audit_logs)
      .where(eq(schema.audit_logs.entity_id, entry.id));
    const cancelAudit = audits.find((a) => a.action === 'cancel');
    expect(cancelAudit).toBeDefined();
    expect(cancelAudit!.entity).toBe('finance_entry');
    expect(cancelAudit!.user_id).toBe(adminId);
  });

  it('PATCH source=auto 的条目 → diff_json 含 _note', async () => {
    const entry = await seedEntry(db, {
      entry_date: '2026-04-10',
      type: 'income',
      amount: 280,
      category: 'regular_sub',
      created_by_user_id: adminId,
      source: 'auto',
    });

    const res = await app.fetch(
      new Request(`http://test.local/api/finance/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(adminToken) },
        body: JSON.stringify({ description: '修正描述' }),
      }),
    );
    expect(res.status).toBe(200);

    const audits = await db
      .select()
      .from(schema.audit_logs)
      .where(eq(schema.audit_logs.entity_id, entry.id));
    const updateAudit = audits.find((a) => a.action === 'update');
    expect(updateAudit).toBeDefined();
    const diff = JSON.parse(updateAudit!.diff_json) as Record<string, unknown>;
    expect(diff).toHaveProperty('_note', 'auto entry modified by staff');
  });

  it('DELETE 已经 voided 的条目幂等返回 200', async () => {
    const entry = await seedEntry(db, {
      entry_date: '2026-04-10',
      type: 'expense',
      amount: 5,
      category: 'manual_expense',
      created_by_user_id: adminId,
      voided: true,
    });
    const res = await app.fetch(
      new Request(`http://test.local/api/finance/${entry.id}`, {
        method: 'DELETE',
        headers: authHeader(adminToken),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: schema.FinanceEntry };
    expect(body.entry.voided).toBe(true);
  });

  it('POST retail-product-sale 写入 misc_retail + collector + 数量', async () => {
    const [product] = await db
      .insert(schema.retail_products)
      .values({
        name: '馒头',
        detail: '非包子',
        is_active: true,
        sort_order: 1,
        created_by_user_id: staffId,
      })
      .returning();
    expect(product).toBeDefined();

    const res = await app.fetch(
      new Request('http://test.local/api/finance/retail-product-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(staffToken) },
        body: JSON.stringify({
          entry_date: '2026-05-08',
          product_id: product!.id,
          quantity: 3,
          amount: 12.5,
          collector_user_id: adminId,
          note: '单元测',
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: schema.FinanceEntry };
    expect(body.entry.category).toBe('misc_retail_income');
    expect(body.entry.amount).toBe(12.5);
    expect(body.entry.collector_user_id).toBe(adminId);
    expect(body.entry.retail_product_id).toBe(product!.id);
    expect(body.entry.quantity).toBe(3);
    expect(body.entry.description).toContain('馒头');
    expect(body.entry.description).toContain('收款人：财务管理员');
  });

  it('GET /api/finance/retail-products 与独立路径等价', async () => {
    await db.insert(schema.retail_products).values({
      name: '包子',
      detail: '',
      is_active: true,
      sort_order: 1,
      created_by_user_id: staffId,
    });

    const res = await app.fetch(
      new Request('http://test.local/api/finance/retail-products', {
        headers: authHeader(staffToken),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { products: { name: string }[] };
    expect(body.products.some((p) => p.name === '包子')).toBe(true);
  });
});
