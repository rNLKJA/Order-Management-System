import type { MealLabelData, PaperWidthMm } from './types';
import { PrintError } from './types';

export async function printMealLabelsWeb(
  _labels: MealLabelData[],
  _paperWidthMm: PaperWidthMm,
): Promise<void> {
  throw new PrintError('Web 打印仅在浏览器中可用。', 'WEB_UNSUPPORTED');
}
