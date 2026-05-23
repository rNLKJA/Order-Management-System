import type { MockOrder } from '../../constants/mockData';

export type PaperWidthMm = 58 | 80;

export const DEFAULT_SHOP_NAME = '市医院健康漂亮餐';

export interface PrintSettings {
  shopName: string;
  paperWidthMm: PaperWidthMm;
}

export interface SavedPrinter {
  address: string;
  name: string;
}

export interface MealLabelData {
  shopName: string;
  customerName: string;
  mealTypeLabel: '午餐' | '晚餐';
  quantity: number;
  tags: string[];
  dietaryNotes: string | null;
  orderNotes: string | null;
  orderId: number;
  orderDate: string;
}

export interface PrintMealLabelsOptions {
  settings?: Partial<PrintSettings>;
  previewOnly?: boolean;
}

export class PrintError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'WEB_UNSUPPORTED'
      | 'NATIVE_UNAVAILABLE'
      | 'NO_PRINTER'
      | 'PRINT_FAILED'
      | 'SCAN_FAILED',
  ) {
    super(message);
    this.name = 'PrintError';
  }
}

export type MealLabelSource = MockOrder;
