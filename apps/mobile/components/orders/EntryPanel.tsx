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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';
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
  onAddMemberOrder,
  onAddMemberBatchOrder,
  onAddWalkinOrder,
  onJumpToOverview,
}: {
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
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<EntryMode>('member');
  const [submitting, setSubmitting] = useState(false);
  const [entryDate, setEntryDate] = useState<string>(() => tomorrowStr());
  // 共用的配送渠道选择（会员餐和散餐共用一套状态，切 mode 不 reset 更顺手）
  const [deliveryChannel, setDeliveryChannel] = useState<'self' | 'courier'>('self');
  const [courierRef, setCourierRef] = useState('');

  // 会员餐 state
  const [memberQuery,    setMemberQuery]    = useState('');
  const [selectedMember, setSelectedMember] = useState<MockMember | null>(null);
  const [lunchQty,       setLunchQty]       = useState(0);
  const [dinnerQty,      setDinnerQty]      = useState(0);
  const [memberNotes,    setMemberNotes]    = useState('');
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [memberIsGift, setMemberIsGift] = useState(false);
  const [memberBatchMode, setMemberBatchMode] = useState(false);
  const [memberBatchQueue, setMemberBatchQueue] = useState<
    Array<{
      member: MockMember;
      lunch: number;
      dinner: number;
      notes: string;
      isGift: boolean;
    }>
  >([]);
  /** 批量模式：在搜索结果中多选会员，再统一填份数加入列表 */
  const [batchPickedMembers, setBatchPickedMembers] = useState<MockMember[]>([]);

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
  const dropdownOpen = !selectedMember && q.length > 0;
  const memberSearchPending = dropdownOpen && memberSearchHits === null;
  const filteredMembers = memberSearchHits ?? [];

  const memberHasCard = !!selectedMember?.active_card;
  const memberCardEnough = memberHasCard
    ? selectedMember!.active_card!.remaining_meals >= lunchQty + dinnerQty
    : false;

  const reset = () => {
    setMode('member');
    setEntryDate(tomorrowStr());
    setMemberQuery(''); setSelectedMember(null);
    setLunchQty(0); setDinnerQty(0); setMemberNotes('');
    setProofImages([]);
    setMemberIsGift(false);
    setMemberBatchMode(false);
    setMemberBatchQueue([]);
    setBatchPickedMembers([]);
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

  const handleSubmitMember = async () => {
    if (proofImages.length < 1) {
      flashToast('请上传至少一张订餐凭证截图');
      return;
    }
    if (!selectedMember || lunchQty + dinnerQty === 0) return;
    if (!memberIsGift && (!memberHasCard || !memberCardEnough)) return;
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
      const qty = lunchQty + dinnerQty;
      reset();
      flashToast(`已为 ${name} 录入 ${qty} 份`);
    } catch {
      // 错误 toast 由上层 handleAddMemberOrder 处理；这里保持 UI
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

  const handleAddToMemberBatch = () => {
    if (proofImages.length < 1) {
      flashToast('请先上传凭证截图');
      return;
    }
    if (batchPickedMembers.length < 1) {
      flashToast('请先在列表里点选至少一位会员');
      return;
    }
    if (lunchQty + dinnerQty === 0) {
      flashToast('午餐或晚餐份数请至少填一项');
      return;
    }
    const ineligible = batchPickedMembers.filter(
      (m) => !memberMeetsBatchCardRules(m, lunchQty, dinnerQty, memberIsGift),
    );
    if (ineligible.length > 0) {
      const label = ineligible.map((m) => m.nickname || m.name).join('、');
      flashToast(`以下会员无卡或次数不足（可改赠送餐或减少份数）：${label}`);
      return;
    }
    const queuedIds = new Set(memberBatchQueue.map((r) => r.member.id));
    const unique = batchPickedMembers.filter((m) => !queuedIds.has(m.id));
    if (unique.length === 0) {
      flashToast('所选会员均已存在于待提交列表');
      return;
    }
    if (memberBatchQueue.length + unique.length > MEMBER_BATCH_QUEUE_MAX) {
      flashToast(
        `待提交最多 ${MEMBER_BATCH_QUEUE_MAX} 条，当前还可加 ${MEMBER_BATCH_QUEUE_MAX - memberBatchQueue.length} 条`,
      );
      return;
    }
    if (unique.length < batchPickedMembers.length) {
      flashToast(`已跳过 ${batchPickedMembers.length - unique.length} 位已在列表中的会员`);
    }
    setMemberBatchQueue([
      ...memberBatchQueue,
      ...unique.map((m) => ({
        member: m,
        lunch: lunchQty,
        dinner: dinnerQty,
        notes: memberNotes.trim(),
        isGift: memberIsGift,
      })),
    ]);
    setBatchPickedMembers([]);
    setMemberQuery('');
    setLunchQty(0);
    setDinnerQty(0);
    setMemberNotes('');
    flashToast(`已加入 ${unique.length} 条`);
  };

  const handleSubmitMemberBatch = async () => {
    if (!onAddMemberBatchOrder) return;
    if (proofImages.length < 1) {
      flashToast('请上传至少一张订餐凭证截图');
      return;
    }
    if (memberBatchQueue.length < 1) {
      flashToast('请先用「加入列表」添加至少一条');
      return;
    }
    setSubmitting(true);
    try {
      await onAddMemberBatchOrder({
        proof_images: proofImages,
        entries: memberBatchQueue.map((row) => ({
          memberId: row.member.id,
          orderDate: entryDate,
          lunchQty: row.lunch,
          dinnerQty: row.dinner,
          notes: row.notes || undefined,
          isGift: row.isGift,
          deliveryChannel,
          courierRef: deliveryChannel === 'courier' ? courierRef.trim() || undefined : undefined,
        })),
      });
      const n = memberBatchQueue.length;
      reset();
      flashToast(`已批量录入 ${n} 位会员`);
    } catch {
      // 上层 toast
    } finally {
      setSubmitting(false);
    }
  };

  const memberQtyOk = lunchQty + dinnerQty > 0;
  const proofOk = proofImages.length >= 1;
  const memberCardOk = memberIsGift || (memberHasCard && memberCardEnough);
  const canSubmitMemberSingle =
    mode === 'member' &&
    !memberBatchMode &&
    !!selectedMember &&
    memberCardOk &&
    memberQtyOk &&
    proofOk &&
    !submitting;
  const batchAddTargets = memberBatchMode ? batchPickedMembers : [];
  const allPickedEligibleForBatch =
    batchAddTargets.length > 0 &&
    batchAddTargets.every((m) =>
      memberMeetsBatchCardRules(m, lunchQty, dinnerQty, memberIsGift),
    );
  const canAddToBatch =
    memberBatchMode &&
    !!onAddMemberBatchOrder &&
    batchAddTargets.length > 0 &&
    allPickedEligibleForBatch &&
    memberQtyOk &&
    proofOk &&
    !submitting;
  const canSubmitBatch =
    memberBatchMode &&
    !!onAddMemberBatchOrder &&
    memberBatchQueue.length >= 1 &&
    proofOk &&
    !submitting;
  const canSubmitAdhoc =
    mode === 'adhoc' &&
    adhocName.trim().length > 0 &&
    adhocTotalQty >= 1 &&
    proofOk &&
    !submitting;
  const canSubmit =
    mode === 'member'
      ? memberBatchMode
        ? false
        : canSubmitMemberSingle
      : canSubmitAdhoc;

  const removeMemberBatchAt = (idx: number) => {
    setMemberBatchQueue(memberBatchQueue.filter((_, i) => i !== idx));
  };

  const setBatchMode = (on: boolean) => {
    setMemberBatchMode(on);
    if (!on) {
      setMemberBatchQueue([]);
      setBatchPickedMembers([]);
    } else {
      setSelectedMember(null);
      setBatchPickedMembers([]);
    }
  };

  const toggleBatchPickMember = (m: MockMember) => {
    setBatchPickedMembers((prev) => {
      const has = prev.some((x) => x.id === m.id);
      if (has) return prev.filter((x) => x.id !== m.id);
      if (prev.length >= MEMBER_BATCH_QUEUE_MAX) {
        requestAnimationFrame(() =>
          flashToast(`单次最多选 ${MEMBER_BATCH_QUEUE_MAX} 人，可先加入列表再继续选`),
        );
        return prev;
      }
      return [...prev, m];
    });
  };

  return (
    <View style={{ flex: 1 }}>
      {/* 模式切换（会员餐 / 散餐） */}
      <View style={entryStyles.modeRow}>
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
        <Text style={entryStyles.modeHint} numberOfLines={2}>
          {mode === 'member'
            ? memberIsGift
              ? '赠送餐：不扣会员卡次数'
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
            <Text style={entryStyles.sectionLabel}>录入日期</Text>
            <View style={entryStyles.dateCard}>
              <DatePicker
                value={entryDate}
                onChange={setEntryDate}
                label="日期"
              />
            </View>
            <Text style={entryStyles.dateHint}>
              默认是次日，可按需要改成今天或任意日期。
            </Text>

            <OrderProofSection images={proofImages} onChange={setProofImages} disabled={submitting} />

            {mode === 'member' && (
              <>
                <Text style={[entryStyles.sectionLabel, { marginTop: 4 }]}>选项</Text>
                <View style={entryStyles.inlineCard}>
                  <View style={entryStyles.fieldRow}>
                    <Text style={entryStyles.fieldLabel}>赠送餐（不扣次）</Text>
                    <View style={entryStyles.toggleGroup}>
                      {([false, true] as const).map((v) => (
                        <Pressable
                          key={String(v)}
                          style={[entryStyles.toggleBtn, memberIsGift === v && entryStyles.toggleBtnActive]}
                          onPress={() => setMemberIsGift(v)}
                          disabled={submitting}
                        >
                          <Text style={[entryStyles.toggleText, memberIsGift === v && entryStyles.toggleTextActive]}>
                            {v ? '是' : '否'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  {onAddMemberBatchOrder ? (
                    <>
                      <View style={entryStyles.fieldDivider} />
                      <View style={entryStyles.fieldRow}>
                        <Text style={entryStyles.fieldLabel}>批量录入</Text>
                        <View style={entryStyles.toggleGroup}>
                          {([false, true] as const).map((v) => (
                            <Pressable
                              key={String(v)}
                              style={[
                                entryStyles.toggleBtn,
                                memberBatchMode === v && entryStyles.toggleBtnActive,
                              ]}
                              onPress={() => setBatchMode(v)}
                              disabled={submitting}
                            >
                              <Text
                                style={[
                                  entryStyles.toggleText,
                                  memberBatchMode === v && entryStyles.toggleTextActive,
                                ]}
                              >
                                {v ? '开' : '关'}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </>
                  ) : null}
                </View>
                {memberBatchMode ? (
                  <Text style={entryStyles.dateHint}>
                    批量模式：在搜索结果里逐个点选多位会员（可多选），设好午餐/晚餐份数后点「加入列表」；可多次加入，最后「批量录入」一次提交（共用上方凭证）。
                  </Text>
                ) : null}
              </>
            )}

            {mode === 'member' ? (
              /* ===== 会员餐 ===== */
              <>
                <Text style={entryStyles.sectionLabel}>选择会员</Text>
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

                {memberBatchMode && batchPickedMembers.length > 0 ? (
                  <View style={{ marginTop: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={entryStyles.sectionLabel}>
                        已选 {batchPickedMembers.length} 人
                      </Text>
                      <Pressable onPress={() => setBatchPickedMembers([])} hitSlop={8}>
                        <Text style={entryStyles.changeBtn}>清空</Text>
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {batchPickedMembers.map((m) => (
                        <Pressable
                          key={m.id}
                          onPress={() =>
                            setBatchPickedMembers((prev) => prev.filter((x) => x.id !== m.id))
                          }
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: IOS_COLORS.blueLight,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 20,
                            maxWidth: '100%',
                          }}
                        >
                          <Text style={{ fontSize: 13, color: IOS_COLORS.label, fontWeight: '600' }} numberOfLines={1}>
                            {m.nickname || m.name}
                          </Text>
                          <Ionicons name="close-circle" size={18} color={IOS_COLORS.labelSecondary} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* 已选会员卡片 */}
                {selectedMember ? (
                  <>
                    <View style={entryStyles.selectedMemberCard}>
                      <View style={[entryStyles.selAvatar, { backgroundColor: selectedMember.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
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
                        onPress={() => { setSelectedMember(null); setMemberQuery(''); }}
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
                            会员订餐必须扣卡，请先去会员详情开卡，或勾选「赠送餐」，或在「散餐」下录单。
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            const id = selectedMember.id;
                            router.push({
                              pathname: '/(app)/members/[id]',
                              params: { id: String(id) },
                            });
                          }}
                          style={entryStyles.warnCta}
                        >
                          <Text style={entryStyles.warnCtaText}>去开卡</Text>
                        </Pressable>
                      </View>
                    ) : !memberIsGift && memberHasCard && lunchQty + dinnerQty > 0 && !memberCardEnough ? (
                      <View style={entryStyles.warnBanner}>
                        <Ionicons name="alert-circle" size={18} color={IOS_COLORS.red} />
                        <Text style={[entryStyles.warnTitle, { flex: 1 }]}>
                          剩 {selectedMember.active_card!.remaining_meals} 份，不够扣 {lunchQty + dinnerQty} 份。请先续卡或减少份数。
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
                      {memberBatchMode ? (
                        <Text style={[entryStyles.dateHint, { paddingHorizontal: 14, paddingVertical: 8 }]}>
                          点选行即可多选；所有人将使用下方相同的午餐/晚餐份数。
                        </Text>
                      ) : null}
                      {filteredMembers.map((m, i) => {
                        const picked = batchPickedMembers.some((x) => x.id === m.id);
                        return (
                          <Pressable
                            key={m.id}
                            style={({ pressed }) => [
                              entryStyles.memberRow,
                              i === filteredMembers.length - 1 && entryStyles.memberRowLast,
                              pressed && { backgroundColor: IOS_COLORS.fillLight },
                              memberBatchMode && picked && { backgroundColor: '#E3F2FD' },
                            ]}
                            onPress={() => {
                              if (memberBatchMode) {
                                toggleBatchPickMember(m);
                              } else {
                                setSelectedMember(m);
                                setMemberQuery(m.nickname || m.name);
                              }
                            }}
                          >
                            {memberBatchMode ? (
                              <Ionicons
                                name={picked ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={picked ? IOS_COLORS.blue : IOS_COLORS.labelSecondary}
                                style={{ marginRight: 4 }}
                              />
                            ) : null}
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
                        );
                      })}
                    </View>
                  ) : (
                    <View style={entryStyles.dropdownEmpty}>
                      <Text style={entryStyles.dropdownEmptyText}>
                        没有匹配的会员
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={entryStyles.searchHintSpacer} />
                )}

                <View style={entryStyles.divider} />
                <Text style={entryStyles.sectionLabel}>份数</Text>
                <View style={entryStyles.qtySection}>
                  <QtyRow label="午餐份数" value={lunchQty}  onChange={setLunchQty} />
                  <QtyRow label="晚餐份数" value={dinnerQty} onChange={setDinnerQty} />
                </View>

                <Text style={[entryStyles.sectionLabel, { marginTop: 16 }]}>配送方式</Text>
                <ChannelPicker
                  value={deliveryChannel}
                  onChange={setDeliveryChannel}
                  courierRef={courierRef}
                  onCourierRefChange={setCourierRef}
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

                {memberBatchMode && memberBatchQueue.length > 0 ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={entryStyles.sectionLabel}>待提交列表（{memberBatchQueue.length}）</Text>
                    <View style={entryStyles.inlineCard}>
                      {memberBatchQueue.map((row, idx) => (
                        <View key={`${row.member.id}-${idx}`}>
                          {idx > 0 ? <View style={entryStyles.fieldDivider} /> : null}
                          <View style={[entryStyles.fieldRow, { alignItems: 'center' }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={entryStyles.fieldLabel}>
                                {row.member.nickname || row.member.name}
                                {row.isGift ? ' · 赠' : ''}
                              </Text>
                              <Text style={entryStyles.dateHint}>
                                午 {row.lunch} · 晚 {row.dinner} · 共 {row.lunch + row.dinner} 份
                                {row.notes ? ` · ${row.notes}` : ''}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => removeMemberBatchAt(idx)}
                              hitSlop={8}
                              disabled={submitting}
                            >
                              <Ionicons name="trash-outline" size={22} color={IOS_COLORS.red} />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
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
                    <Text style={entryStyles.fieldLabel}>类型</Text>
                    <View style={entryStyles.toggleGroup}>
                      {([false, true] as const).map((v) => (
                        <Pressable
                          key={String(v)}
                          style={[entryStyles.toggleBtn, adhocHospital === v && entryStyles.toggleBtnActive]}
                          onPress={() => setAdhocHospital(v)}
                        >
                          <Text style={[entryStyles.toggleText, adhocHospital === v && entryStyles.toggleTextActive]}>
                            {v ? '院内' : '院外'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={entryStyles.fieldDivider} />
                  <View style={entryStyles.fieldRow}>
                    <Text style={entryStyles.fieldLabel}>赠送餐</Text>
                    <View style={entryStyles.toggleGroup}>
                      {([false, true] as const).map((v) => (
                        <Pressable
                          key={String(v)}
                          style={[entryStyles.toggleBtn, adhocIsGift === v && entryStyles.toggleBtnActive]}
                          onPress={() => setAdhocIsGift(v)}
                          disabled={submitting}
                        >
                          <Text style={[entryStyles.toggleText, adhocIsGift === v && entryStyles.toggleTextActive]}>
                            {v ? '是' : '否'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
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
          {mode === 'member' && memberBatchMode ? (
            <>
              <Text style={entryStyles.submitMain}>批量录入</Text>
              <Text style={entryStyles.submitSub}>
                待提交 {memberBatchQueue.length} 条
                {batchPickedMembers.length > 0
                  ? ` · 已选 ${batchPickedMembers.length} 人 · 午${lunchQty} 晚${dinnerQty}`
                  : ''}
                {proofOk ? '' : ' · 请先上传凭证'}
              </Text>
            </>
          ) : mode === 'member' && selectedMember ? (
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
                  ? `赠送餐 · 午 ${lunchQty} · 晚 ${dinnerQty} · 共 ${lunchQty + dinnerQty} 份`
                  : !memberHasCard
                    ? '该会员无卡，请先开卡或改赠送餐'
                    : `午 ${lunchQty} · 晚 ${dinnerQty} · 共 ${lunchQty + dinnerQty} 份`}
              </Text>
            </>
          ) : mode === 'member' ? (
            <Text style={entryStyles.submitHint}>请选择会员并录入份数</Text>
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
        {mode === 'member' && memberBatchMode ? (
          <View style={entryStyles.submitBtnRow}>
            <Pressable
              style={[
                entryStyles.submitBtnSecondary,
                !canAddToBatch && entryStyles.submitBtnSecondaryDisabled,
              ]}
              disabled={!canAddToBatch}
              onPress={handleAddToMemberBatch}
            >
              <Text style={entryStyles.submitBtnSecondaryText}>
                加入列表{batchPickedMembers.length > 0 ? ` (${batchPickedMembers.length}人)` : ''}
              </Text>
            </Pressable>
            <Pressable
              style={[entryStyles.submitBtn, !canSubmitBatch && entryStyles.submitBtnDisabled]}
              disabled={!canSubmitBatch}
              onPress={() => void handleSubmitMemberBatch()}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={entryStyles.submitBtnText}>
                  批量录入{memberBatchQueue.length > 0 ? ` (${memberBatchQueue.length})` : ''}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[entryStyles.submitBtn, !canSubmit && entryStyles.submitBtnDisabled]}
            disabled={!canSubmit}
            onPress={() => {
              if (mode === 'member') void handleSubmitMember();
              else void handleSubmitAdhoc();
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={entryStyles.submitBtnText}>确认录入</Text>
            )}
          </Pressable>
        )}
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
}: {
  value: 'self' | 'courier';
  onChange: (v: 'self' | 'courier') => void;
  courierRef: string;
  onCourierRefChange: (v: string) => void;
}) {
  return (
    <View style={entryStyles.inlineCard}>
      <View style={entryStyles.fieldRow}>
        <Text style={entryStyles.fieldLabel}>配送方式</Text>
        <View style={entryStyles.toggleGroup}>
          {([['self', '员工自送'], ['courier', '快递']] as const).map(([v, label]) => (
            <Pressable
              key={v}
              style={[entryStyles.toggleBtn, value === v && entryStyles.toggleBtnActive]}
              onPress={() => onChange(v)}
            >
              <Text style={[entryStyles.toggleText, value === v && entryStyles.toggleTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
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
