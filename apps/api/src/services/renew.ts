/**
 * 续卡纯函数核心。
 *
 * 语义：
 * - 续卡不改卡种，按当前卡规格再开一张同级新卡。
 * - 旧卡剩餐结转到新卡：`newTotal = spec.meals + oldRemaining`
 * - 旧卡 status 置为 'upgraded'（复用现有状态；通过 new.card_code === old.card_code 可与真正升级区分）
 * - 价格按当前价目表收取（新卡 paid_amount = spec.totalPrice），不按已用份数折价。
 *
 * 前提校验：
 * - 旧卡必须 active
 * - 旧卡 remaining_meals 必须 ≤ CARD_RENEWAL_THRESHOLD_MEALS（防止在"还很多餐"时滥用续卡绕过升级差价规则）
 *
 * 违规抛 RenewError，由 route 层翻成 HTTP 响应。
 */

import type { CardSpec } from '@meal/shared';
import { CARD_RENEWAL_THRESHOLD_MEALS } from '@meal/shared';

export type RenewErrorCode = 'RENEW_NOT_ALLOWED' | 'RENEW_THRESHOLD_NOT_MET';

export class RenewError extends Error {
  code: RenewErrorCode;
  constructor(code: RenewErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface RenewInput {
  oldStatus: 'active' | 'upgraded' | 'exhausted';
  oldRemainingMeals: number;
  spec: CardSpec;
}

export interface RenewResult {
  /** 新卡总餐数 = spec.meals + oldRemaining */
  newTotalMeals: number;
  newUsedMeals: number;
  newRemainingMeals: number;
  newUnitPrice: number;
  newPaidAmount: number;
  /** 结转餐数，用于展示 / 审计 */
  carriedMeals: number;
}

export function computeRenew(input: RenewInput): RenewResult {
  const { oldStatus, oldRemainingMeals, spec } = input;

  if (oldStatus !== 'active') {
    throw new RenewError(
      'RENEW_NOT_ALLOWED',
      `仅 active 状态的卡可续，当前状态：${oldStatus}`,
    );
  }

  if (oldRemainingMeals > CARD_RENEWAL_THRESHOLD_MEALS) {
    throw new RenewError(
      'RENEW_THRESHOLD_NOT_MET',
      `续卡前提：剩餐 ≤ ${CARD_RENEWAL_THRESHOLD_MEALS}，当前剩餐 ${oldRemainingMeals}`,
    );
  }

  const carried = Math.max(0, oldRemainingMeals);
  const newTotal = spec.meals + carried;

  return {
    newTotalMeals: newTotal,
    newUsedMeals: 0,
    newRemainingMeals: newTotal,
    newUnitPrice: spec.unitPrice,
    newPaidAmount: spec.totalPrice,
    carriedMeals: carried,
  };
}
