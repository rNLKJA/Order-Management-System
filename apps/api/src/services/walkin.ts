/**
 * 散客（walk-in）会员哨兵。
 *
 * 现有 daily_orders.member_id NOT NULL，为了让"没有会员档案的临时顾客"也能下单，
 * 我们固定复用一个 `uid='__WALKIN__'` 的会员，所有散客订单都挂到这个会员身上，
 * 同时在 daily_orders.customer_name 里记真实姓名，UI 显示优先用 customer_name。
 *
 * 这个哨兵会员：
 *  - is_active = true（不能被误归档）
 *  - is_hospital = false（默认院外，实际看订单 customer_name + order.is_hospital? 目前无该列）
 *  - name = '散客'
 *  - phone = '13000000000'（占位；手机号 unique 校验不关心重复就靠 phone_idx 非 unique）
 */

import { eq } from 'drizzle-orm';
import { schema } from '../db/client.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = { select: any; insert: any };

export const WALKIN_UID = '__WALKIN__';

let cachedId: number | null = null;

export async function getOrCreateWalkinMemberId(
  tx: Tx,
  createdByUserId: number,
): Promise<number> {
  if (cachedId) return cachedId;

  const existing = await tx
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(eq(schema.members.uid, WALKIN_UID))
    .limit(1);

  if (existing[0]?.id) {
    cachedId = existing[0].id;
    return cachedId!;
  }

  const inserted = await tx
    .insert(schema.members)
    .values({
      uid: WALKIN_UID,
      name: '散客',
      nickname: '',
      phone: '13000000000',
      wechat_id: '',
      address: '',
      dietary_notes: '',
      is_hospital: false,
      is_active: true,
      created_by_user_id: createdByUserId,
    })
    .returning({ id: schema.members.id });

  cachedId = inserted[0]!.id;
  return cachedId!;
}

/** 测试辅助：用完清缓存。 */
export function resetWalkinCacheForTesting() {
  cachedId = null;
}
