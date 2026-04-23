/**
 * 财务路由（MEA-13）。
 *
 * 职责范围：
 * - GET  /api/finance                  列表 + 汇总（按日期 / 类型 / 分类 / 含冲销过滤）
 * - POST /api/finance/expense          手动录入支出（staff + admin 都可）
 * - PATCH /api/finance/:id             编辑已有条目（含 auto 条目；不改 source）
 * - DELETE /api/finance/:id            软删除（设 voided=true）；仅 admin
 *
 * 不在本 slice 范围：
 * - 购卡 / 升级 / 散餐 / 订阅的 income 自动写入，由 MEA-11 cards slice 直接 insert
 * - 订餐履约产生的 ad_hoc income，同样由 cards/orders slice 负责
 *
 * 所有接口都需要登录（requireAuth）；删除额外需要 admin（requireRole）。
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  expenseCreateSchema,
  financeUpdateSchema,
  zDate,
} from '@meal/shared';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { requireAuth, requireRole, type AuthVariables } from '../middleware/jwt.js';

export const financeRouter = new Hono<{ Variables: AuthVariables }>();

financeRouter.use('*', requireAuth());

/**
 * Zod 校验失败 → 422 UNPROCESSABLE_ENTITY。
 * 用 @hono/zod-validator 的 hook 覆盖默认的 400。
 */
const zHook = (
  result: { success: boolean; error?: z.ZodError },
): Response | void => {
  if (!result.success) {
    throw new HTTPException(422, {
      message: result.error?.issues[0]?.message ?? '请求参数不合法',
    });
  }
};

// ========== GET /api/finance ==========

const listQuerySchema = z.object({
  from: zDate.optional(),
  to: zDate.optional(),
  type: z.enum(['income', 'expense', 'all']).optional().default('all'),
  category: z.string().min(1).optional(),
  include_voided: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .default('false'),
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .default('50')
    .transform((v) => Math.min(200, Math.max(1, Number(v)))),
  offset: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .default('0')
    .transform((v) => Math.max(0, Number(v))),
});

financeRouter.get(
  '/',
  zValidator('query', listQuerySchema, zHook),
  async (c) => {
    const q = c.req.valid('query');
    const db = requestDb(c);

    const conds = [] as ReturnType<typeof eq>[];
    if (q.from) conds.push(gte(schema.finance_entries.entry_date, q.from));
    if (q.to) conds.push(lte(schema.finance_entries.entry_date, q.to));
    if (q.type !== 'all') {
      conds.push(eq(schema.finance_entries.type, q.type));
    }
    if (q.category) {
      conds.push(eq(schema.finance_entries.category, q.category));
    }
    if (q.include_voided !== 'true') {
      conds.push(eq(schema.finance_entries.voided, false));
    }

    const whereExpr = conds.length > 0 ? and(...conds) : undefined;

    const items = await db
      .select()
      .from(schema.finance_entries)
      .where(whereExpr)
      .orderBy(
        desc(schema.finance_entries.entry_date),
        desc(schema.finance_entries.id),
      )
      .limit(q.limit)
      .offset(q.offset);

    const totalRows = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.finance_entries)
      .where(whereExpr);
    const total = Number(totalRows[0]?.n ?? 0);

    // summary 永远排除 voided（汇总只算有效数据），但仍然尊重 from/to/type/category
    const summaryConds = [] as ReturnType<typeof eq>[];
    if (q.from) summaryConds.push(gte(schema.finance_entries.entry_date, q.from));
    if (q.to) summaryConds.push(lte(schema.finance_entries.entry_date, q.to));
    if (q.type !== 'all') {
      summaryConds.push(eq(schema.finance_entries.type, q.type));
    }
    if (q.category) {
      summaryConds.push(eq(schema.finance_entries.category, q.category));
    }
    summaryConds.push(eq(schema.finance_entries.voided, false));

    const summaryRows = await db
      .select({
        type: schema.finance_entries.type,
        category: schema.finance_entries.category,
        total: sql<number>`coalesce(sum(${schema.finance_entries.amount}), 0)`,
      })
      .from(schema.finance_entries)
      .where(and(...summaryConds))
      .groupBy(schema.finance_entries.type, schema.finance_entries.category);

    let income = 0;
    let expense = 0;
    const byCategory: Record<string, number> = {};
    for (const row of summaryRows) {
      const amt = Number(row.total ?? 0);
      if (row.type === 'income') income += amt;
      else if (row.type === 'expense') expense += amt;
      byCategory[row.category] = (byCategory[row.category] ?? 0) + amt;
    }

    return c.json({
      items,
      total,
      summary: {
        income: round2(income),
        expense: round2(expense),
        net: round2(income - expense),
        byCategory: Object.fromEntries(
          Object.entries(byCategory).map(([k, v]) => [k, round2(v)]),
        ),
      },
    });
  },
);

// ========== POST /api/finance/expense ==========

financeRouter.post(
  '/expense',
  zValidator('json', expenseCreateSchema, zHook),
  async (c) => {
    const body = c.req.valid('json');
    const me = c.get('authUser');
    const db = requestDb(c);

    const createdBy = body.created_by_user_id ?? me.id;

    const rows = await db
      .insert(schema.finance_entries)
      .values({
        entry_date: body.entry_date,
        type: 'expense',
        category: 'manual_expense',
        amount: body.amount,
        description: body.description,
        source: 'manual',
        voided: false,
        created_by_user_id: createdBy,
      })
      .returning();

    const entry = rows[0]!;

    await db.insert(schema.audit_logs).values({
      user_id: me.id,
      action: 'create',
      entity: 'finance_entry',
      entity_id: entry.id,
      diff_json: JSON.stringify({
        after: {
          type: entry.type,
          category: entry.category,
          amount: entry.amount,
          entry_date: entry.entry_date,
        },
      }),
    });

    return c.json({ entry });
  },
);

// ========== PATCH /api/finance/:id ==========

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform((v) => Number(v)),
});

financeRouter.patch(
  '/:id',
  zValidator('param', idParamSchema, zHook),
  zValidator('json', financeUpdateSchema, zHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const me = c.get('authUser');
    const db = requestDb(c);

    const existing = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.id, id))
      .limit(1);
    const current = existing[0];
    if (!current) {
      throw new HTTPException(404, { message: '条目不存在' });
    }

    const patch: Partial<schema.NewFinanceEntry> = {};
    if (body.entry_date !== undefined) patch.entry_date = body.entry_date;
    if (body.amount !== undefined) patch.amount = body.amount;
    if (body.description !== undefined) patch.description = body.description;
    if (body.category !== undefined) patch.category = body.category;

    if (Object.keys(patch).length === 0) {
      return c.json({ entry: current });
    }

    patch.updated_at = new Date();

    const updated = await db
      .update(schema.finance_entries)
      .set(patch)
      .where(eq(schema.finance_entries.id, id))
      .returning();

    const entry = updated[0]!;

    const diffPayload: Record<string, unknown> = {
      before: {
        entry_date: current.entry_date,
        amount: current.amount,
        description: current.description,
        category: current.category,
      },
      after: {
        entry_date: entry.entry_date,
        amount: entry.amount,
        description: entry.description,
        category: entry.category,
      },
      source_was: current.source,
    };
    if (current.source === 'auto') {
      diffPayload._note = 'auto entry modified by staff';
    }

    await db.insert(schema.audit_logs).values({
      user_id: me.id,
      action: 'update',
      entity: 'finance_entry',
      entity_id: entry.id,
      diff_json: JSON.stringify(diffPayload),
    });

    return c.json({ entry });
  },
);

// ========== DELETE /api/finance/:id ==========

financeRouter.delete(
  '/:id',
  requireRole('admin'),
  zValidator('param', idParamSchema, zHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const me = c.get('authUser');
    const db = requestDb(c);

    const existing = await db
      .select()
      .from(schema.finance_entries)
      .where(eq(schema.finance_entries.id, id))
      .limit(1);
    const current = existing[0];
    if (!current) {
      throw new HTTPException(404, { message: '条目不存在' });
    }

    if (current.voided) {
      return c.json({ entry: current });
    }

    const updated = await db
      .update(schema.finance_entries)
      .set({ voided: true, updated_at: new Date() })
      .where(eq(schema.finance_entries.id, id))
      .returning();

    const entry = updated[0]!;

    await db.insert(schema.audit_logs).values({
      user_id: me.id,
      action: 'cancel',
      entity: 'finance_entry',
      entity_id: entry.id,
      diff_json: JSON.stringify({
        before: { voided: false },
        after: { voided: true },
      }),
    });

    return c.json({ entry });
  },
);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
