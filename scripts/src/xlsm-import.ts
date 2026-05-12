/**
 * 市医院 V5 xlsm 全量导入（选项 A）：可 --inspect / --apply --wipe。
 *
 * 匹配键：姓名 + 手机（规范化后拼接）。
 *
 * pnpm --filter @meal/scripts xlsm-import
 * pnpm --filter @meal/scripts xlsm-import -- --apply --wipe
 * 待复核同时写入 needs_review.csv / needs_review.xlsx（相对运行目录，通常为 scripts/）
 * pnpm --filter @meal/scripts xlsm-import -- --file ../doc/xxx.xlsm
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import * as XLSX from 'xlsx';
import { sql, eq } from 'drizzle-orm';
import { buildUid, shanghaiNoon, getCardSpec, type SubscriptionCardCode } from '@meal/shared';
import { getDb, getClient, schema } from '../../apps/api/src/db/client';

async function sqliteTableExists(name: string): Promise<boolean> {
  const c = getClient();
  const r = await c.execute({
    sql: 'SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?',
    args: ['table', name],
  });
  return r.rows.length > 0;
}

const here = dirname(fileURLToPath(import.meta.url));
for (const path of [resolve(here, '../../.env'), resolve(here, '../.env')]) {
  if (existsSync(path)) loadDotenv({ path });
}

const DEFAULT_FILE = resolve(here, '../../doc/市医院健康漂亮餐订餐表-数据格式调整V5.xlsm');
const IMPORT_CARD_NOTE = 'xlsm:V5:订单明细';
const IMPORT_DAILY_ZENG = 'xlsm:V5:增订份数和时间';
const IMPORT_DAILY_SHEET = 'xlsm:V5:每日订餐';
const IMPORT_FIN_PREFIX = '[xlsm:V5]';

/** 默认最多读入行数，避免 订餐汇总 等表 !ref 过大占满内存 */
const DEFAULT_MAX_SHEET_ROWS = 6000;

/**
 * V5xlsm 列映射（中文表头 → 逻辑名）：
 * - 客户信息：客户ID、客户昵称、姓名、地址、手机号、客户忌口
 * - 订单明细：客户ID、客户昵称、客户姓名、订餐日期、开餐日期、订单金额（元）、订餐数量（份）、已用份数、剩份份数、备注、订餐时间
 * - 增订份数和时间：第 0 行表头，列 0 客户ID、2 姓名、3 份数总计；列 4 起为日期（字符串或 Excel 序列日）
 * - 每日订餐：客户ID、客户昵称、姓名、日期、份数
 * - 收入：列 0 日期、1 收入（元）、2 项目 → finance_entries
 * - 支出：列 0 日期、1 支出(元）、2 项目 → finance_entries
 * - 订餐汇总：列 0 客户ID、5 订餐份数、6 已用份数、7 剩余份数（数据自第 2 行起）；入库 imported_order_summaries；仍与订单明细聚合对账
 * - 汇总计算记录：列 时间、总收入、总支出、剩余 → imported_summary_snapshots
 * - 每周结账：列 周期(M.D)、金额、说明 → imported_weekly_closings
 */

type ReviewRow = { type: string; sheet: string; row: number; message: string; detail: string };

function parseArgs(argv: string[]) {
  const args = argv.filter((x) => x !== '--');
  let file = DEFAULT_FILE;
  let inspect = false;
  let apply = false;
  let wipe = false;
  for (const a of args) {
    if (a === '--inspect') inspect = true;
    else if (a === '--apply') apply = true;
    else if (a === '--wipe') wipe = true;
    else if (a.startsWith('--file=')) file = resolve(process.cwd(), a.slice('--file='.length));
  }
  return { file, inspect, apply, wipe };
}

function cellStr(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  return String(v).trim();
}

/** 客户ID：Excel 合并格常读成 0，不当作有效 ID */
function cellCustomerIdRaw(v: unknown): string {
  const s = cellStr(v);
  if (!s || s === '0') return '';
  return s;
}

/**
 * 客户昵称/姓名列里的数字 0（合并格占位）。
 * Excel 合并格偶发把「客户姓名」读成 Date（1899-12-30 等）→ 视为空，以主档为准且不产生假 name_mismatch。
 */
function cellOptionalName(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return '';
  const s = cellStr(v);
  if (s === '0') return '';
  if (/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s\w+\s+\d+/.test(s) && /1899|1900|GMT/.test(s)) return '';
  return s;
}

function normalizePhoneKey(v: unknown): string {
  return cellStr(v).replace(/\D/g, '');
}

function syntheticPhoneFromCustomerId(customerId: string): string {
  const digitsOnly = customerId.replace(/\D/g, '');
  if (digitsOnly.length >= 9) {
    return `8${digitsOnly.slice(-9)}`;
  }
  let h = 0;
  for (const ch of customerId) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  const tail = String(h % 1_000_000_000).padStart(9, '0');
  return `8${tail}`;
}

/** 导入用唯一键：姓名 + 手机（或合成）+ 客户ID（同人不同档案可区分） */
function personKey(name: string, phoneDigits: string, customerId: string): string {
  return `${name.trim()}|${phoneDigits}|${customerId}`;
}

function formatShanghaiYmd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

/**
 * 表内日期：Excel 日期对象、或 M.DD 小数（如 3.26=3 月 26 日）、或 "3.30" 字符串。默认年 2026。
 */
function parseSheetDateCell(v: unknown, year = 2026): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return formatShanghaiYmd(v);
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const month = Math.trunc(v);
    const frac = Math.round((v - month) * 100 + Number.EPSILON);
    if (month >= 1 && month <= 12 && frac >= 1 && frac <= 31) {
      const mm = String(month).padStart(2, '0');
      const dd = String(frac).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
    return null;
  }
  const s = cellStr(v).replace(/月|日/g, '');
  const m = s.match(/^(\d{1,2})[./](\d{1,2})$/);
  if (m) {
    const mm = m[1]!.padStart(2, '0');
    const dd = m[2]!.padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
  return null;
}

function parsePurchasedAtMs(v: unknown): number | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.getTime();
  const s = cellStr(v);
  if (/^\d{8}$/.test(s)) {
    const y = +s.slice(0, 4);
    const mo = +s.slice(4, 6);
    const d = +s.slice(6, 8);
    return Date.UTC(y, mo - 1, d, 4, 0, 0);
  }
  const iso = parseSheetDateCell(v);
  if (!iso) return null;
  const [y, mo, d] = iso.split('-').map(Number);
  return Date.UTC(y!, mo! - 1, d!, 4, 0, 0);
}

function coerceInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/,/g, ''));
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function coerceAmount(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function headerIndices(headerRow: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  headerRow.forEach((cell, i) => {
    const k = cellStr(cell);
    if (!k) return;
    const norm = k.replace(/\s+/g, '');
    if (!m.has(norm)) m.set(norm, i);
  });
  return m;
}

function loadWorkbook(path: string): XLSX.WorkBook {
  const buf = readFileSync(path);
  return XLSX.read(buf, { type: 'buffer', cellDates: true, dense: true });
}

function sheetToJsonTrimmed(wb: XLSX.WorkBook, name: string, maxRows = DEFAULT_MAX_SHEET_ROWS): unknown[][] {
  const sh = wb.Sheets[name];
  if (!sh) return [];
  const ref = sh['!ref'];
  if (!ref) {
    return XLSX.utils.sheet_to_json(sh, { defval: '', header: 1 }) as unknown[][];
  }
  const d = XLSX.utils.decode_range(ref);
  const endR = Math.min(d.e.r, d.s.r + maxRows);
  const trimmedRef = XLSX.utils.encode_range({ s: d.s, e: { c: d.e.c, r: endR } });
  return XLSX.utils.sheet_to_json(sh, { defval: '', header: 1, range: trimmedRef }) as unknown[][];
}

/** 订单明细表头中所有「备注」列下标（合并表常见两列同名） */
function remarkColumnIndices(headerRow: unknown[]): number[] {
  const ix: number[] = [];
  headerRow.forEach((cell, i) => {
    if (cellStr(cell).replace(/\s+/g, '') === '备注') ix.push(i);
  });
  return ix;
}

/** 市医院：从备注字符串推断院内卡种；对不上返回 null → custom */
function inferHospitalCardCodeFromNotes(text: string): SubscriptionCardCode | null {
  const t = text;
  if (/体验/.test(t)) return 'experience';
  if (/小周/.test(t)) return 'small_week';
  if (/季卡/.test(t)) return 'season';
  if (/年卡/.test(t)) return 'year';
  if (/月卡|\/月\/|每个月/.test(t)) return 'month';
  if (/大周|周卡|\/周\/|\d+元\/周/.test(t)) return 'week';
  return null;
}

function inferMealTypeFromText(text: string): 'lunch' | 'dinner' {
  if (/晚|晚饭|晚餐|傍晚/.test(text)) return 'dinner';
  return 'lunch';
}

/** Excel 序列日 → 上海日历 YYYY-MM-DD */
function excelSerialToYmd(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return formatShanghaiYmd(d);
}

/** 增订/汇总表头：Date、序列数、或「2026/4/4以前」类字符串 */
function parseHeaderToYmd(h: unknown): string | null {
  if (h instanceof Date && !isNaN(h.getTime())) return formatShanghaiYmd(h);
  if (typeof h === 'number' && Number.isFinite(h)) {
    if (h > 2000 && h < 120000) return excelSerialToYmd(h);
    return null;
  }
  const s = cellStr(h);
  const m4 = s.match(/(\d{4})[./年-](\d{1,2})[./月-](\d{1,2})/);
  if (m4) {
    return `${m4[1]}-${m4[2]!.padStart(2, '0')}-${m4[3]!.padStart(2, '0')}`;
  }
  const m2 = s.match(/^(\d{1,2})[./](\d{1,2})(?:以前|前|起)?$/);
  if (m2) {
    return `2026-${m2[1]!.padStart(2, '0')}-${m2[2]!.padStart(2, '0')}`;
  }
  return null;
}

function looksLikeSummaryCustomerId(s: string): boolean {
  const t = s.trim();
  return /^[A-Z]\d{2,}$/i.test(t);
}

/** 每周结账首列「M.D」→ 当年月日 YYYY-MM-DD */
function parsePeriodLabelToYmd(label: string, year: number): string | null {
  const s = label.trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (!m) return null;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function snapshotDateFromCell(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return formatShanghaiYmd(v);
  return parseSheetDateCell(v);
}

function rowToImportJson(row: unknown[]): string {
  const serialisable = row.map((c) => {
    if (c instanceof Date && !isNaN(c.getTime())) return formatShanghaiYmd(c);
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    if (c == null || c === '') return '';
    return String(c);
  });
  return JSON.stringify(serialisable);
}

async function pickActorUserId(db: ReturnType<typeof getDb>): Promise<number> {
  const admins = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, 'admin'))
    .limit(1);
  if (admins[0]) return admins[0].id;
  const any = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (!any[0]) throw new Error('无 users，请先 seed');
  return any[0].id;
}

async function wipeBusinessData(db: ReturnType<typeof getDb>) {
  const hasOrderProofSets = await sqliteTableExists('order_proof_sets');
  await db.transaction(async (tx) => {
    await tx.delete(schema.finance_entries).where(sql`1 = 1`);
    await tx.delete(schema.daily_orders).where(sql`1 = 1`);
    await tx.update(schema.cards).set({ upgraded_from_id: null });
    await tx.delete(schema.cards).where(sql`1 = 1`);
    if (hasOrderProofSets) {
      await tx.delete(schema.order_proof_sets).where(sql`1 = 1`);
    }
    await tx.delete(schema.members).where(sql`1 = 1`);
    await tx.delete(schema.audit_logs).where(sql`1 = 1`);
    await tx.delete(schema.notifications).where(sql`1 = 1`);
    await tx.delete(schema.export_logs).where(sql`1 = 1`);
    await tx.delete(schema.tomorrow_summaries).where(sql`1 = 1`);
    await tx.delete(schema.idempotency_keys).where(sql`1 = 1`);
    await tx.delete(schema.imported_order_summaries).where(sql`1 = 1`);
    await tx.delete(schema.imported_weekly_closings).where(sql`1 = 1`);
    await tx.delete(schema.imported_summary_snapshots).where(sql`1 = 1`);
  });
}

function writeNeedsReviewFiles(review: ReviewRow[], outDir: string) {
  const csvPath = resolve(outDir, 'needs_review.csv');
  const xlsxPath = resolve(outDir, 'needs_review.xlsx');
  const lines = ['type,sheet,row,message,detail', ...review.map((x) =>
    [x.type, x.sheet, x.row, JSON.stringify(x.message), JSON.stringify(x.detail)].join(','),
  )];
  writeFileSync(csvPath, lines.join('\n'), 'utf-8');

  const header = ['type', 'sheet', 'row', 'message', 'detail'];
  const rows: (string | number)[][] = review.map((x) => [x.type, x.sheet, x.row, x.message, x.detail]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 6 }, { wch: 44 }, { wch: 52 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '待复核');
  XLSX.writeFile(wb, xlsxPath, { bookType: 'xlsx' });
}

function runInspect(file: string) {
  console.log('[inspect] file:', file);
  const wb = loadWorkbook(file);
  for (const name of wb.SheetNames) {
    const sh = wb.Sheets[name];
    const ref = sh?.['!ref'] ?? '(none)';
    const rows = sheetToJsonTrimmed(wb, name, DEFAULT_MAX_SHEET_ROWS);
    const nonEmpty = rows.filter((r) => (r as unknown[]).some((c) => c !== '' && c != null)).length;
    console.log(`\n=== ${name} ===`);
    console.log(' !ref:', ref, '| trimmed rows:', rows.length, '| non-empty:', nonEmpty);
    for (let i = 0; i < Math.min(4, rows.length); i++) {
      console.log(i, JSON.stringify(rows[i]).slice(0, 320));
    }
  }
}

interface CustomerMaster {
  customerId: string;
  name: string;
  nickname: string;
  phoneDigits: string;
  address: string;
  dietary: string;
}

async function main() {
  const { file, inspect, apply, wipe } = parseArgs(process.argv.slice(2));
  if (!existsSync(file)) {
    console.error('[error] 文件不存在:', file);
    process.exit(1);
  }

  if (inspect) {
    runInspect(file);
    return;
  }

  const wb = loadWorkbook(file);
  const review: ReviewRow[] = [];

  const membersSheet = sheetToJsonTrimmed(wb, '客户信息');
  const ordersSheet = sheetToJsonTrimmed(wb, '订单明细');
  const incomeSheet = sheetToJsonTrimmed(wb, '收入');
  const expenseSheet = sheetToJsonTrimmed(wb, '支出');
  const zengSheet = sheetToJsonTrimmed(wb, '增订份数和时间');
  const dailyMealSheet = sheetToJsonTrimmed(wb, '每日订餐');
  const summarySheet = sheetToJsonTrimmed(wb, '订餐汇总', 400);
  const calcSummarySheet = sheetToJsonTrimmed(wb, '汇总计算记录', 500);
  const weeklyClosingSheet = sheetToJsonTrimmed(wb, '每周结账', 200);

  if (membersSheet.length < 2) {
    console.error('[error] 客户信息 无数据');
    process.exit(1);
  }
  if (ordersSheet.length < 2) {
    console.error('[error] 订单明细 无数据');
    process.exit(1);
  }

  /** 客户ID -> 主档 */
  const byCustomerId = new Map<string, CustomerMaster>();
  /** 姓名|手机 首次出现的客户ID（用于发现多 ID 同人） */
  const personKeyToFirstCid = new Map<string, string>();

  const mh = headerIndices(membersSheet[0]!);
  const colIdx = (base: string, ...alts: string[]) => {
    for (const a of [base, ...alts]) {
      const ix = mh.get(a.replace(/\s+/g, ''));
      if (ix !== undefined) return ix;
    }
    return undefined;
  };

  const iId = colIdx('客户ID');
  const iNick = colIdx('客户昵称');
  const iName = colIdx('姓名');
  const iAddr = colIdx('地址');
  const iPhone = colIdx('手机号', '手机号 '); // 表头可能带空格
  const iDiet = colIdx('客户忌口');
  if (iName === undefined || iPhone === undefined || iId === undefined) {
    console.error('[error] 客户信息 缺列：客户ID/姓名/手机', [...mh.keys()].join(','));
    process.exit(1);
  }

  for (let r = 1; r < membersSheet.length; r++) {
    const row = membersSheet[r]!;
    const customerId = cellCustomerIdRaw(row[iId!]);
    const name = cellStr(row[iName!]);
    if (!customerId || !name) continue;
    let phoneDigits = iPhone !== undefined ? normalizePhoneKey(row[iPhone!]) : '';
    if (!phoneDigits) {
      phoneDigits = syntheticPhoneFromCustomerId(customerId);
      review.push({
        type: 'member_no_phone',
        sheet: '客户信息',
        row: r + 1,
        message: '无手机号，已按客户ID合成占位号码',
        detail: customerId,
      });
    }
    const nick = iNick !== undefined ? cellOptionalName(row[iNick]) : '';
    const addr = iAddr !== undefined ? cellStr(row[iAddr]) : '';
    const diet = iDiet !== undefined ? cellStr(row[iDiet]) : '';

    if (byCustomerId.has(customerId)) {
      const ex = byCustomerId.get(customerId)!;
      const same =
        ex.name === name &&
        ex.phoneDigits === phoneDigits &&
        ex.nickname === nick &&
        ex.address === addr &&
        ex.dietary === diet;
      if (!same) {
        review.push({
          type: 'duplicate_cid',
          sheet: '客户信息',
          row: r + 1,
          message: '客户ID 重复且内容不一致，保留首行',
          detail: customerId,
        });
      }
      continue;
    }

    const bizKey = `${name.replace(/\s+/g, ' ').trim()}|${phoneDigits}`;
    const firstCid = personKeyToFirstCid.get(bizKey);
    if (firstCid !== undefined && firstCid !== customerId) {
      review.push({
        type: 'duplicate_person_multi_cid',
        sheet: '客户信息',
        row: r + 1,
        message: '同一姓名+手机出现多个客户ID（订单按客户ID区分）',
        detail: `person=${bizKey} firstCid=${firstCid} thisCid=${customerId}`,
      });
    } else if (firstCid === undefined) {
      personKeyToFirstCid.set(bizKey, customerId);
    }

    byCustomerId.set(customerId, {
      customerId,
      name,
      nickname: nick,
      phoneDigits,
      address: addr,
      dietary: diet,
    });
  }

  const oh = headerIndices(ordersSheet[0]!);
  const o = (label: string) => oh.get(label.replace(/\s+/g, ''));
  const oCid = o('客户ID');
  const oCname = o('客户姓名');
  const oDate = o('订餐日期');
  const oStart = o('开餐日期');
  const oPaid = o('订单金额（元）');
  const oTotal = o('订餐数量（份）');
  const oUsed = o('已用份数');
  const oRem = o('剩份份数');
  const oNote = o('备注');
  const oTime = o('订餐时间');
  const oRemarkCols = remarkColumnIndices(ordersSheet[0]!);
  if (oRemarkCols.length === 0 && oNote !== undefined) oRemarkCols.push(oNote);
  if (
    oCid === undefined ||
    oCname === undefined ||
    oTotal === undefined ||
    oUsed === undefined ||
    oRem === undefined
  ) {
    console.error('[error] 订单明细 缺列', [...oh.keys()].join(','));
    process.exit(1);
  }

  type CardPrepared = {
    row: number;
    memberKey: string;
    customerId: string;
    purchasedAt: number;
    paid: number;
    total: number;
    used: number;
    remaining: number;
    /** 与院内 CARD_CATALOG 对齐时为目录 code，否则 custom */
    subscriptionCode: SubscriptionCardCode;
    notes: string;
  };
  const cardsToInsert: CardPrepared[] = [];

  let currentOrderBlockCid = '';

  for (let r = 1; r < ordersSheet.length; r++) {
    const row = ordersSheet[r]!;
    const rawCid = cellCustomerIdRaw(row[oCid!]);
    if (rawCid) {
      if (rawCid !== currentOrderBlockCid) {
        currentOrderBlockCid = rawCid;
      }
    }
    const customerId = currentOrderBlockCid;
    if (!customerId) continue;

    const rawName = cellOptionalName(row[oCname!]);
    const master = byCustomerId.get(customerId);
    if (!master) {
      review.push({
        type: 'order_orphan_cid',
        sheet: '订单明细',
        row: r + 1,
        message: '客户ID 在客户信息中不存在',
        detail: customerId,
      });
      continue;
    }
    if (rawName && rawName !== master.name) {
      review.push({
        type: 'name_mismatch',
        sheet: '订单明细',
        row: r + 1,
        message: '订单客户姓名与客户信息不一致（以主档为准）',
        detail: `${customerId} 订单:${rawName} 主档:${master.name}`,
      });
    }
    const mKey = personKey(master.name, master.phoneDigits, customerId);
    const total = coerceInt(row[oTotal!]);
    let used = coerceInt(row[oUsed!]);
    const remCol = coerceInt(row[oRem!]);
    const paidRaw = coerceAmount(row[oPaid!]);
    const paid = paidRaw ?? 0;
    if (total === null && used === null) {
      continue;
    }
    if (total === null || used === null) {
      review.push({
        type: 'order_bad_number',
        sheet: '订单明细',
        row: r + 1,
        message: '份数无法解析',
        detail: JSON.stringify([row[oTotal!], row[oUsed!], row[oPaid!]]),
      });
      continue;
    }
    let remaining = total - used;
    if (remCol !== null && remCol !== remaining) {
      review.push({
        type: 'order_remaining_mismatch',
        sheet: '订单明细',
        row: r + 1,
        message: `剩余不一致：列值 ${remCol}，total-used=${remaining}，已按后者写入`,
        detail: customerId,
      });
    }
    if (remaining < 0) {
      if (remCol !== null && remCol >= 0 && remCol <= total) {
        used = total - remCol;
        remaining = remCol;
        review.push({
          type: 'order_negative_remaining_reconciled',
          sheet: '订单明细',
          row: r + 1,
          message: '已用大于总量，已按「剩份份数」列反推已用并写入',
          detail: `${customerId} total=${total} remCol=${remCol} used→${used}`,
        });
      } else {
        used = Math.min(used, total);
        remaining = total - used;
        review.push({
          type: 'order_negative_remaining_clamped',
          sheet: '订单明细',
          row: r + 1,
          message: '已用大于总量且无有效剩份列，已将已用钳制为总量、剩余为0并写入',
          detail: `${customerId} total=${total}`,
        });
      }
    }
    const dateCell = oDate !== undefined ? row[oDate] : undefined;
    const purchasedAt = parsePurchasedAtMs(dateCell ?? null) ?? parsePurchasedAtMs(oStart !== undefined ? row[oStart] : null);
    const tMs = purchasedAt ?? Date.now();

    const noteTime = oTime !== undefined ? cellStr(row[oTime]) : '';
    const remarkBits = oRemarkCols.map((i) => cellStr(row[i])).filter(Boolean);
    const notesForCatalog = [...remarkBits, noteTime].filter(Boolean).join(' ');
    let subscriptionCode: SubscriptionCardCode = 'custom';
    const inferred = inferHospitalCardCodeFromNotes(notesForCatalog);
    if (inferred) {
      const spec = getCardSpec(true, inferred);
      if (spec && spec.meals === total) {
        subscriptionCode = inferred;
      } else if (spec) {
        review.push({
          type: 'card_catalog_meals_mismatch',
          sheet: '订单明细',
          row: r + 1,
          message: '备注推断卡种与订餐份数不符院内目录，已按自定义卡写入',
          detail: `cid=${customerId} 推断=${inferred} 目录${spec.meals}份 表=${total}份`,
        });
      }
    }
    const notesParts = [IMPORT_CARD_NOTE, `cid=${customerId}`, `xlsRow=${r + 1}`, ...remarkBits, noteTime].filter(Boolean);
    const notes = notesParts.join(' | ');

    cardsToInsert.push({
      row: r + 1,
      memberKey: mKey,
      customerId,
      purchasedAt: tMs,
      paid,
      total,
      used,
      remaining,
      subscriptionCode,
      notes,
    });
  }

  type DailyPrepared = {
    row: number;
    memberKey: string;
    customerId: string;
    orderDate: string;
    quantity: number;
    mealType: 'lunch' | 'dinner';
    notes: string;
  };
  const dailyOrdersToInsert: DailyPrepared[] = [];

  if (zengSheet.length >= 2) {
    const zHdr = zengSheet[0]!;
    let zBlockCid = '';
    for (let r = 1; r < zengSheet.length; r++) {
      const row = zengSheet[r]!;
      const rawZ = cellCustomerIdRaw(row[0]);
      if (rawZ) zBlockCid = rawZ;
      if (!zBlockCid) continue;
      const zMaster = byCustomerId.get(zBlockCid);
      if (!zMaster) {
        review.push({
          type: 'zeng_orphan_cid',
          sheet: '增订份数和时间',
          row: r + 1,
          message: '客户ID 在客户信息中不存在',
          detail: zBlockCid,
        });
        continue;
      }
      const zmKey = personKey(zMaster.name, zMaster.phoneDigits, zBlockCid);
      const hint = `${cellStr(row[1])} ${cellStr(row[2])}`;
      const rowMeal = inferMealTypeFromText(hint);
      const maxCol = Math.min(row.length, zHdr.length);
      for (let c = 4; c < maxCol; c++) {
        const ymd = parseHeaderToYmd(zHdr[c]);
        if (!ymd) continue;
        const q = coerceInt(row[c]);
        if (q === null || q <= 0) continue;
        dailyOrdersToInsert.push({
          row: r + 1,
          memberKey: zmKey,
          customerId: zBlockCid,
          orderDate: ymd,
          quantity: q,
          mealType: rowMeal,
          notes: `${IMPORT_DAILY_ZENG} | cid=${zBlockCid} | xlsRow=${r + 1} col=${c}`,
        });
      }
    }
  }

  if (dailyMealSheet.length >= 2) {
    const dh = headerIndices(dailyMealSheet[0]!);
    const dCidCol = dh.get('客户ID'.replace(/\s+/g, ''));
    const dDateCol = dh.get('日期'.replace(/\s+/g, ''));
    const dQtyCol = dh.get('份数'.replace(/\s+/g, ''));
    const dNickCol = dh.get('客户昵称'.replace(/\s+/g, ''));
    const dNameCol = dh.get('姓名'.replace(/\s+/g, ''));
    if (dCidCol !== undefined && dDateCol !== undefined && dQtyCol !== undefined) {
      let dBlockCid = '';
      for (let r = 1; r < dailyMealSheet.length; r++) {
        const row = dailyMealSheet[r]!;
        const rc = cellCustomerIdRaw(row[dCidCol]);
        if (rc) dBlockCid = rc;
        if (!dBlockCid) continue;
        const dMaster = byCustomerId.get(dBlockCid);
        if (!dMaster) {
          review.push({
            type: 'daily_orphan_cid',
            sheet: '每日订餐',
            row: r + 1,
            message: '客户ID 在客户信息中不存在',
            detail: dBlockCid,
          });
          continue;
        }
        const dateTry =
          parseSheetDateCell(row[dDateCol]) ??
          (typeof row[dDateCol] === 'number' ? excelSerialToYmd(row[dDateCol] as number) : null) ??
          parseHeaderToYmd(row[dDateCol]);
        const qtyD = coerceInt(row[dQtyCol]);
        if (dateTry == null || qtyD === null || qtyD <= 0) continue;
        const hintD = [
          dNickCol !== undefined ? cellStr(row[dNickCol]) : '',
          dNameCol !== undefined ? cellStr(row[dNameCol]) : '',
        ].join(' ');
        dailyOrdersToInsert.push({
          row: r + 1,
          memberKey: personKey(dMaster.name, dMaster.phoneDigits, dBlockCid),
          customerId: dBlockCid,
          orderDate: dateTry,
          quantity: qtyD,
          mealType: inferMealTypeFromText(hintD),
          notes: `${IMPORT_DAILY_SHEET} | cid=${dBlockCid} | xlsRow=${r + 1}`,
        });
      }
    }
  }

  const cardAggByCid = new Map<string, { total: number; used: number; rem: number }>();
  for (const c of cardsToInsert) {
    const a = cardAggByCid.get(c.customerId) ?? { total: 0, used: 0, rem: 0 };
    a.total += c.total;
    a.used += c.used;
    a.rem += c.remaining;
    cardAggByCid.set(c.customerId, a);
  }

  for (let r = 2; r < summarySheet.length; r++) {
    const row = summarySheet[r] as unknown[];
    const scid = cellCustomerIdRaw(row[0]);
    if (!scid || !looksLikeSummaryCustomerId(scid)) continue;
    const st = coerceInt(row[5]);
    const su = coerceInt(row[6]);
    const sr = coerceInt(row[7]);
    if (st === null || su === null || sr === null) continue;
    const agg = cardAggByCid.get(scid);
    if (!agg) {
      review.push({
        type: 'summary_no_cards',
        sheet: '订餐汇总',
        row: r + 1,
        message: '汇总表有客户但订单明细未聚合到卡',
        detail: scid,
      });
      continue;
    }
    if (agg.total !== st || agg.used !== su || agg.rem !== sr) {
      review.push({
        type: 'summary_mismatch',
        sheet: '订餐汇总',
        row: r + 1,
        message: `份数与订单明细汇总不一致：汇总表 ${st}/${su}/${sr}，订单明细累加 ${agg.total}/${agg.used}/${agg.rem}`,
        detail: scid,
      });
    }
  }

  const IMPORT_LEDGER_YEAR = 2026;

  type SnapshotPrepared = {
    snapshotDate: string;
    totalIncome: number;
    totalExpense: number;
    balance: number;
    extraJson: string;
  };
  const snapshotsToInsert: SnapshotPrepared[] = [];
  if (calcSummarySheet.length >= 2) {
    for (let r = 1; r < calcSummarySheet.length; r++) {
      const row = calcSummarySheet[r] as unknown[];
      const dateStr = snapshotDateFromCell(row[0]);
      if (dateStr == null) continue;
      const tin = coerceAmount(row[1]);
      const tex = coerceAmount(row[2]);
      const bal = coerceAmount(row[3]);
      if (tin == null || tex == null || bal == null) continue;
      const rest = row.slice(4);
      const hasRest = rest.some((x) => x !== '' && x != null);
      snapshotsToInsert.push({
        snapshotDate: dateStr,
        totalIncome: tin,
        totalExpense: tex,
        balance: bal,
        extraJson: hasRest ? JSON.stringify(rest) : '{}',
      });
    }
  }

  type WeeklyPrepared = {
    periodLabel: string;
    inferredDate: string | null;
    amount: number;
    description: string;
    sortOrder: number;
    extraJson: string;
  };
  const weeklyToInsert: WeeklyPrepared[] = [];
  for (let r = 0; r < weeklyClosingSheet.length; r++) {
    const row = weeklyClosingSheet[r] as unknown[];
    const label = cellStr(row[0]);
    const amt = coerceAmount(row[1]);
    const desc = cellStr(row[2]);
    const tail = row.slice(3);
    const hasTail = tail.some((x) => x !== '' && x != null);
    if (amt == null && !label && !desc && !hasTail) continue;
    const amount = amt ?? 0;
    weeklyToInsert.push({
      periodLabel: label || '(未标周期)',
      inferredDate: parsePeriodLabelToYmd(label, IMPORT_LEDGER_YEAR),
      amount,
      description: desc,
      sortOrder: r,
      extraJson: hasTail ? JSON.stringify(tail) : '{}',
    });
  }

  type OrderSumPrepared = {
    customerId: string;
    excelRow: number;
    totalMeals: number | null;
    usedMeals: number | null;
    remainingMeals: number | null;
    rowJson: string;
  };
  const orderSummariesToInsert: OrderSumPrepared[] = [];
  for (let r = 2; r < summarySheet.length; r++) {
    const row = summarySheet[r] as unknown[];
    const scid = cellCustomerIdRaw(row[0]);
    if (!scid || !looksLikeSummaryCustomerId(scid)) continue;
    orderSummariesToInsert.push({
      customerId: scid,
      excelRow: r + 1,
      totalMeals: coerceInt(row[5]),
      usedMeals: coerceInt(row[6]),
      remainingMeals: coerceInt(row[7]),
      rowJson: rowToImportJson(row),
    });
  }

  type FinRow = { sheet: string; row: number; date: string; amount: number; description: string };
  const financeRows: FinRow[] = [];

  function ingestFinanceSheet(rows: unknown[][], sheet: string, amountColIdx: number) {
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]!;
      const dateStr = parseSheetDateCell(row[0]);
      const amt = coerceAmount(row[amountColIdx]);
      const desc = cellStr(row[amountColIdx + 1]);
      if (dateStr == null && amt == null) continue;
      if (amt == null || amt <= 0) continue;
      if (dateStr == null) {
        review.push({
          type: 'finance_bad_date',
          sheet,
          row: r + 1,
          message: '无法解析日期',
          detail: JSON.stringify(row[0]),
        });
        continue;
      }
      const description = `${IMPORT_FIN_PREFIX}${desc || '（无摘要）'}`;
      financeRows.push({ sheet, row: r + 1, date: dateStr, amount: amt, description });
    }
  }

  if (incomeSheet.length >= 2) ingestFinanceSheet(incomeSheet, '收入', 1);
  if (expenseSheet.length >= 2) ingestFinanceSheet(expenseSheet, '支出', 1);

  const catalogCardCount = cardsToInsert.filter((c) => c.subscriptionCode !== 'custom').length;
  console.log(
    `[stats] 客户（按 ID）: ${byCustomerId.size}；订单明细卡: ${cardsToInsert.length}（目录卡: ${catalogCardCount}）；日程订餐行: ${dailyOrdersToInsert.length}；财务(收入/支出→finance_entries): ${financeRows.length}；汇总计算记录: ${snapshotsToInsert.length}；每周结账: ${weeklyToInsert.length}；订餐汇总入库行: ${orderSummariesToInsert.length}；订餐汇总复核项: ${review.filter((x) => x.type.startsWith('summary_')).length}；待复核: ${review.length}`,
  );

  const reviewOutDir = process.cwd();
  if (review.length > 0) {
    writeNeedsReviewFiles(review, reviewOutDir);
    console.log('[warn] 已写 needs_review.csv / needs_review.xlsx', resolve(reviewOutDir, 'needs_review.xlsx'));
  }

  if (!apply) {
    console.log('[info] dry-run 结束。加 --apply [--wipe] 写入数据库。');
    return;
  }

  const db = getDb();
  const actorId = await pickActorUserId(db);

  if (wipe) {
    console.log('[wipe] 清空业务表（保留 users / settings）…');
    await wipeBusinessData(db);
  }

  /** personKey -> memberId */
  const memberIdByKey = new Map<string, number>();

  console.log('[import] members…');
  for (const c of byCustomerId.values()) {
    const uid = `${buildUid(c.nickname, c.name, c.phoneDigits)}·${c.customerId}`;
    const phone = c.phoneDigits;
    const pKey = personKey(c.name, c.phoneDigits, c.customerId);
    const [ins] = await db
      .insert(schema.members)
      .values({
        uid,
        name: c.name,
        nickname: c.nickname,
        phone,
        address: c.address,
        dietary_notes: c.dietary,
        is_hospital: true,
        is_active: true,
        is_walkin: false,
        created_by_user_id: actorId,
      })
      .returning({ id: schema.members.id });
    if (!ins) throw new Error('insert member failed');
    memberIdByKey.set(pKey, ins.id);
  }

  console.log('[import] cards…');
  let cardCount = 0;
  for (const c of cardsToInsert) {
    const mid = memberIdByKey.get(c.memberKey);
    if (mid === undefined) {
      review.push({ type: 'internal', sheet: '订单明细', row: c.row, message: 'memberKey 丢失', detail: c.memberKey });
      continue;
    }
    const catalogSpec = getCardSpec(true, c.subscriptionCode);
    const isCatalog = c.subscriptionCode !== 'custom' && catalogSpec !== null;
    const unitPrice =
      isCatalog && catalogSpec
        ? catalogSpec.unitPrice
        : c.total > 0
          ? Math.round((c.paid / c.total) * 100) / 100
          : 0;
    const status = c.remaining <= 0 ? 'exhausted' : 'active';
    await db.insert(schema.cards).values({
      member_id: mid,
      card_code: isCatalog ? c.subscriptionCode : 'custom',
      custom_label: isCatalog ? null : 'V5导入',
      custom_pack_meals: isCatalog ? null : c.total,
      is_hospital: true,
      total_meals: c.total,
      used_meals: c.used,
      remaining_meals: c.remaining,
      unit_price: unitPrice,
      paid_amount: c.paid,
      status: status as 'active' | 'exhausted',
      collector_user_id: actorId,
      created_by_user_id: actorId,
      purchased_at: new Date(c.purchasedAt),
      notes: c.notes,
    });
    cardCount++;
  }

  console.log('[import] daily_orders…');
  let dailyCount = 0;
  for (const d of dailyOrdersToInsert) {
    const mid = memberIdByKey.get(d.memberKey);
    if (mid === undefined) {
      review.push({
        type: 'internal',
        sheet: 'daily_orders',
        row: d.row,
        message: 'memberKey 丢失',
        detail: d.memberKey,
      });
      continue;
    }
    await db.insert(schema.daily_orders).values({
      member_id: mid,
      card_id: null,
      order_date: d.orderDate,
      meal_type: d.mealType,
      quantity: d.quantity,
      amount: 0,
      customer_name: '',
      status: 'delivered',
      delivered_at: shanghaiNoon(d.orderDate),
      delivery_channel: 'self',
      created_by_user_id: actorId,
      notes: d.notes,
    });
    dailyCount++;
  }

  console.log('[import] finance…');
  let finCount = 0;
  for (const f of financeRows) {
    const category = f.sheet === '收入' ? 'legacy_income' : 'legacy_expense';
    const typ = f.sheet === '收入' ? 'income' : 'expense';
    await db.insert(schema.finance_entries).values({
      entry_date: f.date,
      type: typ,
      category,
      amount: f.amount,
      description: f.description,
      source: 'imported_legacy',
      voided: false,
      created_by_user_id: actorId,
    });
    finCount++;
  }

  console.log('[import] imported_summary_snapshots…');
  let snapImp = 0;
  for (const s of snapshotsToInsert) {
    await db.insert(schema.imported_summary_snapshots).values({
      snapshot_date: s.snapshotDate,
      total_income: s.totalIncome,
      total_expense: s.totalExpense,
      balance: s.balance,
      extra_json: s.extraJson,
      created_by_user_id: actorId,
    });
    snapImp++;
  }

  console.log('[import] imported_weekly_closings…');
  let weekImp = 0;
  for (const w of weeklyToInsert) {
    await db.insert(schema.imported_weekly_closings).values({
      period_label: w.periodLabel,
      inferred_date: w.inferredDate,
      amount: w.amount,
      description: w.description,
      sort_order: w.sortOrder,
      extra_json: w.extraJson,
      created_by_user_id: actorId,
    });
    weekImp++;
  }

  console.log('[import] imported_order_summaries…');
  let sumImp = 0;
  for (const o of orderSummariesToInsert) {
    await db.insert(schema.imported_order_summaries).values({
      customer_id: o.customerId,
      excel_row: o.excelRow,
      total_meals: o.totalMeals,
      used_meals: o.usedMeals,
      remaining_meals: o.remainingMeals,
      row_json: o.rowJson,
      created_by_user_id: actorId,
    });
    sumImp++;
  }

  console.log(
    `[done] members ${memberIdByKey.size}, cards ${cardCount}, daily_orders ${dailyCount}, finance ${finCount}, summary_snapshots ${snapImp}, weekly_closings ${weekImp}, order_summaries ${sumImp}`,
  );
  const summMis = review.filter((x) => x.type === 'summary_mismatch').length;
  if (summMis > 0) {
    console.log(`[validate] 订餐汇总 有 ${summMis} 行与订单明细卡累加不一致，详见 needs_review.xlsx`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
