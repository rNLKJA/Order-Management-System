/**
 * 订餐下单事务（单笔）：扣卡 / 散客计价 / 插入 daily_orders / audit。
 * 由 POST /api/orders 与 POST /api/orders/batch 共用。
 */

import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import type { OrderCreateEntryInput } from '@meal/shared';
import { schema, type Db } from '../db/client.js';
import { deductMeals, getAdHocPrice } from './orders.js';
import { getOrCreateWalkinMember } from './walkin.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface OrderCreateTransactionResult {
  orders: (typeof schema.daily_orders.$inferSelect)[];
  card: typeof schema.cards.$inferSelect | null;
  card_exhausted: boolean;
}

/** inline：逐行写入 proof_images_json（旧数据 / 测试）；set：仅挂 proof_set_id，正文在 order_proof_sets */
export type OrderProofStorage =
  | { mode: 'inline'; images: string[] }
  | { mode: 'set'; setId: number };

/**
 * @param input 不含 proof_images 的订餐字段（凭证由 proof 单独传入）
 */
export async function insertOrdersInTransaction(
  tx: Tx,
  input: OrderCreateEntryInput,
  createdByUserId: number,
  proof: OrderProofStorage,
): Promise<OrderCreateTransactionResult> {
  const lunchQty = input.lunch_qty ?? 0;
  const dinnerQty = input.dinner_qty ?? 0;
  const totalQty = lunchQty + dinnerQty;
  const customerName = (input.customer_name ?? '').trim();
  const isWalkin = customerName.length > 0 && !input.member_id;
  const isGift = input.is_gift ?? false;
  const isStaffMeal = input.is_staff_meal ?? false;
  /** 与赠送餐相同：不扣次卡次数，订单金额为 0。 */
  const isFreeMeal = isGift || isStaffMeal;

  if (!isWalkin) {
    const memberRows = await tx
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, input.member_id!))
      .limit(1);
    const member = memberRows[0];
    if (!member) {
      throw new HTTPException(404, { message: '会员不存在' });
    }
    if (!member.is_active) {
      throw new HTTPException(422, { message: '会员已归档，不能录入订餐' });
    }
  }

  const memberId = isWalkin
    ? (
        await getOrCreateWalkinMember(tx, customerName, createdByUserId, {
          phone: input.customer_phone,
          wechat_id: input.customer_wechat,
          address: input.customer_address,
          is_hospital: input.customer_is_hospital,
        })
      ).id
    : input.member_id!;

  const adHocPrice =
    input.adhoc_unit_price != null && input.adhoc_unit_price >= 0
      ? input.adhoc_unit_price
      : await getAdHocPrice(tx);

  let deductResult: Awaited<ReturnType<typeof deductMeals>> = null;
  if (!isWalkin && !isFreeMeal) {
    deductResult = await deductMeals(tx, {
      memberId,
      totalQty,
      createdByUserId,
    });
    if (deductResult === null) {
      throw new HTTPException(422, {
        message: '该会员暂无进行中的卡，请先开卡、走赠送餐或走散客录单',
      });
    }
  }

  const hasDeductedCard = deductResult !== null;
  const cardId = hasDeductedCard ? deductResult!.card.id : null;

  const deliveryChannel = input.delivery_channel ?? 'self';
  const courierRef = (input.courier_ref ?? '').trim();
  const proofJson = proof.mode === 'set' ? '[]' : JSON.stringify(proof.images);
  const proofSetId = proof.mode === 'set' ? proof.setId : null;

  const orderValues: Array<typeof schema.daily_orders.$inferInsert> = [];

  const rowBase = {
    member_id: memberId,
    card_id: cardId,
    order_date: input.order_date,
    status: 'pending' as const,
    created_by_user_id: createdByUserId,
    notes: input.notes ?? '',
    customer_name: customerName,
    delivery_channel: deliveryChannel,
    courier_ref: courierRef,
    is_gift: isGift,
    is_staff_meal: isStaffMeal,
    proof_images_json: proofJson,
    proof_set_id: proofSetId,
  };

  if (lunchQty > 0) {
    orderValues.push({
      ...rowBase,
      meal_type: 'lunch',
      quantity: lunchQty,
      amount: isFreeMeal || hasDeductedCard ? 0 : adHocPrice * lunchQty,
    });
  }
  if (dinnerQty > 0) {
    orderValues.push({
      ...rowBase,
      meal_type: 'dinner',
      quantity: dinnerQty,
      amount: isFreeMeal || hasDeductedCard ? 0 : adHocPrice * dinnerQty,
    });
  }

  const insertedOrders = await tx
    .insert(schema.daily_orders)
    .values(orderValues)
    .returning();

  for (const order of insertedOrders) {
    await tx.insert(schema.audit_logs).values({
      user_id: createdByUserId,
      action: 'create',
      entity: 'daily_order',
      entity_id: order.id,
      diff_json: JSON.stringify({ after: order }),
    });
  }

  return {
    orders: insertedOrders,
    card: deductResult?.card ?? null,
    card_exhausted: deductResult?.card_exhausted ?? false,
  };
}
