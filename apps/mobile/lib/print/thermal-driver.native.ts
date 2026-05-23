import ThermalPrinter, {
  cut,
  feed,
  line,
  text,
  type Node,
} from 'react-native-thermal-printer-driver';
import type { MealLabelData, PaperWidthMm } from './types';

export { ThermalPrinter };

export function buildMealLabelNodes(label: MealLabelData): Node[] {
  const nodes: Node[] = [
    text(label.shopName, { align: 'center', bold: true }),
    line(),
    text(label.mealTypeLabel, { align: 'center', bold: true, size: 2 }),
    text(`${label.customerName} · ${label.quantity} 份`, { align: 'center', bold: true }),
  ];

  if (label.tags.length > 0) {
    nodes.push(text(label.tags.join('  '), { align: 'center' }));
  }

  if (label.dietaryNotes) {
    nodes.push(text(`忌口：${label.dietaryNotes}`));
  }

  if (label.orderNotes) {
    nodes.push(text(`备注：${label.orderNotes}`));
  }

  nodes.push(
    text(`#${label.orderId} · ${label.orderDate}`, { align: 'center' }),
    line({ style: 'dashed' }),
    feed(2),
    cut(),
  );

  return nodes;
}

export function buildTestLabelNodes(shopName: string): Node[] {
  return [
    text(shopName, { align: 'center', bold: true }),
    line(),
    text('打印测试', { align: 'center', bold: true, size: 2 }),
    text('若能看到此行中文，说明打印机连接正常。', { align: 'center' }),
    feed(2),
    cut(),
  ];
}

export async function printLabelNodes(
  address: string,
  nodes: Node[],
  paperWidthMm: PaperWidthMm,
): Promise<void> {
  await ThermalPrinter.connect(address, { timeout: 10000 });
  await ThermalPrinter.print(address, nodes, {
    paperWidthMm,
    timeout: 15000,
    keepAlive: true,
  });
}

export type ScanDevice = {
  name: string;
  address: string;
  deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
  rssi?: number;
};

export async function scanPrinters(): Promise<ScanDevice[]> {
  const result = await ThermalPrinter.scan();
  const seen = new Set<string>();
  const merged: ScanDevice[] = [];
  for (const device of [...result.paired, ...result.found]) {
    if (seen.has(device.address)) continue;
    seen.add(device.address);
    merged.push(device);
  }
  return merged;
}

export async function testPrinterConnection(address: string): Promise<boolean> {
  const result = await ThermalPrinter.testConnection(address);
  return result.success;
}
