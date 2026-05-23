import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { orderTabPageMeta, type TabKey } from './constants';
import { orderScreenStyles as styles } from './orderScreenStyles';
import { IOS_COLORS } from '../../theme/paperTheme';
import { usesWebPrint } from '../../lib/print';

export function OrderTabPageBanner({
  activeTab,
  printerConnected,
  onOpenPrintSettings,
}: {
  activeTab: TabKey;
  printerConnected?: boolean;
  onOpenPrintSettings?: () => void;
}) {
  const meta = orderTabPageMeta(activeTab);
  const showPrinterStatus = activeTab === 'prep' && onOpenPrintSettings != null;
  const webPrint = usesWebPrint();
  const statusLabel = webPrint
    ? printerConnected
      ? 'Safari 就绪'
      : '不可用'
    : printerConnected
      ? '已配对'
      : '未配对';
  const statusColor = printerConnected ? '#34C759' : IOS_COLORS.orange;

  return (
    <View style={styles.tabPageBanner}>
      <View style={styles.tabPageBannerIcon}>
        <Ionicons name={meta.icon} size={22} color={IOS_COLORS.blue} />
      </View>
      <View style={styles.tabPageBannerText}>
        <Text style={styles.tabPageBannerTitle}>{meta.title}</Text>
        <Text style={styles.tabPageBannerDesc} numberOfLines={2}>
          {meta.description}
        </Text>
      </View>
      {showPrinterStatus ? (
        <Pressable
          onPress={onOpenPrintSettings}
          hitSlop={8}
          style={({ pressed }) => [styles.tabPageBannerPrinter, pressed && { opacity: 0.75 }]}
        >
          <Ionicons
            name={webPrint ? 'globe-outline' : 'print-outline'}
            size={18}
            color={statusColor}
          />
          <Text style={[styles.tabPageBannerPrinterText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
