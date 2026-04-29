/**
 * 财务接口客户端封装（MEA-13）。
 *
 * 与 apps/api/src/routes/finance.ts 的契约一一对应：
 * - listFinance(params)：GET /api/finance
 * - createExpense(body)：POST /api/finance/expense
 * - updateFinance(id, patch)：PATCH /api/finance/:id
 * - voidFinance(id)：DELETE /api/finance/:id（软删，仅 admin）
 */

import type {
  ExpenseCreateInput,
  FinanceCategory,
  FinanceUpdateInput,
} from '@meal/shared';
import { api } from './client';

export interface FinanceEntryDTO {
  id: number;
  entry_date: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  ref_card_id: number | null;
  ref_order_id: number | null;
  source: 'auto' | 'manual' | 'imported_legacy';
  voided: boolean;
  collector_user_id: number | null;
  created_by_user_id: number;
  created_at: string | number;
  updated_at: string | number;
}

export interface FinanceSummary {
  income: number;
  expense: number;
  net: number;
  realized_income: number;
  prepaid_income: number;
  realized_net: number;
  realized_by_channel: {
    hospital: number;
    regular: number;
    walkin: number;
  };
  byCategory: Partial<Record<FinanceCategory, number>> & Record<string, number>;
}

export interface FinanceListResponse {
  items: FinanceEntryDTO[];
  total: number;
  summary: FinanceSummary;
}

export interface ListFinanceParams {
  from?: string;
  to?: string;
  type?: 'income' | 'expense' | 'all';
  category?: string;
  include_voided?: boolean;
  limit?: number;
  offset?: number;
}

function toQuery(params: ListFinanceParams): string {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.type && params.type !== 'all') q.set('type', params.type);
  if (params.category) q.set('category', params.category);
  if (params.include_voided) q.set('include_voided', 'true');
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function listFinance(
  params: ListFinanceParams = {},
): Promise<FinanceListResponse> {
  return api.get<FinanceListResponse>(`/api/finance${toQuery(params)}`);
}

export function createExpense(
  body: ExpenseCreateInput,
): Promise<{ entry: FinanceEntryDTO }> {
  return api.post<{ entry: FinanceEntryDTO }>('/api/finance/expense', body);
}

export function updateFinance(
  id: number,
  patch: FinanceUpdateInput,
): Promise<{ entry: FinanceEntryDTO }> {
  return api.patch<{ entry: FinanceEntryDTO }>(`/api/finance/${id}`, patch);
}

export function voidFinance(id: number): Promise<{ entry: FinanceEntryDTO }> {
  return api.delete<{ entry: FinanceEntryDTO }>(`/api/finance/${id}`);
}
