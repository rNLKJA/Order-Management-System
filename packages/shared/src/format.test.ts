import { describe, expect, it } from 'vitest';
import {
  formatCNY,
  formatDate,
  formatDateTime,
  formatMeals,
  buildUid,
  businessDate,
} from './format';

describe('formatCNY', () => {
  it('整数金额带 .00', () => {
    expect(formatCNY(280)).toBe('¥280.00');
    expect(formatCNY(1000)).toBe('¥1,000.00');
  });

  it('两位小数保留', () => {
    expect(formatCNY(249.9)).toBe('¥249.90');
    expect(formatCNY(1234.56)).toBe('¥1,234.56');
  });

  it('0 正确展示', () => {
    expect(formatCNY(0)).toBe('¥0.00');
  });

  it('接受字符串输入', () => {
    expect(formatCNY('280')).toBe('¥280.00');
  });

  it('非法输入返回 ¥0.00', () => {
    expect(formatCNY(Number.NaN)).toBe('¥0.00');
  });
});

describe('formatDate / formatDateTime（Asia/Shanghai）', () => {
  it('YYYY-MM-DD 格式', () => {
    expect(formatDate('2026-04-21T04:00:00+08:00')).toBe('2026-04-21');
  });

  it('UTC 时间按上海时区转换', () => {
    // UTC 20:00 = 北京时间次日 04:00
    expect(formatDate('2026-04-20T20:00:00Z')).toBe('2026-04-21');
  });

  it('HH:mm 拼接', () => {
    const s = formatDateTime('2026-04-21T14:30:00+08:00');
    expect(s).toBe('2026-04-21 14:30');
  });
});

describe('formatMeals', () => {
  it('无前缀', () => {
    expect(formatMeals(10)).toBe('10 餐');
  });

  it('带前缀', () => {
    expect(formatMeals(4, '剩余')).toBe('剩余 4 餐');
  });
});

describe('buildUid', () => {
  it('有昵称用昵称', () => {
    expect(buildUid('牙巴', '杨晓芸', '13985739933')).toBe('牙巴(13985739933)');
  });

  it('无昵称 fallback 姓名', () => {
    expect(buildUid('', '郭娟', '18685300806')).toBe('郭娟(18685300806)');
  });

  it('昵称带空格会 trim', () => {
    expect(buildUid('  小米  ', '武亚敏', '18685398777')).toBe('小米(18685398777)');
  });
});

describe('businessDate（04:00 业务日切点）', () => {
  it('北京时间 03:59 属于前一业务日', () => {
    // 北京时间 2026-04-21 03:59 = UTC 2026-04-20 19:59
    expect(businessDate('2026-04-20T19:59:00Z')).toBe('2026-04-20');
  });

  it('北京时间 04:00 属于当天', () => {
    expect(businessDate('2026-04-20T20:00:00Z')).toBe('2026-04-21');
  });

  it('北京时间中午', () => {
    expect(businessDate('2026-04-21T04:00:00Z')).toBe('2026-04-21');
  });
});
