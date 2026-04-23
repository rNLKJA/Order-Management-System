/**
 * 卡路由（MEA-11）。
 *
 * - GET    /api/cards?member_id=&status=active|upgraded|exhausted|all
 * - POST   /api/cards                        新购（会员无 active 卡）
 * - POST   /api/cards/:id/upgrade            升级（禁降级，补差价）
 *
 * 所有端点都需要登录（会员卡数据属 PII）。
 * 业务规则详见 plan §5 / §6 与 doc/PROCESS.md §4。
 *
 * 关于"耗尽后换卡"：没有独立端点 —— 旧卡 exhausted 时直接走 POST /api/cards
 * 即可（校验只看是否有 active 卡，不看历史 exhausted 记录）。
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import {
  cardPurchaseSchema,
  cardRenewSchema,
  cardUpgradeSchema,
  getCardSpec,
  type SubscriptionCardCode,
} from '@meal/shared';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { requireAuth, type AuthVariables } from '../middleware/jwt.js';
import { computeUpgrade, UpgradeError } from '../services/upgrade.js';
import { computeRenew, RenewError } from '../services/renew.js';
import { createAutoSubscriptionIncome } from '../services/finance.js';

export const cardsRouter = new Hono<{ Variables: AuthVariables }>();

cardsRouter.use('*', requireAuth());

// ================== GET /api/cards ==================

const listQuerySchema = z.object({
  member_id: z
    .string()
    .regex(/^\d+$/, 'member_id 必须是整数')
    .transform((v) => parseInt(v, 10)),
  status: z.enum(['active', 'upgraded', 'exhausted', 'all']).optional().default('all'),
});

cardsRouter.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { member_id, status } = c.req.valid('query');
  const db = requestDb(c);

  const where =
    status === 'all'
      ? eq(schema.cards.member_id, member_id)
      : and(eq(schema.cards.member_id, member_id), eq(schema.cards.status, status));

  const rows = await db
    .select()
    .from(schema.cards)
    .where(where)
    .orderBy(desc(schema.cards.purchased_at), desc(schema.cards.id));

  return c.json({ cards: rows });
});

// ================== POST /api/cards (新购) ==================

cardsRouter.post('/', zValidator('json', cardPurchaseSchema), async (c) => {
  const input = c.req.valid('json');
  const authUser = c.get('authUser');
  const db = requestDb(c);

  const spec = getCardSpec(input.is_hospital, input.card_code as SubscriptionCardCode);
  if (!spec) {
    throw new HTTPException(400, {
      message: `卡种 ${input.card_code} 不在${input.is_hospital ? '院内' : '院外'}价目表中`,
    });
  }

  const memberRows = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.id, input.member_id))
    .limit(1);
  const member = memberRows[0];
  if (!member) {
    throw new HTTPException(404, { message: '会员不存在' });
  }
  if (!member.is_active) {
    throw new HTTPException(422, { message: '会员已归档，不能购卡' });
  }

  const existingActive = await db
    .select({ id: schema.cards.id })
    .from(schema.cards)
    .where(
      and(eq(schema.cards.member_id, input.member_id), eq(schema.cards.status, 'active')),
    )
    .limit(1);
  if (existingActive.length > 0) {
    throw new HTTPException(409, {
      message: '该会员已有在用卡，请走升级或等旧卡餐数用尽后换卡',
    });
  }

  const collectorUserId = await resolveCollectorUserId(db, input.collector_user_id, authUser.id);
  const createdByUserId = input.created_by_user_id ?? authUser.id;
  const purchasedAt = input.purchased_at ? new Date(input.purchased_at) : new Date();

  const result = await db.transaction(async (tx) => {
    const cardRows = await tx
      .insert(schema.cards)
      .values({
        member_id: input.member_id,
        card_code: input.card_code,
        is_hospital: input.is_hospital,
        total_meals: spec.meals,
        used_meals: 0,
        remaining_meals: spec.meals,
        unit_price: spec.unitPrice,
        paid_amount: spec.totalPrice,
        status: 'active',
        collector_user_id: collectorUserId,
        created_by_user_id: createdByUserId,
        purchased_at: purchasedAt,
        notes: input.notes ?? '',
      })
      .returning();
    const card = cardRows[0]!;

    const finance = await createAutoSubscriptionIncome(tx, {
      amount: spec.totalPrice,
      is_hospital: input.is_hospital,
      ref_card_id: card.id,
      collector_user_id: collectorUserId,
      created_by_user_id: createdByUserId,
      purchased_at: purchasedAt,
      description: `购卡：${spec.name}`,
    });

    return { card, finance };
  });

  return c.json({ card: result.card, financeEntry: result.finance }, 201);
});

// ================== POST /api/cards/:id/upgrade ==================

const paramSchema = z.object({
  id: z.string().regex(/^\d+$/, 'id 必须是整数').transform((v) => parseInt(v, 10)),
});

cardsRouter.post(
  '/:id/upgrade',
  zValidator('param', paramSchema),
  zValidator('json', cardUpgradeSchema),
  async (c) => {
    const { id: oldCardId } = c.req.valid('param');
    const input = c.req.valid('json');
    const authUser = c.get('authUser');
    const db = requestDb(c);

    const oldRows = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, oldCardId))
      .limit(1);
    const oldCard = oldRows[0];
    if (!oldCard) {
      throw new HTTPException(404, { message: '待升级的卡不存在' });
    }
    if (oldCard.status !== 'active') {
      throw new HTTPException(422, {
        message: `仅 active 状态的卡可升级，当前状态：${oldCard.status}`,
      });
    }

    // 升级默认沿用旧卡的 is_hospital；body 里传了就覆盖（但一般保持一致）。
    const isHospital = input.is_hospital ?? oldCard.is_hospital;
    const newSpec = getCardSpec(isHospital, input.card_code as SubscriptionCardCode);
    if (!newSpec) {
      throw new HTTPException(400, {
        message: `卡种 ${input.card_code} 不在${isHospital ? '院内' : '院外'}价目表中`,
      });
    }

    let computed;
    try {
      computed = computeUpgrade({
        oldPaidAmount: oldCard.paid_amount,
        oldUsedMeals: oldCard.used_meals,
        newCat: newSpec,
      });
    } catch (e) {
      if (e instanceof UpgradeError) {
        // UPGRADE_NOT_ALLOWED / INVALID_UPGRADE_MEALS 都走 422，code 区分由 JSON body 给出
        return c.json({ code: e.code, message: e.message }, 422);
      }
      throw e;
    }

    const collectorUserId = await resolveCollectorUserId(db, input.collector_user_id, authUser.id);
    const createdByUserId = input.created_by_user_id ?? authUser.id;
    const purchasedAt = new Date();

    const result = await db.transaction(async (tx) => {
      const newRows = await tx
        .insert(schema.cards)
        .values({
          member_id: oldCard.member_id,
          card_code: input.card_code,
          is_hospital: isHospital,
          total_meals: computed.newTotalMeals,
          used_meals: computed.newUsedMeals,
          remaining_meals: computed.newRemainingMeals,
          unit_price: computed.newUnitPrice,
          paid_amount: computed.newPaidAmount,
          status: 'active',
          upgraded_from_id: oldCard.id,
          collector_user_id: collectorUserId,
          created_by_user_id: createdByUserId,
          purchased_at: purchasedAt,
          notes: input.notes ?? '',
        })
        .returning();
      const newCard = newRows[0]!;

      await tx
        .update(schema.cards)
        .set({ status: 'upgraded', updated_at: new Date() })
        .where(eq(schema.cards.id, oldCard.id));

      const finance = await createAutoSubscriptionIncome(tx, {
        amount: computed.diff,
        is_hospital: isHospital,
        ref_card_id: newCard.id,
        collector_user_id: collectorUserId,
        created_by_user_id: createdByUserId,
        purchased_at: purchasedAt,
        description: `升级补差：${newSpec.name}（原 ¥${oldCard.paid_amount}）`,
      });

      const refreshedOld = await tx
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, oldCard.id))
        .limit(1);

      return { newCard, oldCard: refreshedOld[0]!, finance };
    });

    return c.json(
      {
        old_card: result.oldCard,
        new_card: result.newCard,
        financeEntry: result.finance,
        diff: computed.diff,
      },
      201,
    );
  },
);

// ================== POST /api/cards/:id/renew ==================

/**
 * 续卡：同卡种、同价目表再买一张，剩餐结转到新卡，按新卡全价收款。
 * 前提：旧卡 active 且 remaining_meals ≤ CARD_RENEWAL_THRESHOLD_MEALS（防滥用）。
 * 旧卡 status → 'upgraded'，新卡 upgraded_from_id 指向旧卡；
 * 通过 new.card_code === old.card_code 可与真正升级区分。
 */
cardsRouter.post(
  '/:id/renew',
  zValidator('param', paramSchema),
  zValidator('json', cardRenewSchema),
  async (c) => {
    const { id: oldCardId } = c.req.valid('param');
    const input = c.req.valid('json');
    const authUser = c.get('authUser');
    const db = requestDb(c);

    const oldRows = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, oldCardId))
      .limit(1);
    const oldCard = oldRows[0];
    if (!oldCard) {
      throw new HTTPException(404, { message: '待续的卡不存在' });
    }

    const spec = getCardSpec(oldCard.is_hospital, oldCard.card_code as SubscriptionCardCode);
    if (!spec) {
      // 理论上进不来：卡种被下架才会触发
      throw new HTTPException(422, {
        message: `当前卡种 ${oldCard.card_code} 已不在${oldCard.is_hospital ? '院内' : '院外'}价目表，无法续卡`,
      });
    }

    let computed;
    try {
      computed = computeRenew({
        oldStatus: oldCard.status,
        oldRemainingMeals: oldCard.remaining_meals,
        spec,
      });
    } catch (e) {
      if (e instanceof RenewError) {
        return c.json({ code: e.code, message: e.message }, 422);
      }
      throw e;
    }

    const collectorUserId = await resolveCollectorUserId(db, input.collector_user_id, authUser.id);
    const createdByUserId = input.created_by_user_id ?? authUser.id;
    const purchasedAt = new Date();

    const result = await db.transaction(async (tx) => {
      const newRows = await tx
        .insert(schema.cards)
        .values({
          member_id: oldCard.member_id,
          card_code: oldCard.card_code,
          is_hospital: oldCard.is_hospital,
          total_meals: computed.newTotalMeals,
          used_meals: computed.newUsedMeals,
          remaining_meals: computed.newRemainingMeals,
          unit_price: computed.newUnitPrice,
          paid_amount: computed.newPaidAmount,
          status: 'active',
          upgraded_from_id: oldCard.id,
          collector_user_id: collectorUserId,
          created_by_user_id: createdByUserId,
          purchased_at: purchasedAt,
          notes: input.notes ?? '',
        })
        .returning();
      const newCard = newRows[0]!;

      await tx
        .update(schema.cards)
        .set({ status: 'upgraded', updated_at: new Date() })
        .where(eq(schema.cards.id, oldCard.id));

      const finance = await createAutoSubscriptionIncome(tx, {
        amount: computed.newPaidAmount,
        is_hospital: oldCard.is_hospital,
        ref_card_id: newCard.id,
        collector_user_id: collectorUserId,
        created_by_user_id: createdByUserId,
        purchased_at: purchasedAt,
        description: `续卡：${spec.name}（结转 ${computed.carriedMeals} 份）`,
      });

      const refreshedOld = await tx
        .select()
        .from(schema.cards)
        .where(eq(schema.cards.id, oldCard.id))
        .limit(1);

      return { newCard, oldCard: refreshedOld[0]!, finance };
    });

    return c.json(
      {
        old_card: result.oldCard,
        new_card: result.newCard,
        financeEntry: result.finance,
        carried_meals: computed.carriedMeals,
        paid_amount: computed.newPaidAmount,
      },
      201,
    );
  },
);

// ================== PATCH /api/cards/:id ==================

/**
 * 允许 staff/admin 修改：notes / collector_user_id / created_by_user_id / purchased_at。
 * 禁止通过此接口修改：card_code / total_meals / used_meals / remaining_meals / paid_amount / status。
 * 使用 .strict() 拒绝任何未列出的字段，Zod 校验失败 → 422。
 */
const cardPatchSchema = z
  .object({
    notes: z.string().max(512).optional(),
    collector_user_id: z.number().int().positive().optional(),
    created_by_user_id: z.number().int().positive().optional(),
    purchased_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

const zPatchHook = (
  result: { success: boolean; error?: z.ZodError },
): Response | void => {
  if (!result.success) {
    throw new HTTPException(422, {
      message: result.error?.issues[0]?.message ?? '请求参数不合法（含不允许修改的字段）',
    });
  }
};

cardsRouter.patch(
  '/:id',
  zValidator('param', paramSchema),
  zValidator('json', cardPatchSchema, zPatchHook),
  async (c) => {
    const { id: cardId } = c.req.valid('param');
    const body = c.req.valid('json');
    const authUser = c.get('authUser');
    const db = requestDb(c);

    const cardRows = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, cardId))
      .limit(1);
    const card = cardRows[0];
    if (!card) {
      throw new HTTPException(404, { message: '卡不存在' });
    }

    const patch: Partial<typeof schema.cards.$inferInsert> = {};
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.collector_user_id !== undefined) patch.collector_user_id = body.collector_user_id;
    if (body.created_by_user_id !== undefined) patch.created_by_user_id = body.created_by_user_id;

    if (body.purchased_at !== undefined) {
      const newDate = new Date(body.purchased_at);
      // 将新 purchased_at 转换为 YYYY-MM-DD（UTC），与 order_date text 比较
      const newDateStr = newDate.toISOString().slice(0, 10);

      // 校验该卡下所有 daily_orders.order_date >= 新 purchased_at 日期
      const conflictingOrders = await db
        .select({ id: schema.daily_orders.id })
        .from(schema.daily_orders)
        .where(
          and(
            eq(schema.daily_orders.card_id, cardId),
            lt(schema.daily_orders.order_date, newDateStr),
          ),
        )
        .limit(1);

      if (conflictingOrders.length > 0) {
        return c.json(
          { code: 'PURCHASED_AT_CONFLICT', message: '新购卡时间早于该卡下已有订单日期，冲突' },
          422,
        );
      }

      patch.purchased_at = newDate;
    }

    if (Object.keys(patch).length === 0) {
      return c.json({ card });
    }

    patch.updated_at = new Date();

    const diff: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'updated_at') continue;
      const old = (card as Record<string, unknown>)[k];
      if (old !== v) diff[k] = [old, v];
    }

    const updated = await db
      .update(schema.cards)
      .set(patch)
      .where(eq(schema.cards.id, cardId))
      .returning();
    const updatedCard = updated[0]!;

    if (Object.keys(diff).length > 0) {
      await db.insert(schema.audit_logs).values({
        user_id: authUser.id,
        action: 'update',
        entity: 'card',
        entity_id: cardId,
        diff_json: JSON.stringify(diff),
      });
    }

    return c.json({ card: updatedCard });
  },
);

// ================== helpers ==================

/**
 * 决定最终的 collector_user_id：
 *  1. body 里传的（staff 可以改默认）
 *  2. settings.default_collector_user_id
 *  3. 当前登录用户
 */
async function resolveCollectorUserId(
  db: ReturnType<typeof requestDb>,
  bodyValue: number | undefined,
  fallbackUserId: number,
): Promise<number> {
  if (bodyValue != null) return bodyValue;

  const rows = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, 'default_collector_user_id'))
    .limit(1);
  const raw = rows[0]?.value;
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallbackUserId;
}
