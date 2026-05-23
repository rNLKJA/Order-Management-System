import { useCallback, useEffect, useState } from 'react';
import {
  isPrintReady,
  loadPrintSettings,
  loadSavedPrinter,
  savePrintSettings,
  usesWebPrint,
  type PrintSettings,
  type SavedPrinter,
} from '../lib/print';

export function usePrintSettings() {
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [printer, setPrinter] = useState<SavedPrinter | null>(null);
  const [loading, setLoading] = useState(true);
  const webPrint = usesWebPrint();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSettings, nextPrinter] = await Promise.all([loadPrintSettings(), loadSavedPrinter()]);
      setSettings(nextSettings);
      setPrinter(nextPrinter);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateSettings = useCallback(async (patch: Partial<PrintSettings>) => {
    const next = await savePrintSettings(patch);
    setSettings(next);
    return next;
  }, []);

  const hasPrinter = isPrintReady(Boolean(printer?.address));

  return {
    settings,
    printer,
    loading,
    refresh,
    updateSettings,
    hasPrinter,
    webPrint,
  };
}
