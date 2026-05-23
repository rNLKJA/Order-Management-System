export {
  getSavedPrinter,
  isBrowserPrintAvailable,
  isPrintReady,
  isPrintSupported,
  printErrorMessage,
  printMealLabels,
  printTestLabel,
  requireSavedPrinter,
  scanPrinters,
  testPrinterConnection,
  usesWebPrint,
} from './printer-service';
export type { ScanDevice } from './printer-service';
export {
  buildMealLabelTags,
  displayCustomerName,
  mapOrderToMealLabel,
  mapOrdersToMealLabels,
} from './meal-label-mapper';
export {
  loadPrintSettings,
  loadSavedPrinter,
  paperWidthLabel,
  savePrintSettings,
  saveSavedPrinter,
} from './print-settings-store';
export {
  DEFAULT_SHOP_NAME,
  PrintError,
  type MealLabelData,
  type MealLabelSource,
  type PaperWidthMm,
  type PrintSettings,
  type SavedPrinter,
} from './types';
