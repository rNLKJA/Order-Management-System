/**
 * 订餐业务逻辑 —— MEA-12。
 *
 * 两个核心原子操作：
 *   1. deductMeals：有 active 卡时扣减餐数（含 exhausted 转态）
 *   2. cancelOrder：原子冲销（恢复卡 + 散餐 voided + 写 audit_log）
 */

import { and, eq } from 'drizzle-orm';
import { isStaffMealsCardCode } from '@meal/shared';
import { schema } from '../db/client.js';
import { activateQueuedCardAfterExhaust } from './card-queue.js';
import { toShanghaiDate } from './finance.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = { select: any; insert: any; update: any };

export interface DeductMealsInput {
  memberId: number;
  totalQty: number;
  createdByUserId: number;
}

export interface DeductMealsResult {
  card: typeof schema.cards.$inferSelect;
  card_exhausted: boolean;
}

/**
 * 查找 member 的 active 卡，校验余额，扣减，返回更新后的卡。
 * 若无 active 卡返回 null（散餐逻辑由调用方处理）。
 * 必须在事务里调用。
 */
export async function deductMeals(
  tx: Tx,
  input: DeductMealsInput,
): Promise<DeductMealsResult | null> {
  const cardRows = await tx
    .select()
    .from(schema.cards)
    .where(
      and(
        eq(schema.cards.member_id, input.memberId),
        eq(schema.cards.status, 'active'),
      ),
    )
    .limit(1);

  const card = cardRows[0] as typeof schema.cards.$inferSelect | undefined;
  if (!card) return null;

  const isStaffCard = isStaffMealsCardCode(card.card_code);

  if (!isStaffCard && input.totalQty > card.remaining_meals) {
    // 调用方负责抛 HTTPException（service 不直接依赖 hono）
    throw new InsufficientMealBalanceError(
      card.remaining_meals,
      input.totalQty,
    );
  }

  const newUsed = card.used_meals + input.totalQty;
  const newRemaining = isStaffCard ? card.remaining_meals : card.remaining_meals - input.totalQty;
  const newStatus: 'active' | 'exhausted' =
    isStaffCard ? 'active' : newRemaining === 0 ? 'exhausted' : 'active';

  await tx
    .update(schema.cards)
    .set({
      used_meals: newUsed,
      remaining_meals: newRemaining,
      status: newStatus,
      updated_at: new Date(),
    })
    .where(eq(schema.cards.id, card.id));

  if (newStatus === 'exhausted') {
    await activateQueuedCardAfterExhaust(tx, input.memberId, card.id);
  }

  return {
    card: { ...card, used_meals: newUsed, remaining_meals: newRemaining, status: newStatus },
    card_exhausted: newStatus === 'exhausted',
  };
}

export class InsufficientMealBalanceError extends Error {
  readonly code = 'INSUFFICIENT_MEAL_BALANCE';
  constructor(
    public readonly remaining: number,
    public readonly requested: number,
  ) {
    super(
      `剩余 ${remaining} 餐，不足扣 ${requested} 餐。请先续卡或升级。`,
    );
    this.name = 'InsufficientMealBalanceError';
  }
}

export interface CancelOrderInput {
  orderId: number;
  cancelledByUserId: number;
  reason?: string;
  /**
   * true 时允许对 `status === 'delivered'` 的订单执行冲销（仅管理员经 delivery-failed 纠错用）。
   * 默认 false：已送达仍不可在普通「取消」中冲销。
   */
  allowFromDelivered?: boolean;
}

export interface CancelOrderResult {
  order: typeof schema.daily_orders.$inferSelect;
  card?: typeof schema.cards.$inferSelect;
}

/**
 * 取消订单 + 原子冲销（卡恢复 / 散餐 voided）。
 * delivered → 默认抛 OrderLockedDeliveredError；若 `allowFromDelivered`（仅管理员纠错）则允许冲销。
 * 已 cancelled → 幂等返回当前订单
 * 必须在事务里调用。
 */
export async function cancelOrder(
  tx: Tx,
  input: CancelOrderInput,
): Promise<CancelOrderResult> {
  const orderRows = await tx
    .select()
    .from(schema.daily_orders)
    .where(eq(schema.daily_orders.id, input.orderId))
    .limit(1);

  const order = orderRows[0] as typeof schema.daily_orders.$inferSelect | undefined;
  if (!order) {
    throw new OrderNotFoundError(input.orderId);
  }

  if (order.status === 'delivered') {
    if (!input.allowFromDelivered) {
      throw new OrderLockedDeliveredError();
    }
  }

  // 幂等：已取消直接返回
  if (order.status === 'cancelled') {
    return { order };
  }

  let updatedCard: typeof schema.cards.$inferSelect | undefined;

  // 任意订单取消：冲销该订单关联的履约收入（含会员卡餐、散客餐）
  await tx
    .update(schema.finance_entries)
    .set({ voided: true, updated_at: new Date() })
    .where(
      and(
        eq(schema.finance_entries.ref_order_id, order.id),
        eq(schema.finance_entries.voided, false),
      ),
    );

  if (order.card_id != null) {
    // 卡订单：恢复 used/remaining
    const cardRows = await tx
      .select()
      .from(schema.cards)
      .where(eq(schema.cards.id, order.card_id))
      .limit(1);
    const card = cardRows[0] as typeof schema.cards.$inferSelect | undefined;

    if (card) {
      const isStaffCard = isStaffMealsCardCode(card.card_code);
      const newUsed = Math.max(0, card.used_meals - order.quantity);
      const newRemaining = isStaffCard
        ? card.remaining_meals
        : card.remaining_meals + order.quantity;

      // 若卡曾因扣到 0 变 exhausted 且未被后续卡替代 → 回 active
      let newStatus = card.status;
      if (card.status === 'exhausted' && newRemaining > 0) {
        // 检查是否已被新卡取代（有其他 active 卡存在于同 member）
        const activeReplacement = await tx
          .select({ id: schema.cards.id })
          .from(schema.cards)
          .where(
            and(
              eq(schema.cards.member_id, card.member_id),
              eq(schema.cards.status, 'active'),
            ),
          )
          .limit(1);
        if (!activeReplacement[0]) {
          newStatus = 'active';
        }
      }

      await tx
        .update(schema.cards)
        .set({ used_meals: newUsed, remaining_meals: newRemaining, status: newStatus, updated_at: new Date() })
        .where(eq(schema.cards.id, card.id));

      updatedCard = { ...card, used_meals: newUsed, remaining_meals: newRemaining, status: newStatus };
    }
  }

  const now = new Date();
  await tx
    .update(schema.daily_orders)
    .set({
      status: 'cancelled',
      cancelled_at: now,
      cancelled_by_user_id: input.cancelledByUserId,
      cancel_reason: input.reason ?? '',
      updated_at: now,
    })
    .where(eq(schema.daily_orders.id, order.id));

  // 写 audit_log
  await tx.insert(schema.audit_logs).values({
    user_id: input.cancelledByUserId,
    action: 'cancel',
    entity: 'daily_order',
    entity_id: order.id,
    diff_json: JSON.stringify({
      before: { status: order.status },
      after: { status: 'cancelled', cancel_reason: input.reason ?? '' },
      ...(input.allowFromDelivered ? { correction_from_delivered: true } : {}),
    }),
  });

  const updatedOrderRows = await tx
    .select()
    .from(schema.daily_orders)
    .where(eq(schema.daily_orders.id, order.id))
    .limit(1);

  return {
    order: updatedOrderRows[0] as typeof schema.daily_orders.$inferSelect,
    card: updatedCard,
  };
}

export class OrderNotFoundError extends Error {
  constructor(id: number) {
    super(`订单 ${id} 不存在`);
    this.name = 'OrderNotFoundError';
  }
}

export class OrderLockedDeliveredError extends Error {
  readonly code = 'ORDER_LOCKED_DELIVERED';
  constructor() {
    super('已送达的订单不可取消');
    this.name = 'OrderLockedDeliveredError';
  }
}

/**
 * 从 settings 读 ad_hoc_price，默认 35。
 */
export async function getAdHocPrice(tx: Tx): Promise<number> {
  const rows = await tx
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, 'ad_hoc_price'))
    .limit(1);
  const raw = rows[0]?.value as string | undefined;
  if (raw) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 35;
}

/** Asia/Shanghai 今日日期 YYYY-MM-DD */
export function todayShanghai(): string {
  return toShanghaiDate(new Date());
}
