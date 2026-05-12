/**
 * 卡升级的纯函数核心（与 plan §6.2 对齐）。
 *
 * 规则：
 * - 禁降级：newCat.totalPrice 必须严格 > old.paid_amount
 * - 差价 = newCat.totalPrice - old.paid_amount
 * - 新卡继承 used_meals = old.used_meals（从员工卡 staff 升到付费卡时视为 0）
 * - 新卡 remaining_meals = newCat.meals - effectiveUsed（不可为负）
 *
 * 任何违规都抛 UpgradeError，由 route 层翻成 HTTP 响应。
 */

import type { CardSpec } from '@meal/shared';

export type UpgradeErrorCode = 'UPGRADE_NOT_ALLOWED' | 'INVALID_UPGRADE_MEALS';

export class UpgradeError extends Error {
  code: UpgradeErrorCode;
  constructor(code: UpgradeErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface UpgradeInput {
  oldPaidAmount: number;
  oldUsedMeals: number;
  /** 从员工卡升到付费卡时，已用员工餐不计入新卡剩余餐数 */
  oldCardCode?: string;
  newCat: CardSpec;
}

export interface UpgradeResult {
  diff: number;
  newTotalMeals: number;
  newUsedMeals: number;
  newRemainingMeals: number;
  newUnitPrice: number;
  newPaidAmount: number;
}

export function computeUpgrade(input: UpgradeInput): UpgradeResult {
  const { oldPaidAmount, oldUsedMeals, newCat } = input;
  const leavingStaff =
    input.oldCardCode === 'staff' && newCat.code !== 'staff';
  const effectiveUsed = leavingStaff ? 0 : oldUsedMeals;

  if (newCat.totalPrice <= oldPaidAmount) {
    throw new UpgradeError(
      'UPGRADE_NOT_ALLOWED',
      `新卡总价 ¥${newCat.totalPrice} 需严格大于旧卡已付 ¥${oldPaidAmount}（禁降级 / 禁同价）`,
    );
  }

  if (effectiveUsed > newCat.meals) {
    throw new UpgradeError(
      'INVALID_UPGRADE_MEALS',
      `旧卡已用 ${effectiveUsed} 餐超过新卡总餐数 ${newCat.meals}，无法升级到该卡种`,
    );
  }

  const diff = round2(newCat.totalPrice - oldPaidAmount);

  return {
    diff,
    newTotalMeals: newCat.meals,
    newUsedMeals: effectiveUsed,
    newRemainingMeals: newCat.meals - effectiveUsed,
    newUnitPrice: newCat.unitPrice,
    newPaidAmount: newCat.totalPrice,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
