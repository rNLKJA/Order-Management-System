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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  listCards,
  listUpgradeOptions,
  getCardSpec,
  buildCustomCardSpec,
  CARD_RENEWAL_THRESHOLD_MEALS,
  type CardSpec,
  type SubscriptionCardCode,
} from '@meal/shared';
import { IOS_COLORS } from '../theme/paperTheme';
import { confirmAction } from '../lib/confirm';

/** 员工候选项（收款人/录入者 picker），从 /api/users 拉取 */
export interface CardFlowUser {
  id: number;
  name: string;
}

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
  custom_label?: string;
  custom_pack_meals?: number;
  is_hospital: boolean;
  paid_amount: number;
  used_meals: number;
  total_meals: number;
  remaining_meals?: number;
}

export interface CardFlowSubmitPayload {
  spec: CardSpec;
  isHospital: boolean;
  collectorUserId: number;
  collectorName: string;
  createdByUserId: number;
  createdByName: string;
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
  /** 员工候选（来自 /api/users），按 full_name 展示 */
  pickerUsers: CardFlowUser[];
  /** 默认收款人 id；通常传当前登录用户 id */
  defaultCollectorId: number;
  /** 默认录入者 id；通常传当前登录用户 id */
  defaultRecorderId: number;
  onClose: () => void;
  /** 返回 Promise 以便 Modal 显示 loading；抛错时展示错误 */
  onSubmit: (payload: CardFlowSubmitPayload) => Promise<void> | void;
}

export function CardFlowModal(props: CardFlowModalProps) {
  const {
    visible, mode, memberName, memberIsHospital,
    currentCard, pickerUsers, defaultCollectorId, defaultRecorderId,
    onClose, onSubmit,
  } = props;

  const [isHospital, setIsHospital] = useState(memberIsHospital);
  const [selectedCode, setSelectedCode] = useState<SubscriptionCardCode | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customMealsText, setCustomMealsText] = useState('');
  const [customPaidText, setCustomPaidText] = useState('');
  const [collectorId, setCollectorId] = useState<number>(defaultCollectorId);
  const [recorderId, setRecorderId] = useState<number>(defaultRecorderId);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isCompactPhone = width <= 430;

  const nameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of pickerUsers) m.set(u.id, u.name);
    return m;
  }, [pickerUsers]);
  const collectorName = nameById.get(collectorId) ?? '';
  const recorderName = nameById.get(recorderId) ?? '';

  // 续卡：锁死到当前卡的 spec（同卡种、同价目表、同价格）
  const renewSpec = useMemo<CardSpec | null>(() => {
    if (mode !== 'renew' || !currentCard?.card_code) return null;
    if (currentCard.card_code === 'custom') {
      const pack = currentCard.custom_pack_meals;
      const label = (currentCard.custom_label ?? '').trim() || '自定义套餐';
      const price = currentCard.paid_amount;
      if (pack == null || pack <= 0 || !(price > 0)) return null;
      return buildCustomCardSpec(label, pack, price);
    }
    return getCardSpec(currentCard.is_hospital, currentCard.card_code);
  }, [mode, currentCard]);

  useEffect(() => {
    if (visible) {
      setIsHospital(currentCard?.is_hospital ?? memberIsHospital);
      // 续卡：初始化选中态为当前卡种，其他模式清空
      setSelectedCode(mode === 'renew' ? (currentCard?.card_code ?? null) : null);
      setCustomLabel('');
      setCustomMealsText('');
      setCustomPaidText('');
      setCollectorId(defaultCollectorId);
      setRecorderId(defaultRecorderId);
      setNotes('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible, memberIsHospital, currentCard, mode, defaultCollectorId, defaultRecorderId]);

  const allCards = useMemo(() => listCards(isHospital), [isHospital]);
  const allowedCodes = useMemo(() => {
    if (mode === 'upgrade' && currentCard) {
      const set = new Set<SubscriptionCardCode>(
        listUpgradeOptions(isHospital, currentCard.paid_amount).map((c) => c.code),
      );
      set.add('custom');
      return set;
    }
    if (mode === 'renew' && currentCard?.card_code) {
      return new Set<SubscriptionCardCode>([currentCard.card_code]);
    }
    if (mode === 'purchase') {
      const set = new Set<SubscriptionCardCode>(allCards.map((c) => c.code));
      set.add('custom');
      return set;
    }
    return new Set(allCards.map((c) => c.code));
  }, [mode, currentCard, isHospital, allCards]);

  const selectedSpec = useMemo<CardSpec | null>(() => {
    if (mode === 'renew') return renewSpec;
    if (selectedCode === 'custom') {
      const label = customLabel.trim();
      const meals = parseInt(customMealsText.replace(/[^\d]/g, ''), 10);
      const paid = Number(customPaidText);
      if (
        !label ||
        !Number.isFinite(meals) ||
        meals <= 0 ||
        !Number.isFinite(paid) ||
        paid <= 0
      ) {
        return null;
      }
      return buildCustomCardSpec(label, meals, paid);
    }
    return allCards.find((c) => c.code === selectedCode) ?? null;
  }, [mode, renewSpec, allCards, selectedCode, customLabel, customMealsText, customPaidText]);

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
    (selectedSpec.code === 'custom' ? allowedCodes.has('custom') : allowedCodes.has(selectedSpec.code)) &&
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
        `收款人：${collectorName}`,
      ];
    } else if (mode === 'upgrade') {
      confirmTitle = '确认升级';
      lines = [
        `${memberName} 从【${currentCard?.card_name ?? '当前卡'}】升级到【${selectedSpec.name}】`,
        `补差价 ¥${diff} · 升级后剩 ${newRemaining} 份`,
        `收款人：${collectorName}`,
        crossZone ? '注意：跨价目表换种（院内 ↔ 院外）' : '',
      ].filter(Boolean);
    } else {
      confirmTitle = '确认续卡';
      lines = [
        `为 ${memberName} 续卡【${selectedSpec.name}】`,
        `应收 ¥${selectedSpec.totalPrice} · 结转 ${renewCarried} 份 · 续卡后剩 ${renewNewTotal ?? selectedSpec.meals} 份`,
        `收款人：${collectorName}`,
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
            collectorUserId: collectorId,
            collectorName,
            createdByUserId: recorderId,
            createdByName: recorderName,
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
                          setCustomLabel('');
                          setCustomMealsText('');
                          setCustomPaidText('');
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
            {mode === 'renew' && currentCard?.card_code === 'custom' ? (
              renewSpec ? (
                <Pressable
                  disabled
                  style={[
                    styles.cardOption,
                    isCompactPhone && styles.cardOptionCompact,
                    styles.cardOptionActive,
                  ]}
                >
                  <View style={styles.cardOptionTop}>
                    <View style={styles.cardInfoLeft}>
                      <View style={styles.cardIconWrap}>
                        <Ionicons
                          name={cardIconByCode('custom')}
                          size={16}
                          color={IOS_COLORS.blue}
                        />
                      </View>
                      <View style={{ minWidth: 0, flex: 1 }}>
                        <Text style={styles.cardOptionName}>{renewSpec.name}</Text>
                        <Text style={styles.cardOptionMeals}>
                          续费档 {renewSpec.meals} 份
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardOptionPrice}>¥{renewSpec.totalPrice}</Text>
                  </View>
                  <Text style={styles.cardOptionUnit}>¥{renewSpec.unitPrice}/份</Text>
                </Pressable>
              ) : (
                <View style={styles.warnBanner}>
                  <Text style={styles.warnText}>自定义卡缺少档位数据，无法续卡</Text>
                </View>
              )
            ) : (
              <>
                {allCards.map((opt) => {
                  const enabled = allowedCodes.has(opt.code);
                  const active = enabled && opt.code === selectedCode;
                  const iconName = cardIconByCode(opt.code);
                  return (
                    <Pressable
                      key={opt.code}
                      disabled={!enabled || submitting || mode === 'renew'}
                      onPress={() => {
                        setSelectedCode(opt.code);
                        setCustomLabel('');
                        setCustomMealsText('');
                        setCustomPaidText('');
                      }}
                      style={[
                        styles.cardOption,
                        isCompactPhone && styles.cardOptionCompact,
                        active && styles.cardOptionActive,
                        !enabled && styles.cardOptionDisabled,
                      ]}
                    >
                      <View style={styles.cardOptionTop}>
                        <View style={styles.cardInfoLeft}>
                          <View style={styles.cardIconWrap}>
                            <Ionicons
                              name={iconName}
                              size={16}
                              color={enabled ? IOS_COLORS.blue : IOS_COLORS.labelTertiary}
                            />
                          </View>
                          <View style={{ minWidth: 0, flex: 1 }}>
                            <Text
                              style={[
                                styles.cardOptionName,
                                isCompactPhone && styles.cardOptionNameCompact,
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
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.cardOptionPrice,
                            isCompactPhone && styles.cardOptionPriceCompact,
                            !enabled && styles.cardOptionTextDisabled,
                          ]}
                        >
                          ¥{opt.totalPrice}
                        </Text>
                      </View>
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
                {(mode === 'purchase' || mode === 'upgrade') && (
                  <Pressable
                    key="custom-plan"
                    disabled={!allowedCodes.has('custom') || submitting}
                    onPress={() => setSelectedCode('custom')}
                    style={[
                      styles.cardOption,
                      isCompactPhone && styles.cardOptionCompact,
                      selectedCode === 'custom' && styles.cardOptionActive,
                      !allowedCodes.has('custom') && styles.cardOptionDisabled,
                    ]}
                  >
                    <View style={styles.cardOptionTop}>
                      <View style={styles.cardInfoLeft}>
                        <View style={styles.cardIconWrap}>
                          <Ionicons
                            name={cardIconByCode('custom')}
                            size={16}
                            color={
                              allowedCodes.has('custom')
                                ? IOS_COLORS.blue
                                : IOS_COLORS.labelTertiary
                            }
                          />
                        </View>
                        <View style={{ minWidth: 0, flex: 1 }}>
                          <Text style={styles.cardOptionName}>自定义套餐</Text>
                          <Text style={styles.cardOptionMeals}>自定名称 · 餐数 · 总价</Text>
                        </View>
                      </View>
                      <Text style={[styles.cardOptionPrice, { fontSize: 22 }]}>自定</Text>
                    </View>
                    <Text style={styles.cardOptionUnit}>单价按总价÷份数计</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          {(mode === 'purchase' || mode === 'upgrade') && selectedCode === 'custom' ? (
            <>
              <SectionLabel text="自定义内容" hint="填名称、份数、套餐总价" />
              <View style={styles.card}>
                <TextInput
                  style={styles.customField}
                  placeholder="套餐名称，如：瓜包餐"
                  placeholderTextColor={IOS_COLORS.labelTertiary}
                  value={customLabel}
                  editable={!submitting}
                  onChangeText={setCustomLabel}
                  maxLength={64}
                />
                <TextInput
                  style={styles.customField}
                  placeholder="餐次（整数），如：20"
                  placeholderTextColor={IOS_COLORS.labelTertiary}
                  value={customMealsText}
                  editable={!submitting}
                  onChangeText={(t) => setCustomMealsText(t.replace(/[^\d]/g, ''))}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={styles.customField}
                  placeholder="套餐总价（¥），如：500"
                  placeholderTextColor={IOS_COLORS.labelTertiary}
                  value={customPaidText}
                  editable={!submitting}
                  onChangeText={(t) => setCustomPaidText(t.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                />
              </View>
            </>
          ) : null}

          {/* 收款人 */}
          <SectionLabel text="收款人" />
          <View style={styles.card}>
            <UserChipRow
              options={pickerUsers}
              value={collectorId}
              disabled={submitting}
              onChange={setCollectorId}
            />
          </View>

          {/* 录入者 */}
          <SectionLabel text="录入者" />
          <View style={styles.card}>
            <UserChipRow
              options={pickerUsers}
              value={recorderId}
              disabled={submitting}
              onChange={setRecorderId}
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
        <View style={[styles.summary, isCompactPhone && styles.summaryCompact]}>
          {selectedSpec ? (
            <View style={{ flex: 1 }}>
              {mode === 'purchase' ? (
                <>
                  <Text style={styles.summaryMain}>
                    应收 <Text style={styles.summaryAmount}>¥{selectedSpec.totalPrice}</Text>
                  </Text>
                  <Text style={styles.summarySub}>
                    {selectedSpec.name} · {selectedSpec.meals} 份 · 收款人 {collectorName}
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
                    {currentCard?.card_name ?? '当前卡'} → {selectedSpec.name} · 收款人 {collectorName}
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
                    {selectedSpec.name} · 结转 {renewCarried} 份 · 收款人 {collectorName}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <Text style={styles.summaryHint}>请选择一张卡</Text>
          )}

          <Pressable
            style={[
              styles.primaryBtn,
              isCompactPhone && styles.primaryBtnCompact,
              !canSubmit && styles.primaryBtnDisabled,
            ]}
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

function UserChipRow({
  options, value, onChange, disabled,
}: {
  options: readonly CardFlowUser[];
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) {
    return <Text style={styles.chipText}>加载中…</Text>;
  }
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            disabled={disabled}
            onPress={() => onChange(opt.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cardIconByCode(code: SubscriptionCardCode): keyof typeof Ionicons.glyphMap {
  switch (code) {
    case 'custom':
      return 'pricetag-outline';
    case 'experience':
      return 'sparkles-outline';
    case 'small_week':
      return 'time-outline';
    case 'week':
      return 'calendar-outline';
    case 'month':
      return 'calendar-clear-outline';
    case 'season':
      return 'layers-outline';
    case 'year':
      return 'ribbon-outline';
    default:
      return 'card-outline';
  }
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
    backgroundColor: IOS_COLORS.card, borderRadius: 14, padding: 14, gap: 6,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardOptionCompact: {
    flexBasis: '100%',
    minWidth: 0,
    padding: 12,
  },
  cardOptionActive: { borderColor: IOS_COLORS.blue, backgroundColor: IOS_COLORS.blueLight },
  cardOptionDisabled: { backgroundColor: IOS_COLORS.fillLight, opacity: 0.55 },
  cardOptionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  cardIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardOptionName: { fontSize: 18, fontWeight: '700', color: IOS_COLORS.label },
  cardOptionNameCompact: { fontSize: 16 },
  cardOptionMeals: { fontSize: 13, color: IOS_COLORS.labelSecondary, marginTop: 1 },
  cardOptionPrice: { fontSize: 34, fontWeight: '700', color: IOS_COLORS.blue, lineHeight: 36, textAlign: 'right' },
  cardOptionPriceCompact: { fontSize: 28, lineHeight: 30 },
  cardOptionUnit: { fontSize: 12, color: IOS_COLORS.labelSecondary, textAlign: 'right' },
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

  customField: {
    fontSize: 15,
    color: IOS_COLORS.label,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separatorLight,
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
  summaryCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
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
  primaryBtnCompact: {
    width: '100%',
    minWidth: 0,
  },
  primaryBtnDisabled: { backgroundColor: IOS_COLORS.labelTertiary },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
