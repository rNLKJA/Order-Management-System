import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GLASS, SPACING, TYPE } from '../../theme/paperTheme';
import { GlassSurface, SheetHeader } from '../ui';
import {
  isPrintSupported,
  printErrorMessage,
  printTestLabel,
  saveSavedPrinter,
  scanPrinters,
  usesWebPrint,
  type SavedPrinter,
  type ScanDevice,
} from '../../lib/print';
import { usePrintSettings } from '../../hooks/usePrintSettings';

function WebPrintGuide() {
  return (
    <View style={styles.helpBox}>
      <Text style={styles.helpTitle}>Safari / 浏览器打印说明</Text>
      <Text style={styles.helpText}>1. 在 iPhone / iPad 的 Safari 打开本页面（可添加到主屏幕）。</Text>
      <Text style={styles.helpText}>2. 点击「打印」后，系统会弹出打印对话框。</Text>
      <Text style={styles.helpText}>3. 选择 AirPrint 打印机，或已在系统中配对的蓝牙热敏打印机。</Text>
      <Text style={styles.helpText}>4. 若列表中没有打印机，请先在「设置 → 蓝牙 / 打印机」中完成配对。</Text>
      <Text style={styles.helpText}>5. 纸张宽度请在下方选择 58mm（默认）或 80mm，与打印机纸卷一致。</Text>
    </View>
  );
}

export function PrinterSetupSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: (printer: SavedPrinter) => void;
}) {
  const { printer, refresh } = usePrintSettings();
  const webPrint = usesWebPrint();
  const [devices, setDevices] = useState<ScanDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [savingAddress, setSavingAddress] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    if (webPrint) return;
    if (!isPrintSupported()) {
      setError('请在支持蓝牙的开发版 App 中使用原生打印。');
      return;
    }
    setScanning(true);
    setError(null);
    setMessage(null);
    try {
      const found = await scanPrinters();
      setDevices(found);
      if (found.length === 0) {
        setMessage('未找到打印机。请确认打印机已开机，并在系统蓝牙设置中完成配对后重试。');
      }
    } catch (err) {
      setError(printErrorMessage(err));
    } finally {
      setScanning(false);
    }
  }, [webPrint]);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setMessage(null);
    void refresh();
    if (!webPrint) {
      void runScan();
    }
  }, [visible, refresh, runScan, webPrint]);

  const handleSelect = useCallback(
    async (device: ScanDevice) => {
      setSavingAddress(device.address);
      setError(null);
      try {
        const saved: SavedPrinter = {
          address: device.address,
          name: device.name || device.address,
        };
        await saveSavedPrinter(saved);
        await refresh();
        onSaved?.(saved);
        setMessage(`已设为默认打印机：${saved.name}`);
      } catch (err) {
        setError(printErrorMessage(err));
      } finally {
        setSavingAddress(null);
      }
    },
    [onSaved, refresh],
  );

  const handleTestPrint = useCallback(async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      await printTestLabel();
      setMessage(
        webPrint
          ? '已打开系统打印对话框，请在 Safari 中选择打印机。'
          : '测试页已发送，请查看打印机输出。',
      );
    } catch (err) {
      setError(printErrorMessage(err));
    } finally {
      setTesting(false);
    }
  }, [webPrint]);

  const title = webPrint ? '浏览器打印' : '打印机配对';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <GlassSurface padding={0} style={styles.sheet}>
          <SheetHeader title={title} onClose={onClose} />
          <ScrollView contentContainerStyle={styles.body}>
            {webPrint ? (
              <>
                <View style={styles.currentBox}>
                  <Ionicons name="globe-outline" size={18} color={COLORS.success} />
                  <View style={styles.currentTextWrap}>
                    <Text style={styles.currentLabel}>打印方式</Text>
                    <Text style={styles.currentName}>Safari / 系统打印对话框</Text>
                  </View>
                </View>
                <WebPrintGuide />
              </>
            ) : (
              <>
                {printer ? (
                  <View style={styles.currentBox}>
                    <Ionicons name="print-outline" size={18} color={COLORS.success} />
                    <View style={styles.currentTextWrap}>
                      <Text style={styles.currentLabel}>当前默认打印机</Text>
                      <Text style={styles.currentName}>{printer.name}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.currentBoxMuted}>
                    <Ionicons name="print-outline" size={18} color={COLORS.text.tertiary} />
                    <Text style={styles.currentMutedText}>尚未配对默认打印机</Text>
                  </View>
                )}

                <Pressable
                  onPress={() => void runScan()}
                  disabled={scanning}
                  style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.85 }]}
                >
                  {scanning ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="search-outline" size={18} color="#fff" />
                  )}
                  <Text style={styles.scanBtnText}>{scanning ? '搜索中…' : '搜索附近打印机'}</Text>
                </Pressable>

                {devices.map((device) => {
                  const selected = printer?.address === device.address;
                  return (
                    <Pressable
                      key={device.address}
                      onPress={() => void handleSelect(device)}
                      disabled={savingAddress === device.address}
                      style={({ pressed }) => [
                        styles.deviceRow,
                        selected && styles.deviceRowSelected,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={styles.deviceMain}>
                        <Text style={styles.deviceName}>{device.name || '未知设备'}</Text>
                        <Text style={styles.deviceMeta}>
                          {device.deviceType.toUpperCase()} · {device.address}
                        </Text>
                      </View>
                      {savingAddress === device.address ? (
                        <ActivityIndicator size="small" color={COLORS.brand} />
                      ) : selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={COLORS.text.quaternary} />
                      )}
                    </Pressable>
                  );
                })}

                <View style={styles.helpBox}>
                  <Text style={styles.helpTitle}>原生 App 配对说明</Text>
                  <Text style={styles.helpText}>1. 打开 58mm 蓝牙热敏打印机电源。</Text>
                  <Text style={styles.helpText}>2. 在手机系统设置中打开蓝牙并完成配对（Android 推荐）。</Text>
                  <Text style={styles.helpText}>3. 回到本页搜索设备，点选芯烨 / 佳博等打印机设为默认。</Text>
                </View>
              </>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {message ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => void handleTestPrint()}
              disabled={testing}
              style={({ pressed }) => [styles.testBtn, pressed && { opacity: 0.85 }]}
            >
              {testing ? (
                <ActivityIndicator size="small" color={COLORS.brand} />
              ) : (
                <Ionicons name="document-outline" size={18} color={COLORS.brand} />
              )}
              <Text style={styles.testBtnText}>
                {webPrint ? '打印测试页（打开系统对话框）' : '打印测试页'}
              </Text>
            </Pressable>
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  body: {
    paddingHorizontal: SPACING.page,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  currentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderRadius: 12,
    padding: 12,
  },
  currentTextWrap: { flex: 1 },
  currentLabel: { ...TYPE.caption, color: COLORS.text.tertiary },
  currentName: { ...TYPE.body, color: COLORS.text.primary, fontWeight: '700' },
  currentBoxMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.brandSoft,
    borderRadius: 12,
    padding: 12,
  },
  currentMutedText: { ...TYPE.body, color: COLORS.text.tertiary },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingVertical: 12,
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.outline,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  deviceRowSelected: {
    borderColor: COLORS.success,
    backgroundColor: 'rgba(52,199,89,0.06)',
  },
  deviceMain: { flex: 1, gap: 2 },
  deviceName: { ...TYPE.body, fontWeight: '700', color: COLORS.text.primary },
  deviceMeta: { ...TYPE.caption, color: COLORS.text.tertiary },
  helpBox: {
    backgroundColor: COLORS.brandSoft,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  helpTitle: { ...TYPE.callout, fontWeight: '700', color: COLORS.text.primary },
  helpText: { ...TYPE.caption, color: COLORS.text.secondary, lineHeight: 18 },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.brand,
    paddingVertical: 12,
  },
  testBtnText: { color: COLORS.brand, fontWeight: '700', fontSize: 15 },
  errorBox: {
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: COLORS.danger, fontSize: 14, lineHeight: 20 },
  messageBox: {
    backgroundColor: 'rgba(0,122,255,0.08)',
    borderRadius: 10,
    padding: 12,
  },
  messageText: { color: COLORS.brand, fontSize: 14, lineHeight: 20 },
});
