import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { getDb, schema } from '../db/client.js';
import { toShanghaiDate } from '../services/finance.js';

type BackfillMode = 'dry-run' | 'apply';

interface BackfillStats {
  cardCandidates: number;
  cardInserted: number;
  orderCandidates: number;
  orderInserted: number;
}

const PREPAID_CATEGORIES = ['card_prepaid_hospital', 'card_prepaid_regular'] as const;

const MEAL_EARNED_CATEGORIES = [
  'meal_earned_hospital',
  'meal_earned_regular',
  'meal_earned_walkin',
] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseMode(): BackfillMode {
  return process.argv.includes('--apply') ? 'apply' : 'dry-run';
}

function deriveCardIncomeAmount(
  card: typeof schema.cards.$inferSelect,
  parent: typeof schema.cards.$inferSelect | undefined,
): number {
  if (!card.upgraded_from_id || !parent) {
    return round2(Number(card.paid_amount));
  }
  // 续卡：同卡种结转，记整卡预收
  if (card.card_code === parent.card_code) {
    return round2(Number(card.paid_amount));
  }
  // 升级：补差 = 新卡总价 - (旧卡实付 - 旧卡已消费价值)
  const oldResidual = Number(parent.paid_amount) - Number(parent.used_meals) * Number(parent.unit_price);
  return Math.max(0, round2(Number(card.paid_amount) - oldResidual));
}

async function main() {
  const mode = parseMode();
  const shouldWrite = mode === 'apply';
  const db = getDb();
  const nowIso = new Date().toISOString();

  const existingCardIncome = await db
    .select({
      ref_card_id: schema.finance_entries.ref_card_id,
      category: schema.finance_entries.category,
    })
    .from(schema.finance_entries)
    .where(
      and(
        isNotNull(schema.finance_entries.ref_card_id),
        inArray(schema.finance_entries.category, [...PREPAID_CATEGORIES]),
      ),
    );
  const existingCardKey = new Set(
    existingCardIncome.map((x) => `${x.ref_card_id}:${x.category}`),
  );

  const existingOrderIncome = await db
    .select({ ref_order_id: schema.finance_entries.ref_order_id })
    .from(schema.finance_entries)
    .where(
      and(
        isNotNull(schema.finance_entries.ref_order_id),
        inArray(schema.finance_entries.category, [...MEAL_EARNED_CATEGORIES]),
      ),
    );
  const existingOrderKey = new Set(existingOrderIncome.map((x) => String(x.ref_order_id)));

  const cards = await db.select().from(schema.cards);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const deliveredOrders = await db
    .select()
    .from(schema.daily_orders)
    .where(eq(schema.daily_orders.status, 'delivered'));

  const stats: BackfillStats = {
    cardCandidates: 0,
    cardInserted: 0,
    orderCandidates: 0,
    orderInserted: 0,
  };

  for (const card of cards) {
    const category = card.is_hospital ? 'card_prepaid_hospital' : 'card_prepaid_regular';
    const key = `${card.id}:${category}`;
    if (existingCardKey.has(key)) continue;

    const parent = card.upgraded_from_id ? cardById.get(card.upgraded_from_id) : undefined;
    const amount = deriveCardIncomeAmount(card, parent);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    stats.cardCandidates += 1;
    if (!shouldWrite) continue;

    await db.insert(schema.finance_entries).values({
      entry_date: toShanghaiDate(card.purchased_at),
      type: 'income',
      amount,
      category,
      description: `历史补录：卡收入（card #${card.id}）`,
      ref_card_id: card.id,
      source: 'imported_legacy',
      voided: false,
      collector_user_id: card.collector_user_id,
      created_by_user_id: card.created_by_user_id,
      created_at: new Date(nowIso),
      updated_at: new Date(nowIso),
    });
    stats.cardInserted += 1;
  }

  for (const order of deliveredOrders) {
    const key = String(order.id);
    if (existingOrderKey.has(key)) continue;

    const card = order.card_id ? cardById.get(order.card_id) : undefined;
    let category: (typeof MEAL_EARNED_CATEGORIES)[number];
    let amount = 0;

    if (order.card_id && card) {
      category = card.is_hospital ? 'meal_earned_hospital' : 'meal_earned_regular';
      amount = round2(Number(card.unit_price) * Number(order.quantity));
    } else if (order.card_id && !card) {
      continue;
    } else {
      category = 'meal_earned_walkin';
      amount = round2(Number(order.amount));
    }

    if (!Number.isFinite(amount) || amount <= 0) continue;

    stats.orderCandidates += 1;
    if (!shouldWrite) continue;

    await db.insert(schema.finance_entries).values({
      entry_date: order.order_date,
      type: 'income',
      amount,
      category,
      description: `历史补录：已送达餐费（order #${order.id}）`,
      ref_order_id: order.id,
      source: 'imported_legacy',
      voided: false,
      created_by_user_id: order.delivered_by_user_id ?? order.created_by_user_id,
      created_at: new Date(nowIso),
      updated_at: new Date(nowIso),
    });
    stats.orderInserted += 1;
  }

  const lines = [
    `[finance-backfill] mode=${mode}`,
    `[finance-backfill] card candidates=${stats.cardCandidates}, inserted=${stats.cardInserted}`,
    `[finance-backfill] order candidates=${stats.orderCandidates}, inserted=${stats.orderInserted}`,
    shouldWrite
      ? '[finance-backfill] completed'
      : '[finance-backfill] dry-run only (append --apply to write)',
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

void main();
