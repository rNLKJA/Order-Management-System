import { describe, it, expect } from 'vitest';
import type { CardSpec } from '@meal/shared';
import { computeRenew, RenewError } from './renew.js';

const WEEK_HOSPITAL: CardSpec = {
  code: 'week',
  name: '大周卡',
  meals: 10,
  unitPrice: 23,
  totalPrice: 230,
};

describe('computeRenew', () => {
  it('结转剩餐 + 按全价收款', () => {
    const r = computeRenew({
      oldStatus: 'active',
      oldRemainingMeals: 2,
      spec: WEEK_HOSPITAL,
    });
    expect(r.carriedMeals).toBe(2);
    expect(r.newTotalMeals).toBe(12); // 10 + 2
    expect(r.newRemainingMeals).toBe(12);
    expect(r.newUsedMeals).toBe(0);
    expect(r.newPaidAmount).toBe(230);
    expect(r.newUnitPrice).toBe(23);
  });

  it('剩餐 0 时也允许续（刚好用完）', () => {
    const r = computeRenew({
      oldStatus: 'active',
      oldRemainingMeals: 0,
      spec: WEEK_HOSPITAL,
    });
    expect(r.carriedMeals).toBe(0);
    expect(r.newTotalMeals).toBe(10);
  });

  it('非 active 卡 → RENEW_NOT_ALLOWED', () => {
    expect(() =>
      computeRenew({
        oldStatus: 'upgraded',
        oldRemainingMeals: 2,
        spec: WEEK_HOSPITAL,
      }),
    ).toThrow(RenewError);
  });

  it('剩餐 > 阈值 → RENEW_THRESHOLD_NOT_MET', () => {
    let caught: unknown = null;
    try {
      computeRenew({
        oldStatus: 'active',
        oldRemainingMeals: 5,
        spec: WEEK_HOSPITAL,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RenewError);
    expect((caught as RenewError).code).toBe('RENEW_THRESHOLD_NOT_MET');
  });

  it('剩餐负数按 0 结转（防御）', () => {
    const r = computeRenew({
      oldStatus: 'active',
      oldRemainingMeals: -1,
      spec: WEEK_HOSPITAL,
    });
    expect(r.carriedMeals).toBe(0);
    expect(r.newTotalMeals).toBe(10);
  });
});
