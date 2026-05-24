/**
 * 提前包卡排队：queued 卡在指定 active 卡耗尽后自动激活。
 */

import { and, eq } from 'drizzle-orm';
import { schema } from '../db/client.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = { select: any; update: any };

export async function findQueuedCardWaitingOn(
  tx: Tx,
  memberId: number,
  activeCardId: number,
): Promise<typeof schema.cards.$inferSelect | null> {
  const rows = await tx
    .select()
    .from(schema.cards)
    .where(
      and(
        eq(schema.cards.member_id, memberId),
        eq(schema.cards.status, 'queued'),
        eq(schema.cards.queued_after_card_id, activeCardId),
      ),
    )
    .limit(1);

  return (rows[0] as typeof schema.cards.$inferSelect | undefined) ?? null;
}

export async function findQueuedCardForMember(
  tx: Tx,
  memberId: number,
): Promise<typeof schema.cards.$inferSelect | null> {
  const rows = await tx
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.member_id, memberId), eq(schema.cards.status, 'queued')))
    .limit(1);

  return (rows[0] as typeof schema.cards.$inferSelect | undefined) ?? null;
}

/** 当前卡 exhausted 后，激活排在其后的 queued 卡（若有）。 */
export async function activateQueuedCardAfterExhaust(
  tx: Tx,
  memberId: number,
  exhaustedCardId: number,
): Promise<typeof schema.cards.$inferSelect | null> {
  const queued = await findQueuedCardWaitingOn(tx, memberId, exhaustedCardId);
  if (!queued) return null;

  const now = new Date();
  const updated = await tx
    .update(schema.cards)
    .set({ status: 'active', updated_at: now })
    .where(eq(schema.cards.id, queued.id))
    .returning();

  return (updated[0] as typeof schema.cards.$inferSelect | undefined) ?? null;
}
