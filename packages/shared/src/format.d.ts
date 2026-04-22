/**
 * 格式化工具 - 前后端共用。
 *
 * 核心约定（来自 DESIGN.md）：
 * - 金额 ¥1,234.00
 * - 日期 YYYY-MM-DD
 * - 时间 HH:mm
 * - 份数 "10 餐" / "剩余 4 餐"
 * - 业务日分界 04:00 Asia/Shanghai
 */
export declare const DEFAULT_TZ = "Asia/Shanghai";
/** 格式化为人民币金额：1234.5 -> "¥1,234.50" */
export declare function formatCNY(amount: number | string): string;
/** YYYY-MM-DD（Asia/Shanghai） */
export declare function formatDate(date: Date | string, tz?: string): string;
/** YYYY-MM-DD HH:mm（Asia/Shanghai） */
export declare function formatDateTime(date: Date | string, tz?: string): string;
/** "10 餐" / "剩余 4 餐" */
export declare function formatMeals(qty: number, prefix?: string): string;
/**
 * 拼 UID：优先用昵称，其次用姓名；后缀带手机号。
 * 例：牙巴(13985739933)
 */
export declare function buildUid(nickname: string | null | undefined, name: string, phone: string): string;
/**
 * 业务日切分：Asia/Shanghai 时区下，某时刻归属的"业务日"。
 *
 * 规则：04:00 CST 为日切点。
 * - 2026-04-21 03:59 CST -> 属于 2026-04-20（前一业务日）
 * - 2026-04-21 04:00 CST -> 属于 2026-04-21
 */
export declare function businessDate(date: Date | string, tz?: string): string;
//# sourceMappingURL=format.d.ts.map