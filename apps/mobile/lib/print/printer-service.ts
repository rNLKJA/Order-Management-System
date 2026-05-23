import { Platform } from 'react-native';
import type { MockOrder } from '../../constants/mockData';
import { buildTestLabelData } from './meal-label-html';
import { mapOrdersToMealLabels } from './meal-label-mapper';
import { printMealLabelsWeb } from './print-web';
import { loadPrintSettings, loadSavedPrinter } from './print-settings-store';
import {
  buildMealLabelNodes,
  buildTestLabelNodes,
  printLabelNodes,
  scanPrinters,
  testPrinterConnection,
} from './thermal-driver';
import { PrintError, type MealLabelData, type PrintMealLabelsOptions, type SavedPrinter } from './types';

export { scanPrinters, testPrinterConnection };
export type { ScanDevice } from './thermal-driver';

export function usesWebPrint(): boolean {
  return Platform.OS === 'web';
}

export function isBrowserPrintAvailable(): boolean {
  if (Platform.OS !== 'web') return false;
  return typeof window !== 'undefined' && typeof window.print === 'function';
}

export function isPrintSupported(): boolean {
  if (Platform.OS === 'web') {
    return isBrowserPrintAvailable();
  }
  return true;
}

export function isPrintReady(hasSavedPrinter: boolean): boolean {
  if (Platform.OS === 'web') {
    return isBrowserPrintAvailable();
  }
  return hasSavedPrinter;
}

export async function getSavedPrinter(): Promise<SavedPrinter | null> {
  return loadSavedPrinter();
}

export async function requireSavedPrinter(): Promise<SavedPrinter> {
  const printer = await loadSavedPrinter();
  if (!printer) {
    throw new PrintError('请先在打印设置中配对默认打印机。', 'NO_PRINTER');
  }
  return printer;
}

async function printLabelsNative(
  labels: MealLabelData[],
  paperWidthMm: import('./types').PaperWidthMm,
): Promise<void> {
  const printer = await requireSavedPrinter();
  for (const label of labels) {
    const nodes = buildMealLabelNodes(label);
    await printLabelNodes(printer.address, nodes, paperWidthMm);
  }
}

export async function printMealLabels(
  orders: MockOrder[],
  options: PrintMealLabelsOptions = {},
): Promise<{ count: number; labels: MealLabelData[] }> {
  if (orders.length === 0) {
    return { count: 0, labels: [] };
  }

  const storedSettings = await loadPrintSettings();
  const settings = {
    shopName: options.settings?.shopName ?? storedSettings.shopName,
    paperWidthMm: options.settings?.paperWidthMm ?? storedSettings.paperWidthMm,
  };
  const labels = mapOrdersToMealLabels(orders, settings.shopName);

  if (options.previewOnly) {
    return { count: labels.length, labels };
  }

  try {
    if (usesWebPrint()) {
      await printMealLabelsWeb(labels, settings.paperWidthMm);
    } else {
      await printLabelsNative(labels, settings.paperWidthMm);
    }
    return { count: labels.length, labels };
  } catch (err) {
    if (err instanceof PrintError) throw err;
    const message = err instanceof Error ? err.message : '打印失败，请检查打印机连接。';
    throw new PrintError(message, 'PRINT_FAILED');
  }
}

export async function printTestLabel(): Promise<void> {
  const settings = await loadPrintSettings();

  try {
    if (usesWebPrint()) {
      await printMealLabelsWeb([buildTestLabelData(settings.shopName)], settings.paperWidthMm);
      return;
    }
    const printer = await requireSavedPrinter();
    const nodes = buildTestLabelNodes(settings.shopName);
    await printLabelNodes(printer.address, nodes, settings.paperWidthMm);
  } catch (err) {
    if (err instanceof PrintError) throw err;
    const message = err instanceof Error ? err.message : '测试打印失败。';
    throw new PrintError(message, 'PRINT_FAILED');
  }
}

export function printErrorMessage(err: unknown): string {
  if (err instanceof PrintError) return err.message;
  if (err instanceof Error) return err.message;
  return '打印失败，请稍后重试。';
}
