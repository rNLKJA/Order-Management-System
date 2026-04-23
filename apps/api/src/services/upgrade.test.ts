import { describe, expect, it } from 'vitest';
import type { CardSpec } from '@meal/shared';
import { computeUpgrade, UpgradeError } from './upgrade.js';

/**
 * 纯函数测试：升级的业务规则（与 plan §6.2 对齐）。
 *
 * 前提：
 * - 旧卡 status=active（路由层校验，这里假设传入的就是 active）
 * - 禁降级：newCat.totalPrice 必须严格 > old.paid_amount
 * - 差价 = newCat.totalPrice - old.paid_amount
 * - 新卡继承 used_meals = old.used_meals
 * - 新卡 remaining_meals = newCat.meals - old.used_meals
 * - 新卡 remaining_meals 不可为负（否则视作非法升级目标 -> INVALID_UPGRADE_MEALS）
 */
describe('computeUpgrade 纯函数', () => {
  const weekHospital: CardSpec = { code: 'week', name: '大周卡', meals: 10, unitPrice: 23, totalPrice: 230 };
  const monthHospital: CardSpec = { code: 'month', name: '月卡', meals: 40, unitPrice: 22, totalPrice: 880 };
  const experience: CardSpec = { code: 'experience', name: '体验卡', meals: 2, unitPrice: 25, totalPrice: 50 };
  const seasonHospital: CardSpec = {
    code: 'season',
    name: '季卡',
    meals: 120,
    unitPrice: 21,
    totalPrice: 2520,
  };

  it('体验卡升级到月卡：差价 = 880 - 50 = 830；新卡 meals=40 used=1 remaining=39', () => {
    const result = computeUpgrade({
      oldPaidAmount: 50,
      oldUsedMeals: 1,
      newCat: monthHospital,
    });
    expect(result.diff).toBe(830);
    expect(result.newTotalMeals).toBe(40);
    expect(result.newUsedMeals).toBe(1);
    expect(result.newRemainingMeals).toBe(39);
    expect(result.newUnitPrice).toBe(22);
    expect(result.newPaidAmount).toBe(880);
  });

  it('周卡升级到季卡（全新没吃过）：差价 = 2520 - 230 = 2290；继承 used=0', () => {
    const result = computeUpgrade({
      oldPaidAmount: 230,
      oldUsedMeals: 0,
      newCat: seasonHospital,
    });
    expect(result.diff).toBe(2290);
    expect(result.newUsedMeals).toBe(0);
    expect(result.newRemainingMeals).toBe(120);
  });

  it('同价卡抛 UpgradeError(UPGRADE_NOT_ALLOWED)', () => {
    expect(() =>
      computeUpgrade({ oldPaidAmount: 880, oldUsedMeals: 5, newCat: monthHospital }),
    ).toThrow(UpgradeError);
    try {
      computeUpgrade({ oldPaidAmount: 880, oldUsedMeals: 5, newCat: monthHospital });
    } catch (e) {
      expect((e as UpgradeError).code).toBe('UPGRADE_NOT_ALLOWED');
    }
  });

  it('降级（新卡更便宜）抛 UPGRADE_NOT_ALLOWED', () => {
    expect(() =>
      computeUpgrade({ oldPaidAmount: 880, oldUsedMeals: 2, newCat: weekHospital }),
    ).toThrow(UpgradeError);
  });

  it('降级到体验卡抛 UPGRADE_NOT_ALLOWED', () => {
    expect(() =>
      computeUpgrade({ oldPaidAmount: 230, oldUsedMeals: 0, newCat: experience }),
    ).toThrow(UpgradeError);
  });

  it('已用餐数恰好等于旧卡总数，升级后 remaining = newMeals（允许）', () => {
    const result = computeUpgrade({
      oldPaidAmount: 230,
      oldUsedMeals: 10,
      newCat: monthHospital,
    });
    expect(result.newUsedMeals).toBe(10);
    expect(result.newRemainingMeals).toBe(30);
  });

  it('已用餐数 > 新卡总餐数时抛 INVALID_UPGRADE_MEALS（不允许负余额）', () => {
    const tinyCard: CardSpec = { code: 'small_week', name: '小周卡', meals: 5, unitPrice: 25, totalPrice: 125 };
    expect(() =>
      computeUpgrade({ oldPaidAmount: 50, oldUsedMeals: 6, newCat: tinyCard }),
    ).toThrow(UpgradeError);
    try {
      computeUpgrade({ oldPaidAmount: 50, oldUsedMeals: 6, newCat: tinyCard });
    } catch (e) {
      expect((e as UpgradeError).code).toBe('INVALID_UPGRADE_MEALS');
    }
  });

  it('差价是浮点友好的（目录里都是整数，但保持 2 位小数的四舍五入行为）', () => {
    const cat: CardSpec = { code: 'month', name: '月卡', meals: 40, unitPrice: 25, totalPrice: 1000.55 };
    const result = computeUpgrade({
      oldPaidAmount: 280.33,
      oldUsedMeals: 0,
      newCat: cat,
    });
    expect(result.diff).toBeCloseTo(720.22, 2);
  });
});
