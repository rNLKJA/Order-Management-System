/**
 * 会员路由 - MEA-10。
 *
 * 全部接口需要登录（requireAuth）：
 * - GET    /api/members                列表 + 搜索 + 分页
 * - GET    /api/members/:id            详情
 * - POST   /api/members                新建（重复手机号不硬阻，返回 duplicatePhone 提示）
 * - PATCH  /api/members/:id            更新（改名/昵称/手机 → uid 自动重算）
 * - PATCH  /api/members/:id/archive    软删除（仅 admin）
 * - DELETE /api/members/:id            硬删除（仅 admin，有引用 409）
 *
 * 约束：
 * - 每次写操作写 audit_logs，entity='member'
 * - 列表默认排除 is_active=false；?include_archived=true 时返回全部
 * - 搜索字段：uid / name / nickname / phone / wechat_id（LIKE %q%）
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { memberCreateSchema, memberUpdateSchema, buildUid } from '@meal/shared';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { requireAuth, requireRole, type AuthVariables } from '../middleware/jwt.js';
import {
  countMemberReferences,
  findDuplicatePhone,
  recomputeUid,
} from '../services/members.js';

export const membersRouter = new Hono<{ Variables: AuthVariables }>();

// 全部接口需要登录
membersRouter.use('*', requireAuth());

const listQuerySchema = z.object({
  q: z.string().optional(),
  is_hospital: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  is_active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  include_archived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v === undefined ? 50 : Number(v);
      return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 500) : 50;
    }),
  offset: z
    .string()
    .optional()
    .transform((v) => {
      const n = v === undefined ? 0 : Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    }),
});

// =========== 列表 ===========

membersRouter.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { q, is_hospital, is_active, include_archived, limit, offset } =
    c.req.valid('query');
  const db = requestDb(c);

  const conds: SQL[] = [];

  // 活跃筛选：显式传 is_active 覆盖 include_archived；
  // 否则默认只返回 is_active=true，除非 include_archived=true
  if (is_active !== undefined) {
    conds.push(eq(schema.members.is_active, is_active));
  } else if (!include_archived) {
    conds.push(eq(schema.members.is_active, true));
  }

  if (is_hospital !== undefined) {
    conds.push(eq(schema.members.is_hospital, is_hospital));
  }

  if (q && q.trim().length > 0) {
    const pattern = `%${q.trim()}%`;
    const search = or(
      like(schema.members.uid, pattern),
      like(schema.members.name, pattern),
      like(schema.members.nickname, pattern),
      like(schema.members.phone, pattern),
      like(schema.members.wechat_id, pattern),
    );
    if (search) conds.push(search);
  }

  const where = conds.length > 0 ? and(...conds) : undefined;

  const [totalRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.members)
    .where(where);
  const total = Number(totalRow?.c ?? 0);

  const items = await db
    .select()
    .from(schema.members)
    .where(where)
    .orderBy(desc(schema.members.created_at), desc(schema.members.id))
    .limit(limit)
    .offset(offset);

  return c.json({ items, total });
});

// =========== 详情 ===========

membersRouter.get('/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'));
  const db = requestDb(c);
  const rows = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.id, id))
    .limit(1);
  const member = rows[0];
  if (!member) {
    throw new HTTPException(404, { message: '会员不存在' });
  }
  return c.json({ member });
});

// =========== 新建 ===========

membersRouter.post('/', zValidator('json', memberCreateSchema), async (c) => {
  const input = c.req.valid('json');
  const db = requestDb(c);
  const user = c.get('authUser');

  const duplicatePhone = await findDuplicatePhone(db, input.phone);

  const uid = buildUid(input.nickname ?? '', input.name, input.phone);

  const inserted = await db
    .insert(schema.members)
    .values({
      uid,
      name: input.name,
      nickname: input.nickname ?? '',
      phone: input.phone,
      wechat_id: input.wechat_id ?? '',
      address: input.address ?? '',
      dietary_notes: input.dietary_notes ?? '',
      is_hospital: input.is_hospital ?? false,
      is_active: true,
      created_by_user_id: user.id,
    })
    .returning();
  const member = inserted[0]!;

  await db.insert(schema.audit_logs).values({
    user_id: user.id,
    action: 'create',
    entity: 'member',
    entity_id: member.id,
    diff_json: JSON.stringify({ created: { uid: member.uid, phone: member.phone } }),
  });

  if (duplicatePhone) {
    return c.json({ member, duplicatePhone });
  }
  return c.json({ member });
});

// =========== 更新 ===========

membersRouter.patch(
  '/:id{[0-9]+}',
  zValidator('json', memberUpdateSchema),
  async (c) => {
    const id = Number(c.req.param('id'));
    const input = c.req.valid('json');
    const db = requestDb(c);
    const user = c.get('authUser');

    const existingRows = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, id))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) {
      throw new HTTPException(404, { message: '会员不存在' });
    }

    const nextName = input.name ?? existing.name;
    const nextNickname = input.nickname ?? existing.nickname;
    const nextPhone = input.phone ?? existing.phone;
    const needsUidRecompute =
      input.name !== undefined ||
      input.nickname !== undefined ||
      input.phone !== undefined;

    const updates: Partial<typeof schema.members.$inferInsert> = {
      updated_at: new Date(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.nickname !== undefined) updates.nickname = input.nickname;
    if (input.phone !== undefined) updates.phone = input.phone;
    if (input.wechat_id !== undefined) updates.wechat_id = input.wechat_id;
    if (input.address !== undefined) updates.address = input.address;
    if (input.dietary_notes !== undefined) updates.dietary_notes = input.dietary_notes;
    if (input.is_hospital !== undefined) updates.is_hospital = input.is_hospital;
    if (needsUidRecompute) {
      updates.uid = recomputeUid({
        name: nextName,
        nickname: nextNickname,
        phone: nextPhone,
      });
    }

    const diff: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (k === 'updated_at') continue;
      const old = (existing as Record<string, unknown>)[k];
      if (old !== v) diff[k] = [old, v];
    }

    const rows = await db
      .update(schema.members)
      .set(updates)
      .where(eq(schema.members.id, id))
      .returning();
    const member = rows[0]!;

    if (Object.keys(diff).length > 0) {
      await db.insert(schema.audit_logs).values({
        user_id: user.id,
        action: 'update',
        entity: 'member',
        entity_id: id,
        diff_json: JSON.stringify(diff),
      });
    }

    return c.json({ member });
  },
);

// =========== 归档（软删除，仅 admin） ===========

membersRouter.patch(
  '/:id{[0-9]+}/archive',
  requireRole('admin'),
  async (c) => {
    const id = Number(c.req.param('id'));
    const db = requestDb(c);
    const user = c.get('authUser');

    const existingRows = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, id))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) {
      throw new HTTPException(404, { message: '会员不存在' });
    }
    if (!existing.is_active) {
      // 已经归档就幂等返回
      return c.json({ member: existing });
    }

    const rows = await db
      .update(schema.members)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(schema.members.id, id))
      .returning();
    const member = rows[0]!;

    await db.insert(schema.audit_logs).values({
      user_id: user.id,
      action: 'update',
      entity: 'member',
      entity_id: id,
      diff_json: JSON.stringify({ is_active: [true, false] }),
    });

    return c.json({ member });
  },
);

// =========== 硬删除（仅 admin，无引用才允许） ===========

membersRouter.delete(
  '/:id{[0-9]+}',
  requireRole('admin'),
  async (c) => {
    const id = Number(c.req.param('id'));
    const db = requestDb(c);
    const user = c.get('authUser');

    const existingRows = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, id))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) {
      throw new HTTPException(404, { message: '会员不存在' });
    }

    const refs = await countMemberReferences(db, id);
    if (refs.cards > 0) {
      throw new HTTPException(409, {
        message: `会员有 ${refs.cards} 条卡记录，不能删除，改用归档`,
      });
    }
    if (refs.orders > 0) {
      throw new HTTPException(409, {
        message: `会员有 ${refs.orders} 条订单记录，不能删除，改用归档`,
      });
    }

    await db.insert(schema.audit_logs).values({
      user_id: user.id,
      action: 'delete',
      entity: 'member',
      entity_id: id,
      diff_json: JSON.stringify({ deleted: { uid: existing.uid, phone: existing.phone } }),
    });

    await db.delete(schema.members).where(eq(schema.members.id, id));

    return c.json({ success: true });
  },
);
