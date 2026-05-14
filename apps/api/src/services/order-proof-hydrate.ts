/**
 * 将 order_proof_sets 中的凭证 JSON 展开到 daily_orders 响应（客户端仍只读 proof_images_json）。
 * 并附加录入人展示字段（full_name、username），供订单详情展示「谁、何时录入」。
 */

import { inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import * as schema from '../db/schema.js';

export type DailyOrderRow = typeof schema.daily_orders.$inferSelect;

export type DailyOrderJsonRow = DailyOrderRow & {
  created_by_full_name: string;
  created_by_username: string;
};

function mergeProofImagesFromSets(
  orders: DailyOrderRow[],
  proofJsonBySetId: Record<number, string>,
): DailyOrderRow[] {
  return orders.map((o) => {
    const sid = o.proof_set_id;
    if (sid != null && proofJsonBySetId[sid]) {
      return { ...o, proof_images_json: proofJsonBySetId[sid] };
    }
    return o;
  });
}

async function attachCreatorFields(db: Db, orders: DailyOrderRow[]): Promise<DailyOrderJsonRow[]> {
  const ids = [...new Set(orders.map((o) => o.created_by_user_id))];
  const byUserId: Record<number, { full_name: string; username: string }> = {};
  if (ids.length > 0) {
    const users = await db
      .select({
        id: schema.users.id,
        full_name: schema.users.full_name,
        username: schema.users.username,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, ids));
    for (const u of users) {
      byUserId[u.id] = { full_name: u.full_name, username: u.username };
    }
  }
  return orders.map((o) => {
    const u = byUserId[o.created_by_user_id];
    return {
      ...o,
      created_by_full_name: u?.full_name?.trim() ?? '',
      created_by_username: u?.username ?? '',
    };
  });
}

export async function hydrateOrderProofs(db: Db, orders: DailyOrderRow[]): Promise<DailyOrderJsonRow[]> {
  const proofSetIds = [
    ...new Set(
      orders.map((o) => o.proof_set_id).filter((x): x is number => typeof x === 'number' && x > 0),
    ),
  ];

  let merged = orders;
  if (proofSetIds.length > 0) {
    const sets = await db
      .select()
      .from(schema.order_proof_sets)
      .where(inArray(schema.order_proof_sets.id, proofSetIds));
    const proofJsonBySetId = Object.fromEntries(sets.map((s) => [s.id, s.proof_images_json]));
    merged = mergeProofImagesFromSets(orders, proofJsonBySetId);
  }

  return attachCreatorFields(db, merged);
}
