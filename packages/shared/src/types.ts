/**
 * 业务类型定义（前后端共用）。
 *
 * DB 行的实际类型由 Drizzle schema 自动推导（见 apps/api/src/db/schema.ts），
 * 这里只放"跨前后端的契约类型"，包括枚举、DTO、API 响应形状。
 */

// =========== 角色 & 权限 ===========

export type UserRole = 'admin' | 'staff';

// =========== 订单状态机 ===========

export type OrderStatus = 'pending' | 'fulfilled' | 'delivered' | 'cancelled';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '等待出餐',
  fulfilled: '已出餐',
  delivered: '已送达',
  cancelled: '已取消',
};

export type MealType = 'lunch' | 'dinner';

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  lunch: '午餐',
  dinner: '晚餐',
};

// =========== 卡状态 ===========

export type CardStatus = 'active' | 'upgraded' | 'exhausted';

export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  active: '进行中',
  upgraded: '已升级',
  exhausted: '已用完',
};

// =========== 财务分类 ===========

export type FinanceType = 'income' | 'expense';

export type FinanceCategory =
  | 'hospital_sub'
  | 'regular_sub'
  | 'ad_hoc'
  | 'manual_expense'
  | 'legacy_income'
  | 'legacy_expense';

export const FINANCE_CATEGORY_LABEL: Record<FinanceCategory, string> = {
  hospital_sub: '院内订阅',
  regular_sub: '院外订阅',
  ad_hoc: '散餐',
  manual_expense: '手动支出',
  legacy_income: '历史收入（迁移）',
  legacy_expense: '历史支出（迁移）',
};

export type FinanceSource = 'auto' | 'manual' | 'imported_legacy';

// =========== AuditLog ===========

export type AuditAction = 'create' | 'update' | 'delete' | 'fulfill' | 'deliver' | 'cancel';

export type AuditEntity =
  | 'member'
  | 'card'
  | 'daily_order'
  | 'finance_entry'
  | 'user';

// =========== Settings key 枚举 ===========

export const SETTING_KEYS = {
  DEFAULT_COLLECTOR_USER_ID: 'default_collector_user_id',
  DEFAULT_RECORDER_USER_ID: 'default_recorder_user_id',
  DEFAULT_DELIVERY_HOSPITAL_USER_ID: 'default_delivery_hospital_user_id',
  DEFAULT_DELIVERY_REGULAR_USER_ID: 'default_delivery_regular_user_id',
  AD_HOC_PRICE: 'ad_hoc_price',
  ORDER_CUTOFF_HOUR: 'order_cutoff_hour',
  RENEWAL_THRESHOLD: 'renewal_threshold',
  INCOME_AUTO_CATEGORIES: 'income_auto_categories',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// =========== 公共 API 形状 ===========

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuthTokenPayload {
  sub: number; // user id
  role: UserRole;
  ver: number; // token_version
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
