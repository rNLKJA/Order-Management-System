/**
 * 用户查询 + 当前用户头像上传 + 每个用户的订单流水。
 */

import type { AuthUser } from '@meal/shared';
import { api } from './client';
import type { DailyOrder } from './orders';

export interface ApiUser {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'staff';
  is_active: boolean;
  avatar_url?: string | null;
  can_data_write?: boolean;
  is_superadmin?: boolean;
}

export interface ApiUserOrder {
  order: DailyOrder;
  member: {
    id: number;
    name: string;
    nickname: string;
    phone: string;
    is_hospital: boolean;
    is_walkin: boolean;
  } | null;
}

export interface UserOrderSummary {
  total_orders: number;
  total_meals: number;
  total_amount: number;
  pending_count: number;
  fulfilled_count: number;
  delivered_count: number;
  cancelled_count: number;
}

export interface AdminPermissionState {
  enforcement: boolean;
  operators: string[];
  users: ApiUser[];
}

export interface CreateStaffInput {
  username: string;
  full_name: string;
  password: string;
  is_active?: boolean;
  can_data_write?: boolean;
  /** 仅超级管理员可设为 `admin` */
  role?: 'admin' | 'staff';
}

export const usersApi = {
  list: () => api.get<{ users: ApiUser[] }>('/api/users'),

  get: (id: number) => api.get<{ user: ApiUser }>(`/api/users/${id}`),

  permissions: () =>
    api.get<AdminPermissionState>('/api/users/permissions/data-operators'),

  updateAccess: (
    id: number,
    input: {
      role?: 'admin' | 'staff';
      is_active?: boolean;
      can_data_write?: boolean;
    },
  ) => api.patch<{ user: ApiUser; operators: string[] }>(`/api/users/${id}/access`, input),

  updatePassword: (id: number, password: string) =>
    api.patch<{ ok: true; user: { id: number; username: string; full_name: string } }>(
      `/api/users/${id}/password`,
      { password },
    ),

  createStaff: (input: CreateStaffInput) =>
    api.post<{ user: ApiUser }>('/api/users/staff', input),

  deleteUser: (id: number) => api.delete<{ ok: true }>(`/api/users/${id}`),

  /** 某员工录入的订单流水（按日期 + 创建时间倒序） */
  orders: (id: number, opts?: { from?: string; to?: string; status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (opts?.from) qs.set('from', opts.from);
    if (opts?.to) qs.set('to', opts.to);
    if (opts?.status) qs.set('status', opts.status);
    if (opts?.limit != null) qs.set('limit', String(opts.limit));
    if (opts?.offset != null) qs.set('offset', String(opts.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ orders: ApiUserOrder[] }>(`/api/users/${id}/orders${suffix}`);
  },

  /** 某员工录入统计汇总 */
  orderSummary: (id: number) =>
    api.get<UserOrderSummary>(`/api/users/${id}/order-summary`),

  /** 上传当前用户头像（base64 data URL） */
  updateMyAvatar: (avatar: string) =>
    api.patch<{ user: AuthUser }>('/api/users/me/avatar', { avatar }),

  /** 清空当前用户头像 */
  clearMyAvatar: () => api.delete<{ user: AuthUser }>('/api/users/me/avatar'),
};
