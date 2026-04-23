/**
 * 订餐 API 封装 —— MEA-12。
 */

import { api } from './client';

export interface DailyOrder {
  id: number;
  member_id: number;
  card_id: number | null;
  order_date: string;
  meal_type: 'lunch' | 'dinner';
  quantity: number;
  amount: number;
  status: 'pending' | 'fulfilled' | 'delivered' | 'cancelled';
  fulfilled_at: string | null;
  fulfilled_by_user_id: number | null;
  delivered_at: string | null;
  delivered_by_user_id: number | null;
  cancelled_at: string | null;
  cancelled_by_user_id: number | null;
  cancel_reason: string;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
  notes: string;
}

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
  status: 'active' | 'upgraded' | 'exhausted';
}

export interface CreateOrderInput {
  member_id: number;
  order_date: string;
  lunch_qty?: number;
  dinner_qty?: number;
  notes?: string;
  created_by_user_id?: number;
}

export interface CreateOrderResponse {
  orders: DailyOrder[];
  card?: Card;
  card_exhausted?: boolean;
}

export interface OrderListParams {
  member_id?: number;
  date?: string;
  status?: 'pending' | 'fulfilled' | 'delivered' | 'cancelled' | 'all';
  meal_type?: 'lunch' | 'dinner' | 'all';
  zone?: 'all' | 'hospital' | 'regular';
  limit?: number;
  offset?: number;
}

export const ordersApi = {
  list: (params: OrderListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.member_id != null) qs.set('member_id', String(params.member_id));
    if (params.date) qs.set('date', params.date);
    if (params.status) qs.set('status', params.status);
    if (params.meal_type) qs.set('meal_type', params.meal_type);
    if (params.zone) qs.set('zone', params.zone);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return api.get<{ orders: DailyOrder[] }>(`/api/orders${query ? `?${query}` : ''}`);
  },

  today: (params: { meal_type?: string; zone?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.meal_type) qs.set('meal_type', params.meal_type);
    if (params.zone) qs.set('zone', params.zone);
    const query = qs.toString();
    return api.get<{ orders: DailyOrder[] }>(`/api/orders/today${query ? `?${query}` : ''}`);
  },

  get: (id: number) => api.get<{ order: DailyOrder }>(`/api/orders/${id}`),

  create: (input: CreateOrderInput, idempotencyKey?: string) => {
    const init: RequestInit = {
      method: 'POST',
      body: JSON.stringify(input),
    };
    if (idempotencyKey) {
      (init as { headers?: Record<string, string> }).headers = {
        'Idempotency-Key': idempotencyKey,
      };
    }
    return api.post<CreateOrderResponse>('/api/orders', input);
  },

  updateNotes: (id: number, notes: string) =>
    api.patch<{ order: DailyOrder }>(`/api/orders/${id}`, { notes }),

  /** 切换状态：pending → fulfilled → delivered，或反向回退一步。不能到 cancelled（走 cancel 路由）。 */
  setStatus: (id: number, status: 'pending' | 'fulfilled' | 'delivered') =>
    api.patch<{ order: DailyOrder }>(`/api/orders/${id}/status`, { status }),

  cancel: (id: number, reason?: string) =>
    api.patch<{ order: DailyOrder; card?: Card }>(`/api/orders/${id}/cancel`, { reason }),
};
