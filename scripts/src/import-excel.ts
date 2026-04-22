/**
 * 一次性 Excel 迁移脚本（Phase 4+，MEA-20）。
 *
 * 占位：真实实现会在 v2 阶段补。
 *
 * 预期行为：
 * - 读 doc/xxx.xlsm 的"客户信息 / 订单明细 / 每日订餐 / 收入 / 支出"5 张表
 * - 调 API 批量入库，meal_type 按备注正则推断
 * - 匹配不上的会员 → unresolved.csv；餐别推断不出 → needs_review.csv
 */

export {};

async function main() {
  console.log(
    '[import-excel] 此脚本尚未实现（Phase 4+ 会做）。当前 Phase 1 / MVP 不依赖它。',
  );
  process.exit(0);
}

main();
