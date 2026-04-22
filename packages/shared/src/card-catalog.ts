/**
 * 卡种目录 - 业务核心配置。
 *
 * 变更方式：
 * 1. 修改本文件的 totalPrice / meals / unitPrice。
 * 2. 已存在的卡记录保留原 paid_amount / unit_price / total_meals，不受新价格影响。
 * 3. 新购 / 升级按新目录计算。
 *
 * 卡永不过期：系统不存在 expired_at / 过期 cron / 时间失效逻辑。
 */

export type CardZone = 'regular' | 'hospital';

export type RegularCardCode = 'week' | 'month' | 'season' | 'year';
export type HospitalCardCode =
  | 'experience'
  | 'small_week'
  | 'week'
  | 'month'
  | 'season'
  | 'year';
export type SubscriptionCardCode = RegularCardCode | HospitalCardCode;

export interface CardSpec {
  /** 机器码，存库用 */
  code: SubscriptionCardCode;
  /** 中文展示名 */
  name: string;
  /** 总餐数 */
  meals: number;
  /** 单价（元） */
  unitPrice: number;
  /** 总价（元） */
  totalPrice: number;
}

export const CARD_CATALOG = {
  /** 院外（普通会员）价目表 */
  regular: {
    week: { code: 'week', name: '大周卡', meals: 10, unitPrice: 28, totalPrice: 280 },
    month: { code: 'month', name: '月卡', meals: 40, unitPrice: 25, totalPrice: 1000 },
    season: { code: 'season', name: '季卡', meals: 120, unitPrice: 22, totalPrice: 2640 },
    year: { code: 'year', name: '年卡', meals: 480, unitPrice: 20, totalPrice: 9600 },
  },
  /** 院内价目表 */
  hospital: {
    experience: { code: 'experience', name: '体验卡', meals: 2, unitPrice: 25, totalPrice: 50 },
    small_week: { code: 'small_week', name: '小周卡', meals: 5, unitPrice: 25, totalPrice: 125 },
    week: { code: 'week', name: '大周卡', meals: 10, unitPrice: 23, totalPrice: 230 },
    month: { code: 'month', name: '月卡', meals: 40, unitPrice: 22, totalPrice: 880 },
    season: { code: 'season', name: '季卡', meals: 120, unitPrice: 21, totalPrice: 2520 },
    year: { code: 'year', name: '年卡', meals: 480, unitPrice: 20, totalPrice: 9600 },
  },
} as const satisfies Record<CardZone, Record<string, CardSpec>>;

/** 散餐单价（非订阅，现款结算） */
export const AD_HOC_UNIT_PRICE = 35;

/**
 * 根据"会员是否院内 + 卡代码"取卡规格。
 */
export function getCardSpec(isHospital: boolean, code: SubscriptionCardCode): CardSpec | null {
  if (isHospital) {
    const hospitalCatalog = CARD_CATALOG.hospital as Record<string, CardSpec>;
    return hospitalCatalog[code] ?? null;
  }
  const regularCatalog = CARD_CATALOG.regular as Record<string, CardSpec>;
  return regularCatalog[code] ?? null;
}

/**
 * 列出某价目表下所有卡（按总价升序）。
 */
export function listCards(isHospital: boolean): CardSpec[] {
  const catalog = isHospital ? CARD_CATALOG.hospital : CARD_CATALOG.regular;
  return Object.values(catalog).sort((a, b) => a.totalPrice - b.totalPrice);
}

/**
 * 升级可选项：在同一价目表下，总价严格大于当前已付金额的卡种。
 */
export function listUpgradeOptions(
  isHospital: boolean,
  currentPaidAmount: number,
): CardSpec[] {
  return listCards(isHospital).filter((c) => c.totalPrice > currentPaidAmount);
}
