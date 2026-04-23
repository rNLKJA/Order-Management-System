/**
 * 会员 API 封装 - MEA-10 / MEA-14。
 *
 * 和 `apps/api/src/routes/members.ts` 的契约严格一一对应。
 */

import type { MemberCreateInput, MemberUpdateInput } from '@meal/shared';
import { api } from './client';
import type { Card } from './cards';

export interface Member {
  id: number;
  uid: string;
  name: string;
  nickname: string;
  phone: string;
  wechat_id: string;
  address: string;
  dietary_notes: string;
  is_hospital: boolean;
  is_active: boolean;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
}

export interface MemberListParams {
  q?: string;
  is_hospital?: boolean;
  is_active?: boolean;
  include_archived?: boolean;
  limit?: number;
  offset?: number;
}

export interface MemberListResp {
  items: Member[];
  total: number;
}

export interface DuplicatePhoneHint {
  existing_member_id: number;
  existing_uid: string;
}

export interface MemberCreateResp {
  member: Member;
  duplicatePhone?: DuplicatePhoneHint;
}

export interface MemberDetailResp {
  member: Member;
}

export interface DailyOrder {
  id: number;
  member_id: number;
  card_id: number | null;
  order_date: string;
  meal_type: 'lunch' | 'dinner';
  quantity: number;
  amount: number;
  status: 'pending' | 'fulfilled' | 'delivered' | 'cancelled';
  notes: string;
  created_by_user_id: number;
  created_at: number;
  updated_at: number;
}

export interface MemberStatsResp {
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

function buildQuery(params: MemberListParams): string {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.is_hospital !== undefined) q.set('is_hospital', String(params.is_hospital));
  if (params.is_active !== undefined) q.set('is_active', String(params.is_active));
  if (params.include_archived) q.set('include_archived', 'true');
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  if (params.offset !== undefined) q.set('offset', String(params.offset));
  const str = q.toString();
  return str ? `?${str}` : '';
}

export const membersApi = {
  list: (params: MemberListParams = {}) =>
    api.get<MemberListResp>(`/api/members${buildQuery(params)}`),

  detail: (id: number) => api.get<MemberDetailResp>(`/api/members/${id}`),

  create: (body: MemberCreateInput) =>
    api.post<MemberCreateResp>('/api/members', body),

  update: (id: number, body: MemberUpdateInput) =>
    api.patch<MemberDetailResp>(`/api/members/${id}`, body),

  archive: (id: number) =>
    api.patch<MemberDetailResp>(`/api/members/${id}/archive`),

  remove: (id: number) => api.delete<{ success: boolean }>(`/api/members/${id}`),

  stats: (id: number) => api.get<MemberStatsResp>(`/api/members/${id}/stats`),
};
