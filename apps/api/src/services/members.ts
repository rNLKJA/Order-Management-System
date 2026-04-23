/**
 * 会员相关业务逻辑 - 独立于 Hono 路由层，便于单测和复用。
 *
 * 这里主要承担：
 * - 统一重算 uid
 * - 引用校验（删除前检查 cards / daily_orders / finance_entries）
 */

import { and, eq, ne, sql } from 'drizzle-orm';
import { buildUid } from '@meal/shared';
import { schema, type Db } from '../db/client.js';

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
