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
import { COLORS, SPACING } from '../../theme/paperTheme';
import { GlassSurface, SheetHeader } from '../ui';
import {
  mapOrdersToMealLabels,
  printErrorMessage,
  printMealLabels,
  loadPrintSettings,
  type MealLabelData,
} from '../../lib/print';
import type { MockOrder } from '../../constants/mockData';
import { MealLabelPreview } from './MealLabelPreview';

export function MealLabelPreviewSheet({
  visible,
  orders,
  onClose,
  onPrinted,
  onNeedPrinter,
}: {
  visible: boolean;
  orders: MockOrder[];
  onClose: () => void;
  onPrinted?: (count: number) => void;
  onNeedPrinter?: () => void;
}) {
  const [labels, setLabels] = useState<MealLabelData[]>([]);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    void loadPrintSettings()
      .then((settings) => setLabels(mapOrdersToMealLabels(orders, settings.shopName)))
      .catch(() => setLabels(mapOrdersToMealLabels(orders)));
  }, [visible, orders]);

  const handlePrint = useCallback(async () => {
    setPrinting(true);
    setError(null);
    try {
      const result = await printMealLabels(orders);
      onPrinted?.(result.count);
      onClose();
    } catch (err) {
      const message = printErrorMessage(err);
      setError(message);
      if (message.includes('配对') || message.includes('浏览器')) {
        onNeedPrinter?.();
      }
    } finally {
      setPrinting(false);
    }
  }, [orders, onClose, onNeedPrinter, onPrinted]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <GlassSurface padding={0} style={styles.sheet}>
          <SheetHeader
            title={orders.length > 1 ? `打印 ${orders.length} 张标签` : '打印餐盒标签'}
            onClose={onClose}
            onConfirm={handlePrint}
            confirmLabel="打印"
            confirming={printing}
            confirmDisabled={orders.length === 0 || Boolean(error)}
          />
          <ScrollView contentContainerStyle={styles.body}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {labels.length === 0 && !error ? (
              <ActivityIndicator color={COLORS.brand} style={{ marginVertical: 24 }} />
            ) : (
              labels.map((label, index) => (
                <View key={`${label.orderId}-${index}`} style={styles.previewWrap}>
                  {labels.length > 1 ? (
                    <Text style={styles.previewIndex}>
                      {index + 1} / {labels.length}
                    </Text>
                  ) : null}
                  <MealLabelPreview label={label} />
                </View>
              ))
            )}
          </ScrollView>
          <Pressable onPress={onClose} style={styles.dismissArea} accessibilityRole="button" />
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
    maxHeight: '82%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  body: {
    paddingHorizontal: SPACING.page,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  previewWrap: {
    gap: 6,
  },
  previewIndex: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  dismissArea: {
    height: 0,
  },
});
