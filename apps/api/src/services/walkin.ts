/**
 * 散客（walk-in）会员。
 *
 * 设计：
 *  - 每个不同姓名的散客有自己的 member 行，uid 固定格式 `__WALKIN__{name}`。
 *  - is_walkin=true 标记它是散客目录成员；订单挂到这个 member 上，
 *    走和会员订单一样的外键结构（解锁"散客订单历史"、"散客开卡"等功能）。
 *  - 为散客开卡时（POST /api/cards），卡 route 会把 is_walkin 翻成 false，
 *    同时按真实手机号重算 uid，正式晋升为会员。
 *
 *  历史上老版本里所有散客订单都挂在一个 uid=`__WALKIN__` 的哨兵 member 上，
 *  保留它，历史订单不动；新订单走新 per-name 结构。
 */

import { and, eq } from 'drizzle-orm';
import { schema } from '../db/client.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = { select: any; insert: any };

export const WALKIN_UID_PREFIX = '__WALKIN__';

export function walkinUid(name: string): string {
  return `${WALKIN_UID_PREFIX}${name.trim()}`;
}

/**
 * 按散客姓名找或建一个 walk-in member。
 * 查找条件是 (uid='__WALKIN__{name}' AND is_walkin=true)，
 * is_walkin 的约束让"张三晋升为会员后，下次又来了个新张三"不会复用旧 id。
 */
export async function getOrCreateWalkinMember(
  tx: Tx,
  customerName: string,
  createdByUserId: number,
): Promise<typeof schema.members.$inferSelect> {
  const name = customerName.trim();
  if (!name) {
    throw new Error('customer_name 不能为空');
  }

  const uid = walkinUid(name);

  const existing = await tx
    .select()
    .from(schema.members)
    .where(
      and(eq(schema.members.uid, uid), eq(schema.members.is_walkin, true)),
    )
    .limit(1);

  const hit = existing[0] as typeof schema.members.$inferSelect | undefined;
  if (hit) return hit;

  const inserted = await tx
    .insert(schema.members)
    .values({
      uid,
      name,
      nickname: '',
      phone: '', // 散客没有手机号，留空；正式会员化时再补
      wechat_id: '',
      address: '',
      dietary_notes: '',
      is_hospital: false,
      is_active: true,
      is_walkin: true,
      created_by_user_id: createdByUserId,
    })
    .returning();

  return inserted[0]!;
}
