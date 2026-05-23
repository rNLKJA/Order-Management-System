import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GLASS, SPACING, TYPE } from '../../theme/paperTheme';
import { GlassSurface } from '../ui';
import {
  DEFAULT_SHOP_NAME,
  isPrintSupported,
  paperWidthLabel,
  printErrorMessage,
  printTestLabel,
  usesWebPrint,
  type PaperWidthMm,
} from '../../lib/print';
import { usePrintSettings } from '../../hooks/usePrintSettings';
import { PrinterSetupSheet } from './PrinterSetupSheet';

export function PrintSettingsSection() {
  const { settings, printer, updateSettings, refresh, webPrint } = usePrintSettings();
  const [shopNameDraft, setShopNameDraft] = useState('');
  const [setupVisible, setSetupVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.shopName) {
      setShopNameDraft(settings.shopName);
    }
  }, [settings?.shopName]);

  const handleSaveShopName = useCallback(async () => {
    await updateSettings({ shopName: shopNameDraft.trim() || DEFAULT_SHOP_NAME });
    setFeedback('店名已保存');
  }, [shopNameDraft, updateSettings]);

  const handlePaperWidth = useCallback(
    async (paperWidthMm: PaperWidthMm) => {
      await updateSettings({ paperWidthMm });
      setFeedback(`纸张规格：${paperWidthLabel(paperWidthMm)}`);
    },
    [updateSettings],
  );

  const handleTestPrint = useCallback(async () => {
    setTesting(true);
    setFeedback(null);
    try {
      await printTestLabel();
      setFeedback(webPrint ? '已打开系统打印对话框' : '测试页已发送');
    } catch (err) {
      setFeedback(printErrorMessage(err));
    } finally {
      setTesting(false);
    }
  }, [webPrint]);

  if (!isPrintSupported()) {
    return (
      <GlassSurface padding={SPACING.base} style={styles.card}>
        <Text style={styles.title}>打印设置</Text>
        <Text style={styles.webHint}>当前浏览器不支持打印，请使用 Safari 或 Chrome。</Text>
      </GlassSurface>
    );
  }

  return (
    <>
      <GlassSurface padding={0} style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="print-outline" size={18} color={COLORS.brand} />
          <Text style={styles.title}>打印设置</Text>
        </View>

        {webPrint ? (
          <View style={styles.webBanner}>
            <Ionicons name="globe-outline" size={16} color={COLORS.brand} />
            <Text style={styles.webBannerText}>
              网页版通过 Safari 系统打印对话框输出标签，无需 App 内蓝牙配对。
            </Text>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.label}>店名（标签抬头）</Text>
          <TextInput
            value={shopNameDraft || settings?.shopName || DEFAULT_SHOP_NAME}
            onChangeText={setShopNameDraft}
            onBlur={() => void handleSaveShopName()}
            placeholder={DEFAULT_SHOP_NAME}
            style={styles.input}
          />
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>纸张宽度</Text>
          <View style={styles.chips}>
            {([58, 80] as PaperWidthMm[]).map((width) => {
              const active = (settings?.paperWidthMm ?? 58) === width;
              return (
                <Pressable
                  key={width}
                  onPress={() => void handlePaperWidth(width)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {paperWidthLabel(width)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => setSetupVisible(true)}
          style={({ pressed }) => [styles.rowBtn, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>{webPrint ? 'Safari 打印说明' : '默认打印机'}</Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              {webPrint
                ? '如何在 iPhone / iPad 上选择打印机'
                : (printer?.name ?? '未配对 — 点击设置')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.text.quaternary} />
        </Pressable>

        <Pressable
          onPress={() => void handleTestPrint()}
          disabled={testing}
          style={({ pressed }) => [styles.rowBtn, styles.rowBtnLast, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>打印测试页</Text>
            <Text style={styles.rowSub}>
              {testing ? '处理中…' : webPrint ? '将打开系统打印对话框' : '验证连接与中文显示'}
            </Text>
          </View>
          <Ionicons name="document-outline" size={16} color={COLORS.brand} />
        </Pressable>

        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      </GlassSurface>

      <PrinterSetupSheet
        visible={setupVisible}
        onClose={() => {
          setSetupVisible(false);
          void refresh();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.sm,
  },
  title: {
    ...TYPE.callout,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  webBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: SPACING.base,
    marginBottom: SPACING.sm,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  webBannerText: {
    flex: 1,
    ...TYPE.caption,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
  webHint: {
    ...TYPE.body,
    color: COLORS.text.secondary,
    padding: SPACING.base,
  },
  block: {
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.md,
    gap: 8,
  },
  label: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.outline,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text.primary,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,122,255,0.06)',
  },
  chipActive: {
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  chipText: {
    ...TYPE.caption,
    color: COLORS.text.secondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: COLORS.brand,
  },
  rowBtn: {
    minHeight: 52,
    paddingHorizontal: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GLASS.outline,
  },
  rowBtnLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flex: 1,
    paddingVertical: 10,
    gap: 2,
    marginRight: 8,
  },
  rowTitle: {
    ...TYPE.body,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  rowSub: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
  },
  feedback: {
    ...TYPE.caption,
    color: COLORS.brand,
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.base,
  },
});
