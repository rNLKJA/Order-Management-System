/** 与订单屏历史逻辑一致：按 UTC+8 日历日换算 */

export function dateStrWithOffset(offsetDays: number): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  now.setUTCDate(now.getUTCDate() + offsetDays);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr(): string {
  return dateStrWithOffset(0);
}

export function tomorrowStr(): string {
  return dateStrWithOffset(1);
}
