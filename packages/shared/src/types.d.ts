/**
 * 业务类型定义（前后端共用）。
 *
 * DB 行的实际类型由 Drizzle schema 自动推导（见 apps/api/src/db/schema.ts），
 * 这里只放"跨前后端的契约类型"，包括枚举、DTO、API 响应形状。
 */
export type UserRole = 'admin' | 'staff';
export type OrderStatus = 'pending' | 'fulfilled' | 'delivered' | 'cancelled';
export declare const ORDER_STATUS_LABEL: Record<OrderStatus, string>;
export type MealType = 'lunch' | 'dinner';
export declare const MEAL_TYPE_LABEL: Record<MealType, string>;
export type CardStatus = 'active' | 'upgraded' | 'exhausted';
export declare const CARD_STATUS_LABEL: Record<CardStatus, string>;
export type FinanceType = 'income' | 'expense';
export type FinanceCategory = 'hospital_sub' | 'regular_sub' | 'ad_hoc' | 'manual_expense' | 'legacy_income' | 'legacy_expense';
export declare const FINANCE_CATEGORY_LABEL: Record<FinanceCategory, string>;
export type FinanceSource = 'auto' | 'manual' | 'imported_legacy';
export type AuditAction = 'create' | 'update' | 'delete' | 'fulfill' | 'deliver' | 'cancel';
export type AuditEntity = 'member' | 'card' | 'daily_order' | 'finance_entry' | 'user';
export declare const SETTING_KEYS: {
    readonly DEFAULT_COLLECTOR_USER_ID: "default_collector_user_id";
    readonly DEFAULT_RECORDER_USER_ID: "default_recorder_user_id";
    readonly DEFAULT_DELIVERY_HOSPITAL_USER_ID: "default_delivery_hospital_user_id";
    readonly DEFAULT_DELIVERY_REGULAR_USER_ID: "default_delivery_regular_user_id";
    readonly AD_HOC_PRICE: "ad_hoc_price";
    readonly ORDER_CUTOFF_HOUR: "order_cutoff_hour";
    readonly RENEWAL_THRESHOLD: "renewal_threshold";
    readonly INCOME_AUTO_CATEGORIES: "income_auto_categories";
};
export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface AuthTokenPayload {
    sub: number;
    role: UserRole;
    ver: number;
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
//# sourceMappingURL=types.d.ts.map