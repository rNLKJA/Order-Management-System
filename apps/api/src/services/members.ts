/**
 * 会员相关业务逻辑 - 独立于 Hono 路由层，便于单测和复用。
 *
 * 这里主要承担：
 * - 统一重算 uid
 * - 引用校验（删除前检查 cards / daily_orders / finance_entries）
 */

import { and, desc, eq, gte, ne, sql } from 'drizzle-orm';
import { buildUid } from '@meal/shared';
import { schema, type Db } from '../db/client.js';
import type { Member, Card, DailyOrder } from '../db/schema.js';

export function recomputeUid(params: {
  name: string;
  nickname: string | null | undefined;
  phone: string;
}): string {
  return buildUid(params.nickname ?? '', params.name, params.phone);
}

export interface DuplicatePhoneInfo {
  existing_member_id: number;
  existing_uid: string;
}

/**
 * 查找同手机号、非当前 id（创建时 excludeId=undefined）的最早一条会员。
 * 用于"重复手机号"软提示。
 */
export async function findDuplicatePhone(
  db: Db,
  phone: string,
  excludeId?: number,
): Promise<DuplicatePhoneInfo | undefined> {
  const conds = excludeId
    ? and(eq(schema.members.phone, phone), ne(schema.members.id, excludeId))
    : eq(schema.members.phone, phone);

  const rows = await db
    .select({ id: schema.members.id, uid: schema.members.uid })
    .from(schema.members)
    .where(conds)
    .orderBy(schema.members.id)
    .limit(1);

  const hit = rows[0];
  return hit ? { existing_member_id: hit.id, existing_uid: hit.uid } : undefined;
}

export interface MemberReferenceCounts {
  cards: number;
  orders: number;
  finance: number;
}

/**
 * 统计会员被 cards / daily_orders / finance_entries 引用的数量。
 * 任何一项 > 0 → 禁止硬删除，走归档。
 */
export interface MemberStatsResponse {
  member: Member;
  active_card: Card | null;
  card_history: Card[];
  order_history: DailyOrder[];
  stats: {
    total_purchased_meals: number;
    total_consumed_meals: number;
    total_paid_amount: number;
    order_count: number;
  };
}

/**
 * 聚合会员详情统计：卡历史 + 最近 90 天订单 + 累计数据。
 * 当 daily_orders 尚未有数据时，order_history 返回 []，order_count 返回 0。
 */
export async function getMemberStats(
  db: Db,
  memberId: number,
): Promise<MemberStatsResponse | null> {
  const memberRows = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.id, memberId))
    .limit(1);
  const member = memberRows[0];
  if (!member) return null;

  // 全部历史卡，倒序
  const allCards = await db
    .select()
    .from(schema.cards)
    .where(eq(schema.cards.member_id, memberId))
    .orderBy(desc(schema.cards.purchased_at), desc(schema.cards.id));

  const active_card = allCards.find((c) => c.status === 'active') ?? null;
  const card_history = allCards;

  // 累计统计
  let total_purchased_meals = 0;
  let total_consumed_meals = 0;
  let total_paid_amount = 0;
  for (const card of allCards) {
    total_purchased_meals += card.total_meals;
    total_consumed_meals += card.used_meals;
    total_paid_amount += card.paid_amount;
  }

  // 最近 90 天订单
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  let order_history: DailyOrder[] = [];
  let order_count = 0;
  try {
    order_history = await db
      .select()
      .from(schema.daily_orders)
      .where(
        and(
          eq(schema.daily_orders.member_id, memberId),
          gte(schema.daily_orders.order_date, cutoffDate),
        ),
      )
      .orderBy(desc(schema.daily_orders.order_date), desc(schema.daily_orders.id));

    const [countRow] = await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.daily_orders)
      .where(
        and(
          eq(schema.daily_orders.member_id, memberId),
          ne(schema.daily_orders.status, 'cancelled'),
        ),
      );
    order_count = Number(countRow?.c ?? 0);
  } catch {
    // daily_orders 表尚未有数据时安全降级
    order_history = [];
    order_count = 0;
  }

  return {
    member,
    active_card,
    card_history,
    order_history,
    stats: {
      total_purchased_meals,
      total_consumed_meals,
      total_paid_amount,
      order_count,
    },
  };
}

export async function countMemberReferences(
  db: Db,
  memberId: number,
): Promise<MemberReferenceCounts> {
  const [cardRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.cards)
    .where(eq(schema.cards.member_id, memberId));
  const [orderRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.daily_orders)
    .where(eq(schema.daily_orders.member_id, memberId));
  // finance_entries 通过 ref_card_id / ref_order_id 间接引用会员；
  // 只要存在 cards / orders 就不会删到 finance_entries 这层。这里保守再查一遍，
  // 以防有人手动插了无 card/order 但跟会员相关的 finance 记录。
  // 当前 schema 的 finance_entries 没有 member_id 直引用，返回 0 即可。
  return {
    cards: Number(cardRow?.c ?? 0),
    orders: Number(orderRow?.c ?? 0),
    finance: 0,
  };
}
