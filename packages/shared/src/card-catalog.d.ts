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
export type HospitalCardCode = 'experience' | 'small_week' | 'week' | 'month' | 'season' | 'year';
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
export declare const CARD_CATALOG: {
    /** 院外（普通会员）价目表 */
    readonly regular: {
        readonly week: {
            readonly code: "week";
            readonly name: "大周卡";
            readonly meals: 10;
            readonly unitPrice: 28;
            readonly totalPrice: 280;
        };
        readonly month: {
            readonly code: "month";
            readonly name: "月卡";
            readonly meals: 40;
            readonly unitPrice: 25;
            readonly totalPrice: 1000;
        };
        readonly season: {
            readonly code: "season";
            readonly name: "季卡";
            readonly meals: 120;
            readonly unitPrice: 22;
            readonly totalPrice: 2640;
        };
        readonly year: {
            readonly code: "year";
            readonly name: "年卡";
            readonly meals: 480;
            readonly unitPrice: 20;
            readonly totalPrice: 9600;
        };
    };
    /** 院内价目表 */
    readonly hospital: {
        readonly experience: {
            readonly code: "experience";
            readonly name: "体验卡";
            readonly meals: 2;
            readonly unitPrice: 25;
            readonly totalPrice: 50;
        };
        readonly small_week: {
            readonly code: "small_week";
            readonly name: "小周卡";
            readonly meals: 5;
            readonly unitPrice: 25;
            readonly totalPrice: 125;
        };
        readonly week: {
            readonly code: "week";
            readonly name: "大周卡";
            readonly meals: 10;
            readonly unitPrice: 23;
            readonly totalPrice: 230;
        };
        readonly month: {
            readonly code: "month";
            readonly name: "月卡";
            readonly meals: 40;
            readonly unitPrice: 22;
            readonly totalPrice: 880;
        };
        readonly season: {
            readonly code: "season";
            readonly name: "季卡";
            readonly meals: 120;
            readonly unitPrice: 21;
            readonly totalPrice: 2520;
        };
        readonly year: {
            readonly code: "year";
            readonly name: "年卡";
            readonly meals: 480;
            readonly unitPrice: 20;
            readonly totalPrice: 9600;
        };
    };
};
/** 散餐单价（非订阅，现款结算） */
export declare const AD_HOC_UNIT_PRICE = 35;
/**
 * 根据"会员是否院内 + 卡代码"取卡规格。
 */
export declare function getCardSpec(isHospital: boolean, code: SubscriptionCardCode): CardSpec | null;
/**
 * 列出某价目表下所有卡（按总价升序）。
 */
export declare function listCards(isHospital: boolean): CardSpec[];
/**
 * 升级可选项：在同一价目表下，总价严格大于当前已付金额的卡种。
 */
export declare function listUpgradeOptions(isHospital: boolean, currentPaidAmount: number): CardSpec[];
//# sourceMappingURL=card-catalog.d.ts.map