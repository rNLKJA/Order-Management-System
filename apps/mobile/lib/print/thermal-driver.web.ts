import type { MealLabelData, PaperWidthMm } from './types';
import { PrintError } from './types';

export type ScanDevice = {
  name: string;
  address: string;
  deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
  rssi?: number;
};

function webUnsupported(): never {
  throw new PrintError('打印功能请在手机 App 中使用（需安装开发版或正式版 App）。', 'WEB_UNSUPPORTED');
}

export function buildMealLabelNodes(_label: MealLabelData): never {
  webUnsupported();
}

export function buildTestLabelNodes(_shopName: string): never {
  webUnsupported();
}

export async function printLabelNodes(
  _address: string,
  _nodes: unknown[],
  _paperWidthMm: PaperWidthMm,
): Promise<void> {
  webUnsupported();
}

export async function scanPrinters(): Promise<ScanDevice[]> {
  webUnsupported();
}

export async function testPrinterConnection(_address: string): Promise<boolean> {
  webUnsupported();
}

export const ThermalPrinter = null;
