/**
 * 中国法定节假日清单（手工维护）。
 *
 * Summary 的"基准线"计算排除周末和这些日子。每年末更新下一年清单。
 *
 * 数据源：国务院办公厅《xxxx年部分节假日安排通知》。
 * 格式：YYYY-MM-DD。只放法定假日（放假的日子）；调休补班不列（补班日视作工作日）。
 */
export declare const CN_HOLIDAYS_2026: ReadonlySet<string>;
export declare const CN_HOLIDAYS: Record<number, ReadonlySet<string>>;
/** 判断一个 YYYY-MM-DD 是否为法定节假日 */
export declare function isHoliday(dateStr: string): boolean;
/**
 * 判断一个 YYYY-MM-DD 是否为"工作日"。
 * 工作日 = 周一到周五 且 非法定节假日。
 */
export declare function isWorkday(dateStr: string): boolean;
//# sourceMappingURL=holidays.d.ts.map