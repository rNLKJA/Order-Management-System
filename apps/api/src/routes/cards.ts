/**
 * 卡路由（MEA-11）。
 *
 * - GET    /api/cards?member_id=&status=active|upgraded|exhausted|all
 * - POST   /api/cards                        新购（会员无 active 卡）
 * - POST   /api/cards/:id/upgrade            升级（禁降级，补差价）
 * - POST   /api/cards/:id/advance            提前包卡（全价排队，当前卡用完后生效）
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
  cardRefundSchema,
  cardRenewSchema,
  cardAdvanceSchema,
  cardUpgradeSchema,
  buildCustomCardSpec,
  getCardSpec,
  type SubscriptionCardCode,
} from '@meal/shared';
import { schema } from '../db/client.js';
import { requestDb } from '../db/request-db.js';
import { requireAuth, requireDataOperator, type AuthVariables } from '../middleware/jwt.js';
import { computeUpgrade, UpgradeError } from '../services/upgrade.js';
import { computeRenew, computeRenewCustom, RenewError } from '../services/renew.js';
import {
  activateQueuedCardAfterExhaust,
  findQueuedCardForMember,
  findQueuedCardWaitingOn,
} from '../services/card-queue.js';
import { createAutoSubscriptionIncome } from '../services/finance.js';
import { refundCard, CardRefundError } from '../services/refund.js';

export const cardsRouter = new Hono<{ Variables: AuthVariables }>();

cardsRouter.use('*', requireAuth());
cardsRouter.use('*', requireDataOperator());

// ================== GET /api/cards ==================

const listQuerySchema = z.object({
  member_id: z
    .string()
    .regex(/^\d+$/, 'member_id 必须是整数')
    .transform((v) => parseInt(v, 10)),
  status: z.enum(['active', 'queued', 'upgraded', 'exhausted', 'all']).optional().default('all'),
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
  // 散客首次开卡 → 把该 member 正式升为会员
  const wasWalkin = member.is_walkin;

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
    let insertRow: typeof schema.cards.$inferInsert;
    let financeAmount: number;
    let financeDesc: string;

    if (input.card_code === 'custom') {
      const unitPrice = round2(input.paid_amount / input.total_meals);
      insertRow = {
        member_id: input.member_id,
        card_code: 'custom',
        is_hospital: input.is_hospital,
        total_meals: input.total_meals,
        used_meals: 0,
        remaining_meals: input.total_meals,
        unit_price: unitPrice,
        paid_amount: input.paid_amount,
        status: 'active',
        custom_label: input.custom_label,
        custom_pack_meals: input.total_meals,
        collector_user_id: collectorUserId,
        created_by_user_id: createdByUserId,
        purchased_at: purchasedAt,
        notes: input.notes ?? '',
      };
      financeAmount = input.paid_amount;
      financeDesc = `购卡：${input.custom_label}`;
    } else {
      const spec = getCardSpec(input.is_hospital, input.card_code);
      if (!spec) {
        throw new HTTPException(400, {
          message: `卡种 ${input.card_code} 不在${input.is_hospital ? '院内' : '院外'}价目表中`,
        });
      }
      insertRow = {
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
      };
      financeAmount = spec.totalPrice;
      financeDesc = `购卡：${spec.name}`;
    }

    const cardRows = await tx.insert(schema.cards).values(insertRow).returning();
    const card = cardRows[0]!;

    // 散客升级：把 is_walkin 翻成 false，后续下单会按正式会员处理。
    // uid 先保留 `__WALKIN__{name}` 不动，等补完手机号时在 PATCH /members 里重算。
    if (wasWalkin) {
      await tx
        .update(schema.members)
        .set({ is_walkin: false, updated_at: new Date() })
        .where(eq(schema.members.id, input.member_id));
    }

    const finance = await createAutoSubscriptionIncome(tx, {
      amount: financeAmount,
      is_hospital: input.is_hospital,
      ref_card_id: card.id,
      collector_user_id: collectorUserId,
      created_by_user_id: createdByUserId,
      purchased_at: purchasedAt,
      description: financeDesc,
    });

    return { card, finance, promoted: wasWalkin };
  });

  return c.json(
    {
      card: result.card,
      financeEntry: result.finance,
      ...(result.promoted ? { promoted_from_walkin: true } : {}),
    },
    201,
  );
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

    await assertNoQueuedCardBlocking(db, oldCard.member_id, oldCard.id);

    const isHospital = input.is_hospital ?? oldCard.is_hospital;

    let newSpec;
    let upgradeTitle: string;
    if (input.card_code === 'custom') {
      newSpec = buildCustomCardSpec(
        input.custom_label,
        input.total_meals,
        input.paid_amount,
      );
      upgradeTitle = input.custom_label;
    } else {
      const spec = getCardSpec(isHospital, input.card_code);
      if (!spec) {
        throw new HTTPException(400, {
          message: `卡种 ${input.card_code} 不在${isHospital ? '院内' : '院外'}价目表中`,
        });
      }
      newSpec = spec;
      upgradeTitle = spec.name;
    }

    let computed;
    try {
      computed = computeUpgrade({
        oldPaidAmount: oldCard.paid_amount,
        oldUsedMeals: oldCard.used_meals,
        oldCardCode: oldCard.card_code,
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
          custom_label: input.card_code === 'custom' ? input.custom_label : null,
          custom_pack_meals: input.card_code === 'custom' ? input.total_meals : null,
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
        description: `升级补差：${upgradeTitle}（原 ¥${oldCard.paid_amount}）`,
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

    await assertNoQueuedCardBlocking(db, oldCard.member_id, oldCard.id);

    let computed;
    let renewLabel: string;

    if (oldCard.card_code === 'custom') {
      const packMeals = oldCard.custom_pack_meals;
      if (packMeals == null || packMeals <= 0) {
        throw new HTTPException(422, {
          message:
            '自定义卡缺少档位餐数记录，无法续卡（请联系管理员补数据或改用升级）',
        });
      }
      try {
        computed = computeRenewCustom({
          oldStatus: oldCard.status,
          oldRemainingMeals: oldCard.remaining_meals,
          packMeals,
          packPrice: oldCard.paid_amount,
        });
      } catch (e) {
        if (e instanceof RenewError) {
          return c.json({ code: e.code, message: e.message }, 422);
        }
        throw e;
      }
      renewLabel = oldCard.custom_label ?? '自定义套餐';
    } else {
      const spec = getCardSpec(oldCard.is_hospital, oldCard.card_code as SubscriptionCardCode);
      if (!spec) {
        throw new HTTPException(422, {
          message: `当前卡种 ${oldCard.card_code} 已不在${oldCard.is_hospital ? '院内' : '院外'}价目表，无法续卡`,
        });
      }
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
      renewLabel = spec.name;
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
          custom_label: oldCard.card_code === 'custom' ? oldCard.custom_label : null,
          custom_pack_meals: oldCard.card_code === 'custom' ? oldCard.custom_pack_meals : null,
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
        description: `续卡：${renewLabel}（结转 ${computed.carriedMeals} 份）`,
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

// ================== POST /api/cards/:id/advance ==================

/**
 * 提前包卡：当前 active 卡未用完时，按全价购买下一张卡（可换卡种），
 * 新卡 status=queued，当前卡耗尽后自动激活。不走升级补差、不结转剩餐。
 */
cardsRouter.post(
  '/:id/advance',
  zValidator('param', paramSchema),
  zValidator('json', cardAdvanceSchema),
  async (c) => {
    const { id: activeCardId } = c.req.valid('param');
    const input = c.req.valid('json');
    const authUser = c.get('authUser');
    const db = requestDb(c);

    const activeRows = await db
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, activeCardId))
      .limit(1);
    const activeCard = activeRows[0];
    if (!activeCard) {
      throw new HTTPException(404, { message: '当前卡不存在' });
    }
    if (activeCard.status !== 'active') {
      throw new HTTPException(422, {
        message: `仅 active 状态的卡可提前包卡，当前状态：${activeCard.status}`,
      });
    }
    if (activeCard.card_code === 'staff') {
      throw new HTTPException(422, { message: '员工卡不支持提前包卡，请先换购付费卡' });
    }

    const existingQueued = await findQueuedCardForMember(db, activeCard.member_id);
    if (existingQueued) {
      throw new HTTPException(409, {
        message: '该会员已有待生效的提前包卡，请先等当前卡用完或退掉待生效卡',
      });
    }

    const isHospital = input.is_hospital ?? activeCard.is_hospital;
    const collectorUserId = await resolveCollectorUserId(db, input.collector_user_id, authUser.id);
    const createdByUserId = input.created_by_user_id ?? authUser.id;
    const purchasedAt = new Date();

    let insertRow: typeof schema.cards.$inferInsert;
    let financeAmount: number;
    let financeDesc: string;

    if (input.card_code === 'custom') {
      const unitPrice = round2(input.paid_amount / input.total_meals);
      insertRow = {
        member_id: activeCard.member_id,
        card_code: 'custom',
        is_hospital: isHospital,
        total_meals: input.total_meals,
        used_meals: 0,
        remaining_meals: input.total_meals,
        unit_price: unitPrice,
        paid_amount: input.paid_amount,
        status: 'queued',
        queued_after_card_id: activeCard.id,
        custom_label: input.custom_label,
        custom_pack_meals: input.total_meals,
        collector_user_id: collectorUserId,
        created_by_user_id: createdByUserId,
        purchased_at: purchasedAt,
        notes: input.notes ?? '',
      };
      financeAmount = input.paid_amount;
      financeDesc = `提前包卡：${input.custom_label}`;
    } else {
      const spec = getCardSpec(isHospital, input.card_code);
      if (!spec) {
        throw new HTTPException(400, {
          message: `卡种 ${input.card_code} 不在${isHospital ? '院内' : '院外'}价目表中`,
        });
      }
      insertRow = {
        member_id: activeCard.member_id,
        card_code: input.card_code,
        is_hospital: isHospital,
        total_meals: spec.meals,
        used_meals: 0,
        remaining_meals: spec.meals,
        unit_price: spec.unitPrice,
        paid_amount: spec.totalPrice,
        status: 'queued',
        queued_after_card_id: activeCard.id,
        collector_user_id: collectorUserId,
        created_by_user_id: createdByUserId,
        purchased_at: purchasedAt,
        notes: input.notes ?? '',
      };
      financeAmount = spec.totalPrice;
      financeDesc = `提前包卡：${spec.name}`;
    }

    const result = await db.transaction(async (tx) => {
      const cardRows = await tx.insert(schema.cards).values(insertRow).returning();
      const queuedCard = cardRows[0]!;

      const finance = await createAutoSubscriptionIncome(tx, {
        amount: financeAmount,
        is_hospital: isHospital,
        ref_card_id: queuedCard.id,
        collector_user_id: collectorUserId,
        created_by_user_id: createdByUserId,
        purchased_at: purchasedAt,
        description: financeDesc,
      });

      return { queuedCard, finance, activeCard };
    });

    return c.json(
      {
        active_card: result.activeCard,
        queued_card: result.queuedCard,
        financeEntry: result.finance,
        paid_amount: financeAmount,
      },
      201,
    );
  },
);

// ================== POST /api/cards/:id/refund ==================

/**
 * 退卡：active 卡 → refunded，并自动写一条 manual_expense 的 FinanceEntry 跟踪退款。
 * 规则：
 *  - 仅 active 可退；upgraded / exhausted / refunded 都返回 422
 *  - 0 ≤ refund_amount ≤ paid_amount
 *  - 关联的 pending/fulfilled 订单不自动取消，如需冲销请单独走 /orders/:id/cancel
 */
cardsRouter.post(
  '/:id/refund',
  zValidator('param', paramSchema),
  zValidator('json', cardRefundSchema),
  async (c) => {
    const { id: cardId } = c.req.valid('param');
    const input = c.req.valid('json');
    const authUser = c.get('authUser');
    const db = requestDb(c);

    const collectorUserId = await resolveCollectorUserId(
      db,
      input.collector_user_id,
      authUser.id,
    );
    const createdByUserId = input.created_by_user_id ?? authUser.id;

    try {
      const result = await db.transaction(async (tx) => {
        const cardRows = await tx
          .select()
          .from(schema.cards)
          .where(eq(schema.cards.id, cardId))
          .limit(1);
        const before = cardRows[0] as typeof schema.cards.$inferSelect | undefined;

        const refundResult = await refundCard(tx, {
          cardId,
          refundAmount: input.refund_amount,
          reason: input.reason ?? '',
          collectorUserId,
          createdByUserId,
          refundedByUserId: authUser.id,
        });

        let activatedQueued: typeof schema.cards.$inferSelect | null = null;
        if (before?.status === 'active') {
          activatedQueued = await activateQueuedCardAfterExhaust(
            tx,
            before.member_id,
            before.id,
          );
        }

        return { ...refundResult, activatedQueued, beforeStatus: before?.status ?? 'active' };
      });

      await db.insert(schema.audit_logs).values({
        user_id: authUser.id,
        action: 'update',
        entity: 'card',
        entity_id: cardId,
        diff_json: JSON.stringify({
          status: [result.beforeStatus, 'refunded'],
          refund_amount: input.refund_amount,
          reason: input.reason ?? '',
        }),
      });

      return c.json(
        {
          card: result.card,
          financeEntry: result.financeEntry,
          refund_amount: input.refund_amount,
          ...(result.activatedQueued ? { activated_queued_card: result.activatedQueued } : {}),
        },
        201,
      );
    } catch (err) {
      if (err instanceof CardRefundError) {
        if (err.code === 'CARD_NOT_FOUND') {
          throw new HTTPException(404, { message: err.message });
        }
        return c.json({ code: err.code, message: err.message }, 422);
      }
      throw err;
    }
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

async function assertNoQueuedCardBlocking(
  db: ReturnType<typeof requestDb>,
  memberId: number,
  activeCardId: number,
): Promise<void> {
  const queued = await findQueuedCardWaitingOn(db, memberId, activeCardId);
  if (queued) {
    throw new HTTPException(409, {
      message: '该会员已有待生效的提前包卡，请先等当前卡用完或退掉待生效卡后再操作',
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
