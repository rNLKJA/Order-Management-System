/**
 * 财务条目辅助函数。
 *
 * - 购卡 / 升级补差：`createAutoSubscriptionIncome` → 预收（card_prepaid_*），
 *   不在送达前计入「履约收入」。
 * - 订单标记已送达：`createMealEarnedIncome` → 按卡单价×份数或散客实付写入 meal_earned_*。
 *
 * source='auto'；entry_date 业务日：办卡按 purchased_at 转上海日；履约按 order.order_date。
 */

import { schema } from '../db/client.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Inserter = { insert: (table: typeof schema.finance_entries) => any };

export type CardPrepaidCategory = 'card_prepaid_hospital' | 'card_prepaid_regular';

export type MealEarnedCategory =
  | 'meal_earned_hospital'
  | 'meal_earned_regular'
  | 'meal_earned_walkin';

export interface AutoIncomeInput {
  amount: number;
  is_hospital: boolean;
  ref_card_id: number;
  collector_user_id: number;
  created_by_user_id: number;
  purchased_at: Date;
  description?: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 写一条自动收入 FinanceEntry（购卡 / 升级补差）— **预收**，送达餐费另记 meal_earned_*。
 */
export async function createAutoSubscriptionIncome(
  db: Inserter,
  input: AutoIncomeInput,
): Promise<{
  id: number;
  entry_date: string;
  category: CardPrepaidCategory;
  amount: number;
  type: 'income';
  source: 'auto';
  ref_card_id: number;
}> {
  const category: CardPrepaidCategory = input.is_hospital
    ? 'card_prepaid_hospital'
    : 'card_prepaid_regular';
  const entry_date = toShanghaiDate(input.purchased_at);

  const rows = await db
    .insert(schema.finance_entries)
    .values({
      entry_date,
      type: 'income',
      amount: input.amount,
      category,
      description: input.description ?? '',
      ref_card_id: input.ref_card_id,
      source: 'auto',
      voided: false,
      collector_user_id: input.collector_user_id,
      created_by_user_id: input.created_by_user_id,
    })
    .returning({ id: schema.finance_entries.id });

  return {
    id: rows[0]!.id,
    entry_date,
    category,
    amount: input.amount,
    type: 'income',
    source: 'auto',
    ref_card_id: input.ref_card_id,
  };
}

export interface MealEarnedInput {
  order: typeof schema.daily_orders.$inferSelect;
  /** 有卡订单必填；散客为 null */
  card: typeof schema.cards.$inferSelect | null;
  created_by_user_id: number;
}

/**
 * 订单 fulfilled → delivered 时调用：按单价确认当日履约收入。
 */
export async function createMealEarnedIncome(
  db: Inserter,
  input: MealEarnedInput,
): Promise<{ id: number; category: MealEarnedCategory; amount: number }> {
  const { order, card, created_by_user_id } = input;
  const entry_date = order.order_date;

  let category: MealEarnedCategory;
  let amount: number;
  let description: string;

  if (order.card_id != null && card) {
    category = card.is_hospital ? 'meal_earned_hospital' : 'meal_earned_regular';
    amount = round2(Number(card.unit_price) * order.quantity);
    const zone = card.is_hospital ? '院内' : '院外';
    const meal = order.meal_type === 'lunch' ? '午餐' : '晚餐';
    description = `${zone}会员餐·已送达：${meal} ${order.quantity} 份（卡 #${card.id}）`;
  } else {
    category = 'meal_earned_walkin';
    amount = round2(Number(order.amount));
    const who = (order.customer_name ?? '').trim();
    const meal = order.meal_type === 'lunch' ? '午餐' : '晚餐';
    description = `散客餐·已送达：${who ? `${who} · ` : ''}${meal} ${order.quantity} 份`;
  }

  const rows = await db
    .insert(schema.finance_entries)
    .values({
      entry_date,
      type: 'income',
      amount,
      category,
      description,
      ref_order_id: order.id,
      source: 'auto',
      voided: false,
      created_by_user_id,
    })
    .returning({ id: schema.finance_entries.id });

  return { id: rows[0]!.id, category, amount };
}

/**
 * 把 Date 转成 Asia/Shanghai 的 YYYY-MM-DD。
 * MVP 取 UTC+8 偏移（上海无夏令时），后续统一到 shared/date util。
 */
export function toShanghaiDate(d: Date): string {
  const shanghai = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const yyyy = shanghai.getUTCFullYear();
  const mm = String(shanghai.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shanghai.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
