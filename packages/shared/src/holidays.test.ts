import { describe, expect, it } from 'vitest';
import { isHoliday, isWorkday, CN_HOLIDAYS_2026 } from './holidays';

describe('holidays', () => {
  it('2026 春节 2 月 17 日是节假日', () => {
    expect(isHoliday('2026-02-17')).toBe(true);
  });

  it('2026-04-22（周三）是工作日', () => {
    expect(isWorkday('2026-04-22')).toBe(true);
  });

  it('2026-04-18（周六）不是工作日', () => {
    expect(isWorkday('2026-04-18')).toBe(false);
  });

  it('2026-10-01（国庆）不是工作日', () => {
    expect(isWorkday('2026-10-01')).toBe(false);
  });

  it('清明 2026-04-05（周日）是节假日', () => {
    expect(isHoliday('2026-04-05')).toBe(true);
  });

  it('2027 的日期不在清单里 → 默认非节假日', () => {
    expect(isHoliday('2027-10-01')).toBe(false);
  });

  it('节假日清单 2026 有合理条目数', () => {
    expect(CN_HOLIDAYS_2026.size).toBeGreaterThan(20);
  });
});
