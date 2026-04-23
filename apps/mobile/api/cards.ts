/**
 * 卡相关的前端 API 封装。
 *
 * 契约与 apps/api/src/routes/cards.ts 严格对齐，Member 与 User 的 shape 这里简化
 * 到本模块直接用到的字段；更大的集合等 types 稳定后统一挪去 @meal/shared。
 */

import type { SubscriptionCardCode } from '@meal/shared';
import { api } from './client';

export type CardStatus = 'active' | 'upgraded' | 'exhausted';

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
}

export interface FinanceEntrySummary {
  id: number;
  amount: number;
  category: 'hospital_sub' | 'regular_sub';
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
};
