/**
 * 财务条目辅助函数。
 *
 * 卡 slice 只负责"购卡 / 升级补差"这两类自动入账；
 * 散餐入账 / 支出录入 / 筛选查询这些归 finance slice（MEA-13）。
 *
 * 这里写的"自动入账"函数保证：
 * - source='auto'
 * - category 按 is_hospital 自动选 'hospital_sub' | 'regular_sub'
 * - entry_date 按 purchased_at 的 Asia/Shanghai 业务日取 YYYY-MM-DD
 *   （MVP 先用 UTC + 8h 偏移；未来接入真 TZ util 时统一替换）
 */

import { schema } from '../db/client.js';

/**
 * 能 insert 的 Drizzle 客户端 —— `Db` 或事务里的 `tx` 都可以塞。
 * 故意不从 drizzle-orm/sqlite-core 导具体类型，因为 libsql 的 tx 泛型签名和 LibSQLDatabase
 * 在类型层面不可互换（batch 方法差异），用最小结构约束绕过。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Inserter = { insert: (table: typeof schema.finance_entries) => any };

export type AutoIncomeCategory = 'hospital_sub' | 'regular_sub';

export interface AutoIncomeInput {
  amount: number;
  is_hospital: boolean;
  ref_card_id: number;
  collector_user_id: number;
  created_by_user_id: number;
  purchased_at: Date;
  description?: string;
}

/**
 * 写一条自动收入 FinanceEntry（购卡 / 升级补差共用）。
 *
 * 调用方必须把本函数放在事务里，和"建卡 / 改旧卡"合起来成原子。
 * 返回 FinanceEntry 的 id。
 */
export async function createAutoSubscriptionIncome(
  db: Inserter,
  input: AutoIncomeInput,
): Promise<{
  id: number;
  entry_date: string;
  category: AutoIncomeCategory;
  amount: number;
  type: 'income';
  source: 'auto';
  ref_card_id: number;
}> {
  const category: AutoIncomeCategory = input.is_hospital ? 'hospital_sub' : 'regular_sub';
  const entry_date = toShanghaiDate(input.purchased_at);

  const rows = await db
    .insert(schema.finance_entries)
    .values({
      entry_date,
      type: 'income',
      amount: input.amount,
      category,
      description: input.description ?? '',
      ref_card_id: input.ref_card_id,
      source: 'auto',
      voided: false,
      collector_user_id: input.collector_user_id,
      created_by_user_id: input.created_by_user_id,
    })
    .returning({ id: schema.finance_entries.id });

  return {
    id: rows[0]!.id,
    entry_date,
    category,
    amount: input.amount,
    type: 'income',
    source: 'auto',
    ref_card_id: input.ref_card_id,
  };
}

/**
 * 把 Date 转成 Asia/Shanghai 的 YYYY-MM-DD。
 * MVP 取 UTC+8 偏移（上海无夏令时），后续统一到 shared/date util 后可替换。
 */
export function toShanghaiDate(d: Date): string {
  const shanghai = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const yyyy = shanghai.getUTCFullYear();
  const mm = String(shanghai.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shanghai.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
