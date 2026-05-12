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
  /** 散客姓名（非空 → walk-in 订单，不扣卡） */
  customer_name: string;
  status: 'pending' | 'fulfilled' | 'delivered' | 'cancelled';
  fulfilled_at: string | null;
  fulfilled_by_user_id: number | null;
  delivered_at: string | null;
  delivered_by_user_id: number | null;
  cancelled_at: string | null;
  cancelled_by_user_id: number | null;
  cancel_reason: string;
  /** 送餐渠道：self=本店员工自送；courier=外包快递 */
  delivery_channel: 'self' | 'courier';
  /** 外包渠道承运方标识（快递公司名 / 骑手 id） */
  courier_ref: string;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
  notes: string;
  /** 赠送餐：不扣次、送达不计收入 */
  is_gift: boolean;
  /** 员工餐（股东/内部送餐等标记） */
  is_staff_meal?: boolean;
  /** JSON 数组字符串，客户端可 JSON.parse（若 proof_set_id 有值，列表接口会展开合并进此字段） */
  proof_images_json: string;
  proof_set_id?: number | null;
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
  /** 会员模式必传；散客模式可省略，改用 customer_name */
  member_id?: number;
  order_date: string;
  lunch_qty?: number;
  dinner_qty?: number;
  notes?: string;
  /** 散客姓名 */
  customer_name?: string;
  /** 散客联系方式（可选，留空就不覆盖现有档案） */
  customer_phone?: string;
  customer_wechat?: string;
  customer_address?: string;
  customer_is_hospital?: boolean;
  /** 散客模式自定义单价（覆盖 ad_hoc_price） */
  adhoc_unit_price?: number;
  /** 送餐渠道：self=自送（默认）；courier=外包快递 */
  delivery_channel?: 'self' | 'courier';
  /** 快递承运方标识（快递公司 / 骑手 id） */
  courier_ref?: string;
  created_by_user_id?: number;
  /** 赠送餐：不扣会员卡次数 */
  is_gift?: boolean;
  /** 员工餐标记 */
  is_staff_meal?: boolean;
  /** 订餐凭证截图 data URL，至少 1 张 */
  proof_images: string[];
}

export interface CreateOrderResponse {
  orders: DailyOrder[];
  card?: Card;
  card_exhausted?: boolean;
}

export interface OrderBatchCreateInput {
  proof_images: string[];
  entries: Array<
    Omit<CreateOrderInput, 'proof_images'>
  >;
}

export interface OrderListParams {
  member_id?: number;
  created_by_user_id?: number;
  /** 单日筛选。与 from/to 互斥；传了 date 就忽略 from/to */
  date?: string;
  /** 起始日期（含），YYYY-MM-DD */
  from?: string;
  /** 截止日期（含），YYYY-MM-DD */
  to?: string;
  status?: 'pending' | 'fulfilled' | 'delivered' | 'cancelled' | 'all';
  meal_type?: 'lunch' | 'dinner' | 'all';
  zone?: 'all' | 'hospital' | 'regular';
  delivery_channel?: 'all' | 'self' | 'courier';
  limit?: number;
  offset?: number;
}

export const ordersApi = {
  list: (params: OrderListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.member_id != null) qs.set('member_id', String(params.member_id));
    if (params.created_by_user_id != null) qs.set('created_by_user_id', String(params.created_by_user_id));
    if (params.date) qs.set('date', params.date);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.status) qs.set('status', params.status);
    if (params.meal_type) qs.set('meal_type', params.meal_type);
    if (params.zone) qs.set('zone', params.zone);
    if (params.delivery_channel) qs.set('delivery_channel', params.delivery_channel);
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

  create: (input: CreateOrderInput, idempotencyKey?: string) =>
    api.post<CreateOrderResponse>(
      '/api/orders',
      input,
      idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
    ),

  batchCreate: (input: OrderBatchCreateInput) =>
    api.post<CreateOrderResponse>('/api/orders/batch', input),

  updateNotes: (id: number, notes: string) =>
    api.patch<{ order: DailyOrder }>(`/api/orders/${id}`, { notes }),

  /** 切换状态：pending → fulfilled → delivered，或反向回退一步。不能到 cancelled（走 cancel 路由）。 */
  setStatus: (id: number, status: 'pending' | 'fulfilled' | 'delivered') =>
    api.patch<{ order: DailyOrder }>(`/api/orders/${id}/status`, { status }),

  cancel: (id: number, reason?: string) =>
    api.patch<{ order: DailyOrder; card?: Card }>(`/api/orders/${id}/cancel`, { reason }),

  markDeliveryFailed: (id: number, reason: string) =>
    api.patch<{ order: DailyOrder; card?: Card }>(`/api/orders/${id}/delivery-failed`, { reason }),
};
