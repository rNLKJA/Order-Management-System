/**
 * 审计日志路由测试（MEA-17）。
 *
 * 覆盖：
 * - GET /api/audit-logs  仅 admin 可访问
 * - 按 entity / entity_id 过滤
 * - limit 参数
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { drizzle } from 'drizzle-orm/libsql';
import { createApp } from '../app.js';
import { setupTestDb, seedUser } from '../test-helpers.js';
import * as schema from '../db/schema.js';
import { signToken } from '../services/jwt.js';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

interface Ctx {
  db: TestDb;
  app: ReturnType<typeof createApp>;
  adminToken: string;
  staffToken: string;
  adminId: number;
  staffId: number;
}

async function buildCtx(): Promise<Ctx> {
  const { db } = await setupTestDb();
  const app = createApp({ db });

  const admin = await seedUser(db, {
    username: 'audit_admin',
    full_name: '审计管理员',
    role: 'admin',
    password: 'AdminPw!1',
  });
  const staff = await seedUser(db, {
    username: 'audit_staff',
    full_name: '审计员工',
    role: 'staff',
    password: 'StaffPw!1',
  });

  const adminToken = await signToken({ user_id: admin.id, role: 'admin', token_version: 1 });
  const staffToken = await signToken({ user_id: staff.id, role: 'staff', token_version: 1 });

  return { db, app, adminToken, staffToken, adminId: admin.id, staffId: staff.id };
}

async function seedAuditLog(
  db: TestDb,
  values: {
    user_id: number;
    action: 'create' | 'update' | 'delete' | 'fulfill' | 'deliver' | 'cancel';
    entity: 'member' | 'card' | 'daily_order' | 'finance_entry' | 'user';
    entity_id: number;
    diff_json?: string;
  },
): Promise<schema.AuditLog> {
  const rows = await db
    .insert(schema.audit_logs)
    .values({ ...values, diff_json: values.diff_json ?? '{}' })
    .returning();
  return rows[0]!;
}

describe('GET /api/audit-logs', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await buildCtx();
  });

  it('未登录 401', async () => {
    const res = await ctx.app.fetch(new Request('http://test.local/api/audit-logs'));
    expect(res.status).toBe(401);
  });

  it('staff 尝试访问 → 403', async () => {
    const res = await ctx.app.fetch(
      new Request('http://test.local/api/audit-logs', {
        headers: { Authorization: `Bearer ${ctx.staffToken}` },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('admin 访问 → 200，返回 logs 数组', async () => {
    await seedAuditLog(ctx.db, {
      user_id: ctx.adminId,
      action: 'create',
      entity: 'card',
      entity_id: 1,
      diff_json: JSON.stringify({ notes: ['', '测试'] }),
    });

    const res = await ctx.app.fetch(
      new Request('http://test.local/api/audit-logs', {
        headers: { Authorization: `Bearer ${ctx.adminToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { logs: schema.AuditLog[] };
    expect(Array.isArray(body.logs)).toBe(true);
    expect(body.logs.length).toBeGreaterThanOrEqual(1);
  });

  it('按 entity=card 过滤', async () => {
    await seedAuditLog(ctx.db, {
      user_id: ctx.adminId,
      action: 'update',
      entity: 'card',
      entity_id: 10,
    });
    await seedAuditLog(ctx.db, {
      user_id: ctx.adminId,
      action: 'create',
      entity: 'member',
      entity_id: 5,
    });

    const res = await ctx.app.fetch(
      new Request('http://test.local/api/audit-logs?entity=card', {
        headers: { Authorization: `Bearer ${ctx.adminToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { logs: schema.AuditLog[] };
    expect(body.logs.every((l) => l.entity === 'card')).toBe(true);
    expect(body.logs.length).toBeGreaterThanOrEqual(1);
  });

  it('按 entity=card&entity_id=10 过滤', async () => {
    await seedAuditLog(ctx.db, {
      user_id: ctx.adminId,
      action: 'update',
      entity: 'card',
      entity_id: 10,
    });
    await seedAuditLog(ctx.db, {
      user_id: ctx.adminId,
      action: 'update',
      entity: 'card',
      entity_id: 20,
    });

    const res = await ctx.app.fetch(
      new Request('http://test.local/api/audit-logs?entity=card&entity_id=10', {
        headers: { Authorization: `Bearer ${ctx.adminToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { logs: schema.AuditLog[] };
    expect(body.logs).toHaveLength(1);
    expect(body.logs[0]!.entity_id).toBe(10);
  });

  it('limit 参数限制返回数量', async () => {
    for (let i = 1; i <= 5; i++) {
      await seedAuditLog(ctx.db, {
        user_id: ctx.adminId,
        action: 'update',
        entity: 'member',
        entity_id: i,
      });
    }

    const res = await ctx.app.fetch(
      new Request('http://test.local/api/audit-logs?limit=3', {
        headers: { Authorization: `Bearer ${ctx.adminToken}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { logs: schema.AuditLog[] };
    expect(body.logs).toHaveLength(3);
  });

  it('结果按 created_at 倒序排列', async () => {
    await seedAuditLog(ctx.db, {
      user_id: ctx.adminId,
      action: 'create',
      entity: 'card',
      entity_id: 1,
    });
    await seedAuditLog(ctx.db, {
      user_id: ctx.adminId,
      action: 'update',
      entity: 'card',
      entity_id: 2,
    });

    const res = await ctx.app.fetch(
      new Request('http://test.local/api/audit-logs?entity=card', {
        headers: { Authorization: `Bearer ${ctx.adminToken}` },
      }),
    );
    const body = (await res.json()) as { logs: schema.AuditLog[] };
    expect(body.logs.length).toBeGreaterThanOrEqual(2);
    // 最新插入的（entity_id=2）应该在前
    const ids = body.logs.map((l) => l.id);
    expect(ids[0]).toBeGreaterThan(ids[1]!);
  });
});
