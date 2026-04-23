/**
 * 退卡 Modal —— 对齐 PROCESS §4.3。
 *
 * 规则展示：
 *  - 已用 X 份 · 剩 Y 份 · 原价 ¥Z
 *  - 建议退款 = round(已付 × 剩 / 总)，可改但须 ≤ 已付金额
 *  - 必须选择原因（下拉 + 自定义补充）
 *
 * 提交后：
 *  - 卡 status='refunded'
 *  - 写一条 expense FinanceEntry
 *  - 该会员回到"无有效卡"状态，可继续开新卡
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOS_COLORS } from '../theme/paperTheme';

export interface RefundCardCurrent {
  card_name: string;
  is_hospital: boolean;
  paid_amount: number;
  total_meals: number;
  used_meals: number;
  remaining_meals: number;
  unit_price: number;
}

export interface RefundSubmitPayload {
  refund_amount: number;
  reason: string;
}

export interface RefundCardModalProps {
  visible: boolean;
  memberName: string;
  currentCard: RefundCardCurrent;
  onClose: () => void;
  onSubmit: (payload: RefundSubmitPayload) => Promise<void> | void;
}

const PRESET_REASONS = [
  '客户要求',
  '服务异常',
  '长期不再订餐',
  '重复开卡',
  '其他',
] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 建议退款：paid_amount × remaining_meals / total_meals，四舍五入到分 */
function suggestedRefund(card: RefundCardCurrent): number {
  if (card.total_meals <= 0) return 0;
  return round2((card.paid_amount * card.remaining_meals) / card.total_meals);
}

export function RefundCardModal(props: RefundCardModalProps) {
  const { visible, memberName, currentCard, onClose, onSubmit } = props;

  const suggestion = useMemo(() => suggestedRefund(currentCard), [currentCard]);

  const [amountText, setAmountText] = useState(String(suggestion));
  const [reason, setReason] = useState<string>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAmountText(String(suggestion));
      setReason(PRESET_REASONS[0]);
      setCustomReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible, suggestion]);

  const amount = parseFloat(amountText);
  const amountValid =
    Number.isFinite(amount) && amount >= 0 && amount <= currentCard.paid_amount;

  const finalReason = reason === '其他' ? customReason.trim() : reason;
  const reasonValid = finalReason.length > 0;

  const canSubmit = amountValid && reasonValid && !submitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        refund_amount: round2(amount),
        reason: finalReason,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '退卡失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} disabled={submitting}>
            <Text style={[styles.cancel, submitting && styles.disabled]}>
              取消
            </Text>
          </Pressable>
          <Text style={styles.title}>退卡</Text>
          <Pressable onPress={handleConfirm} disabled={!canSubmit}>
            <Text style={[styles.confirm, !canSubmit && styles.disabled]}>
              确认
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{memberName}</Text>
            <Text style={styles.cardSub}>
              {currentCard.card_name} ·{' '}
              {currentCard.is_hospital ? '院内' : '院外'} · ¥
              {currentCard.unit_price}/份
            </Text>
            <View style={styles.metaRow}>
              <Meta label="已付" value={`¥${currentCard.paid_amount}`} />
              <Meta
                label="已用"
                value={`${currentCard.used_meals} / ${currentCard.total_meals}`}
              />
              <Meta
                label="剩"
                value={`${currentCard.remaining_meals} 份`}
                tint={IOS_COLORS.blue}
              />
            </View>
          </View>

          <Text style={styles.sectionLabel}>退款金额</Text>
          <View style={styles.card}>
            <View style={styles.amountRow}>
              <Text style={styles.amountPrefix}>¥</Text>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={(t) => setAmountText(t.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                editable={!submitting}
              />
            </View>
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>
                建议 ¥{suggestion}（按剩余份数比例）
              </Text>
              <Pressable
                onPress={() => setAmountText(String(suggestion))}
                hitSlop={6}
              >
                <Text style={styles.hintLink}>用建议值</Text>
              </Pressable>
            </View>
            {!amountValid && amountText.length > 0 ? (
              <Text style={styles.errorText}>
                金额必须 ≥ 0 且 ≤ 已付 ¥{currentCard.paid_amount}
              </Text>
            ) : null}
          </View>

          <Text style={styles.sectionLabel}>退款原因</Text>
          <View style={styles.card}>
            <View style={styles.reasonWrap}>
              {PRESET_REASONS.map((r) => {
                const active = reason === r;
                return (
                  <Pressable
                    key={r}
                    disabled={submitting}
                    onPress={() => setReason(r)}
                    style={[styles.reasonChip, active && styles.reasonChipActive]}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        active && styles.reasonTextActive,
                      ]}
                    >
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {reason === '其他' ? (
              <TextInput
                style={styles.customReasonInput}
                placeholder="请填写具体原因"
                placeholderTextColor={IOS_COLORS.labelTertiary}
                value={customReason}
                onChangeText={setCustomReason}
                editable={!submitting}
                multiline
                maxLength={120}
              />
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          <View style={{ height: 48 }} />
        </ScrollView>

        <View style={styles.summaryBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryMain}>
              本次退款{' '}
              <Text style={styles.summaryAmount}>
                ¥{amountValid ? round2(amount) : 0}
              </Text>
            </Text>
            <Text style={styles.summarySub}>
              退卡后该会员进入"无有效卡"状态
            </Text>
          </View>
          <Pressable
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            disabled={!canSubmit}
            onPress={handleConfirm}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>确认退卡</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Meta({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <View style={styles.meta}>
      <Text style={[styles.metaValue, tint ? { color: tint } : null]}>
        {value}
      </Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: IOS_COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separatorLight,
  },
  cancel: { fontSize: 17, color: IOS_COLORS.labelSecondary, width: 60 },
  title: { fontSize: 17, fontWeight: '600', color: IOS_COLORS.label },
  confirm: {
    fontSize: 17,
    color: '#FF3B30',
    fontWeight: '600',
    width: 60,
    textAlign: 'right',
  },
  disabled: { opacity: 0.3 },

  scrollBody: { padding: 16, gap: 6 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 4,
    paddingTop: 14,
    paddingBottom: 4,
  },

  card: {
    backgroundColor: IOS_COLORS.card,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: IOS_COLORS.label },
  cardSub: { fontSize: 13, color: IOS_COLORS.labelSecondary },

  metaRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separatorLight,
  },
  meta: { flex: 1, alignItems: 'center', gap: 2 },
  metaValue: { fontSize: 16, fontWeight: '700', color: IOS_COLORS.label },
  metaLabel: { fontSize: 11, color: IOS_COLORS.labelSecondary },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  amountPrefix: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.labelSecondary,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
    paddingVertical: 4,
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hintText: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  hintLink: { fontSize: 13, color: IOS_COLORS.blue, fontWeight: '600' },
  errorText: { fontSize: 12, color: '#FF3B30', marginTop: 4 },

  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.fillLight,
  },
  reasonChipActive: { backgroundColor: '#FF3B30' },
  reasonText: { fontSize: 14, color: IOS_COLORS.label },
  reasonTextActive: { color: '#fff', fontWeight: '600' },

  customReasonInput: {
    marginTop: 10,
    fontSize: 15,
    color: IOS_COLORS.label,
    padding: 12,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.fillLight,
    minHeight: 64,
    textAlignVertical: 'top',
  },

  errorBanner: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
  },
  errorBannerText: { fontSize: 14, color: '#FF3B30' },

  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separatorLight,
  },
  summaryMain: { fontSize: 15, color: IOS_COLORS.label },
  summaryAmount: { fontSize: 20, fontWeight: '700', color: '#FF3B30' },
  summarySub: { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: 2 },

  primaryBtn: {
    height: 44,
    minWidth: 130,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { backgroundColor: IOS_COLORS.labelTertiary },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
