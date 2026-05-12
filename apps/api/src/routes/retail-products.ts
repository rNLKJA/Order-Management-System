/**
 * 其他零售商品目录（不绑定会员；销售入账走 POST /api/finance/retail-product-sale）。
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { retailProductCreateSchema, retailProductPatchSchema } from '@meal/shared';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { requireAuth, requireDataOperator, type AuthVariables } from '../middleware/jwt.js';

export const retailProductsRouter = new Hono<{ Variables: AuthVariables }>();

retailProductsRouter.use('*', requireAuth());
retailProductsRouter.use('*', requireDataOperator());

const zHook = (
  result: { success: boolean; error?: z.ZodError },
): Response | void => {
  if (!result.success) {
    throw new HTTPException(422, {
      message: result.error?.issues[0]?.message ?? '请求参数不合法',
    });
  }
};

const listQuerySchema = z.object({
  include_inactive: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .default('false'),
});

retailProductsRouter.get(
  '/',
  zValidator('query', listQuerySchema, zHook),
  async (c) => {
    const q = c.req.valid('query');
    const db = requestDb(c);
    const includeInactive = q.include_inactive === 'true';

    const rows = await db
      .select()
      .from(schema.retail_products)
      .where(includeInactive ? undefined : eq(schema.retail_products.is_active, true))
      .orderBy(asc(schema.retail_products.sort_order), desc(schema.retail_products.id));

    return c.json({ products: rows });
  },
);

retailProductsRouter.post(
  '/',
  zValidator('json', retailProductCreateSchema, zHook),
  async (c) => {
    const body = c.req.valid('json');
    const me = c.get('authUser');
    const db = requestDb(c);

    const maxRow = await db
      .select({ m: sql<number>`coalesce(max(${schema.retail_products.sort_order}), 0)` })
      .from(schema.retail_products);
    const nextSort = Number(maxRow[0]?.m ?? 0) + 1;

    const rows = await db
      .insert(schema.retail_products)
      .values({
        name: body.name.trim(),
        detail: (body.detail ?? '').trim(),
        is_active: true,
        sort_order: nextSort,
        created_by_user_id: me.id,
      })
      .returning();
    const product = rows[0]!;
    return c.json({ product });
  },
);

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform((v) => Number(v)),
});

retailProductsRouter.patch(
  '/:id',
  zValidator('param', idParamSchema, zHook),
  zValidator('json', retailProductPatchSchema, zHook),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const db = requestDb(c);

    const existing = await db
      .select()
      .from(schema.retail_products)
      .where(eq(schema.retail_products.id, id))
      .limit(1);
    const cur = existing[0];
    if (!cur) {
      throw new HTTPException(404, { message: '商品不存在' });
    }

    const patch: Partial<typeof schema.retail_products.$inferInsert> = {
      updated_at: new Date(),
    };
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.detail !== undefined) patch.detail = body.detail.trim();
    if (body.is_active !== undefined) patch.is_active = body.is_active;

    const rows = await db
      .update(schema.retail_products)
      .set(patch)
      .where(eq(schema.retail_products.id, id))
      .returning();
    const product = rows[0]!;

    return c.json({ product });
  },
);
