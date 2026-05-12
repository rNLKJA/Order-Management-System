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

function parseProofImagesJson(json: string): string[] {
  if (!json || json === '[]') return [];
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

export function dailyOrderToMockOrder(
  order: DailyOrder,
  membersById: Record<number, MockMember>,
): MockOrder {
  const member = membersById[order.member_id];
  const card =
    order.card_id != null && member
      ? member.card_history.find((c) => c.id === order.card_id)
      : undefined;

  const walkin = (order.customer_name ?? '').length > 0;

  return {
    id: order.id,
    member_id: order.member_id,
    // 散客订单优先显示 customer_name；会员订单照常显示
    member_name: walkin ? order.customer_name : (member?.name ?? `#${order.member_id}`),
    member_nickname: walkin ? '' : (member?.nickname ?? ''),
    is_hospital: walkin ? false : (member?.is_hospital ?? false),
    dietary_notes: walkin ? '' : (member?.dietary_notes ?? ''),
    order_date: order.order_date,
    meal_type: order.meal_type,
    quantity: order.quantity,
    amount: order.amount,
    status: order.status,
    notes: order.notes,
    cancel_reason: order.cancel_reason || undefined,
    // 散客没有卡；会员有卡时显示卡名；会员无卡则 null（= 散餐）
    card_type: walkin ? null : (card?.card_name ?? null),
    customer_name: walkin ? order.customer_name : undefined,
    delivery_channel: order.delivery_channel ?? 'self',
    courier_ref: order.courier_ref || undefined,
    is_gift: order.is_gift,
    is_staff_meal: order.is_staff_meal ?? false,
    proof_images: parseProofImagesJson(order.proof_images_json),
  };
}

export function membersByIdFrom(members: MockMember[]): Record<number, MockMember> {
  const out: Record<number, MockMember> = {};
  for (const m of members) out[m.id] = m;
  return out;
}
