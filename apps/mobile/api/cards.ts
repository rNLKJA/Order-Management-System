/**
 * 卡相关的前端 API 封装。
 *
 * 契约与 apps/api/src/routes/cards.ts 严格对齐，Member 与 User 的 shape 这里简化
 * 到本模块直接用到的字段；更大的集合等 types 稳定后统一挪去 @meal/shared。
 */

import type { FinanceCategory, SubscriptionCardCode } from '@meal/shared';
import { api } from './client';

export type CardStatus = 'active' | 'upgraded' | 'exhausted' | 'refunded';

export interface Card {
  id: number;
  member_id: number;
  card_code: SubscriptionCardCode;
  is_hospital: boolean;
  total_meals: number;
  used_meals: number;
  remaining_meals: number;
  unit_price: number;
  paid_amount: number;
  status: CardStatus;
  upgraded_from_id: number | null;
  collector_user_id: number;
  created_by_user_id: number;
  purchased_at: number;
  created_at: number;
  updated_at: number;
  notes: string;
  refund_amount: number | null;
  refund_reason: string | null;
  refunded_at: number | null;
  refunded_by_user_id: number | null;
}

export interface FinanceEntrySummary {
  id: number;
  amount: number;
  category: FinanceCategory;
  entry_date: string;
  ref_card_id: number;
  source: 'auto';
  type: 'income';
}

export interface PurchaseInput {
  member_id: number;
  card_code: SubscriptionCardCode;
  is_hospital: boolean;
  collector_user_id?: number;
  created_by_user_id?: number;
  purchased_at?: string;
  notes?: string;
}

export interface UpgradeInput {
  card_code: SubscriptionCardCode;
  is_hospital: boolean;
  collector_user_id?: number;
  created_by_user_id?: number;
  notes?: string;
}

export interface RenewInput {
  collector_user_id?: number;
  created_by_user_id?: number;
  notes?: string;
}

export interface RefundInput {
  refund_amount: number;
  reason?: string;
  collector_user_id?: number;
  created_by_user_id?: number;
}

export interface RefundResponse {
  card: Card;
  financeEntry: {
    id: number;
    entry_date: string;
    amount: number;
    type: 'expense';
    category: 'manual_expense';
  };
  refund_amount: number;
}

export const cardsApi = {
  list: (memberId: number, status: CardStatus | 'all' = 'all') =>
    api.get<{ cards: Card[] }>(
      `/api/cards?member_id=${memberId}&status=${status}`,
    ),

  purchase: (input: PurchaseInput) =>
    api.post<{ card: Card; financeEntry: FinanceEntrySummary }>(
      '/api/cards',
      input,
    ),

  upgrade: (cardId: number, input: UpgradeInput) =>
    api.post<{
      old_card: Card;
      new_card: Card;
      financeEntry: FinanceEntrySummary;
      diff: number;
    }>(`/api/cards/${cardId}/upgrade`, input),

  renew: (cardId: number, input: RenewInput) =>
    api.post<{
      old_card: Card;
      new_card: Card;
      financeEntry: FinanceEntrySummary;
      carried_meals: number;
      paid_amount: number;
    }>(`/api/cards/${cardId}/renew`, input),

  refund: (cardId: number, input: RefundInput) =>
    api.post<RefundResponse>(`/api/cards/${cardId}/refund`, input),
};
