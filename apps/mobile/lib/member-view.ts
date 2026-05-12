/**
 * 视图模型适配层：把 API 的 Member + Card[] + 用户映射 整合成
 * 屏幕已有的 MockMember 形状（屏幕组件无需改 JSX / 字段读取）。
 *
 * 做的事：
 *  - Card.card_code → CardSpec.name（按 is_hospital 查目录）
 *  - collector_user_id → 用户 full_name（经 usersById 映射）
 *  - upgraded_from_id → 上一张卡的 card_name（history 里能找到的话）
 *  - 挂到 MockMember 上：active_card / card_history / stats
 *
 * 注意：
 *  - stats.total_consumed_meals 由 used_meals 求和；真实数据暂不拉订单，
 *    这个字段会随卡的 used_meals 变化（够用于首页 / 列表的近似）。
 */

import {
  getCardSpec,
  isStaffMealsCardCode,
  type SubscriptionCardCode,
} from '@meal/shared';
import type { Card } from '../api/cards';
import type { Member } from '../api/members';
import type { ApiUser } from '../api/users';
import type { MockCard, MockMember } from '../constants/mockData';

export function usersById(users: ApiUser[]): Record<number, ApiUser> {
  const map: Record<number, ApiUser> = {};
  for (const u of users) map[u.id] = u;
  return map;
}

export function apiCardToMockCard(
  card: Card,
  users: Record<number, ApiUser>,
  cardsById: Record<number, Card> = {},
): MockCard {
  const spec = getCardSpec(card.is_hospital, card.card_code as SubscriptionCardCode);
  const cardName =
    card.card_code === 'custom' && (card.custom_label?.trim() ?? '').length > 0
      ? card.custom_label!.trim()
      : (spec?.name ?? card.card_code);
  const collector = users[card.collector_user_id]?.full_name ?? '';
  const recorder = users[card.created_by_user_id]?.full_name;
  const upgradedFromCard = card.upgraded_from_id != null ? cardsById[card.upgraded_from_id] : null;
  const upgradedFromName = upgradedFromCard
    ? (getCardSpec(
        upgradedFromCard.is_hospital,
        upgradedFromCard.card_code as SubscriptionCardCode,
      )?.name ??
        (upgradedFromCard.card_code === 'custom' && upgradedFromCard.custom_label?.trim()
          ? upgradedFromCard.custom_label.trim()
          : upgradedFromCard.card_code))
    : undefined;

  return {
    id: card.id,
    card_code: card.card_code,
    card_name: cardName,
    custom_label: card.custom_label ?? undefined,
    custom_pack_meals: card.custom_pack_meals ?? undefined,
    is_hospital: card.is_hospital,
    total_meals: card.total_meals,
    used_meals: card.used_meals,
    remaining_meals: card.remaining_meals,
    unit_price: card.unit_price,
    paid_amount: card.paid_amount,
    status: card.status,
    purchased_at: new Date(card.purchased_at).toISOString(),
    collector,
    recorder,
    notes: card.notes || undefined,
    upgraded_from: upgradedFromName,
    refund_amount: card.refund_amount ?? undefined,
    refunded_at:
      card.refunded_at != null ? new Date(card.refunded_at).toISOString() : undefined,
    refund_reason: card.refund_reason || undefined,
  };
}

export function apiToMockMember(
  m: Member,
  cards: Card[],
  users: Record<number, ApiUser>,
): MockMember {
  const cardsById: Record<number, Card> = {};
  for (const c of cards) cardsById[c.id] = c;

  const mockCards = cards
    .slice()
    .sort((a, b) => b.purchased_at - a.purchased_at)
    .map((c) => apiCardToMockCard(c, users, cardsById));

  const active = mockCards.find((c) => c.status === 'active') ?? null;
  const hasStaffCard = active != null && isStaffMealsCardCode(active.card_code);

  let totalPurchased = 0;
  let totalConsumed = 0;
  let totalPaid = 0;
  for (const c of mockCards) {
    totalPurchased += c.total_meals;
    totalConsumed += c.used_meals;
    totalPaid += c.paid_amount;
  }

  return {
    id: m.id,
    uid: m.uid,
    name: m.name,
    nickname: m.nickname,
    phone: m.phone,
    wechat_id: m.wechat_id,
    address: m.address,
    dietary_notes: m.dietary_notes,
    is_hospital: m.is_hospital,
    /** 展示用：持员工卡或历史档案 is_staff */
    is_staff: hasStaffCard || m.is_staff,
    is_walkin: m.is_walkin,
    active_card: active,
    card_history: mockCards,
    stats: {
      total_purchased_meals: totalPurchased,
      total_consumed_meals: totalConsumed,
      total_paid_amount: totalPaid,
    },
  };
}
