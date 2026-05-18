/**
 * 录入 Tab — 会员餐 / 散餐（从 orders/index 拆分）
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';
import { router } from 'expo-router';
import { type MockMember } from '../../constants/mockData';
import { DatePicker } from '../ui/DatePicker';
import { ADHOC_DEFAULT_PRICE } from './constants';
import { tomorrowStr } from './date-utils';
import { entryStyles } from './entryStyles';
import { OrderProofSection } from './OrderProofSection';
import { membersApi } from '../../api/members';
import { cardsApi } from '../../api/cards';
import { useUsersMap } from '../../hooks/useMembersView';
import { apiToMockMember } from '../../lib/member-view';
import { isStaffMealsCardCode, formatCNY } from '@meal/shared';

function memberHasStaffCard(m: MockMember | null | undefined): boolean {
  const c = m?.active_card;
  return c != null && isStaffMealsCardCode(c.card_code);
}

/** 列表/卡片展示：空则显示 — */
function displayContactField(value: string | undefined | null): string {
  const t = (value ?? '').trim();
  return t.length > 0 ? t : '—';
}

function batchMemberMetaLine(m: MockMember): string {
  const loc = m.is_hospital ? '院内' : '院外';
  if (memberHasStaffCard(m)) return `${loc} · 员工卡`;
  if (m.is_staff) return `${loc} · 员工标记`;
  if (m.active_card) {
    return `${loc} · ${m.active_card.card_name} · 剩 ${m.active_card.remaining_meals} 份`;
  }
  return `${loc} · 无卡`;
}

// EntryPanel — 快速录入（会员餐 / 散餐），内嵌在「录入」Tab 中
// ============================================================
type EntryMode = 'member' | 'adhoc';

/** 与 POST /api/orders/batch 单请求上限一致 */
const MEMBER_BATCH_QUEUE_MAX = 30;

/** 与顶部 Tab（录入 / 批量 / 赠送）对齐 */
export type MemberQuickEntryPreset = 'single' | 'batch' | 'gift';

function memberPresetState(preset?: MemberQuickEntryPreset): { batch: boolean; gift: boolean } {
  if (preset === 'single') return { batch: false, gift: false };
  if (preset === 'batch') return { batch: true, gift: false };
  if (preset === 'gift') return { batch: true, gift: true };
  return { batch: true, gift: false };
}

function memberMeetsBatchCardRules(
  m: MockMember,
  lunch: number,
  dinner: number,
  isGift: boolean,
): boolean {
  if (isGift) return true;
  if (memberHasStaffCard(m)) return true;
  const c = m.active_card;
  return !!c && c.remaining_meals >= lunch + dinner;
}

export function EntryPanel({
  memberQuickEntry,
  onAddMemberOrder,
  onAddMemberBatchOrder,
  onAddWalkinOrder,
  onJumpToOverview,
}: {
  /** 自订餐页 Tab 传入时，锁定对应会员餐模式且不再显示「批量/赠送」开关 */
  memberQuickEntry?: MemberQuickEntryPreset;
  onAddMemberOrder: (payload: {
    memberId: number;
    orderDate: string;
    lunchQty: number;
    dinnerQty: number;
    notes?: string;
    deliveryChannel: 'self' | 'courier';
    courierRef?: string;
    proofImages: string[];
    isGift?: boolean;
  }) => Promise<void>;
  onAddMemberBatchOrder?: (payload: {
    proof_images: string[];
    entries: Array<{
      memberId: number;
      orderDate: string;
      lunchQty: number;
      dinnerQty: number;
      notes?: string;
      isGift: boolean;
      deliveryChannel: 'self' | 'courier';
      courierRef?: string;
    }>;
  }) => Promise<void>;
  onAddWalkinOrder: (payload: {
    customerName: string;
    customerPhone?: string;
    customerWechat?: string;
    customerAddress?: string;
    customerIsHospital: boolean;
    orderDate: string;
    lunchQty: number;
    dinnerQty: number;
    unitPrice: number;
    notes?: string;
    deliveryChannel: 'self' | 'courier';
    courierRef?: string;
    proofImages: string[];
    isGift?: boolean;
  }) => Promise<void>;
  onJumpToOverview?: () => void;
}) {
  const quickInitial = memberPresetState(memberQuickEntry);
  const lockMemberPreset = memberQuickEntry != null;

  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<EntryMode>('member');
  const [submitting, setSubmitting] = useState(false);
  const [entryDate, setEntryDate] = useState<string>(() => tomorrowStr());
  // 共用的配送渠道选择（会员餐和散餐共用一套状态，切 mode 不 reset 更顺手）
  const [deliveryChannel, setDeliveryChannel] = useState<'self' | 'courier'>('self');
  const [courierRef, setCourierRef] = useState('');

  const [memberBatchMode, setMemberBatchMode] = useState(quickInitial.batch);
  const [memberIsGift, setMemberIsGift] = useState(quickInitial.gift);
  const [selectedMember, setSelectedMember] = useState<MockMember | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [lunchQty, setLunchQty] = useState(0);
  const [dinnerQty, setDinnerQty] = useState(0);
  const [memberNotes, setMemberNotes] = useState('');
  const [proofImages, setProofImages] = useState<string[]>([]);
  /** 批量：已加入本单的会员，每人独立午/晚（上限与 API 一致） */
  const [memberBatchRows, setMemberBatchRows] = useState<
    Array<{ member: MockMember; lunch: number; dinner: number }>
  >([]);

  // 散餐 state
  const [adhocName,       setAdhocName]       = useState('');
  const [adhocPhone,      setAdhocPhone]      = useState('');
  const [adhocWechat,     setAdhocWechat]     = useState('');
  const [adhocAddress,    setAdhocAddress]    = useState('');
  const [adhocLunchQty,   setAdhocLunchQty]   = useState(0);
  const [adhocDinnerQty,  setAdhocDinnerQty]  = useState(0);
  const [adhocPrice,      setAdhocPrice]      = useState(String(ADHOC_DEFAULT_PRICE));
  const [adhocHospital,   setAdhocHospital]   = useState(false);
  const [adhocNotes,      setAdhocNotes]      = useState('');
  const [adhocIsGift, setAdhocIsGift] = useState(false);
  const adhocTotalQty = adhocLunchQty + adhocDinnerQty;

  /** 服务端模糊搜索命中（含拉卡），避免仅在这页已缓存的 ~200 人里本地过滤 */
  const [memberSearchHits, setMemberSearchHits] = useState<MockMember[] | null>(null);
  const memberSearchReq = useRef(0);
  const usersMapQuery = useUsersMap();

  useEffect(() => {
    const q = memberQuery.trim();
    if (q.length === 0) {
      setMemberSearchHits(null);
      return;
    }
    const usersMap = usersMapQuery.data;
    if (!usersMap) {
      setMemberSearchHits(null);
      return;
    }
    setMemberSearchHits(null);
    const reqId = ++memberSearchReq.current;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const { items } = await membersApi.list({ q, limit: 24, type: 'member' });
          const enriched = await Promise.all(
            items.map(async (m) => {
              try {
                const { cards } = await cardsApi.list(m.id, 'all');
                return apiToMockMember(m, cards, usersMap);
              } catch {
                return apiToMockMember(m, [], usersMap);
              }
            }),
          );
          if (memberSearchReq.current === reqId) setMemberSearchHits(enriched);
        } catch {
          if (memberSearchReq.current === reqId) setMemberSearchHits([]);
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [memberQuery, usersMapQuery.data]);

  const q = memberQuery.trim();
  const dropdownOpen = q.length > 0;
  const memberSearchPending = dropdownOpen && memberSearchHits === null;
  const filteredMembers = memberSearchHits ?? [];

  const reset = () => {
    const nextPreset = memberPresetState(memberQuickEntry);
    setMode('member');
    setEntryDate(tomorrowStr());
    setMemberBatchMode(nextPreset.batch);
    setMemberQuery('');
    setSelectedMember(null);
    setLunchQty(0);
    setDinnerQty(0);
    setMemberNotes('');
    setProofImages([]);
    setMemberIsGift(nextPreset.gift);
    setMemberBatchRows([]);
    setAdhocName(''); setAdhocPhone(''); setAdhocAddress('');
    setAdhocWechat('');
    setAdhocLunchQty(0); setAdhocDinnerQty(0);
    setAdhocPrice(String(ADHOC_DEFAULT_PRICE)); setAdhocHospital(false); setAdhocNotes('');
    setAdhocIsGift(false);
    setDeliveryChannel('self'); setCourierRef('');
  };

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const appendMemberToBatch = (m: MockMember) => {
    setMemberBatchRows((prev) => {
      if (prev.some((r) => r.member.id === m.id)) {
        requestAnimationFrame(() => flashToast('已在列表中，请在下方调整该会员的午/晚餐份数'));
        return prev;
      }
      if (prev.length >= MEMBER_BATCH_QUEUE_MAX) {
        requestAnimationFrame(() =>
          flashToast(`本单最多 ${MEMBER_BATCH_QUEUE_MAX} 位会员`),
        );
        return prev;
      }
      return [...prev, { member: m, lunch: 0, dinner: 0 }];
    });
    setMemberQuery('');
  };

  const updateMemberBatchRow = (
    idx: number,
    patch: Partial<{ lunch: number; dinner: number }>,
  ) => {
    setMemberBatchRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  const removeMemberBatchRow = (idx: number) => {
    setMemberBatchRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const setBatchMode = (on: boolean) => {
    setMemberBatchMode(on);
    setMemberQuery('');
    setLunchQty(0);
    setDinnerQty(0);
    setMemberNotes('');
    if (on) {
      setSelectedMember(null);
    } else {
      setMemberBatchRows([]);
    }
  };

  const handleSubmitMemberBatchRows = async () => {
    const entriesSrc = memberBatchRows.filter((r) => r.lunch + r.dinner > 0);
    if (proofImages.length < 1) {
      flashToast('请上传至少一张订餐凭证截图');
      return;
    }
    if (entriesSrc.length < 1) {
      flashToast('请至少为一位会员填写午餐或晚餐份数');
      return;
    }
    const ineligible = entriesSrc.filter(
      (r) => !memberMeetsBatchCardRules(r.member, r.lunch, r.dinner, memberIsGift),
    );
    if (ineligible.length > 0) {
      const label = ineligible.map((r) => r.member.nickname || r.member.name).join('、');
      flashToast(`以下会员无卡或次数不足（可改赠送餐或调整份数）：${label}`);
      return;
    }
    setSubmitting(true);
    try {
      const entries = entriesSrc.map((r) => ({
        memberId: r.member.id,
        orderDate: entryDate,
        lunchQty: r.lunch,
        dinnerQty: r.dinner,
        notes: memberNotes.trim() || undefined,
        isGift: memberIsGift,
        deliveryChannel,
        courierRef: deliveryChannel === 'courier' ? courierRef.trim() || undefined : undefined,
      }));
      if (onAddMemberBatchOrder) {
        await onAddMemberBatchOrder({ proof_images: proofImages, entries });
      } else {
        for (const e of entries) {
          await onAddMemberOrder({
            memberId: e.memberId,
            orderDate: e.orderDate,
            lunchQty: e.lunchQty,
            dinnerQty: e.dinnerQty,
            notes: e.notes,
            deliveryChannel: e.deliveryChannel,
            courierRef: e.courierRef,
            proofImages,
            isGift: e.isGift,
          });
        }
      }
      reset();
      flashToast(`已录入 ${entriesSrc.length} 位会员`);
    } catch {
      // 上层 toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMemberSingle = async () => {
    if (proofImages.length < 1) {
      flashToast('请上传至少一张订餐凭证截图');
      return;
    }
    if (!selectedMember || lunchQty + dinnerQty === 0) return;
    if (
      !memberIsGift &&
      !memberHasStaffCard(selectedMember) &&
      (!selectedMember.active_card ||
        selectedMember.active_card.remaining_meals < lunchQty + dinnerQty)
    ) {
      flashToast('该会员无卡或剩余次数不足，请改赠送餐或调整份数');
      return;
    }
    setSubmitting(true);
    try {
      await onAddMemberOrder({
        memberId: selectedMember.id,
        orderDate: entryDate,
        lunchQty,
        dinnerQty,
        notes: memberNotes.trim() || undefined,
        deliveryChannel,
        courierRef: deliveryChannel === 'courier' ? courierRef.trim() || undefined : undefined,
        proofImages,
        isGift: memberIsGift,
      });
      const name = selectedMember.nickname || selectedMember.name;
      reset();
      flashToast(`已为 ${name} 录入 ${lunchQty + dinnerQty} 份`);
    } catch {
      // 上层 toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAdhoc = async () => {
    if (proofImages.length < 1) {
      flashToast('请上传至少一张订餐凭证截图');
      return;
    }
    const name = adhocName.trim();
    const phone = adhocPhone.trim();
    const price = parseFloat(adhocPrice);
    if (!name) {
      flashToast('请填写姓名');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      flashToast('请填写正确的 11 位手机号');
      return;
    }
    if (!adhocWechat.trim()) {
      flashToast('请填写微信号');
      return;
    }
    if (!adhocAddress.trim()) {
      flashToast('请填写送餐地址');
      return;
    }
    if (adhocTotalQty < 1) {
      flashToast('午餐和晚餐份数至少有一项 > 0');
      return;
    }
    if (!Number.isFinite(price) || price < 0) return;
    setSubmitting(true);
    try {
      await onAddWalkinOrder({
        customerName: name,
        customerPhone: phone,
        customerWechat: adhocWechat.trim(),
        customerAddress: adhocAddress.trim(),
        customerIsHospital: adhocHospital,
        orderDate: entryDate,
        lunchQty: adhocLunchQty,
        dinnerQty: adhocDinnerQty,
        unitPrice: price,
        notes: adhocNotes.trim() || undefined,
        deliveryChannel,
        courierRef: deliveryChannel === 'courier' ? courierRef.trim() || undefined : undefined,
        proofImages,
        isGift: adhocIsGift,
      });
      reset();
      flashToast(`已录入散客 ${name} · ${adhocTotalQty} 份`);
    } catch {
      // 错误上层 toast
    } finally {
      setSubmitting(false);
    }
  };

  const proofOk = proofImages.length >= 1;

  const memberBatchEntries = memberBatchRows.filter((r) => r.lunch + r.dinner > 0);
  const batchAllEligible =
    memberBatchEntries.length > 0 &&
    memberBatchEntries.every((r) =>
      memberMeetsBatchCardRules(r.member, r.lunch, r.dinner, memberIsGift),
    );
  const canSubmitMemberBatch =
    mode === 'member' &&
    memberBatchMode &&
    batchAllEligible &&
    proofOk &&
    !submitting;

  const memberHasCard = !!selectedMember?.active_card;
  const memberCardEnough = memberHasCard
    ? memberHasStaffCard(selectedMember) ||
      selectedMember!.active_card!.remaining_meals >= lunchQty + dinnerQty
    : false;
  const canSubmitMemberSingle =
    mode === 'member' &&
    !memberBatchMode &&
    !!selectedMember &&
    lunchQty + dinnerQty > 0 &&
    proofOk &&
    !submitting &&
    (memberIsGift || memberHasStaffCard(selectedMember) || (memberHasCard && memberCardEnough));

  const canSubmitAdhoc =
    mode === 'adhoc' &&
    adhocName.trim().length > 0 &&
    adhocTotalQty >= 1 &&
    proofOk &&
    !submitting;
  const canSubmit =
    mode === 'member'
      ? memberBatchMode
        ? canSubmitMemberBatch
        : canSubmitMemberSingle
      : canSubmitAdhoc;

  /** 单人会员餐：按钮灰掉时的可读原因（避免误以为「坏了」） */
  const memberSingleWhyDisabled = useMemo((): string | null => {
    if (mode !== 'member' || memberBatchMode || !selectedMember || canSubmitMemberSingle || submitting) {
      return null;
    }
    if (lunchQty + dinnerQty < 1) {
      return '请用上方步进器设置午餐或晚餐至少 1 份。';
    }
    if (!proofOk) {
      return '请在上方「订餐凭证」中添加至少一张截图。';
    }
    if (!memberIsGift && !memberHasStaffCard(selectedMember) && !memberHasCard) {
      return '该会员无进行中有效卡，无法扣次；请办卡、勾选「赠送餐」或使用员工卡。';
    }
    if (
      !memberIsGift &&
      memberHasCard &&
      !memberHasStaffCard(selectedMember) &&
      !memberCardEnough
    ) {
      const rem = selectedMember.active_card!.remaining_meals;
      const need = lunchQty + dinnerQty;
      return `剩余餐次不足：卡上剩 ${rem} 份，本单需扣 ${need} 份。`;
    }
    return null;
  }, [
    mode,
    memberBatchMode,
    selectedMember,
    canSubmitMemberSingle,
    submitting,
    lunchQty,
    dinnerQty,
    proofOk,
    memberIsGift,
    memberHasCard,
    memberCardEnough,
  ]);

  const batchHasStaffMember = memberBatchEntries.some(
    (r) => memberHasStaffCard(r.member) || r.member.is_staff,
  );

  return (
    <View style={{ flex: 1 }}>
      {/* 模式切换 + 录入日期：与下方录入块同款圆角卡片 */}
      <View style={entryStyles.modeRowShell}>
        <View style={[entryStyles.formCard, entryStyles.modeRow]}>
          <View style={entryStyles.modeRowInner}>
            <View style={entryStyles.modeGroup}>
              {(['member', 'adhoc'] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[entryStyles.modeBtn, mode === m && entryStyles.modeBtnActive]}
                  onPress={() => setMode(m)}
                >
                  <Text
                    style={[entryStyles.modeBtnText, mode === m && entryStyles.modeBtnTextActive]}
                    numberOfLines={1}
                  >
                    {m === 'member' ? '会员餐' : '散餐'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={entryStyles.modeDateWrap}>
              <DatePicker
                label="日期"
                value={entryDate}
                onChange={setEntryDate}
                labelMinWidth={32}
                disabled={submitting}
                compact
                style={entryStyles.modeRowDatePicker}
              />
            </View>
          </View>
          {!(lockMemberPreset && mode === 'member') ? (
            <Text style={entryStyles.modeHint} numberOfLines={2}>
              {mode === 'member'
                ? memberIsGift
                  ? '单人 · 赠送餐：不扣次，一套午/晚份数'
                  : '从档案选会员；员工卡计次不减余额'
                : '散餐：无需会员账户，现金收费'}
            </Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={entryStyles.scroll}
          keyboardShouldPersistTaps="handled"
        >
            {(mode !== 'member' || memberBatchMode) ? (
              <EntryProofBlock
                images={proofImages}
                onChange={setProofImages}
                disabled={submitting}
              />
            ) : null}

            {mode === 'member' && !lockMemberPreset ? (
              <View style={entryStyles.optionPillsRow}>
                <Pressable
                  style={[entryStyles.optionPill, memberIsGift && entryStyles.optionPillOn]}
                  onPress={() => setMemberIsGift((v) => !v)}
                  disabled={submitting}
                >
                  <Ionicons
                    name={memberIsGift ? 'gift' : 'gift-outline'}
                    size={18}
                    color={memberIsGift ? IOS_COLORS.blue : IOS_COLORS.labelSecondary}
                  />
                  <Text
                    style={[entryStyles.optionPillText, memberIsGift && entryStyles.optionPillTextOn]}
                  >
                    赠送餐
                  </Text>
                </Pressable>
                <Pressable
                  style={[entryStyles.optionPill, memberBatchMode && entryStyles.optionPillOn]}
                  onPress={() => setBatchMode(!memberBatchMode)}
                  disabled={submitting}
                >
                  <Ionicons
                    name={memberBatchMode ? 'people' : 'people-outline'}
                    size={18}
                    color={memberBatchMode ? IOS_COLORS.blue : IOS_COLORS.labelSecondary}
                  />
                  <Text
                    style={[
                      entryStyles.optionPillText,
                      memberBatchMode && entryStyles.optionPillTextOn,
                    ]}
                  >
                    批量录入
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {mode === 'member' ? (
              memberBatchMode ? (
              /* ===== 会员餐 · 批量（每人份数独立） ===== */
              <>
                <BatchMemberSearchCard
                  memberQuery={memberQuery}
                  onMemberQueryChange={setMemberQuery}
                  memberBatchCount={memberBatchRows.length}
                  onClearBatch={() => setMemberBatchRows([])}
                  dropdownOpen={dropdownOpen}
                  memberSearchPending={memberSearchPending}
                  filteredMembers={filteredMembers}
                  onAppendMember={appendMemberToBatch}
                  submitting={submitting}
                  sectionTitle={memberBatchRows.length > 0 ? '继续加入' : '搜索加入'}
                />

                {memberBatchRows.length > 0 ? (
                  <>
                    <View style={entryStyles.formCard}>
                      <Text style={entryStyles.cardSectionTitle}>本批名单</Text>
                      <View style={entryStyles.batchRosterList}>
                        {memberBatchRows.map((row, idx) => (
                          <View key={`${row.member.id}-${idx}`}>
                            {idx > 0 ? <View style={entryStyles.inCardDivider} /> : null}
                            <View style={entryStyles.batchRosterRow}>
                              <View
                                style={[
                                  entryStyles.memberAvatar,
                                  {
                                    backgroundColor: row.member.is_hospital
                                      ? IOS_COLORS.blueLight
                                      : '#E8F8ED',
                                  },
                                ]}
                              >
                                <Text style={entryStyles.memberAvatarText}>
                                  {(row.member.nickname || row.member.name)[0]}
                                </Text>
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={entryStyles.batchRosterName} numberOfLines={1}>
                                  {row.member.name}「{row.member.nickname}」
                                </Text>
                                <Text style={entryStyles.batchRosterMeta} numberOfLines={1}>
                                  {batchMemberMetaLine(row.member)}
                                </Text>
                              </View>
                              <Pressable
                                onPress={() => removeMemberBatchRow(idx)}
                                hitSlop={8}
                                disabled={submitting}
                              >
                                <Ionicons name="trash-outline" size={20} color={IOS_COLORS.red} />
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>

                    <View style={entryStyles.formCard}>
                      <Text style={entryStyles.cardSectionTitle}>设份数</Text>
                      <Text style={entryStyles.cardSectionHint} numberOfLines={2}>
                        {memberIsGift
                          ? '赠送餐不扣次；每人单独午/晚，均为 0 不提交'
                          : '每人单独午/晚，均为 0 不提交'}
                      </Text>
                      {memberBatchRows.map((row, idx) => (
                        <View key={`qty-${row.member.id}-${idx}`}>
                          {idx > 0 ? <View style={entryStyles.inCardDivider} /> : null}
                          <View style={entryStyles.batchQtyBlock}>
                            <Text style={entryStyles.batchQtyName} numberOfLines={1}>
                              {row.member.name}「{row.member.nickname}」
                            </Text>
                            <LunchDinnerQtyPair
                              lunch={row.lunch}
                              dinner={row.dinner}
                              onLunchChange={(v) => updateMemberBatchRow(idx, { lunch: v })}
                              onDinnerChange={(v) => updateMemberBatchRow(idx, { dinner: v })}
                              dense
                              inCard
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}

                {!memberIsGift &&
                memberBatchEntries.some((r) => !r.member.active_card) ? (
                  <View style={[entryStyles.warnBanner, { marginTop: 10 }]}>
                    <Ionicons name="alert-circle" size={18} color={IOS_COLORS.red} />
                    <View style={{ flex: 1 }}>
                      <Text style={entryStyles.warnTitle}>列表中有会员无进行中卡，无法扣次（已填份数的行）</Text>
                      <Text style={entryStyles.warnHint}>请改「赠送餐」、删行，或去档案为该会员开「员工卡」等有效卡。</Text>
                    </View>
                  </View>
                ) : null}
                {!memberIsGift &&
                memberBatchEntries.some(
                  (r) =>
                    !memberHasStaffCard(r.member) &&
                    r.member.active_card != null &&
                    r.member.active_card.remaining_meals < r.lunch + r.dinner,
                ) ? (
                  <View style={[entryStyles.warnBanner, { marginTop: 10 }]}>
                    <Ionicons name="alert-circle" size={18} color={IOS_COLORS.red} />
                    <Text style={[entryStyles.warnTitle, { flex: 1 }]}>
                      部分会员剩余次数小于其午+晚合计，请逐行改份数或改赠送餐。
                    </Text>
                  </View>
                ) : null}

                <View style={entryStyles.formCard}>
                  <View style={entryStyles.cardTitleRow}>
                    <Text style={[entryStyles.cardSectionTitle, entryStyles.cardTitleRowTitle]}>
                      配送与备注
                    </Text>
                    <DeliveryCourierSwitch
                      value={deliveryChannel}
                      onChange={setDeliveryChannel}
                      disabled={submitting}
                    />
                  </View>
                  <ChannelPicker
                    value={deliveryChannel}
                    onChange={setDeliveryChannel}
                    courierRef={courierRef}
                    onCourierRefChange={setCourierRef}
                    disabled={submitting}
                    embedded
                    switchInHeader
                  />
                  {deliveryChannel === 'courier' ? <View style={entryStyles.inCardDivider} /> : null}
                  <View style={entryStyles.notesBox}>
                    <TextInput
                      style={entryStyles.notesInput}
                      placeholder="备注（可选，本批共用）"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={memberNotes}
                      onChangeText={setMemberNotes}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                </View>
              </>
            ) : (
              /* ===== 会员餐 · 单人 ===== */
              <>
                <EntryProofBlock
                  images={proofImages}
                  onChange={setProofImages}
                  disabled={submitting}
                />

                <View style={entryStyles.formCard}>
                  <Text style={entryStyles.cardSectionTitle}>选择会员</Text>
                  <View style={entryStyles.searchBox}>
                    <TextInput
                      style={entryStyles.searchInput}
                      placeholder="姓名 / 昵称 / 手机号搜索"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={memberQuery}
                      onChangeText={(text) => {
                        setMemberQuery(text);
                        if (selectedMember) setSelectedMember(null);
                      }}
                      clearButtonMode="while-editing"
                    />
                  </View>

                {selectedMember ? (
                  <>
                    <View style={[entryStyles.selectedMemberCard, { marginTop: 10 }]}>
                      <View
                        style={[
                          entryStyles.selAvatar,
                          { backgroundColor: selectedMember.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' },
                        ]}
                      >
                        <Text style={entryStyles.selAvatarText}>
                          {(selectedMember.nickname || selectedMember.name)[0]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={entryStyles.selName}>
                          {selectedMember.name}「{selectedMember.nickname}」
                        </Text>
                        <Text style={entryStyles.selSub}>
                          {selectedMember.is_hospital ? '院内' : '院外'} ·{' '}
                          {memberHasStaffCard(selectedMember)
                            ? `员工卡 · ${selectedMember.active_card!.card_name} · 计次不减余额`
                            : selectedMember.is_staff
                              ? '档案员工标记（请办员工卡）'
                              : `${selectedMember.active_card?.card_name ?? '无有效卡'} · 剩 ${selectedMember.active_card?.remaining_meals ?? 0} 份`}
                        </Text>
                        <Text style={[entryStyles.selSub, { marginTop: 4 }]}>
                          手机 {displayContactField(selectedMember.phone)}
                        </Text>
                        <Text style={[entryStyles.selSub, { marginTop: 2 }]}>
                          微信 {displayContactField(selectedMember.wechat_id)}
                        </Text>
                        {selectedMember.dietary_notes ? (
                          <Text style={entryStyles.selDiet}>忌：{selectedMember.dietary_notes}</Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => {
                          setSelectedMember(null);
                          setMemberQuery('');
                        }}
                      >
                        <Text style={entryStyles.changeBtn}>更换</Text>
                      </Pressable>
                    </View>
                    {!memberIsGift && !memberHasCard ? (
                      <View style={entryStyles.warnBanner}>
                        <Ionicons name="alert-circle" size={18} color={IOS_COLORS.red} />
                        <View style={{ flex: 1 }}>
                          <Text style={entryStyles.warnTitle}>该会员暂无进行中的卡</Text>
                          <Text style={entryStyles.warnHint}>
                            请开卡（含员工卡）、改「赠送餐」或改「散餐」录单。
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            router.push({
                              pathname: '/(app)/members/[id]',
                              params: { id: String(selectedMember.id) },
                            });
                          }}
                          style={entryStyles.warnCta}
                        >
                          <Text style={entryStyles.warnCtaText}>去开卡</Text>
                        </Pressable>
                      </View>
                    ) : !memberIsGift &&
                      !memberHasStaffCard(selectedMember) &&
                      memberHasCard &&
                      lunchQty + dinnerQty > 0 &&
                      !memberCardEnough ? (
                      <View style={entryStyles.warnBanner}>
                        <Ionicons name="alert-circle" size={18} color={IOS_COLORS.red} />
                        <Text style={[entryStyles.warnTitle, { flex: 1 }]}>
                          剩 {selectedMember.active_card!.remaining_meals} 份，不够扣 {lunchQty + dinnerQty}{' '}
                          份。
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : dropdownOpen ? (
                  memberSearchPending ? (
                    <View style={entryStyles.dropdownEmpty}>
                      <ActivityIndicator color={IOS_COLORS.blue} />
                      <Text style={[entryStyles.dropdownEmptyText, { marginTop: 8 }]}>
                        正在搜索会员…
                      </Text>
                    </View>
                  ) : filteredMembers.length > 0 ? (
                    <View style={entryStyles.memberList}>
                      <Text style={[entryStyles.dateHint, { paddingHorizontal: 14, paddingVertical: 8 }]}>
                        点选一行作为当前唯一会员。
                      </Text>
                      {filteredMembers.map((m, i) => (
                        <Pressable
                          key={m.id}
                          style={({ pressed }) => [
                            entryStyles.memberRow,
                            entryStyles.memberRowWithContact,
                            i === filteredMembers.length - 1 && entryStyles.memberRowLast,
                            pressed && { backgroundColor: IOS_COLORS.fillLight },
                          ]}
                          onPress={() => {
                            setSelectedMember(m);
                            setMemberQuery(m.nickname || m.name);
                          }}
                        >
                          <View
                            style={[
                              entryStyles.memberAvatar,
                              { backgroundColor: m.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' },
                            ]}
                          >
                            <Text style={entryStyles.memberAvatarText}>{(m.nickname || m.name)[0]}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={entryStyles.memberName}>{m.name}</Text>
                            <Text style={entryStyles.memberNick}>
                              「{m.nickname}」· {m.is_hospital ? '院内' : '院外'}
                            </Text>
                            <Text style={entryStyles.memberContact} numberOfLines={1}>
                              手机 {displayContactField(m.phone)}
                            </Text>
                            <Text style={entryStyles.memberContact} numberOfLines={1}>
                              微信 {displayContactField(m.wechat_id)}
                            </Text>
                          </View>
                          {m.active_card ? (
                            <Text style={entryStyles.memberCardBadge}>
                              {m.active_card.card_name} 剩{m.active_card.remaining_meals}份
                            </Text>
                          ) : m.is_staff ? (
                            <Text style={[entryStyles.memberNoCard, { color: IOS_COLORS.blue }]}>
                              员工/档案标记
                            </Text>
                          ) : (
                            <Text style={entryStyles.memberNoCard}>无卡 · 需先开卡</Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View style={entryStyles.dropdownEmpty}>
                      <Text style={entryStyles.dropdownEmptyText}>没有匹配的会员</Text>
                    </View>
                  )
                ) : (
                  <View style={entryStyles.searchHintSpacer} />
                )}
                </View>

                <View style={entryStyles.formCard}>
                  <View style={entryStyles.cardTitleRow}>
                    <Text style={[entryStyles.cardSectionTitle, entryStyles.cardTitleRowTitle]}>
                      份数与配送
                    </Text>
                    <DeliveryCourierSwitch
                      value={deliveryChannel}
                      onChange={setDeliveryChannel}
                      disabled={submitting}
                    />
                  </View>
                  <LunchDinnerQtyPair
                    lunch={lunchQty}
                    dinner={dinnerQty}
                    onLunchChange={setLunchQty}
                    onDinnerChange={setDinnerQty}
                    inCard
                  />
                  <ChannelPicker
                    value={deliveryChannel}
                    onChange={setDeliveryChannel}
                    courierRef={courierRef}
                    onCourierRefChange={setCourierRef}
                    disabled={submitting}
                    embedded
                    switchInHeader
                  />
                  {deliveryChannel === 'courier' ? <View style={entryStyles.inCardDivider} /> : null}
                  <View style={entryStyles.notesBox}>
                    <TextInput
                      style={entryStyles.notesInput}
                      placeholder="备注（可选，如：今日忌辣）"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={memberNotes}
                      onChangeText={setMemberNotes}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                </View>
              </>
            )
            ) : (
              /* ===== 散餐 ===== */
              <>
                <Text style={entryStyles.sectionLabel}>顾客信息</Text>
                <View style={entryStyles.inlineCard}>
                  <View style={entryStyles.fieldRow}>
                    <Text style={entryStyles.fieldLabel}>
                      姓名 / 称呼 <Text style={entryStyles.fieldRequired}>*</Text>
                    </Text>
                    <TextInput
                      style={entryStyles.fieldInput}
                      placeholder="必填"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={adhocName}
                      onChangeText={setAdhocName}
                    />
                  </View>
                  <View style={entryStyles.fieldDivider} />
                  <View style={entryStyles.fieldRow}>
                    <Text style={entryStyles.fieldLabel}>
                      手机号 <Text style={entryStyles.fieldRequired}>*</Text>
                    </Text>
                    <TextInput
                      style={entryStyles.fieldInput}
                      placeholder="11 位手机号，必填"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={adhocPhone}
                      onChangeText={setAdhocPhone}
                      keyboardType="phone-pad"
                      maxLength={11}
                    />
                  </View>
                  <View style={entryStyles.fieldDivider} />
                  <View style={entryStyles.fieldRowTop}>
                    <Text style={entryStyles.fieldLabel}>送餐地址</Text>
                    <TextInput
                      style={[entryStyles.fieldInput, entryStyles.fieldInputMulti]}
                      placeholder="必填：送餐地址 / 科室"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={adhocAddress}
                      onChangeText={setAdhocAddress}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                  <View style={entryStyles.fieldDivider} />
                  <View style={entryStyles.fieldRow}>
                    <Text style={entryStyles.fieldLabel}>
                      微信号 <Text style={entryStyles.fieldRequired}>*</Text>
                    </Text>
                    <TextInput
                      style={entryStyles.fieldInput}
                      placeholder="必填"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={adhocWechat}
                      onChangeText={setAdhocWechat}
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={entryStyles.fieldDivider} />
                  <View style={entryStyles.fieldRow}>
                    <View style={entryStyles.switchLabelCol}>
                      <Text style={entryStyles.fieldLabel}>院内顾客</Text>
                      <Text style={entryStyles.switchHint}>打开表示送餐地址在院区内</Text>
                    </View>
                    <Switch
                      value={adhocHospital}
                      onValueChange={setAdhocHospital}
                      disabled={submitting}
                      trackColor={{ false: IOS_COLORS.fillMedium, true: IOS_COLORS.blueLight }}
                      thumbColor={Platform.OS === 'android' ? (adhocHospital ? IOS_COLORS.blue : '#f4f3f4') : undefined}
                      ios_backgroundColor={IOS_COLORS.fillMedium}
                    />
                  </View>
                  <View style={entryStyles.fieldDivider} />
                  <View style={entryStyles.fieldRow}>
                    <View style={entryStyles.switchLabelCol}>
                      <Text style={entryStyles.fieldLabel}>赠送餐</Text>
                      <Text style={entryStyles.switchHint}>打开后应收金额为 0</Text>
                    </View>
                    <Switch
                      value={adhocIsGift}
                      onValueChange={setAdhocIsGift}
                      disabled={submitting}
                      trackColor={{ false: IOS_COLORS.fillMedium, true: IOS_COLORS.blueLight }}
                      thumbColor={Platform.OS === 'android' ? (adhocIsGift ? IOS_COLORS.blue : '#f4f3f4') : undefined}
                      ios_backgroundColor={IOS_COLORS.fillMedium}
                    />
                  </View>
                </View>
                <Text style={entryStyles.hintUnderCard}>
                  散客手机号、微信号、地址均为必填，同名散客会自动合并并更新这些资料。
                </Text>

                <Text style={[entryStyles.sectionLabel, { marginTop: 20 }]}>份数</Text>
                <LunchDinnerQtyPair
                  lunch={adhocLunchQty}
                  dinner={adhocDinnerQty}
                  onLunchChange={setAdhocLunchQty}
                  onDinnerChange={setAdhocDinnerQty}
                />

                <Text style={[entryStyles.sectionLabel, { marginTop: 20 }]}>单价</Text>
                <View style={entryStyles.inlineCard}>
                  <View style={entryStyles.fieldRow}>
                    <Text style={entryStyles.fieldLabel}>单价（元）</Text>
                    <TextInput
                      style={[entryStyles.fieldInput, { textAlign: 'right' }]}
                      value={adhocPrice}
                      onChangeText={setAdhocPrice}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Text style={[entryStyles.sectionLabel, { marginTop: 20 }]}>配送方式</Text>
                <ChannelPicker
                  value={deliveryChannel}
                  onChange={setDeliveryChannel}
                  courierRef={courierRef}
                  onCourierRefChange={setCourierRef}
                  disabled={submitting}
                />

                <View style={entryStyles.notesBox}>
                  <TextInput
                    style={entryStyles.notesInput}
                    placeholder="备注（可选）"
                    placeholderTextColor={IOS_COLORS.labelTertiary}
                    value={adhocNotes}
                    onChangeText={setAdhocNotes}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* 合计 —— 放最底，订餐前最后一眼确认金额 */}
                <View style={entryStyles.adhocTotal}>
                  <Text style={entryStyles.adhocTotalLabel}>合计应收</Text>
                  <Text style={entryStyles.adhocTotalValue}>
                    {adhocIsGift ? `赠送 ${formatCNY(0)}` : formatCNY((parseFloat(adhocPrice) || 0) * adhocTotalQty)}
                  </Text>
                </View>
              </>
            )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 底部提交条：悬浮圆角卡片，与录入块 / 底栏 Tab 一致 */}
      <View style={entryStyles.submitBarShell}>
        <View style={[entryStyles.formCard, entryStyles.submitBarCard]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {mode === 'member' ? (
            memberBatchMode ? (
              <Text style={entryStyles.submitHint} numberOfLines={3}>
                {memberIsGift ? '赠送餐批量' : '批量录入'}
                {memberBatchEntries.length > 0
                  ? `：将提交 ${memberBatchEntries.length} 位（列表共 ${memberBatchRows.length} 人）`
                  : memberBatchRows.length > 0
                    ? `：已为 ${memberBatchRows.length} 人设行，请至少为一行填写午/晚份数`
                    : '：请搜索并点行加入会员，再分别设份数'}
                {proofOk ? '' : '；请先上传凭证'}
                {batchHasStaffMember ? '；含员工卡/员工标记' : ''}
              </Text>
            ) : selectedMember ? (
              <>
                <Text style={entryStyles.submitMain}>
                  {selectedMember.nickname || selectedMember.name}
                </Text>
                <Text
                  style={[
                    entryStyles.submitSub,
                    !memberIsGift &&
                      !memberHasCard &&
                      !memberHasStaffCard(selectedMember) && { color: IOS_COLORS.red, fontWeight: '600' },
                  ]}
                >
                  {memberIsGift
                    ? `赠送餐 · 午 ${lunchQty} · 晚 ${dinnerQty}`
                    : memberHasStaffCard(selectedMember)
                      ? `员工卡 · 午 ${lunchQty} · 晚 ${dinnerQty}`
                      : selectedMember.is_staff
                        ? `档案员工标记 · 午 ${lunchQty} · 晚 ${dinnerQty}`
                        : !memberHasCard
                          ? '无有效卡'
                          : `午 ${lunchQty} · 晚 ${dinnerQty}`}
                  {proofOk ? '' : ' · 请先上传凭证'}
                </Text>
                {memberSingleWhyDisabled ? (
                  <Text style={entryStyles.submitBlockHint}>{memberSingleWhyDisabled}</Text>
                ) : null}
              </>
            ) : (
              <Text style={entryStyles.submitHint} numberOfLines={2}>
                请搜索并选择一位会员
                {!proofOk ? '，并上传至少一张订餐凭证' : ''}
              </Text>
            )
          ) : mode === 'adhoc' && adhocName.trim() ? (
            <>
              <Text style={entryStyles.submitMain}>{adhocName.trim()}</Text>
              <Text style={entryStyles.submitSub}>
                午 {adhocLunchQty} · 晚 {adhocDinnerQty} · 共 {adhocTotalQty} 份
                {adhocIsGift ? ' · 赠送' : ` · ${formatCNY((parseFloat(adhocPrice) || 0) * adhocTotalQty)}`}
              </Text>
            </>
          ) : (
            <Text style={entryStyles.submitHint}>请填写顾客姓名与份数</Text>
          )}
        </View>
        <Pressable
          style={[entryStyles.submitBtn, !canSubmit && entryStyles.submitBtnDisabled]}
          disabled={!canSubmit}
          onPress={() => {
            if (mode === 'member') {
              if (memberBatchMode) void handleSubmitMemberBatchRows();
              else void handleSubmitMemberSingle();
            } else void handleSubmitAdhoc();
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={entryStyles.submitBtnText}>
              {mode === 'member' && memberBatchMode && memberBatchEntries.length > 0
                ? `确认录入 (${memberBatchEntries.length}人${batchHasStaffMember ? '·含员工' : ''})`
                : mode === 'member' && !memberBatchMode && memberHasStaffCard(selectedMember)
                  ? '确认录入（员工卡）'
                  : '确认录入'}
            </Text>
          )}
        </Pressable>
        </View>
      </View>

      {/* Toast */}
      {toast ? (
        <View style={entryStyles.toast}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={entryStyles.toastText}>{toast}</Text>
          {onJumpToOverview ? (
            <Pressable onPress={onJumpToOverview} hitSlop={8}>
              <Text style={entryStyles.toastLink}>查看总览</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ============================================================
// BatchMemberSearchCard — 批量录入搜索（置底时结果在输入框上方展开）
// ============================================================
function BatchMemberSearchCard({
  memberQuery,
  onMemberQueryChange,
  memberBatchCount,
  onClearBatch,
  dropdownOpen,
  memberSearchPending,
  filteredMembers,
  onAppendMember,
  submitting,
  sectionTitle,
}: {
  memberQuery: string;
  onMemberQueryChange: (q: string) => void;
  memberBatchCount: number;
  onClearBatch: () => void;
  dropdownOpen: boolean;
  memberSearchPending: boolean;
  filteredMembers: MockMember[];
  onAppendMember: (m: MockMember) => void;
  submitting: boolean;
  sectionTitle: string;
}) {
  return (
    <View style={[entryStyles.formCard, { gap: 8 }]}>
      <Text style={entryStyles.cardSectionTitle}>{sectionTitle}</Text>
      <View style={entryStyles.searchRow}>
        <Ionicons
          name="search"
          size={18}
          color={IOS_COLORS.labelTertiary}
          style={entryStyles.searchRowIcon}
        />
        <TextInput
          style={[entryStyles.searchInput, { flex: 1, paddingVertical: 8, minWidth: 0 }]}
          placeholder={
            memberBatchCount > 0
              ? `搜索加入 · 已 ${memberBatchCount} 人`
              : '搜索姓名 / 昵称 / 手机加入'
          }
          placeholderTextColor={IOS_COLORS.labelTertiary}
          value={memberQuery}
          onChangeText={onMemberQueryChange}
          clearButtonMode="while-editing"
          editable={!submitting}
        />
        {memberBatchCount > 0 ? (
          <Pressable onPress={onClearBatch} hitSlop={8} disabled={submitting}>
            <Text style={entryStyles.changeBtn}>清空</Text>
          </Pressable>
        ) : null}
      </View>
      {dropdownOpen ? (
        memberSearchPending ? (
          <View style={entryStyles.dropdownEmpty}>
            <ActivityIndicator color={IOS_COLORS.blue} />
            <Text style={[entryStyles.dropdownEmptyText, { marginTop: 8 }]}>正在搜索…</Text>
          </View>
        ) : filteredMembers.length > 0 ? (
          <View style={entryStyles.memberListInCard}>
            {filteredMembers.map((m, i) => (
              <Pressable
                key={m.id}
                style={({ pressed }) => [
                  entryStyles.memberRow,
                  entryStyles.memberRowWithContact,
                  i === filteredMembers.length - 1 && entryStyles.memberRowLast,
                  pressed && { backgroundColor: IOS_COLORS.fillLight },
                ]}
                onPress={() => onAppendMember(m)}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={22}
                  color={IOS_COLORS.blue}
                  style={{ marginRight: 4 }}
                />
                <View
                  style={[
                    entryStyles.memberAvatar,
                    { backgroundColor: m.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' },
                  ]}
                >
                  <Text style={entryStyles.memberAvatarText}>{(m.nickname || m.name)[0]}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={entryStyles.memberName}>{m.name}</Text>
                  <Text style={entryStyles.memberNick}>
                    「{m.nickname}」· {m.is_hospital ? '院内' : '院外'}
                  </Text>
                  <Text style={entryStyles.memberContact} numberOfLines={1}>
                    手机 {displayContactField(m.phone)}
                  </Text>
                </View>
                {m.active_card ? (
                  <Text style={entryStyles.memberCardBadge}>剩{m.active_card.remaining_meals}份</Text>
                ) : m.is_staff ? (
                  <Text style={[entryStyles.memberNoCard, { color: IOS_COLORS.blue }]}>员工</Text>
                ) : (
                  <Text style={entryStyles.memberNoCard}>无卡</Text>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[entryStyles.dropdownEmpty, { paddingVertical: 12 }]}>
            <Text style={entryStyles.dropdownEmptyText}>没有匹配的会员</Text>
          </View>
        )
      ) : null}
    </View>
  );
}

// ============================================================
// EntryProofBlock — 紧凑凭证区（横条添加 + 小缩略图）
// ============================================================
function EntryProofBlock({
  images,
  onChange,
  disabled = false,
}: {
  images: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <View style={entryStyles.formCard}>
      <View style={entryStyles.proofInlineCard}>
        <View>
          <Text style={entryStyles.proofInlineTitle}>
            订餐凭证 <Text style={entryStyles.fieldRequired}>*</Text>
          </Text>
          <Text style={entryStyles.proofInlineHint}>至少 1 张截图，可多选</Text>
        </View>
        <OrderProofSection
          images={images}
          onChange={onChange}
          disabled={disabled}
          compact
          hideTitle
          pairColumn
        />
      </View>
    </View>
  );
}

// ============================================================
// DeliveryCourierSwitch — 标题行右侧「快递」开关
// ============================================================
function DeliveryCourierSwitch({
  value,
  onChange,
  disabled = false,
}: {
  value: 'self' | 'courier';
  onChange: (v: 'self' | 'courier') => void;
  disabled?: boolean;
}) {
  const isCourier = value === 'courier';
  return (
    <View style={entryStyles.cardTitleSwitch}>
      <Text style={entryStyles.cardTitleSwitchLabel}>快递</Text>
      <Switch
        value={isCourier}
        onValueChange={(on) => onChange(on ? 'courier' : 'self')}
        disabled={disabled}
        trackColor={{ false: IOS_COLORS.fillMedium, true: IOS_COLORS.blueLight }}
        thumbColor={Platform.OS === 'android' ? (isCourier ? IOS_COLORS.blue : '#f4f3f4') : undefined}
        ios_backgroundColor={IOS_COLORS.fillMedium}
      />
    </View>
  );
}

// ============================================================
// ChannelPicker — 配送方式（员工自送 / 外包快递）+ 快递承运方备注
// ============================================================
function ChannelPicker({
  value,
  onChange,
  courierRef,
  onCourierRefChange,
  disabled = false,
  embedded = false,
  switchInHeader = false,
}: {
  value: 'self' | 'courier';
  onChange: (v: 'self' | 'courier') => void;
  courierRef: string;
  onCourierRefChange: (v: string) => void;
  disabled?: boolean;
  embedded?: boolean;
  /** 开关已放在卡片标题行时，仅渲染承运方 */
  switchInHeader?: boolean;
}) {
  const isCourier = value === 'courier';
  const rowStyle = embedded ? entryStyles.fieldRowEmbedded : entryStyles.fieldRow;
  const dividerStyle = embedded ? entryStyles.fieldDividerEmbedded : entryStyles.fieldDivider;
  const body = (
    <>
      {!switchInHeader ? (
        <View style={rowStyle}>
          <View style={entryStyles.switchLabelCol}>
            <Text style={entryStyles.fieldLabel}>使用快递</Text>
            {!embedded ? (
              <Text style={entryStyles.switchHint}>关闭则员工自送；打开后可填承运方</Text>
            ) : (
              <Text style={entryStyles.switchHint} numberOfLines={1}>
                关=自送 · 开=快递
              </Text>
            )}
          </View>
          <Switch
            value={isCourier}
            onValueChange={(on) => onChange(on ? 'courier' : 'self')}
            disabled={disabled}
            trackColor={{ false: IOS_COLORS.fillMedium, true: IOS_COLORS.blueLight }}
            thumbColor={Platform.OS === 'android' ? (isCourier ? IOS_COLORS.blue : '#f4f3f4') : undefined}
            ios_backgroundColor={IOS_COLORS.fillMedium}
          />
        </View>
      ) : null}
      {value === 'courier' ? (
        <>
          {!switchInHeader ? <View style={dividerStyle} /> : null}
          <View style={rowStyle}>
            <Text style={entryStyles.fieldLabel}>承运方</Text>
            <TextInput
              style={entryStyles.fieldInput}
              placeholder="选填"
              placeholderTextColor={IOS_COLORS.labelTertiary}
              value={courierRef}
              onChangeText={onCourierRefChange}
              maxLength={64}
              editable={!disabled}
            />
          </View>
        </>
      ) : null}
    </>
  );
  if (embedded) return body;
  return <View style={entryStyles.inlineCard}>{body}</View>;
}

// ============================================================
// 午餐 / 晚餐份数：并排一行，省纵向空间
// ============================================================

function QtyStepper({
  value,
  onChange,
  min = 0,
  compact = false,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  compact?: boolean;
}) {
  return (
    <View style={compact ? entryStyles.qtyControlsCompact : entryStyles.qtyControls}>
      <Pressable
        style={[
          compact ? entryStyles.qtyBtnSm : entryStyles.qtyBtn,
          value <= min && entryStyles.qtyBtnDisabled,
        ]}
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Text style={compact ? entryStyles.qtyBtnTextSm : entryStyles.qtyBtnText}>−</Text>
      </Pressable>
      <Text style={compact ? entryStyles.qtyValueSm : entryStyles.qtyValue}>{value}</Text>
      <Pressable style={compact ? entryStyles.qtyBtnSm : entryStyles.qtyBtn} onPress={() => onChange(value + 1)}>
        <Text style={compact ? entryStyles.qtyBtnTextSm : entryStyles.qtyBtnText}>＋</Text>
      </Pressable>
    </View>
  );
}

function LunchDinnerQtyPair({
  lunch,
  dinner,
  onLunchChange,
  onDinnerChange,
  min = 0,
  dense = false,
  inCard = false,
}: {
  lunch: number;
  dinner: number;
  onLunchChange: (v: number) => void;
  onDinnerChange: (v: number) => void;
  min?: number;
  dense?: boolean;
  inCard?: boolean;
}) {
  return (
    <View
      style={[
        entryStyles.qtyPairCard,
        dense && entryStyles.qtyPairCardDense,
        inCard && entryStyles.qtyPairCardInForm,
      ]}
    >
      <View style={[entryStyles.qtyPairCol, dense && entryStyles.qtyPairColDense]}>
        <Text style={[entryStyles.qtyPairCaption, dense && entryStyles.qtyPairCaptionDense]}>午餐份数</Text>
        <QtyStepper value={lunch} onChange={onLunchChange} min={min} compact />
      </View>
      <View style={[entryStyles.qtyPairVBar, dense && entryStyles.qtyPairVBarDense]} />
      <View style={[entryStyles.qtyPairCol, dense && entryStyles.qtyPairColDense]}>
        <Text style={[entryStyles.qtyPairCaption, dense && entryStyles.qtyPairCaptionDense]}>晚餐份数</Text>
        <QtyStepper value={dinner} onChange={onDinnerChange} min={min} compact />
      </View>
    </View>
  );
}
