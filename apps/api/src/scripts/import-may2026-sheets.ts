/**
 * 从用户提供的 2026 年 5 月表格图片导入：
 * - 会员份数表 → members（按姓名复用或新建）+ cards（每行一张卡，custom 历史导入）
 * - 支出明细 → finance_entries（expense / imported_legacy / legacy_expense）
 *
 * 用法：
 *   pnpm --filter @meal/api exec tsx src/scripts/import-may2026-sheets.ts           # dry-run
 *   pnpm --filter @meal/api exec tsx src/scripts/import-may2026-sheets.ts --apply    # 写入
 */

import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client.js';

const IMPORT_CARD_NOTE = '图片表格导入·份数（2026-05）';
const IMPORT_FIN_PREFIX = '[图片导入·支出]';

type CardRow = { name: string; total: number; used: number; remaining: number };

/** 客户名称 / 订单份数 / 已用 / 剩余（与截图一致，一行 → 一张卡） */
const CARD_ROWS_RAW: [string, number, number, number][] = [
  ['郭美玲', 51, 13, 38],
  ['宁静', 121, 13, 108],
  ['李景林', 20, 14, 6],
  ['李鹏', 11, 11, 0],
  ['纪圣伟', 1, 1, 0],
  ['纪文兴', 1, 1, 0],
  ['于海燕', 10, 5, 5],
  ['江涛', 6, 4, 2],
  ['丁金凤', 4, 4, 0],
  ['杜美姣', 51, 20, 31],
  ['郭芳芳', 2, 2, 0],
  ['郭玲', 42, 42, 0],
  ['柳青', 14, 0, 14],
  ['纪芳', 28, 27, 1],
  ['汪峰', 8, 0, 8],
  ['吕晓梅', 21, 6, 15],
  ['孙悦', 8, 6, 2],
  ['刘文娟', 4, 0, 4],
  ['郭晓燕', 8, 1, 7],
  ['潘敏慧', 6, 6, 0],
  ['杨波', 22, 19, 3],
  ['孙利', 36, 27, 9],
  ['郭芳', 38, 20, 18],
  ['朱海英', 9, 2, 7],
  ['艾佳佳', 6, 6, 0],
  ['汉文娟', 1, 1, 0],
  ['常文娟', 1, 1, 0],
  ['肖志刚', 1, 1, 0],
  ['郭艳', 14, 14, 0],
  ['马海燕', 5, 4, 1],
  ['郭敏', 5, 4, 1],
  ['耿志勇', 5, 5, 0],
  ['孙美玲', 1, 1, 0],
  ['李杰', 5, 5, 0],
  ['潘燕', 40, 36, 4],
  ['孙小兰', 10, 0, 10],
  ['孙莉', 1, 1, 0],
  ['冯娟', 5, 3, 2],
  ['刘丽', 1, 1, 0],
  ['耿志勇', 10, 9, 1],
  ['孙艳丽', 1, 1, 0],
  ['吕伶', 5, 0, 5],
  ['郭晓燕', 10, 7, 3],
  ['孙悦', 10, 5, 5],
  ['郭晓丽', 2, 2, 0],
  ['郭芳', 5, 2, 3],
  ['中兴官网', 2, 2, 0],
  ['吕晓梅', 10, 5, 5],
  ['王丽', 1, 1, 0],
  ['卢静', 5, 5, 0],
  ['耿志勇', 5, 4, 1],
  ['孙艳丽', 2, 2, 0],
  ['邹美玲', 10, 10, 0],
  ['郭美玲', 2, 2, 0],
  ['郭芳', 2, 1, 1],
  ['孙莉', 45, 31, 14],
  ['王美玲', 5, 1, 4],
  ['孙艳丽', 1, 1, 0],
  ['王美玲', 10, 4, 6],
  ['王美玲', 40, 15, 25],
  ['王美玲', 40, 1, 39],
  ['孙艳丽', 1, 1, 0],
  ['孙美玲', 52, 14, 38],
  ['孙艳丽', 2, 2, 0],
  ['孙美玲', 10, 10, 0],
  ['孙美玲', 40, 1, 39],
  ['孙艳丽', 1, 1, 0],
  ['孙美玲', 12, 11, 1],
  ['孙艳丽', 2, 2, 0],
  ['孙美玲', 10, 10, 0],
  ['孙艳丽', 2, 2, 0],
  ['孙艳丽', 1, 1, 0],
  ['孙美玲', 40, 6, 34],
  ['孙美玲', 40, 11, 29],
  ['孙艳丽', 10, 2, 8],
  ['孙艳丽', 10, 1, 9],
  ['孙艳丽', 2, 2, 0],
  ['孙艳丽', 5, 1, 4],
  ['孙艳丽', 10, 3, 7],
  ['孙艳丽', 10, 1, 9],
  ['孙艳丽', 10, 1, 9],
  ['孙艳丽', 2, 1, 1],
  ['孙艳丽', 5, 1, 4],
];

const CARD_ROWS: CardRow[] = CARD_ROWS_RAW.map(([name, total, used, remaining]) => ({
  name,
  total,
  used,
  remaining,
}));

type ExpenseRow = { date: string; amount: number; description: string; payer: string };

const EXPENSE_ROWS: ExpenseRow[] = [
  { date: '2026-05-02', amount: 28.19, description: '菜品等采买支出', payer: '徐超' },
  { date: '2026-05-03', amount: 249.9, description: '买米', payer: '孙姐' },
  { date: '2026-05-06', amount: 65, description: '鸡蛋+锤子', payer: '徐超' },
  { date: '2026-05-07', amount: 43, description: '菜+筷子', payer: '孙姐' },
  { date: '2026-05-08', amount: 1083.5, description: '买菜', payer: '孙姐' },
  { date: '2026-05-08', amount: 10.8, description: '买菜', payer: '徐超' },
  { date: '2026-05-09', amount: 140, description: '贵阳往返学习交通费', payer: '梦瑶' },
  { date: '2026-05-09', amount: 68, description: '看开张日子红包', payer: '梦瑶' },
];

function parseArgs(): { apply: boolean } {
  return { apply: process.argv.includes('--apply') };
}

async function pickActorUserId(
  db: ReturnType<typeof getDb>,
): Promise<{ id: number; username: string }> {
  const admins = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, 'admin'))
    .limit(1);
  if (admins[0]) {
    return { id: admins[0].id, username: admins[0].username };
  }
  const any = await db.select().from(schema.users).limit(1);
  const u = any[0];
  if (!u) throw new Error('数据库中没有任何用户，请先 seed 账号');
  return { id: u.id, username: u.username };
}

async function findMemberByName(
  db: ReturnType<typeof getDb>,
  name: string,
): Promise<{ id: number } | null> {
  const rows = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(eq(schema.members.name, name.trim()))
    .limit(2);
  if (rows.length > 1) {
    console.warn(`[warn] 姓名「${name}」重复 ${rows.length} 条，使用第一条 member_id=${rows[0]!.id}`);
  }
  return rows[0] ?? null;
}

async function createMember(
  db: ReturnType<typeof getDb>,
  name: string,
  createdByUserId: number,
): Promise<number> {
  const rand = Math.random().toString(36).slice(2, 10);
  const uid = `IMP${Date.now().toString(36)}${rand}`;
  /** 占位手机号（11 位数字），导入后可在后台改成本人号码 */
  const phone = `18${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}`;
  const [row] = await db
    .insert(schema.members)
    .values({
      uid,
      name: name.trim(),
      nickname: '',
      phone,
      created_by_user_id: createdByUserId,
      is_walkin: false,
    })
    .returning({ id: schema.members.id });
  if (!row) throw new Error(`创建会员失败：${name}`);
  console.log(`[member] 新建「${name}」id=${row.id} uid=${uid} phone=${phone}`);
  return row.id;
}

async function findOrCreateMember(
  db: ReturnType<typeof getDb>,
  name: string,
  createdByUserId: number,
): Promise<{ id: number; created: boolean }> {
  const found = await findMemberByName(db, name);
  if (found) return { id: found.id, created: false };
  const id = await createMember(db, name, createdByUserId);
  return { id, created: true };
}

function assertCardArithmetic(row: CardRow, index: number) {
  const expectedRem = row.total - row.used;
  if (expectedRem !== row.remaining) {
    console.warn(
      `[warn] 第 ${index + 1} 行「${row.name}」剩余不一致：表内 remaining=${row.remaining}，total-used=${expectedRem}，以 total/used 为准写入`,
    );
  }
}

async function main() {
  const { apply } = parseArgs();
  const db = getDb();
  const actor = await pickActorUserId(db);
  console.log(`[info] 执行用户：${actor.username} (id=${actor.id})；模式：${apply ? '写入' : 'dry-run'}`);

  let cardsWould = 0;
  let membersCreated = 0;
  const memberIdCache = new Map<string, number>();

  for (let i = 0; i < CARD_ROWS.length; i++) {
    const row = CARD_ROWS[i]!;
    assertCardArithmetic(row, i);
    const remaining = row.total - row.used;
    const status = remaining <= 0 ? ('exhausted' as const) : ('active' as const);

    if (!memberIdCache.has(row.name)) {
      if (apply) {
        const { id, created } = await findOrCreateMember(db, row.name, actor.id);
        memberIdCache.set(row.name, id);
        if (created) membersCreated++;
      } else {
        const existing = await findMemberByName(db, row.name);
        memberIdCache.set(row.name, existing?.id ?? -1);
        if (!existing) membersCreated++;
      }
    }

    cardsWould++;
    const mid = memberIdCache.get(row.name)!;
    if (!apply) {
      console.log(
        `[dry-run] card「${row.name}」member_id=${mid} total=${row.total} used=${row.used} remaining=${remaining} status=${status}`,
      );
      continue;
    }

    if (mid < 0) throw new Error('unexpected member id');
    await db.insert(schema.cards).values({
      member_id: mid,
      card_code: 'custom',
      custom_label: '历史导入',
      custom_pack_meals: row.total,
      is_hospital: false,
      total_meals: row.total,
      used_meals: row.used,
      remaining_meals: remaining,
      unit_price: 0,
      paid_amount: 0,
      status,
      collector_user_id: actor.id,
      created_by_user_id: actor.id,
      notes: IMPORT_CARD_NOTE,
    });
  }

  let expenseWould = 0;
  for (const ex of EXPENSE_ROWS) {
    expenseWould++;
    const desc = `${IMPORT_FIN_PREFIX} ${ex.date} ${ex.description}（${ex.payer}垫付）¥${ex.amount}`;
    if (!apply) {
      console.log(`[dry-run] finance expense ${ex.date} ¥${ex.amount} ${desc}`);
      continue;
    }
    await db.insert(schema.finance_entries).values({
      entry_date: ex.date,
      type: 'expense',
      category: 'legacy_expense',
      amount: ex.amount,
      description: desc,
      source: 'imported_legacy',
      voided: false,
      created_by_user_id: actor.id,
    });
  }

  console.log(
    `\n[done] 会员卡行：${cardsWould}；新建会员（估算）：${membersCreated}；支出条：${expenseWould}。${apply ? '已写入数据库。' : '未写入（请加 --apply）'}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
