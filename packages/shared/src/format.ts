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

/**
 * 上海日历日 YYYY-MM-DD 当天正午（上海）对应的 UTC 瞬时。
 * 用于在同日历上做加减，不依赖设备本地时区。
 */
export function shanghaiNoon(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return new Date(Number.NaN);
  return new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
}

/** 以上海日历日为单位加减自然日，返回新的 YYYY-MM-DD */
export function addCalendarDaysShanghai(isoDate: string, delta: number): string {
  const base = shanghaiNoon(isoDate);
  if (!Number.isFinite(base.getTime())) return isoDate;
  base.setUTCDate(base.getUTCDate() + delta);
  return formatDate(base.toISOString());
}

/** 上海日历上增减整年（仅改年份，月日不变） */
export function addCalendarYearsShanghai(isoDate: string, deltaYears: number): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return isoDate;
  const ny = y + deltaYears;
  return `${String(ny).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function startOfMonthShanghai(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number);
  if (!y || !m) return isoDate;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
}

export function startOfYearShanghai(isoDate: string): string {
  const y = Number(isoDate.slice(0, 4));
  if (!Number.isFinite(y)) return isoDate;
  return `${String(y).padStart(4, '0')}-01-01`;
}

function weekdayMondayOffsetShanghai(isoDate: string): number {
  const d = shanghaiNoon(isoDate);
  if (!Number.isFinite(d.getTime())) return 0;
  const w = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TZ,
    weekday: 'short',
  }).format(d);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[w] ?? 0;
}

/** 包含 isoDate 的那一周（周一至周日）的周一，上海日历 */
export function mondayOfWeekShanghai(isoDate: string): string {
  return addCalendarDaysShanghai(isoDate, -weekdayMondayOffsetShanghai(isoDate));
}

/** 上海日历两端日期包含在内的自然日天数 */
export function diffCalendarDaysInclusiveShanghai(from: string, to: string): number {
  const a = shanghaiNoon(from).getTime();
  const b = shanghaiNoon(to).getTime();
  const ms = b - a;
  if (!Number.isFinite(ms) || ms < 0) return 1;
  return Math.floor(ms / 86_400_000) + 1;
}

/** 首页副标题：「M月D日  星期一」口径（上海日历） */
export function shanghaiCalendarMetaLine(now: Date = new Date()): string {
  const iso = formatDate(now);
  const d = shanghaiNoon(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const weekdayFmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: DEFAULT_TZ,
    weekday: 'long',
  });
  const mdFmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: DEFAULT_TZ,
    month: 'numeric',
    day: 'numeric',
  });
  const mdParts = mdFmt.formatToParts(d);
  const month = mdParts.find((p) => p.type === 'month')?.value ?? '';
  const day = mdParts.find((p) => p.type === 'day')?.value ?? '';
  const weekday = weekdayFmt.format(d);
  return `${month}月${day}日  ${weekday}`;
}

/** 「M月D日」（上海日历），用于页内「今日 …」文案 */
export function shanghaiMonthDayLine(now: Date = new Date()): string {
  const iso = formatDate(now);
  const d = shanghaiNoon(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const mdFmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: DEFAULT_TZ,
    month: 'numeric',
    day: 'numeric',
  });
  const mdParts = mdFmt.formatToParts(d);
  const month = mdParts.find((p) => p.type === 'month')?.value ?? '';
  const day = mdParts.find((p) => p.type === 'day')?.value ?? '';
  return `${month}月${day}日`;
}
