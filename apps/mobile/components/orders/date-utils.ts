import { addCalendarDaysShanghai, formatDate } from '@meal/shared';

/** 上海日历 YYYY-MM-DD 起算加减自然日（与设备时区无关） */

export function dateStrWithOffset(offsetDays: number): string {
  const today = formatDate(new Date());
  return addCalendarDaysShanghai(today, offsetDays);
}

export function todayStr(): string {
  return dateStrWithOffset(0);
}

export function tomorrowStr(): string {
  return dateStrWithOffset(1);
}
