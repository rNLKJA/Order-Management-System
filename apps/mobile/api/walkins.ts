/**
 * 散客目录 API 封装 —— 对齐 apps/api/src/routes/walkins.ts。
 */

import { api } from './client';
import type { Member } from './members';
import type { DailyOrder } from './orders';

export interface WalkinStats {
  order_count: number;
  active_order_count: number;
  total_meals: number;
  total_spent: number;
  last_order_date: string | null;
  first_order_date: string | null;
}

export interface WalkinRow extends Member {
  stats: WalkinStats;
}

export interface WalkinListResp {
  items: WalkinRow[];
  total: number;
}

export interface WalkinDetailResp {
  member: Member;
  orders: DailyOrder[];
  stats: WalkinStats;
}

export const walkinsApi = {
  list: () => api.get<WalkinListResp>('/api/walkins'),
  detail: (id: number) => api.get<WalkinDetailResp>(`/api/walkins/${id}`),
};
