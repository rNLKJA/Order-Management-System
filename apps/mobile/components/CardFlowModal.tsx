/**
 * 统一的开卡 / 升级 Modal —— 对齐 PROCESS §4.2、DESIGN §8.4。
 *
 * 复用两种模式：
 *  - mode='purchase'：会员当前无 active 卡，所有卡种可选
 *  - mode='upgrade'：会员当前有 active 卡；同价目表内总价严格大于旧卡 paid_amount 的才可选
 *
 * 含：院内/院外切换（默认=会员原属性）、卡种网格（禁用态带说明）、
 * 收款人/录入者分区（iOS 设置页样式）、备注、底部汇总条、提交态、错误提示。
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
import {
  listCards,
  listUpgradeOptions,
  getCardSpec,
  CARD_RENEWAL_THRESHOLD_MEALS,
  type CardSpec,
  type SubscriptionCardCode,
} from '@meal/shared';
import { IOS_COLORS } from '../theme/paperTheme';
import {
  COLLECTORS,
  DEFAULT_COLLECTOR,
  DEFAULT_RECORDER,
  RECORDERS,
  type Collector,
  type Recorder,
} from '../constants/mockData';
import { confirmAction } from '../lib/confirm';

export type CardFlowMode = 'purchase' | 'upgrade' | 'renew';

/**
 * Modal 需要知道的"当前卡"最小字段集（供升级 / 续卡模式展示基线与计算）。
 * Mock 端的 MockCard 与 API 端的 Card 结构都能满足（字段名对齐）。
 *
 * 续卡额外依赖：card_code（沿用同卡种）、remaining_meals（结转到新卡 + 阈值校验）。
 */
export interface CardFlowCurrentCard {
  card_name?: string;
  card_code?: SubscriptionCardCode;
  is_hospital: boolean;
  paid_amount: number;
  used_meals: number;
  total_meals: number;
  remaining_meals?: number;
}

export interface CardFlowSubmitPayload {
  spec: CardSpec;
  isHospital: boolean;
  collector: Collector;
  recorder: Recorder;
  notes: string;
}

export interface CardFlowModalProps {
  visible: boolean;
  mode: CardFlowMode;
  memberName: string;
  /** 会员当前是否院内（用于默认价目表） */
  memberIsHospital: boolean;
  /** mode='upgrade' 时必须传当前 active 卡 */
  currentCard?: CardFlowCurrentCard | null;
  onClose: () => void;
  /** 返回 Promise 以便 Modal 显示 loading；抛错时展示错误 */
  onSubmit: (payload: CardFlowSubmitPayload) => Promise<void> | void;
}

export function CardFlowModal(props: CardFlowModalProps) {
  const {
    visible, mode, memberName, memberIsHospital,
    currentCard, onClose, onSubmit,
  } = props;

  const [isHospital, setIsHospital] = useState(memberIsHospital);
  const [selectedCode, setSelectedCode] = useState<SubscriptionCardCode | null>(null);
  const [collector, setCollector] = useState<Collector>(DEFAULT_COLLECTOR);
  const [recorder, setRecorder] = useState<Recorder>(DEFAULT_RECORDER);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 续卡：锁死到当前卡的 spec（同卡种、同价目表、同价格）
  const renewSpec = useMemo<CardSpec | null>(() => {
    if (mode !== 'renew' || !currentCard?.card_code) return null;
    return getCardSpec(currentCard.is_hospital, currentCard.card_code);
  }, [mode, currentCard]);

  useEffect(() => {
    if (visible) {
      setIsHospital(currentCard?.is_hospital ?? memberIsHospital);
      // 续卡：初始化选中态为当前卡种，其他模式清空
      setSelectedCode(mode === 'renew' ? (currentCard?.card_code ?? null) : null);
      setCollector(DEFAULT_COLLECTOR);
      setRecorder(DEFAULT_RECORDER);
      setNotes('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible, memberIsHospital, currentCard, mode]);

  const allCards = useMemo(() => listCards(isHospital), [isHospital]);
  const allowedCodes = useMemo(() => {
    if (mode === 'upgrade' && currentCard) {
      return new Set(
        listUpgradeOptions(isHospital, currentCard.paid_amount).map((c) => c.code),
      );
    }
    if (mode === 'renew' && currentCard?.card_code) {
      return new Set<SubscriptionCardCode>([currentCard.card_code]);
    }
    return new Set(allCards.map((c) => c.code));
  }, [mode, currentCard, isHospital, allCards]);

  const selectedSpec = useMemo<CardSpec | null>(() => {
    if (mode === 'renew') return renewSpec;
    return allCards.find((c) => c.code === selectedCode) ?? null;
  }, [mode, renewSpec, allCards, selectedCode]);

  const crossZone =
    mode === 'upgrade' &&
    currentCard != null &&
    currentCard.is_hospital !== isHospital;

  // 升级金额与剩餐
  const diff =
    mode === 'upgrade' && selectedSpec && currentCard
      ? round2(selectedSpec.totalPrice - currentCard.paid_amount)
      : null;
  const newRemaining =
    mode === 'upgrade' && selectedSpec && currentCard
      ? Math.max(0, selectedSpec.meals - currentCard.used_meals)
      : null;

  // 续卡：结转餐数 + 新卡总餐数
  const renewCarried =
    mode === 'renew' && currentCard ? Math.max(0, currentCard.remaining_meals ?? 0) : 0;
  const renewNewTotal =
    mode === 'renew' && selectedSpec ? selectedSpec.meals + renewCarried : null;
  const renewThresholdOk =
    mode === 'renew' && currentCard
      ? (currentCard.remaining_meals ?? 0) <= CARD_RENEWAL_THRESHOLD_MEALS
      : true;

  const canSubmit =
    !!selectedSpec &&
    allowedCodes.has(selectedSpec.code) &&
    !submitting &&
    (mode !== 'renew' || renewThresholdOk);

  const title =
    mode === 'purchase' ? '购买新卡' : mode === 'upgrade' ? '升级卡片' : '续卡';
  const primaryLabel =
    mode === 'purchase' ? '确认开卡' : mode === 'upgrade' ? '确认升级' : '确认续卡';

  const handleConfirm = () => {
    if (!selectedSpec) return;
    let lines: string[];
    let confirmTitle: string;
    if (mode === 'purchase') {
      confirmTitle = '确认开卡';
      lines = [
        `为 ${memberName} 开通【${selectedSpec.name}】`,
        `应收 ¥${selectedSpec.totalPrice}`,
        `收款人：${collector}`,
      ];
    } else if (mode === 'upgrade') {
      confirmTitle = '确认升级';
      lines = [
        `${memberName} 从【${currentCard?.card_name ?? '当前卡'}】升级到【${selectedSpec.name}】`,
        `补差价 ¥${diff} · 升级后剩 ${newRemaining} 份`,
        `收款人：${collector}`,
        crossZone ? '注意：跨价目表换种（院内 ↔ 院外）' : '',
      ].filter(Boolean);
    } else {
      confirmTitle = '确认续卡';
      lines = [
        `为 ${memberName} 续卡【${selectedSpec.name}】`,
        `应收 ¥${selectedSpec.totalPrice} · 结转 ${renewCarried} 份 · 续卡后剩 ${renewNewTotal ?? selectedSpec.meals} 份`,
        `收款人：${collector}`,
      ];
    }
    confirmAction(
      confirmTitle,
      lines.join('\n'),
      async () => {
        setSubmitting(true);
        setError(null);
        try {
          await onSubmit({
            spec: selectedSpec,
            isHospital,
            collector,
            recorder,
            notes,
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : '提交失败，请重试');
        } finally {
          setSubmitting(false);
        }
      },
      primaryLabel,
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {/* 顶部导航 */}
        <View style={styles.header}>
          <Pressable onPress={onClose} disabled={submitting}>
            <Text style={[styles.cancel, submitting && styles.disabled]}>取消</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={handleConfirm} disabled={!canSubmit}>
            <Text style={[styles.confirm, !canSubmit && styles.disabled]}>确认</Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
        >
          {/* 升级 / 续卡：显示当前卡基线 */}
          {(mode === 'upgrade' || mode === 'renew') && currentCard ? (
            <View style={styles.currentCard}>
              <Text style={styles.currentLabel}>
                当前：{currentCard.card_name ?? '当前卡'}
              </Text>
              <Text style={styles.currentSub}>
                {currentCard.is_hospital ? '院内' : '院外'} · 已付 ¥{currentCard.paid_amount} ·
                已用 {currentCard.used_meals}/{currentCard.total_meals} 份
                {mode === 'renew' && currentCard.remaining_meals != null
                  ? ` · 剩 ${currentCard.remaining_meals} 份`
                  : ''}
              </Text>
            </View>
          ) : null}

          {/* 续卡阈值未满足提示 */}
          {mode === 'renew' && !renewThresholdOk ? (
            <View style={styles.warnBanner}>
              <Text style={styles.warnText}>
                续卡前提：剩餐 ≤ {CARD_RENEWAL_THRESHOLD_MEALS}，当前剩餐{' '}
                {currentCard?.remaining_meals ?? 0}。如需换卡请走升级流程。
              </Text>
            </View>
          ) : null}

          {/* 价目表切换（续卡模式锁死不显示） */}
          {mode !== 'renew' ? (
            <>
              <SectionLabel text="订阅类型" />
              <View style={styles.card}>
                <View style={styles.toggleRow}>
                  <Text style={styles.rowLabel}>价目表</Text>
                  <View style={styles.toggleGroup}>
                    {([false, true] as const).map((v) => (
                      <Pressable
                        key={String(v)}
                        disabled={submitting}
                        style={[styles.toggleBtn, isHospital === v && styles.toggleBtnActive]}
                        onPress={() => {
                          setIsHospital(v);
                          setSelectedCode(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.toggleText,
                            isHospital === v && styles.toggleTextActive,
                          ]}
                        >
                          {v ? '院内' : '院外'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {crossZone && currentCard ? (
                  <View style={styles.warnBanner}>
                    <Text style={styles.warnText}>
                      注意：和当前卡不在同一价目表（{currentCard.is_hospital ? '院内' : '院外'} → {isHospital ? '院内' : '院外'}），
                      差价按新价目表计算。
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {/* 卡种网格（续卡模式只显示当前卡种一张，且预选） */}
          <SectionLabel
            text={
              mode === 'renew'
                ? '续卡卡种（同级，不可改）'
                : `选择卡种（${isHospital ? '院内' : '院外'}）`
            }
            hint={
              mode === 'upgrade'
                ? '禁降级 / 禁同价，灰掉的卡不可选'
                : mode === 'renew'
                  ? '如需换卡请走升级流程'
                  : undefined
            }
          />
          <View style={styles.cardGrid}>
            {allCards.map((opt) => {
              const enabled = allowedCodes.has(opt.code);
              const active = enabled && opt.code === selectedCode;
              return (
                <Pressable
                  key={opt.code}
                  disabled={!enabled || submitting || mode === 'renew'}
                  onPress={() => setSelectedCode(opt.code)}
                  style={[
                    styles.cardOption,
                    active && styles.cardOptionActive,
                    !enabled && styles.cardOptionDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.cardOptionName,
                      !enabled && styles.cardOptionTextDisabled,
                    ]}
                  >
                    {opt.name}
                  </Text>
                  <Text
                    style={[
                      styles.cardOptionMeals,
                      !enabled && styles.cardOptionTextDisabled,
                    ]}
                  >
                    {opt.meals} 份
                  </Text>
                  <Text
                    style={[
                      styles.cardOptionPrice,
                      !enabled && styles.cardOptionTextDisabled,
                    ]}
                  >
                    ¥{opt.totalPrice}
                  </Text>
                  <Text
                    style={[
                      styles.cardOptionUnit,
                      !enabled && styles.cardOptionTextDisabled,
                    ]}
                  >
                    ¥{opt.unitPrice}/份
                  </Text>
                  {!enabled && mode === 'upgrade' ? (
                    <Text style={styles.disabledReason}>不支持降级 / 同价</Text>
                  ) : null}
                  {!enabled && mode === 'renew' ? (
                    <Text style={styles.disabledReason}>续卡只能同级</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* 收款人 */}
          <SectionLabel text="收款人" />
          <View style={styles.card}>
            <ChipRow
              options={COLLECTORS}
              value={collector}
              disabled={submitting}
              onChange={(v) => setCollector(v as Collector)}
            />
          </View>

          {/* 录入者 */}
          <SectionLabel text="录入者" />
          <View style={styles.card}>
            <ChipRow
              options={RECORDERS}
              value={recorder}
              disabled={submitting}
              onChange={(v) => setRecorder(v as Recorder)}
            />
          </View>

          {/* 备注 */}
          <SectionLabel text="备注（可选）" />
          <View style={styles.card}>
            <TextInput
              style={styles.notesInput}
              placeholder="如：续卡、从月卡升级、发票抬头……"
              placeholderTextColor={IOS_COLORS.labelTertiary}
              value={notes}
              editable={!submitting}
              onChangeText={setNotes}
              multiline
              maxLength={120}
            />
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* 底部汇总条 */}
        <View style={styles.summary}>
          {selectedSpec ? (
            <View style={{ flex: 1 }}>
              {mode === 'purchase' ? (
                <>
                  <Text style={styles.summaryMain}>
                    应收 <Text style={styles.summaryAmount}>¥{selectedSpec.totalPrice}</Text>
                  </Text>
                  <Text style={styles.summarySub}>
                    {selectedSpec.name} · {selectedSpec.meals} 份 · 收款人 {collector}
                  </Text>
                </>
              ) : mode === 'upgrade' ? (
                <>
                  <Text style={styles.summaryMain}>
                    补差价{' '}
                    <Text style={styles.summaryAmount}>¥{diff ?? 0}</Text>
                    {'  '}升级后剩{' '}
                    <Text style={[styles.summaryAmount, { color: IOS_COLORS.green }]}>
                      {newRemaining ?? 0} 份
                    </Text>
                  </Text>
                  <Text style={styles.summarySub}>
                    {currentCard?.card_name ?? '当前卡'} → {selectedSpec.name} · 收款人 {collector}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.summaryMain}>
                    应收{' '}
                    <Text style={styles.summaryAmount}>¥{selectedSpec.totalPrice}</Text>
                    {'  '}续卡后剩{' '}
                    <Text style={[styles.summaryAmount, { color: IOS_COLORS.green }]}>
                      {renewNewTotal ?? selectedSpec.meals} 份
                    </Text>
                  </Text>
                  <Text style={styles.summarySub}>
                    {selectedSpec.name} · 结转 {renewCarried} 份 · 收款人 {collector}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <Text style={styles.summaryHint}>请选择一张卡</Text>
          )}

          <Pressable
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            disabled={!canSubmit}
            onPress={handleConfirm}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SectionLabel({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={styles.sectionLabelWrap}>
      <Text style={styles.sectionLabel}>{text}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

function ChipRow({
  options, value, onChange, disabled,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            disabled={disabled}
            onPress={() => onChange(opt)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: IOS_COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  cancel: { fontSize: 17, color: IOS_COLORS.labelSecondary, width: 60 },
  title: { fontSize: 17, fontWeight: '600', color: IOS_COLORS.label },
  confirm: { fontSize: 17, color: IOS_COLORS.blue, fontWeight: '600', width: 60, textAlign: 'right' },
  disabled: { opacity: 0.3 },

  scrollBody: { paddingBottom: 16 },

  currentCard: {
    backgroundColor: IOS_COLORS.card, marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, padding: 14, gap: 2,
  },
  currentLabel: { fontSize: 15, fontWeight: '600', color: IOS_COLORS.label },
  currentSub: { fontSize: 13, color: IOS_COLORS.labelSecondary },

  sectionLabelWrap: {
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6,
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionHint: { fontSize: 12, color: IOS_COLORS.labelTertiary },

  card: {
    marginHorizontal: 16, backgroundColor: IOS_COLORS.card, borderRadius: 14, overflow: 'hidden',
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  rowLabel: { fontSize: 15, color: IOS_COLORS.label },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.fillMedium, borderRadius: 8, padding: 2,
  },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: IOS_COLORS.card },
  toggleText: { fontSize: 14, color: IOS_COLORS.labelSecondary },
  toggleTextActive: { color: IOS_COLORS.label, fontWeight: '600' },

  warnBanner: {
    backgroundColor: '#FFF4E5',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#FFE3B8',
  },
  warnText: { fontSize: 13, color: IOS_COLORS.orange, lineHeight: 18 },

  cardGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, gap: 10,
  },
  cardOption: {
    flexGrow: 1, flexBasis: '46%', minWidth: 140,
    backgroundColor: IOS_COLORS.card, borderRadius: 14, padding: 14, gap: 4,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardOptionActive: { borderColor: IOS_COLORS.blue, backgroundColor: IOS_COLORS.blueLight },
  cardOptionDisabled: { backgroundColor: IOS_COLORS.fillLight, opacity: 0.55 },
  cardOptionName: { fontSize: 16, fontWeight: '700', color: IOS_COLORS.label },
  cardOptionMeals: { fontSize: 13, color: IOS_COLORS.labelSecondary },
  cardOptionPrice: { fontSize: 22, fontWeight: '700', color: IOS_COLORS.blue },
  cardOptionUnit: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  cardOptionTextDisabled: { color: IOS_COLORS.labelTertiary },
  disabledReason: { fontSize: 11, color: IOS_COLORS.red, marginTop: 2 },

  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    backgroundColor: IOS_COLORS.fillLight,
  },
  chipActive: { backgroundColor: IOS_COLORS.blue },
  chipText: { fontSize: 14, color: IOS_COLORS.label },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  notesInput: {
    fontSize: 15, color: IOS_COLORS.label,
    padding: 14, minHeight: 64, textAlignVertical: 'top',
  },

  errorBanner: {
    marginHorizontal: 16, marginTop: 12, padding: 12,
    backgroundColor: '#FFF0F0', borderRadius: 10,
  },
  errorText: { fontSize: 14, color: IOS_COLORS.red },

  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: IOS_COLORS.card,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: IOS_COLORS.separatorLight,
  },
  summaryMain: { fontSize: 15, color: IOS_COLORS.label },
  summaryAmount: { fontSize: 20, fontWeight: '700', color: IOS_COLORS.blue },
  summarySub: { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: 2 },
  summaryHint: { flex: 1, fontSize: 14, color: IOS_COLORS.labelSecondary },

  primaryBtn: {
    height: 44, minWidth: 120, paddingHorizontal: 18,
    borderRadius: 12, backgroundColor: IOS_COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnDisabled: { backgroundColor: IOS_COLORS.labelTertiary },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
