/**
 * 将 order_proof_sets 中的凭证 JSON 展开到 daily_orders 响应（客户端仍只读 proof_images_json）。
 */

import { inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import * as schema from '../db/schema.js';

export type DailyOrderRow = typeof schema.daily_orders.$inferSelect;

export async function hydrateOrderProofs(db: Db, orders: DailyOrderRow[]): Promise<DailyOrderRow[]> {
  const ids = [
    ...new Set(
      orders.map((o) => o.proof_set_id).filter((x): x is number => typeof x === 'number' && x > 0),
    ),
  ];
  if (ids.length === 0) return orders;

  const sets = await db
    .select()
    .from(schema.order_proof_sets)
    .where(inArray(schema.order_proof_sets.id, ids));
  const byId = Object.fromEntries(sets.map((s) => [s.id, s.proof_images_json]));

  return orders.map((o) => {
    const sid = o.proof_set_id;
    if (sid != null && byId[sid]) {
      return { ...o, proof_images_json: byId[sid] };
    }
    return o;
  });
}
