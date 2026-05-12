/**
 * 修补 V5 xlsm：P012 份数自洽；H083 续行姓名占位日期改为「鲍丽娟」。
 * 原表中 H13/I13、G14/H14 为公式链，需改为常量后导入读到的 cell.v 才正确。
 *
 * pnpm --filter @meal/scripts exec tsx src/patch-v5-xlsm.ts
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, '../../doc/市医院健康漂亮餐订餐表-数据格式调整V5.xlsm');
const backup = file.replace(/\.xlsm$/i, '.pre-patch-backup.xlsm');

function setNum(sheet: XLSX.WorkSheet, addr: string, v: number) {
  sheet[addr] = { t: 'n', v };
}

function setStr(sheet: XLSX.WorkSheet, addr: string, v: string) {
  sheet[addr] = { t: 'str', v };
}

const buf = readFileSync(file);
copyFileSync(file, backup);
console.log('[patch] backup:', backup);

const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
const orders = wb.Sheets['订单明细'];
const summary = wb.Sheets['订餐汇总'];
if (!orders || !summary) {
  console.error('[patch] missing sheet');
  process.exit(1);
}

// 订餐汇总：G14=已用、H14=剩余（原 H14=F14-G14、G14=横项 SUM，与 F14=40 时应为 40/0）
setNum(summary, 'G14', 40);
setNum(summary, 'H14', 0);

// 订单明细：与汇总一致（原单元格为 =订餐汇总!G14 等，改为常量供 xlsx 读值）
setNum(orders, 'H13', 40);
setNum(orders, 'I13', 0);

// H083 合并续行：C86:C99 姓名误为 1899 占位日期
for (let r = 86; r <= 99; r++) {
  setStr(orders, `C${r}`, '鲍丽娟');
}

XLSX.writeFile(wb, file, { bookType: 'xlsm' });
console.log('[patch] written:', file);
