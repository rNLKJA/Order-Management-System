import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SHOP_NAME, type PaperWidthMm, type PrintSettings, type SavedPrinter } from './types';

const SETTINGS_KEY = '@meal/print/settings';
const PRINTER_KEY = '@meal/print/defaultPrinter';

const DEFAULT_SETTINGS: PrintSettings = {
  shopName: DEFAULT_SHOP_NAME,
  paperWidthMm: 58,
};

export async function loadPrintSettings(): Promise<PrintSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PrintSettings>;
    return {
      shopName: parsed.shopName?.trim() || DEFAULT_SETTINGS.shopName,
      paperWidthMm: parsed.paperWidthMm === 80 ? 80 : 58,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function savePrintSettings(patch: Partial<PrintSettings>): Promise<PrintSettings> {
  const current = await loadPrintSettings();
  const next: PrintSettings = {
    shopName: patch.shopName?.trim() || current.shopName,
    paperWidthMm: patch.paperWidthMm === 80 ? 80 : patch.paperWidthMm === 58 ? 58 : current.paperWidthMm,
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export async function loadSavedPrinter(): Promise<SavedPrinter | null> {
  try {
    const raw = await AsyncStorage.getItem(PRINTER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedPrinter>;
    if (!parsed.address?.trim()) return null;
    return {
      address: parsed.address.trim(),
      name: parsed.name?.trim() || parsed.address.trim(),
    };
  } catch {
    return null;
  }
}

export async function saveSavedPrinter(printer: SavedPrinter | null): Promise<void> {
  if (!printer) {
    await AsyncStorage.removeItem(PRINTER_KEY);
    return;
  }
  await AsyncStorage.setItem(
    PRINTER_KEY,
    JSON.stringify({
      address: printer.address.trim(),
      name: printer.name.trim() || printer.address.trim(),
    }),
  );
}

export function paperWidthLabel(width: PaperWidthMm): string {
  return width === 80 ? '80mm' : '58mm';
}
