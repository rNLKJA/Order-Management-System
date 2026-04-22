/**
 * 中国法定节假日清单（手工维护）。
 *
 * Summary 的"基准线"计算排除周末和这些日子。每年末更新下一年清单。
 *
 * 数据源：国务院办公厅《xxxx年部分节假日安排通知》。
 * 格式：YYYY-MM-DD。只放法定假日（放假的日子）；调休补班不列（补班日视作工作日）。
 */

export const CN_HOLIDAYS_2026: ReadonlySet<string> = new Set([
  // 元旦
  '2026-01-01',
  '2026-01-02',
  '2026-01-03',
  // 春节（农历正月初一前后）—— 2026 春节是 2 月 17 日
  '2026-02-15',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
  '2026-02-20',
  '2026-02-21',
  // 清明节
  '2026-04-05',
  '2026-04-06',
  // 劳动节
  '2026-05-01',
  '2026-05-02',
  '2026-05-03',
  '2026-05-04',
  '2026-05-05',
  // 端午
  '2026-06-19',
  '2026-06-20',
  '2026-06-21',
  // 中秋 + 国庆叠加（2026 双节合并假期）
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
]);

export const CN_HOLIDAYS: Record<number, ReadonlySet<string>> = {
  2026: CN_HOLIDAYS_2026,
};

/** 判断一个 YYYY-MM-DD 是否为法定节假日 */
export function isHoliday(dateStr: string): boolean {
  const year = Number(dateStr.slice(0, 4));
  const set = CN_HOLIDAYS[year];
  return set ? set.has(dateStr) : false;
}

/**
 * 判断一个 YYYY-MM-DD 是否为"工作日"。
 * 工作日 = 周一到周五 且 非法定节假日。
 */
export function isWorkday(dateStr: string): boolean {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !isHoliday(dateStr);
}
