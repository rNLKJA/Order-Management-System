/**
 * 业务类型定义（前后端共用）。
 *
 * DB 行的实际类型由 Drizzle schema 自动推导（见 apps/api/src/db/schema.ts），
 * 这里只放"跨前后端的契约类型"，包括枚举、DTO、API 响应形状。
 */

// =========== 角色 & 权限 ===========

export type UserRole = 'admin' | 'staff';

/** 界面展示：超级管理员（@rNLKJA）/ 管理员 / 员工 */
export function displayUserRole(u: { role: UserRole; is_superadmin?: boolean | null }): string {
  if (u.is_superadmin) return '超级管理员';
  if (u.role === 'admin') return '管理员';
  return '员工';
}

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

export type CardStatus = 'active' | 'upgraded' | 'exhausted' | 'refunded';

export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  active: '进行中',
  upgraded: '已升级',
  exhausted: '已用完',
  refunded: '已退卡',
};

// =========== 财务分类 ===========

export type FinanceType = 'income' | 'expense';

export type FinanceCategory =
  | 'hospital_sub'
  | 'regular_sub'
  | 'ad_hoc'
  | 'card_prepaid_hospital'
  | 'card_prepaid_regular'
  | 'meal_earned_hospital'
  | 'meal_earned_regular'
  | 'meal_earned_walkin'
  | 'manual_expense'
  | 'legacy_income'
  | 'legacy_expense';

export const FINANCE_CATEGORY_LABEL: Record<FinanceCategory, string> = {
  hospital_sub: '院内办卡（旧·预收）',
  regular_sub: '院外办卡（旧·预收）',
  ad_hoc: '散餐送达（旧口径）',
  card_prepaid_hospital: '院内办卡（预收）',
  card_prepaid_regular: '院外办卡（预收）',
  meal_earned_hospital: '院内餐·已送达',
  meal_earned_regular: '院外餐·已送达',
  meal_earned_walkin: '散客餐·已送达',
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

/** 审计记录：实体类型中文说明（界面用） */
export const AUDIT_ENTITY_LABEL: Record<AuditEntity, string> = {
  member: '会员',
  card: '会员卡',
  daily_order: '订餐订单',
  finance_entry: '财务流水',
  user: '账号与权限',
};

/** 审计记录：操作类型中文说明（界面用） */
export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  create: '新建',
  update: '更新',
  delete: '删除',
  fulfill: '出餐',
  deliver: '送达',
  cancel: '取消',
};

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
  /** rNLKJA 专属最高权限标记 */
  is_superadmin?: boolean;
  /** data URL；无头像为 null */
  avatar_url?: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
