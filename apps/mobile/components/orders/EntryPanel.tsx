/**
 * 录入 Tab — 会员餐 / 散餐（从 orders/index 拆分）
 */
import { useEffect, useRef, useState } from 'react';
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
    isStaffMeal?: boolean;
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
      isStaffMeal: boolean;
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
  const [memberIsStaffMeal, setMemberIsStaffMeal] = useState(false);
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
    setMemberIsStaffMeal(false);
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
        isStaffMeal: memberIsStaffMeal,
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
            isStaffMeal: e.isStaffMeal,
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
        isStaffMeal: memberIsStaffMeal,
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
    ? selectedMember!.active_card!.remaining_meals >= lunchQty + dinnerQty
    : false;
  const canSubmitMemberSingle =
    mode === 'member' &&
    !memberBatchMode &&
    !!selectedMember &&
    lunchQty + dinnerQty > 0 &&
    proofOk &&
    !submitting &&
    (memberIsGift || (memberHasCard && memberCardEnough));

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

  return (
    <View style={{ flex: 1 }}>
      {/* 模式切换 + 录入日期（同一行）；说明在下一行，凭证区全宽 */}
      <View style={entryStyles.modeRow}>
        <View style={entryStyles.modeRowInner}>
          <View style={entryStyles.modeGroup}>
            {(['member', 'adhoc'] as const).map((m) => (
              <Pressable
                key={m}
                style={[entryStyles.modeBtn, mode === m && entryStyles.modeBtnActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[entryStyles.modeBtnText, mode === m && entryStyles.modeBtnTextActive]}>
                  {m === 'member' ? '会员餐' : '散餐'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={entryStyles.modeDateWrap}>
            <DatePicker
              label="录入日期"
              value={entryDate}
              onChange={setEntryDate}
              labelMinWidth={52}
              disabled={submitting}
              style={entryStyles.modeRowDatePicker}
            />
          </View>
        </View>
        <Text style={entryStyles.modeHint} numberOfLines={3}>
          {mode === 'member'
            ? memberIsGift
              ? '赠送餐：每行一位会员，午/晚份数分开填'
              : '从会员档案中选择，自动扣卡'
            : '无需会员账户，现金收费'}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={entryStyles.scroll}
          keyboardShouldPersistTaps="handled"
        >
            <View style={entryStyles.proofCard}>
              <Text style={entryStyles.proofCardTitle}>
                订餐凭证 <Text style={{ color: IOS_COLORS.red }}>*</Text>
              </Text>
              <OrderProofSection
                images={proofImages}
                onChange={setProofImages}
                disabled={submitting}
                compact
                hideTitle
              />
            </View>
            <Text style={entryStyles.dateHint}>
              默认次日；须至少一张截图。点「添加截图」可选多图。
            </Text>

            {mode === 'member' && !lockMemberPreset && (
              <>
                <Text style={[entryStyles.sectionLabel, { marginTop: 4 }]}>选项</Text>
                <View style={entryStyles.inlineCard}>
                  <View style={entryStyles.fieldRow}>
                    <View style={entryStyles.switchLabelCol}>
                      <Text style={entryStyles.fieldLabel}>赠送餐</Text>
                      <Text style={entryStyles.switchHint}>打开后不扣会员卡次数</Text>
                    </View>
                    <Switch
                      value={memberIsGift}
                      onValueChange={setMemberIsGift}
                      disabled={submitting}
                      trackColor={{ false: IOS_COLORS.fillMedium, true: IOS_COLORS.blueLight }}
                      thumbColor={Platform.OS === 'android' ? (memberIsGift ? IOS_COLORS.blue : '#f4f3f4') : undefined}
                      ios_backgroundColor={IOS_COLORS.fillMedium}
                    />
                  </View>
                  <View style={entryStyles.fieldDivider} />
                  <View style={entryStyles.fieldRow}>
                    <View style={entryStyles.switchLabelCol}>
                      <Text style={entryStyles.fieldLabel}>批量录入</Text>
                      <Text style={entryStyles.switchHint}>
                        开：多人，每人单独午/晚份数 · 关：只录一位，共用一套份数
                      </Text>
                    </View>
                    <Switch
                      value={memberBatchMode}
                      onValueChange={setBatchMode}
                      disabled={submitting}
                      trackColor={{ false: IOS_COLORS.fillMedium, true: IOS_COLORS.blueLight }}
                      thumbColor={Platform.OS === 'android' ? (memberBatchMode ? IOS_COLORS.blue : '#f4f3f4') : undefined}
                      ios_backgroundColor={IOS_COLORS.fillMedium}
                    />
                  </View>
                </View>
                <Text style={entryStyles.dateHint}>
                  {memberBatchMode
                    ? '搜索并加入多位会员；列表里每一行各自调整午餐、晚餐份数。'
                    : '搜索并选定一位会员；页面中间只有一组午餐、晚餐份数。'}
                </Text>
              </>
            )}

            {mode === 'member' && (
              <>
                <Text style={[entryStyles.sectionLabel, { marginTop: 4 }]}>订餐标记</Text>
                <View style={entryStyles.inlineCard}>
                  <View style={entryStyles.fieldRow}>
                    <View style={entryStyles.switchLabelCol}>
                      <Text style={entryStyles.fieldLabel}>员工餐</Text>
                      <Text style={entryStyles.switchHint}>股东/员工送餐等（仍按下方规则扣卡或赠送）</Text>
                    </View>
                    <Switch
                      value={memberIsStaffMeal}
                      onValueChange={setMemberIsStaffMeal}
                      disabled={submitting}
                      trackColor={{ false: IOS_COLORS.fillMedium, true: IOS_COLORS.blueLight }}
                      thumbColor={Platform.OS === 'android' ? (memberIsStaffMeal ? IOS_COLORS.blue : '#f4f3f4') : undefined}
                      ios_backgroundColor={IOS_COLORS.fillMedium}
                    />
                  </View>
                </View>
              </>
            )}

            {mode === 'member' ? (
              memberBatchMode ? (
              /* ===== 会员餐 · 批量（每人份数独立） ===== */
              <>
                <Text style={entryStyles.sectionLabel}>
                  {memberIsGift ? '赠送餐' : '批量录入'}
                </Text>
                <Text style={[entryStyles.dateHint, { marginBottom: 8 }]}>
                  {memberIsGift
                    ? '不扣会员卡次数。搜索并加入会员，在每行设午/晚份数；午+晚均为 0 不提交。'
                    : '每位会员一行，午/晚份数用步进器单独设置；午+晚均为 0 不提交。'}
                </Text>
                <View style={entryStyles.searchBox}>
                  <TextInput
                    style={entryStyles.searchInput}
                    placeholder="姓名 / 昵称 / 手机号搜索"
                    placeholderTextColor={IOS_COLORS.labelTertiary}
                    value={memberQuery}
                    onChangeText={setMemberQuery}
                    clearButtonMode="while-editing"
                  />
                </View>

                {dropdownOpen ? (
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
                        点行加入列表。
                      </Text>
                      {filteredMembers.map((m, i) => (
                        <Pressable
                          key={m.id}
                          style={({ pressed }) => [
                            entryStyles.memberRow,
                            i === filteredMembers.length - 1 && entryStyles.memberRowLast,
                            pressed && { backgroundColor: IOS_COLORS.fillLight },
                          ]}
                          onPress={() => appendMemberToBatch(m)}
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={22}
                            color={IOS_COLORS.blue}
                            style={{ marginRight: 4 }}
                          />
                          <View style={[entryStyles.memberAvatar, { backgroundColor: m.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
                            <Text style={entryStyles.memberAvatarText}>{(m.nickname || m.name)[0]}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={entryStyles.memberName}>{m.name}</Text>
                            <Text style={entryStyles.memberNick}>
                              「{m.nickname}」· {m.is_hospital ? '院内' : '院外'}
                            </Text>
                          </View>
                          {m.active_card ? (
                            <Text style={entryStyles.memberCardBadge}>
                              {m.active_card.card_name} 剩{m.active_card.remaining_meals}份
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

                {memberBatchRows.length > 0 ? (
                  <View style={{ marginTop: 14, gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={entryStyles.sectionLabel}>已加入 {memberBatchRows.length} 人</Text>
                      <Pressable onPress={() => setMemberBatchRows([])} hitSlop={8}>
                        <Text style={entryStyles.changeBtn}>清空本批</Text>
                      </Pressable>
                    </View>
                    {memberBatchRows.map((row, idx) => (
                      <View key={`${row.member.id}-${idx}`} style={entryStyles.inlineCard}>
                        <View style={[entryStyles.fieldRow, { alignItems: 'center' }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={entryStyles.fieldLabel}>
                              {row.member.name}「{row.member.nickname}」
                            </Text>
                            <Text style={entryStyles.dateHint}>
                              {row.member.is_hospital ? '院内' : '院外'} ·{' '}
                              {row.member.active_card?.card_name ?? '无有效卡'} · 剩{' '}
                              {row.member.active_card?.remaining_meals ?? 0} 份
                            </Text>
                          </View>
                          <Pressable onPress={() => removeMemberBatchRow(idx)} hitSlop={8} disabled={submitting}>
                            <Ionicons name="trash-outline" size={22} color={IOS_COLORS.red} />
                          </Pressable>
                        </View>
                        <View style={entryStyles.fieldDivider} />
                        <View style={entryStyles.qtySection}>
                          <QtyRow
                            label="午餐份数"
                            value={row.lunch}
                            onChange={(v) => updateMemberBatchRow(idx, { lunch: v })}
                          />
                          <QtyRow
                            label="晚餐份数"
                            value={row.dinner}
                            onChange={(v) => updateMemberBatchRow(idx, { dinner: v })}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                {!memberIsGift &&
                memberBatchEntries.some(
                  (r) => !r.member.active_card,
                ) ? (
                  <View style={[entryStyles.warnBanner, { marginTop: 10 }]}>
                    <Ionicons name="alert-circle" size={18} color={IOS_COLORS.red} />
                    <View style={{ flex: 1 }}>
                      <Text style={entryStyles.warnTitle}>列表中有会员无进行中卡，无法扣次（已填份数的行）</Text>
                      <Text style={entryStyles.warnHint}>请改「赠送餐」、删行或去会员详情开卡。</Text>
                    </View>
                  </View>
                ) : null}
                {!memberIsGift &&
                memberBatchEntries.some(
                  (r) =>
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

                <View style={entryStyles.divider} />

                <Text style={[entryStyles.sectionLabel, { marginTop: 16 }]}>配送方式</Text>
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
                    placeholder="备注（可选，本批订单共用）"
                    placeholderTextColor={IOS_COLORS.labelTertiary}
                    value={memberNotes}
                    onChangeText={setMemberNotes}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </>
            ) : (
              /* ===== 会员餐 · 单人 ===== */
              <>
                <Text style={entryStyles.sectionLabel}>单人录入</Text>
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
                          {selectedMember.active_card?.card_name ?? '无有效卡'} · 剩{' '}
                          {selectedMember.active_card?.remaining_meals ?? 0} 份
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
                            请开卡、改「赠送餐」或改「散餐」录单。
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
                            i === filteredMembers.length - 1 && entryStyles.memberRowLast,
                            pressed && { backgroundColor: IOS_COLORS.fillLight },
                          ]}
                          onPress={() => {
                            setSelectedMember(m);
                            setMemberQuery(m.nickname || m.name);
                          }}
                        >
                          <View style={[entryStyles.memberAvatar, { backgroundColor: m.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
                            <Text style={entryStyles.memberAvatarText}>{(m.nickname || m.name)[0]}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={entryStyles.memberName}>{m.name}</Text>
                            <Text style={entryStyles.memberNick}>
                              「{m.nickname}」· {m.is_hospital ? '院内' : '院外'}
                            </Text>
                          </View>
                          {m.active_card ? (
                            <Text style={entryStyles.memberCardBadge}>
                              {m.active_card.card_name} 剩{m.active_card.remaining_meals}份
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

                <Text style={[entryStyles.sectionLabel, { marginTop: 16 }]}>份数（仅此一位）</Text>
                <Text style={[entryStyles.dateHint, { marginBottom: 6 }]}>
                  以下为该会员共用的一套午餐/晚餐，不是批量那种「每人不同」。
                </Text>
                <View style={entryStyles.qtySection}>
                  <QtyRow label="午餐份数" value={lunchQty} onChange={setLunchQty} />
                  <QtyRow label="晚餐份数" value={dinnerQty} onChange={setDinnerQty} />
                </View>

                <View style={entryStyles.divider} />

                <Text style={[entryStyles.sectionLabel, { marginTop: 16 }]}>配送方式</Text>
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
                    placeholder="备注（可选，如：今日忌辣）"
                    placeholderTextColor={IOS_COLORS.labelTertiary}
                    value={memberNotes}
                    onChangeText={setMemberNotes}
                    multiline
                    numberOfLines={2}
                  />
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
                <View style={entryStyles.qtySection}>
                  <QtyRow label="午餐份数" value={adhocLunchQty}  onChange={setAdhocLunchQty} />
                  <QtyRow label="晚餐份数" value={adhocDinnerQty} onChange={setAdhocDinnerQty} />
                </View>

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
                    {adhocIsGift ? '赠送 ¥0' : `¥${((parseFloat(adhocPrice) || 0) * adhocTotalQty).toFixed(0)}`}
                  </Text>
                </View>
              </>
            )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 底部提交条 */}
      <View style={entryStyles.submitBar}>
        <View style={{ flex: 1 }}>
          {mode === 'member' ? (
            memberBatchMode ? (
              <>
                <Text style={entryStyles.submitMain}>
                  {memberIsGift ? '赠送餐（批量）' : '批量录入'}
                </Text>
                <Text style={entryStyles.submitSub}>
                  {memberBatchEntries.length > 0
                    ? `将提交 ${memberBatchEntries.length} 位（列表共 ${memberBatchRows.length} 人）`
                    : memberBatchRows.length > 0
                      ? `已为 ${memberBatchRows.length} 人设行，请至少为一行填写午/晚份数`
                      : '请搜索并点行加入会员，再分别设份数'}
                  {proofOk ? '' : ' · 请先上传凭证'}
                  {memberIsStaffMeal ? ' · 员工餐' : ''}
                </Text>
              </>
            ) : selectedMember ? (
              <>
                <Text style={entryStyles.submitMain}>
                  {selectedMember.nickname || selectedMember.name}
                </Text>
                <Text
                  style={[
                    entryStyles.submitSub,
                    !memberIsGift && !memberHasCard && { color: IOS_COLORS.red, fontWeight: '600' },
                  ]}
                >
                  {memberIsGift
                    ? `赠送餐 · 午 ${lunchQty} · 晚 ${dinnerQty}`
                    : !memberHasCard
                      ? '无有效卡'
                      : `午 ${lunchQty} · 晚 ${dinnerQty}`}
                  {proofOk ? '' : ' · 请先上传凭证'}
                  {memberIsStaffMeal ? ' · 员工餐' : ''}
                </Text>
              </>
            ) : (
              <Text style={entryStyles.submitHint}>请搜索并选择一位会员</Text>
            )
          ) : mode === 'adhoc' && adhocName.trim() ? (
            <>
              <Text style={entryStyles.submitMain}>{adhocName.trim()}</Text>
              <Text style={entryStyles.submitSub}>
                午 {adhocLunchQty} · 晚 {adhocDinnerQty} · 共 {adhocTotalQty} 份
                {adhocIsGift ? ' · 赠送' : ` · ¥${((parseFloat(adhocPrice) || 0) * adhocTotalQty).toFixed(0)}`}
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
                ? `确认录入 (${memberBatchEntries.length}人${memberIsStaffMeal ? '·员工餐' : ''})`
                : mode === 'member' && memberIsStaffMeal && !memberBatchMode
                  ? '确认录入（员工餐）'
                  : '确认录入'}
            </Text>
          )}
        </Pressable>
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
// ChannelPicker — 配送方式（员工自送 / 外包快递）+ 快递承运方备注
// ============================================================
function ChannelPicker({
  value,
  onChange,
  courierRef,
  onCourierRefChange,
  disabled = false,
}: {
  value: 'self' | 'courier';
  onChange: (v: 'self' | 'courier') => void;
  courierRef: string;
  onCourierRefChange: (v: string) => void;
  disabled?: boolean;
}) {
  const isCourier = value === 'courier';
  return (
    <View style={entryStyles.inlineCard}>
      <View style={entryStyles.fieldRow}>
        <View style={entryStyles.switchLabelCol}>
          <Text style={entryStyles.fieldLabel}>使用快递</Text>
          <Text style={entryStyles.switchHint}>关闭则员工自送；打开后可填承运方</Text>
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
      {value === 'courier' ? (
        <>
          <View style={entryStyles.fieldDivider} />
          <View style={entryStyles.fieldRow}>
            <Text style={entryStyles.fieldLabel}>承运方</Text>
            <TextInput
              style={entryStyles.fieldInput}
              placeholder="选填：快递公司 / 骑手手机后四位"
              placeholderTextColor={IOS_COLORS.labelTertiary}
              value={courierRef}
              onChangeText={onCourierRefChange}
              maxLength={64}
              editable={!disabled}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

// ============================================================
// QtyRow — stepper 组件
// ============================================================
function QtyRow({
  label, value, onChange, min = 0,
}: {
  label: string; value: number; onChange: (v: number) => void; min?: number;
}) {
  return (
    <View style={entryStyles.qtyRow}>
      <Text style={entryStyles.qtyLabel}>{label}</Text>
      <View style={entryStyles.qtyControls}>
        <Pressable
          style={[entryStyles.qtyBtn, value <= min && entryStyles.qtyBtnDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Text style={entryStyles.qtyBtnText}>−</Text>
        </Pressable>
        <Text style={entryStyles.qtyValue}>{value}</Text>
        <Pressable style={entryStyles.qtyBtn} onPress={() => onChange(value + 1)}>
          <Text style={entryStyles.qtyBtnText}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}
