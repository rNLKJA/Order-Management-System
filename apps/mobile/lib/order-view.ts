/**
 * 把 DailyOrder（API 形状）+ MockMember[]（已经是 API 衍生的视图模型）
 * 合成成订餐页已经在用的 MockOrder 形状，屏幕 JSX 无需大改。
 *
 * 关键映射：
 *  - member_name / member_nickname / is_hospital / dietary_notes ← MockMember
 *  - card_type（卡名 or null 表示散餐）← MockMember.card_history 按 card_id 查
 */

import type { DailyOrder } from '../api/orders';
import type { MockMember, MockOrder } from '../constants/mockData';

export function dailyOrderToMockOrder(
  order: DailyOrder,
  membersById: Record<number, MockMember>,
): MockOrder {
  const member = membersById[order.member_id];
  const card =
    order.card_id != null && member
      ? member.card_history.find((c) => c.id === order.card_id)
      : undefined;

  return {
    id: order.id,
    member_id: order.member_id,
    member_name: member?.name ?? `#${order.member_id}`,
    member_nickname: member?.nickname ?? '',
    is_hospital: member?.is_hospital ?? false,
    dietary_notes: member?.dietary_notes ?? '',
    order_date: order.order_date,
    meal_type: order.meal_type,
    quantity: order.quantity,
    amount: order.amount,
    status: order.status,
    notes: order.notes,
    card_type: card?.card_name ?? null,
  };
}

export function membersByIdFrom(members: MockMember[]): Record<number, MockMember> {
  const out: Record<number, MockMember> = {};
  for (const m of members) out[m.id] = m;
  return out;
}
