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
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { cardFlowStyles as styles } from './cards/cardFlowStyles';
import { CardPlanPicker } from './cards/CardPlanPicker';
import { MemberFormPageBanner } from './members/MemberFormPageBanner';
import { entryStyles } from './orders/entryStyles';
import { MeshBackground, SheetHeader } from './ui';
import { COLORS, SPACING, TYPE } from '../theme/paperTheme';

/** 员工候选项（收款人/录入者 picker），从 /api/users 拉取 */
export interface CardFlowUser {
  id: number;
  name: string;
}

export type CardFlowMode = 'purchase' | 'upgrade' | 'renew' | 'advance';

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
    if (mode === 'purchase' || mode === 'advance') {
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
    mode === 'purchase'
      ? '购买新卡'
      : mode === 'upgrade'
        ? '升级卡片'
        : mode === 'renew'
          ? '续卡'
          : '提前包卡';
  const primaryLabel =
    mode === 'purchase'
      ? '确认开卡'
      : mode === 'upgrade'
        ? '确认升级'
        : mode === 'renew'
          ? '确认续卡'
          : '确认提前包卡';

  const bannerDescription =
    mode === 'purchase'
      ? `为「${memberName}」选择卡种，确认收款人与应收金额。`
      : mode === 'upgrade'
        ? `从当前卡升级；灰掉的卡不可降级或同价。`
        : mode === 'renew'
          ? `同卡种续费，剩餐 ≤ ${CARD_RENEWAL_THRESHOLD_MEALS} 份时可办；剩餐结转到新卡。`
          : `当前卡未用完时按全价买下一张卡，待当前卡用完自动生效（非升级、不结转剩餐）。`;

  const bannerIcon: keyof typeof Ionicons.glyphMap =
    mode === 'purchase'
      ? 'card-outline'
      : mode === 'upgrade'
        ? 'arrow-up-circle-outline'
        : mode === 'renew'
          ? 'refresh-outline'
          : 'time-outline';

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
    } else if (mode === 'advance') {
      confirmTitle = '确认提前包卡';
      lines = [
        `为 ${memberName} 提前购买【${selectedSpec.name}】`,
        `应收 ¥${selectedSpec.totalPrice} · 当前【${currentCard?.card_name ?? '在用餐卡'}】用完后自动生效`,
        `新卡 ${selectedSpec.meals} 份 · 不结转当前剩餐 · 收款人：${collectorName}`,
      ];
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
      <View style={styles.root}>
        <MeshBackground />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <SheetHeader title={title} onClose={onClose} closeLabel="取消" />

          <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <MemberFormPageBanner title={title} description={bannerDescription} icon={bannerIcon} />
          {/* 升级 / 续卡：显示当前卡基线 */}
          {(mode === 'upgrade' || mode === 'renew' || mode === 'advance') && currentCard ? (
            <View style={styles.currentCard}>
              <Text style={styles.currentLabel}>
                当前：{currentCard.card_name ?? '当前卡'}
              </Text>
              <Text style={styles.currentSub}>
                {currentCard.is_hospital ? '院内' : '院外'} · 已付 ¥{currentCard.paid_amount} ·
                已用 {currentCard.used_meals}/{currentCard.total_meals} 份
                {mode === 'renew' && currentCard.remaining_meals != null
                  ? ` · 剩 ${currentCard.remaining_meals} 份`
                  : mode === 'advance' && currentCard.remaining_meals != null
                    ? ` · 剩 ${currentCard.remaining_meals} 份（用完后下一张卡生效）`
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
              <SectionLabel text="价目表" />
              <View style={styles.card}>
                <View style={styles.priceListToggle}>
                  <Text style={styles.priceListLabel}>订阅类型</Text>
                  <View style={entryStyles.modeGroup}>
                    {([false, true] as const).map((v) => (
                      <Pressable
                        key={String(v)}
                        disabled={submitting}
                        style={[entryStyles.modeBtn, isHospital === v && entryStyles.modeBtnActive]}
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
                            entryStyles.modeBtnText,
                            isHospital === v && entryStyles.modeBtnTextActive,
                          ]}
                        >
                          {v ? '院内' : '院外'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
              {crossZone && currentCard ? (
                <View style={styles.warnBanner}>
                  <Text style={styles.warnText}>
                    跨价目表（{currentCard.is_hospital ? '院内' : '院外'} → {isHospital ? '院内' : '院外'}），差价按新表计算。
                  </Text>
                </View>
              ) : null}
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
                  ? '如需换卡种请走提前包卡'
                  : mode === 'advance'
                    ? '可任意选卡种，按全价收款，当前卡用完后生效'
                    : undefined
            }
          />
          <View style={styles.card}>
            {mode === 'renew' ? (
              renewSpec ? (
                <View style={styles.pickerWrap}>
                  <View style={[styles.planDetail, styles.planDetailActive]}>
                    <View style={styles.planDetailTop}>
                      <Text style={styles.planDetailName}>{renewSpec.name}</Text>
                      <Text style={styles.planDetailPrice}>¥{renewSpec.totalPrice}</Text>
                    </View>
                    <Text style={styles.planDetailMeta}>
                      续费档 {renewSpec.meals} 份 · ¥{renewSpec.unitPrice}/份 · 同级续卡
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.warnBanner}>
                  <Text style={styles.warnText}>无法续卡：缺少当前卡档位数据</Text>
                </View>
              )
            ) : (
              <CardPlanPicker
                mode={mode}
                cards={allCards}
                allowedCodes={allowedCodes}
                selectedCode={selectedCode}
                submitting={submitting}
                showCustom={mode === 'purchase' || mode === 'upgrade' || mode === 'advance'}
                onSelect={(code) => {
                  setSelectedCode(code);
                  setCustomLabel('');
                  setCustomMealsText('');
                  setCustomPaidText('');
                }}
              />
            )}
          </View>

          {(mode === 'purchase' || mode === 'upgrade' || mode === 'advance') && selectedCode === 'custom' ? (
            <>
              <SectionLabel text="自定义套餐" hint="名称 · 份数 · 总价" />
              <View style={styles.card}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>套餐名称</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="如：瓜包餐"
                    placeholderTextColor={IOS_COLORS.labelTertiary}
                    value={customLabel}
                    editable={!submitting}
                    onChangeText={setCustomLabel}
                    maxLength={64}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>餐次</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="整数，如 20"
                    placeholderTextColor={IOS_COLORS.labelTertiary}
                    value={customMealsText}
                    editable={!submitting}
                    onChangeText={(t) => setCustomMealsText(t.replace(/[^\d]/g, ''))}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.field, styles.fieldLast]}>
                  <Text style={styles.fieldLabel}>套餐总价（¥）</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="如 500"
                    placeholderTextColor={IOS_COLORS.labelTertiary}
                    value={customPaidText}
                    editable={!submitting}
                    onChangeText={(t) => setCustomPaidText(t.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                  />
                </View>
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
          <SectionLabel text="备注" hint="可选" />
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

          <View style={{ height: 16 }} />
        </ScrollView>

          <CardFlowSubmitBar
            mode={mode}
            selectedSpec={selectedSpec}
            collectorName={collectorName}
            diff={diff}
            newRemaining={newRemaining}
            currentCard={currentCard}
            renewCarried={renewCarried}
            renewNewTotal={renewNewTotal}
            canSubmit={canSubmit}
            submitting={submitting}
            primaryLabel={primaryLabel}
            onConfirm={handleConfirm}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function CardFlowSubmitBar({
  mode,
  selectedSpec,
  collectorName,
  diff,
  newRemaining,
  currentCard,
  renewCarried,
  renewNewTotal,
  canSubmit,
  submitting,
  primaryLabel,
  onConfirm,
}: {
  mode: CardFlowMode;
  selectedSpec: CardSpec | null;
  collectorName: string;
  diff: number | null;
  newRemaining: number | null;
  currentCard?: CardFlowCurrentCard | null;
  renewCarried: number;
  renewNewTotal: number | null;
  canSubmit: boolean;
  submitting: boolean;
  primaryLabel: string;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();
  const padBottom = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.submitBarShell, { paddingBottom: padBottom }]}>
      <View style={styles.submitBarCard}>
        <View style={styles.submitSummaryRow}>
          {selectedSpec ? (
            <View style={styles.submitSummaryCol}>
              {mode === 'purchase' || mode === 'advance' ? (
                <>
                  <Text style={styles.summaryMain}>
                    应收{' '}
                    <Text style={styles.summaryAmount}>¥{selectedSpec.totalPrice}</Text>
                  </Text>
                  <Text style={styles.summarySub} numberOfLines={2}>
                    {mode === 'advance'
                      ? `${selectedSpec.name} · ${selectedSpec.meals} 份 · 当前卡用完后生效`
                      : `${selectedSpec.name} · ${selectedSpec.meals} 份 · ${collectorName}`}
                  </Text>
                </>
              ) : mode === 'upgrade' ? (
                <>
                  <Text style={styles.summaryMain}>
                    补差 <Text style={styles.summaryAmount}>¥{diff ?? 0}</Text>
                    {' · '}剩{' '}
                    <Text style={[styles.summaryAmount, { fontSize: 18, color: IOS_COLORS.green }]}>
                      {newRemaining ?? 0}
                    </Text>
                    {' '}份
                  </Text>
                  <Text style={styles.summarySub} numberOfLines={2}>
                    {currentCard?.card_name ?? '当前卡'} → {selectedSpec.name}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.summaryMain}>
                    应收 <Text style={styles.summaryAmount}>¥{selectedSpec.totalPrice}</Text>
                    {' · '}续后{' '}
                    <Text style={[styles.summaryAmount, { fontSize: 18, color: IOS_COLORS.green }]}>
                      {renewNewTotal ?? selectedSpec.meals}
                    </Text>
                    {' '}份
                  </Text>
                  <Text style={styles.summarySub} numberOfLines={2}>
                    结转 {renewCarried} 份 · {collectorName}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <Text style={styles.summaryHint}>请先选择卡种</Text>
          )}
        </View>
        <Pressable
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          disabled={!canSubmit}
          onPress={onConfirm}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{primaryLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
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

