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

export const DEFAULT_TZ = 'Asia/Shanghai';

/** 格式化为人民币金额：1234.5 -> "¥1,234.50" */
export function formatCNY(amount: number | string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '¥0.00';
  return (
    '¥' +
    n.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** YYYY-MM-DD（Asia/Shanghai） */
export function formatDate(date: Date | string, tz: string = DEFAULT_TZ): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '00';
  const day = parts.find((p) => p.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

/** YYYY-MM-DD HH:mm（Asia/Shanghai） */
export function formatDateTime(date: Date | string, tz: string = DEFAULT_TZ): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** "10 餐" / "剩余 4 餐" */
export function formatMeals(qty: number, prefix = ''): string {
  return prefix ? `${prefix} ${qty} 餐` : `${qty} 餐`;
}

/**
 * 拼 UID：优先用昵称，其次用姓名；后缀带手机号。
 * 例：牙巴(13985739933)
 */
export function buildUid(
  nickname: string | null | undefined,
  name: string,
  phone: string,
): string {
  const prefix = (nickname && nickname.trim()) || name.trim();
  return `${prefix}(${phone})`;
}

/**
 * 业务日切分：Asia/Shanghai 时区下，某时刻归属的"业务日"。
 *
 * 规则：04:00 CST 为日切点。
 * - 2026-04-21 03:59 CST -> 属于 2026-04-20（前一业务日）
 * - 2026-04-21 04:00 CST -> 属于 2026-04-21
 */
export function businessDate(date: Date | string, tz: string = DEFAULT_TZ): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  // 减去 4 小时再按 tz 格式化，等价于"04:00 前算前一天"
  const shifted = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  return formatDate(shifted, tz);
}
