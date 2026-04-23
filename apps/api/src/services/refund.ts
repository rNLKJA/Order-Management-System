/**
 * 退卡业务逻辑。
 *
 * 约束：
 * - 仅 active 卡可以退（upgraded / exhausted / refunded 都不行）
 * - 0 ≤ refund_amount ≤ paid_amount
 * - 调用方在事务里执行，本函数返回更新后的卡和新写入的 FinanceEntry
 */

import { eq } from 'drizzle-orm';
import { schema } from '../db/client.js';
import { toShanghaiDate } from './finance.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = { select: any; insert: any; update: any };

export class CardRefundError extends Error {
  constructor(
    public readonly code:
      | 'CARD_NOT_FOUND'
      | 'CARD_NOT_ACTIVE'
      | 'INVALID_REFUND_AMOUNT',
    message: string,
  ) {
    super(message);
    this.name = 'CardRefundError';
  }
}

export interface RefundCardInput {
  cardId: number;
  refundAmount: number;
  reason: string;
  collectorUserId: number;
  createdByUserId: number;
  refundedByUserId: number;
}

export interface RefundCardResult {
  card: typeof schema.cards.$inferSelect;
  financeEntry: {
    id: number;
    entry_date: string;
    amount: number;
    type: 'expense';
    category: 'manual_expense';
  };
}

export async function refundCard(
  tx: Tx,
  input: RefundCardInput,
): Promise<RefundCardResult> {
  const rows = await tx
    .select()
    .from(schema.cards)
    .where(eq(schema.cards.id, input.cardId))
    .limit(1);

  const card = rows[0] as typeof schema.cards.$inferSelect | undefined;
  if (!card) {
    throw new CardRefundError('CARD_NOT_FOUND', '待退的卡不存在');
  }
  if (card.status !== 'active') {
    throw new CardRefundError(
      'CARD_NOT_ACTIVE',
      `仅 active 卡可退，当前状态：${card.status}`,
    );
  }

  if (input.refundAmount < 0 || input.refundAmount > card.paid_amount) {
    throw new CardRefundError(
      'INVALID_REFUND_AMOUNT',
      `退款金额必须在 0 ~ ¥${card.paid_amount} 之间`,
    );
  }

  const now = new Date();
  const entry_date = toShanghaiDate(now);

  const updatedCardRows = await tx
    .update(schema.cards)
    .set({
      status: 'refunded',
      refund_amount: input.refundAmount,
      refund_reason: input.reason,
      refunded_at: now,
      refunded_by_user_id: input.refundedByUserId,
      updated_at: now,
    })
    .where(eq(schema.cards.id, card.id))
    .returning();

  const updatedCard = updatedCardRows[0] as typeof schema.cards.$inferSelect;

  const financeRows = await tx
    .insert(schema.finance_entries)
    .values({
      entry_date,
      type: 'expense',
      amount: input.refundAmount,
      category: 'manual_expense',
      description: `退卡退款${input.reason ? `：${input.reason}` : ''}`,
      ref_card_id: card.id,
      source: 'auto',
      voided: false,
      collector_user_id: input.collectorUserId,
      created_by_user_id: input.createdByUserId,
    })
    .returning({
      id: schema.finance_entries.id,
      entry_date: schema.finance_entries.entry_date,
      amount: schema.finance_entries.amount,
    });

  const fe = financeRows[0]!;

  return {
    card: updatedCard,
    financeEntry: {
      id: fe.id,
      entry_date: fe.entry_date,
      amount: fe.amount,
      type: 'expense',
      category: 'manual_expense',
    },
  };
}
