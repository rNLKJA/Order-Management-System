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

export interface WalkinContact {
  /** 散客手机号（可选） */
  phone?: string;
  /** 送餐地址（可选） */
  address?: string;
  /** 是否算院内订单（散客模式默认 false，前端可覆盖） */
  is_hospital?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxWithUpdate = Tx & { update: any };

/**
 * 按散客姓名找或建一个 walk-in member。
 * 查找条件是 (uid='__WALKIN__{name}' AND is_walkin=true)，
 * is_walkin 的约束让"张三晋升为会员后，下次又来了个新张三"不会复用旧 id。
 *
 * 如果 contact 里传了新的 phone / address，会合并保存到 member：
 *  - 旧记录某字段为空 → 写入新值
 *  - 旧记录已有值 → 新值非空才覆盖（避免下次录单把空串洗掉已有的地址）
 */
export async function getOrCreateWalkinMember(
  tx: TxWithUpdate,
  customerName: string,
  createdByUserId: number,
  contact: WalkinContact = {},
): Promise<typeof schema.members.$inferSelect> {
  const name = customerName.trim();
  if (!name) {
    throw new Error('customer_name 不能为空');
  }

  const phone = (contact.phone ?? '').trim();
  const address = (contact.address ?? '').trim();
  const isHospital = contact.is_hospital ?? false;
  const uid = walkinUid(name);

  const existing = await tx
    .select()
    .from(schema.members)
    .where(
      and(eq(schema.members.uid, uid), eq(schema.members.is_walkin, true)),
    )
    .limit(1);

  const hit = existing[0] as typeof schema.members.$inferSelect | undefined;
  if (hit) {
    // 合并更新：非空新值 或 旧值为空时的默认值
    const patch: Partial<typeof schema.members.$inferInsert> = {};
    if (phone && phone !== hit.phone) patch.phone = phone;
    if (address && address !== hit.address) patch.address = address;
    if (isHospital !== hit.is_hospital) patch.is_hospital = isHospital;
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date();
      const updated = await tx
        .update(schema.members)
        .set(patch)
        .where(eq(schema.members.id, hit.id))
        .returning();
      return updated[0]!;
    }
    return hit;
  }

  const inserted = await tx
    .insert(schema.members)
    .values({
      uid,
      name,
      nickname: '',
      phone,
      wechat_id: '',
      address,
      dietary_notes: '',
      is_hospital: isHospital,
      is_active: true,
      is_walkin: true,
      created_by_user_id: createdByUserId,
    })
    .returning();

  return inserted[0]!;
}
