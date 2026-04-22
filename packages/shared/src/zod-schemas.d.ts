/**
 * Zod schemas - 前后端共用的输入输出契约。
 *
 * 后端 Hono 路由用这些做 body 校验；前端表单也用它们在提交前校验，
 * 保持前后端同步（改一处，两端都变）。
 */
import { z } from 'zod';
/** 中国大陆 11 位手机号 */
export declare const zPhone: z.ZodString;
/** 微信号 6-20 位字母数字下划线或连字符（可为空） */
export declare const zWechatId: z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>;
/** CNY 金额，非负，最多两位小数 */
export declare const zAmount: z.ZodNumber;
/** ISO 8601 带时区 */
export declare const zIsoDateTime: z.ZodString;
/** YYYY-MM-DD 日期 */
export declare const zDate: z.ZodString;
export declare const loginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export declare const memberCreateSchema: z.ZodObject<{
    name: z.ZodString;
    nickname: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    phone: z.ZodString;
    wechat_id: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>>;
    address: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    dietary_notes: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    is_hospital: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    nickname: string;
    phone: string;
    wechat_id: string;
    address: string;
    dietary_notes: string;
    is_hospital: boolean;
}, {
    name: string;
    phone: string;
    nickname?: string | undefined;
    wechat_id?: string | undefined;
    address?: string | undefined;
    dietary_notes?: string | undefined;
    is_hospital?: boolean | undefined;
}>;
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export declare const memberUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    nickname: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodString>>>;
    phone: z.ZodOptional<z.ZodString>;
    wechat_id: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>>>;
    address: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodString>>>;
    dietary_notes: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodString>>>;
    is_hospital: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    nickname?: string | undefined;
    phone?: string | undefined;
    wechat_id?: string | undefined;
    address?: string | undefined;
    dietary_notes?: string | undefined;
    is_hospital?: boolean | undefined;
}, {
    name?: string | undefined;
    nickname?: string | undefined;
    phone?: string | undefined;
    wechat_id?: string | undefined;
    address?: string | undefined;
    dietary_notes?: string | undefined;
    is_hospital?: boolean | undefined;
}>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
export declare const cardPurchaseSchema: z.ZodObject<{
    member_id: z.ZodNumber;
    card_code: z.ZodEnum<["experience", "small_week", "week", "month", "season", "year"]>;
    is_hospital: z.ZodBoolean;
    collector_user_id: z.ZodOptional<z.ZodNumber>;
    created_by_user_id: z.ZodOptional<z.ZodNumber>;
    purchased_at: z.ZodOptional<z.ZodString>;
    notes: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    is_hospital: boolean;
    member_id: number;
    card_code: "week" | "month" | "season" | "year" | "experience" | "small_week";
    notes: string;
    collector_user_id?: number | undefined;
    created_by_user_id?: number | undefined;
    purchased_at?: string | undefined;
}, {
    is_hospital: boolean;
    member_id: number;
    card_code: "week" | "month" | "season" | "year" | "experience" | "small_week";
    collector_user_id?: number | undefined;
    created_by_user_id?: number | undefined;
    purchased_at?: string | undefined;
    notes?: string | undefined;
}>;
export type CardPurchaseInput = z.infer<typeof cardPurchaseSchema>;
export declare const cardUpgradeSchema: z.ZodObject<{
    card_code: z.ZodEnum<["experience", "small_week", "week", "month", "season", "year"]>;
    is_hospital: z.ZodBoolean;
    collector_user_id: z.ZodOptional<z.ZodNumber>;
    created_by_user_id: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    is_hospital: boolean;
    card_code: "week" | "month" | "season" | "year" | "experience" | "small_week";
    notes: string;
    collector_user_id?: number | undefined;
    created_by_user_id?: number | undefined;
}, {
    is_hospital: boolean;
    card_code: "week" | "month" | "season" | "year" | "experience" | "small_week";
    collector_user_id?: number | undefined;
    created_by_user_id?: number | undefined;
    notes?: string | undefined;
}>;
export type CardUpgradeInput = z.infer<typeof cardUpgradeSchema>;
export declare const orderCreateSchema: z.ZodEffects<z.ZodObject<{
    member_id: z.ZodNumber;
    order_date: z.ZodString;
    lunch_qty: z.ZodDefault<z.ZodNumber>;
    dinner_qty: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    created_by_user_id: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    member_id: number;
    notes: string;
    order_date: string;
    lunch_qty: number;
    dinner_qty: number;
    created_by_user_id?: number | undefined;
}, {
    member_id: number;
    order_date: string;
    created_by_user_id?: number | undefined;
    notes?: string | undefined;
    lunch_qty?: number | undefined;
    dinner_qty?: number | undefined;
}>, {
    member_id: number;
    notes: string;
    order_date: string;
    lunch_qty: number;
    dinner_qty: number;
    created_by_user_id?: number | undefined;
}, {
    member_id: number;
    order_date: string;
    created_by_user_id?: number | undefined;
    notes?: string | undefined;
    lunch_qty?: number | undefined;
    dinner_qty?: number | undefined;
}>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export declare const orderUpdateSchema: z.ZodObject<{
    order_date: z.ZodOptional<z.ZodString>;
    meal_type: z.ZodOptional<z.ZodEnum<["lunch", "dinner"]>>;
    quantity: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    created_by_user_id: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    created_by_user_id?: number | undefined;
    notes?: string | undefined;
    order_date?: string | undefined;
    meal_type?: "lunch" | "dinner" | undefined;
    quantity?: number | undefined;
}, {
    created_by_user_id?: number | undefined;
    notes?: string | undefined;
    order_date?: string | undefined;
    meal_type?: "lunch" | "dinner" | undefined;
    quantity?: number | undefined;
}>;
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;
export declare const orderCancelSchema: z.ZodObject<{
    reason: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason?: string | undefined;
}>;
export type OrderCancelInput = z.infer<typeof orderCancelSchema>;
export declare const expenseCreateSchema: z.ZodObject<{
    entry_date: z.ZodString;
    amount: z.ZodNumber;
    description: z.ZodString;
    created_by_user_id: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    entry_date: string;
    amount: number;
    description: string;
    created_by_user_id?: number | undefined;
}, {
    entry_date: string;
    amount: number;
    description: string;
    created_by_user_id?: number | undefined;
}>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export declare const financeUpdateSchema: z.ZodObject<{
    entry_date: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entry_date?: string | undefined;
    amount?: number | undefined;
    description?: string | undefined;
    category?: string | undefined;
}, {
    entry_date?: string | undefined;
    amount?: number | undefined;
    description?: string | undefined;
    category?: string | undefined;
}>;
export type FinanceUpdateInput = z.infer<typeof financeUpdateSchema>;
export declare const userCreateSchema: z.ZodObject<{
    username: z.ZodString;
    full_name: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["admin", "staff"]>>;
}, "strip", z.ZodTypeAny, {
    username: string;
    full_name: string;
    role: "admin" | "staff";
}, {
    username: string;
    full_name: string;
    role?: "admin" | "staff" | undefined;
}>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export declare const userUpdateSchema: z.ZodObject<{
    full_name: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["admin", "staff"]>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    full_name?: string | undefined;
    role?: "admin" | "staff" | undefined;
    is_active?: boolean | undefined;
}, {
    full_name?: string | undefined;
    role?: "admin" | "staff" | undefined;
    is_active?: boolean | undefined;
}>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
//# sourceMappingURL=zod-schemas.d.ts.map