/**
 * 用户路由。
 *
 * - GET    /api/users                    所有 active 用户 {id, username, full_name, role, is_active, avatar_url}
 * - GET    /api/users/:id                单个用户信息（不含密码）
 * - GET    /api/users/:id/orders         该用户录入的订单列表（按 created_at 倒序）
 * - GET    /api/users/:id/order-summary  该用户录入的订单聚合统计
 * - POST   /api/users/staff               新建账号（一般管理员仅员工；超管可 role=admin）
 * - PATCH  /api/users/:id/access         角色 / 在职 / 数据写权限（角色仅超管可改）
 * - PATCH  /api/users/:id/password       管理员重置指定用户密码（一般管理员仅限员工；本人 / 超管除外）
 * - DELETE /api/users/:id               停用账号（超级管理员任意；一般管理员仅限员工）
 * - PATCH  /api/users/me/avatar          当前登录用户头像上传（data URL）
 * - DELETE /api/users/me/avatar           清空当前用户头像
 *
 * 读接口任何登录用户都能用（卡/订单要把 *_user_id 映射成姓名 + 头像）。
 * 权限：超级管理员 user @rNLKJA（不区分大小写）；可分配管理员、管理全员。一般管理员仅能管理员工账号与写权限。
 * 写账号/权限/头像/密码等操作会写入 audit_logs（entity=user）。
 */

import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { and, desc, eq, gte, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { userAvatarUpdateSchema } from '@meal/shared';
import { schema, type Db } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { hydrateOrderProofs } from '../services/order-proof-hydrate.js';
import { hashPassword } from '../services/password.js';
import {
  DEFAULT_DATA_OPERATORS,
  isSuperAdminUsername,
  isDataOperatorEnforced,
  requireAuth,
  requireRole,
  resolveEffectiveRole,
  userHasEffectiveDataWrite,
  type AuthVariables,
} from '../middleware/jwt.js';

export const usersRouter = new Hono<{ Variables: AuthVariables }>();

usersRouter.use('*', requireAuth());

function parseOperatorUsernames(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function readDataOperatorUsernames(c: Context<{ Variables: AuthVariables }>): Promise<string[]> {
  const db = requestDb(c);
  const rows = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, 'data_operator_usernames'))
    .limit(1);
  const raw = rows[0]?.value?.trim() ?? '';
  if (!raw) return DEFAULT_DATA_OPERATORS();
  return parseOperatorUsernames(raw);
}

async function writeDataOperatorUsernames(c: Context<{ Variables: AuthVariables }>, usernames: string[]) {
  const db = requestDb(c);
  const value = usernames.join(',');
  await db
    .insert(schema.settings)
    .values({
      key: 'data_operator_usernames',
      value,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: {
        value,
        updated_at: new Date(),
      },
    });
}

async function insertUserAudit(
  db: Db,
  opts: {
    actorUserId: number;
    action: 'create' | 'update' | 'delete';
    targetUserId: number;
    diff: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(schema.audit_logs).values({
    user_id: opts.actorUserId,
    action: opts.action,
    entity: 'user',
    entity_id: opts.targetUserId,
    diff_json: JSON.stringify(opts.diff),
  });
}

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

  return c.json({
    users: rows.map((u) => ({
      ...u,
      role: resolveEffectiveRole(u.username, u.role),
      is_superadmin: isSuperAdminUsername(u.username),
    })),
  });
});

const updateUserAccessSchema = z
  .object({
    role: z.enum(['admin', 'staff']).optional(),
    is_active: z.boolean().optional(),
    can_data_write: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.is_active !== undefined || d.can_data_write !== undefined, {
    message: '至少传一个字段',
  });
const accessIdSchema = z.object({
  id: z.string().regex(/^\d+$/, 'id 必须是整数').transform((v) => parseInt(v, 10)),
});
const updatePasswordSchema = z.object({
  password: z.string().min(8, '密码至少 8 位').max(64, '密码不能超过 64 位'),
});
const createStaffSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '用户名至少 3 位')
    .max(64, '用户名不能超过 64 位')
    .regex(/^[a-zA-Z0-9._-]+$/, '用户名仅支持字母、数字、点、下划线与连字符'),
  full_name: z.string().trim().min(1, '姓名不能为空').max(64, '姓名不能超过 64 位'),
  password: z.string().min(8, '密码至少 8 位').max(64, '密码不能超过 64 位'),
  is_active: z.boolean().optional().default(true),
  can_data_write: z.boolean().optional().default(false),
  role: z.enum(['admin', 'staff']).optional(),
});

usersRouter.get('/permissions/data-operators', requireRole('admin'), async (c) => {
  const db = requestDb(c);
  const users = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      full_name: schema.users.full_name,
      role: schema.users.role,
      is_active: schema.users.is_active,
    })
    .from(schema.users)
    .orderBy(schema.users.id);
  const operators = await readDataOperatorUsernames(c);
  const enforced = isDataOperatorEnforced();
  return c.json({
    enforcement: enforced,
    operators,
    users: users.map((u) => ({
      ...u,
      role: resolveEffectiveRole(u.username, u.role),
      is_superadmin: isSuperAdminUsername(u.username),
      can_data_write: userHasEffectiveDataWrite({
        username: u.username,
        isSuperadmin: isSuperAdminUsername(u.username),
        operatorsLower: operators,
        enforcement: enforced,
      }),
    })),
  });
});

usersRouter.post(
  '/staff',
  requireRole('admin'),
  zValidator('json', createStaffSchema),
  async (c) => {
    const actor = c.get('authUser');
    const db = requestDb(c);
    const input = c.req.valid('json');
    const passwordHash = await hashPassword(input.password);
    const username = input.username.trim();
    const fullName = input.full_name.trim();

    let newRole: 'admin' | 'staff' = 'staff';
    if (input.role === 'admin') {
      if (!actor.is_superadmin) {
        throw new HTTPException(403, { message: '仅超级管理员可创建管理员账号' });
      }
      newRole = 'admin';
    } else if (input.role === 'staff') {
      newRole = 'staff';
    }

    let createdId: number;
    try {
      const created = await db
        .insert(schema.users)
        .values({
          username,
          full_name: fullName,
          password_hash: passwordHash,
          role: newRole,
          is_active: input.is_active,
        })
        .returning({
          id: schema.users.id,
        });
      createdId = created[0]!.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('users.username')) {
        throw new HTTPException(409, { message: '用户名已存在' });
      }
      throw err;
    }

    const effectiveWrite = !!input.can_data_write;
    if (effectiveWrite) {
      const operators = new Set(await readDataOperatorUsernames(c));
      operators.add(username.toLowerCase());
      await writeDataOperatorUsernames(c, Array.from(operators));
    }

    const rows = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        full_name: schema.users.full_name,
        role: schema.users.role,
        is_active: schema.users.is_active,
      })
      .from(schema.users)
      .where(eq(schema.users.id, createdId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new HTTPException(500, { message: '创建员工后读取失败' });

    const ops = await readDataOperatorUsernames(c);
    const enforced = isDataOperatorEnforced();
    const canWrite = userHasEffectiveDataWrite({
      username: row.username,
      isSuperadmin: isSuperAdminUsername(row.username),
      operatorsLower: ops,
      enforcement: enforced,
    });

    await insertUserAudit(db, {
      actorUserId: actor.id,
      action: 'create',
      targetUserId: createdId,
      diff: {
        username,
        full_name: fullName,
        role: newRole,
        is_active: input.is_active,
        can_data_write: canWrite,
      },
    });

    return c.json({
      user: {
        ...row,
        role: resolveEffectiveRole(row.username, row.role),
        is_superadmin: isSuperAdminUsername(row.username),
        can_data_write: canWrite,
      },
    });
  },
);

usersRouter.patch(
  '/:id/access',
  requireRole('admin'),
  zValidator('param', accessIdSchema),
  zValidator('json', updateUserAccessSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const db = requestDb(c);

    const targetRows = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role,
        is_active: schema.users.is_active,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    const target = targetRows[0];
    if (!target) throw new HTTPException(404, { message: '用户不存在' });
    const actor = c.get('authUser');

    const beforeOperators = await readDataOperatorUsernames(c);
    const enforced = isDataOperatorEnforced();
    const beforeCanWrite = userHasEffectiveDataWrite({
      username: target.username,
      isSuperadmin: isSuperAdminUsername(target.username),
      operatorsLower: beforeOperators,
      enforcement: enforced,
    });

    const patch: { role?: 'admin' | 'staff'; is_active?: boolean } = {};
    if (input.role !== undefined) {
      if (!actor.is_superadmin) {
        throw new HTTPException(403, { message: '仅超级管理员可分配或撤销管理员角色' });
      }
      if (input.role === 'staff' && isSuperAdminUsername(target.username)) {
        throw new HTTPException(422, { message: 'rNLKJA 不能降级为员工' });
      }
      patch.role = input.role;
    }
    if (input.is_active !== undefined) {
      if (input.is_active === false) {
        if (actor.id === id) {
          throw new HTTPException(422, { message: '不能停用自己的账号' });
        }
        if (isSuperAdminUsername(target.username) && !actor.is_superadmin) {
          throw new HTTPException(403, { message: '仅超级管理员可停用该账号' });
        }
        if (!actor.is_superadmin && target.role === 'admin') {
          throw new HTTPException(403, { message: '仅超级管理员可停用管理员账号' });
        }
      } else {
        if (isSuperAdminUsername(target.username) && !actor.is_superadmin) {
          throw new HTTPException(403, { message: '仅超级管理员可启用该账号' });
        }
        if (!actor.is_superadmin && target.role === 'admin') {
          throw new HTTPException(403, { message: '仅超级管理员可启用管理员账号' });
        }
      }
      patch.is_active = input.is_active;
    }
    if (Object.keys(patch).length > 0) {
      await db.update(schema.users).set(patch).where(eq(schema.users.id, id));
    }

    if (input.can_data_write !== undefined) {
      if (!actor.is_superadmin && target.role !== 'staff') {
        throw new HTTPException(403, {
          message: '仅超级管理员可调整其他管理员的写权限；你可修改员工的读写（写操作）权限',
        });
      }
      if (!actor.is_superadmin && isSuperAdminUsername(target.username)) {
        throw new HTTPException(403, { message: '无权限修改该账号写权限' });
      }
      const operators = new Set(await readDataOperatorUsernames(c));
      const uname = target.username.toLowerCase();
      if (input.can_data_write) operators.add(uname);
      else operators.delete(uname);
      await writeDataOperatorUsernames(c, Array.from(operators));
    }

    const users = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        full_name: schema.users.full_name,
        role: schema.users.role,
        is_active: schema.users.is_active,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    const user = users[0]!;
    const operators = await readDataOperatorUsernames(c);
    const effectiveRole = resolveEffectiveRole(user.username, user.role);
    const afterCanWrite = userHasEffectiveDataWrite({
      username: user.username,
      isSuperadmin: isSuperAdminUsername(user.username),
      operatorsLower: operators,
      enforcement: enforced,
    });

    const diff: Record<string, unknown> = {};
    if (user.role !== target.role) diff.role = [target.role, user.role];
    if (user.is_active !== target.is_active) diff.is_active = [target.is_active, user.is_active];
    if (beforeCanWrite !== afterCanWrite) diff.can_data_write = [beforeCanWrite, afterCanWrite];

    if (Object.keys(diff).length > 0) {
      await insertUserAudit(db, {
        actorUserId: actor.id,
        action: 'update',
        targetUserId: id,
        diff,
      });
    }

    return c.json({
      user: {
        ...user,
        role: effectiveRole,
        is_superadmin: isSuperAdminUsername(user.username),
        can_data_write: afterCanWrite,
      },
      operators,
    });
  },
);

usersRouter.patch(
  '/:id/password',
  requireRole('admin'),
  zValidator('param', accessIdSchema),
  zValidator('json', updatePasswordSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { password } = c.req.valid('json');
    const db = requestDb(c);

    const targetRows = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        full_name: schema.users.full_name,
        role: schema.users.role,
        token_version: schema.users.token_version,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    const target = targetRows[0];
    if (!target) throw new HTTPException(404, { message: '用户不存在' });
    const actor = c.get('authUser');
    if (actor.id !== target.id) {
      if (!actor.is_superadmin && (target.role === 'admin' || isSuperAdminUsername(target.username))) {
        throw new HTTPException(403, { message: '仅超级管理员可重置该账号密码' });
      }
    }

    const passwordHash = await hashPassword(password);
    await db
      .update(schema.users)
      .set({
        password_hash: passwordHash,
        token_version: target.token_version + 1,
      })
      .where(eq(schema.users.id, id));

    await insertUserAudit(db, {
      actorUserId: actor.id,
      action: 'update',
      targetUserId: id,
      diff: {
        password_reset: true,
        target_username: target.username,
        self_service: actor.id === target.id,
      },
    });

    return c.json({
      ok: true,
      user: {
        id: target.id,
        username: target.username,
        full_name: target.full_name,
      },
    });
  },
);

usersRouter.delete(
  '/:id',
  requireRole('admin'),
  zValidator('param', accessIdSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const actor = c.get('authUser');
    const db = requestDb(c);

    if (actor.id === id) {
      throw new HTTPException(422, { message: '不能删除自己的账号' });
    }

    const targetRows = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        role: schema.users.role,
        token_version: schema.users.token_version,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    const target = targetRows[0];
    if (!target) throw new HTTPException(404, { message: '用户不存在' });

    if (!actor.is_superadmin) {
      if (isSuperAdminUsername(target.username)) {
        throw new HTTPException(403, { message: '无权限删除该账号' });
      }
      if (target.role === 'admin') {
        throw new HTTPException(403, { message: '仅超级管理员可删除（停用）管理员账号' });
      }
    }

    await db
      .update(schema.users)
      .set({
        is_active: false,
        token_version: target.token_version + 1,
      })
      .where(eq(schema.users.id, id));

    await insertUserAudit(db, {
      actorUserId: actor.id,
      action: 'update',
      targetUserId: id,
      diff: {
        is_active: [true, false],
        account_deactivated: true,
        target_username: target.username,
      },
    });

    return c.json({ ok: true as const });
  },
);

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

    if (updated[0]) {
      await insertUserAudit(db, {
        actorUserId: authUser.id,
        action: 'update',
        targetUserId: authUser.id,
        diff: { avatar: 'uploaded', data_url_length: avatar.length },
      });
    }

    return c.json({
      user: updated[0]
        ? {
            ...updated[0],
            role: resolveEffectiveRole(updated[0].username, updated[0].role),
            is_superadmin: isSuperAdminUsername(updated[0].username),
          }
        : undefined,
    });
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

  if (updated[0]) {
    await insertUserAudit(db, {
      actorUserId: authUser.id,
      action: 'update',
      targetUserId: authUser.id,
      diff: { avatar: 'cleared' },
    });
  }

  return c.json({
    user: updated[0]
      ? {
          ...updated[0],
          role: resolveEffectiveRole(updated[0].username, updated[0].role),
          is_superadmin: isSuperAdminUsername(updated[0].username),
        }
      : undefined,
  });
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
  return c.json({
    user: {
      ...rows[0],
      role: resolveEffectiveRole(rows[0].username, rows[0].role),
      is_superadmin: isSuperAdminUsername(rows[0].username),
    },
  });
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

    const actorCondByStatus = (
      targetStatus: 'all' | 'pending' | 'fulfilled' | 'delivered' | 'cancelled',
    ): SQL => {
      if (targetStatus === 'pending') {
        return and(
          eq(schema.daily_orders.status, 'pending'),
          eq(schema.daily_orders.created_by_user_id, id),
        ) as SQL;
      }
      if (targetStatus === 'fulfilled') {
        return and(
          eq(schema.daily_orders.status, 'fulfilled'),
          eq(schema.daily_orders.fulfilled_by_user_id, id),
        ) as SQL;
      }
      if (targetStatus === 'delivered') {
        return and(
          eq(schema.daily_orders.status, 'delivered'),
          eq(schema.daily_orders.delivered_by_user_id, id),
        ) as SQL;
      }
      if (targetStatus === 'cancelled') {
        return and(
          eq(schema.daily_orders.status, 'cancelled'),
          eq(schema.daily_orders.cancelled_by_user_id, id),
        ) as SQL;
      }
      return or(
        and(eq(schema.daily_orders.status, 'pending'), eq(schema.daily_orders.created_by_user_id, id)),
        and(
          eq(schema.daily_orders.status, 'fulfilled'),
          eq(schema.daily_orders.fulfilled_by_user_id, id),
        ),
        and(
          eq(schema.daily_orders.status, 'delivered'),
          eq(schema.daily_orders.delivered_by_user_id, id),
        ),
        and(
          eq(schema.daily_orders.status, 'cancelled'),
          eq(schema.daily_orders.cancelled_by_user_id, id),
        ),
      ) as SQL;
    };
    const conds: SQL[] = [actorCondByStatus(status)];
    if (from) conds.push(gte(schema.daily_orders.order_date, from));
    if (to) conds.push(lte(schema.daily_orders.order_date, to));

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

    const ordersOnly = rows.map((r) => r.order);
    const hydrated = await hydrateOrderProofs(db, ordersOnly);
    return c.json({
      orders: rows.map((r, i) => ({ ...r, order: hydrated[i]! })),
    });
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
        pending_count: sql<number>`sum(case when ${schema.daily_orders.status} = 'pending' and ${schema.daily_orders.created_by_user_id} = ${id} then 1 else 0 end)`,
        fulfilled_count: sql<number>`sum(case when ${schema.daily_orders.status} = 'fulfilled' and ${schema.daily_orders.fulfilled_by_user_id} = ${id} then 1 else 0 end)`,
        delivered_count: sql<number>`sum(case when ${schema.daily_orders.status} = 'delivered' and ${schema.daily_orders.delivered_by_user_id} = ${id} then 1 else 0 end)`,
        cancelled_count: sql<number>`sum(case when ${schema.daily_orders.status} = 'cancelled' and ${schema.daily_orders.cancelled_by_user_id} = ${id} then 1 else 0 end)`,
      })
      .from(schema.daily_orders)
      .where(
        or(
          and(
            eq(schema.daily_orders.status, 'pending'),
            eq(schema.daily_orders.created_by_user_id, id),
          ),
          and(
            eq(schema.daily_orders.status, 'fulfilled'),
            eq(schema.daily_orders.fulfilled_by_user_id, id),
          ),
          and(
            eq(schema.daily_orders.status, 'delivered'),
            eq(schema.daily_orders.delivered_by_user_id, id),
          ),
          and(
            eq(schema.daily_orders.status, 'cancelled'),
            eq(schema.daily_orders.cancelled_by_user_id, id),
          ),
        ),
      );

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
