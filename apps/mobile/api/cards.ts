/**
 * 卡相关的前端 API 封装。
 *
 * 契约与 apps/api/src/routes/cards.ts 严格对齐；购卡/升级 body 见 CardPurchaseInput / CardUpgradeInput。
 */

import type {
  CardAdvanceInput,
  CardPurchaseInput,
  CardUpgradeInput,
  FinanceCategory,
} from '@meal/shared';
import { api } from './client';

export type CardStatus = 'active' | 'queued' | 'upgraded' | 'exhausted' | 'refunded';

export interface Card {
  id: number;
  member_id: number;
  card_code: string;
  is_hospital: boolean;
  total_meals: number;
  used_meals: number;
  remaining_meals: number;
  unit_price: number;
  paid_amount: number;
  status: CardStatus;
  upgraded_from_id: number | null;
  queued_after_card_id: number | null;
  collector_user_id: number;
  created_by_user_id: number;
  purchased_at: number;
  created_at: number;
  updated_at: number;
  notes: string;
  custom_label: string | null;
  custom_pack_meals: number | null;
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

export type PurchaseInput = CardPurchaseInput;
export type UpgradeInput = CardUpgradeInput;
export type AdvanceInput = CardAdvanceInput;

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
    api.post<{ card: Card; financeEntry: FinanceEntrySummary | null }>(
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

  advance: (activeCardId: number, input: AdvanceInput) =>
    api.post<{
      active_card: Card;
      queued_card: Card;
      financeEntry: FinanceEntrySummary;
      paid_amount: number;
    }>(`/api/cards/${activeCardId}/advance`, input),

  refund: (cardId: number, input: RefundInput) =>
    api.post<RefundResponse>(`/api/cards/${cardId}/refund`, input),
};
