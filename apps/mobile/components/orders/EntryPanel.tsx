/**
 * 录入 Tab — 会员餐 / 散餐（从 orders/index 拆分）
 */
import { useState } from 'react';
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

// EntryPanel — 快速录入（会员餐 / 散餐），内嵌在「录入」Tab 中
// ============================================================
type EntryMode = 'member' | 'adhoc';

export function EntryPanel({
  members,
  onAddMemberOrder,
  onAddWalkinOrder,
  onJumpToOverview,
}: {
  members: MockMember[];
  onAddMemberOrder: (payload: {
    memberId: number;
    orderDate: string;
    lunchQty: number;
    dinnerQty: number;
    notes?: string;
    deliveryChannel: 'self' | 'courier';
    courierRef?: string;
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
  const adhocTotalQty = adhocLunchQty + adhocDinnerQty;

  const q = memberQuery.trim();
  const filteredMembers = q
    ? members
        .filter(
          (m) =>
            m.name.includes(q) ||
            m.nickname.includes(q) ||
            m.phone.includes(q),
        )
        .slice(0, 8)
    : [];
  const dropdownOpen = !selectedMember && q.length > 0;

  const reset = () => {
    setMode('member');
    setEntryDate(tomorrowStr());
    setMemberQuery(''); setSelectedMember(null);
    setLunchQty(0); setDinnerQty(0); setMemberNotes('');
    setAdhocName(''); setAdhocPhone(''); setAdhocAddress('');
    setAdhocWechat('');
    setAdhocLunchQty(0); setAdhocDinnerQty(0);
    setAdhocPrice(String(ADHOC_DEFAULT_PRICE)); setAdhocHospital(false); setAdhocNotes('');
    setDeliveryChannel('self'); setCourierRef('');
  };

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleSubmitMember = async () => {
    if (!selectedMember || lunchQty + dinnerQty === 0) return;
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
      });
      reset();
      flashToast(`已录入散客 ${name} · ${adhocTotalQty} 份`);
    } catch {
      // 错误上层 toast
    } finally {
      setSubmitting(false);
    }
  };

  const memberHasCard = !!selectedMember?.active_card;
  const memberCardEnough = memberHasCard
    ? (selectedMember!.active_card!.remaining_meals >= lunchQty + dinnerQty)
    : false;
  const canSubmitMember =
    !!selectedMember &&
    memberHasCard &&
    memberCardEnough &&
    lunchQty + dinnerQty > 0 &&
    !submitting;
  const canSubmitAdhoc  = adhocName.trim().length > 0 && adhocTotalQty >= 1 && !submitting;
  const canSubmit       = mode === 'member' ? canSubmitMember : canSubmitAdhoc;

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
        <Text style={entryStyles.modeHint} numberOfLines={1}>
          {mode === 'member' ? '从会员档案中选择，自动扣卡' : '无需会员账户，现金收费'}
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
                    onChangeText={(q) => {
                      setMemberQuery(q);
                      if (selectedMember) setSelectedMember(null);
                    }}
                    clearButtonMode="while-editing"
                  />
                </View>

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
                    {!memberHasCard ? (
                      <View style={entryStyles.warnBanner}>
                        <Ionicons name="alert-circle" size={18} color={IOS_COLORS.red} />
                        <View style={{ flex: 1 }}>
                          <Text style={entryStyles.warnTitle}>该会员暂无进行中的卡</Text>
                          <Text style={entryStyles.warnHint}>
                            会员订餐必须扣卡，请先去会员详情开卡，或在"散餐"标签下做一次性散客录单。
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
                    ) : memberHasCard && lunchQty + dinnerQty > 0 && !memberCardEnough ? (
                      <View style={entryStyles.warnBanner}>
                        <Ionicons name="alert-circle" size={18} color={IOS_COLORS.red} />
                        <Text style={[entryStyles.warnTitle, { flex: 1 }]}>
                          剩 {selectedMember.active_card!.remaining_meals} 份，不够扣 {lunchQty + dinnerQty} 份。请先续卡或减少份数。
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : dropdownOpen ? (
                  /* 搜索结果下拉 */
                  filteredMembers.length > 0 ? (
                    <View style={entryStyles.memberList}>
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
                    ¥{((parseFloat(adhocPrice) || 0) * adhocTotalQty).toFixed(0)}
                  </Text>
                </View>
              </>
            )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 底部提交条 */}
      <View style={entryStyles.submitBar}>
        <View style={{ flex: 1 }}>
          {mode === 'member' && selectedMember ? (
            <>
              <Text style={entryStyles.submitMain}>
                {selectedMember.nickname || selectedMember.name}
              </Text>
              <Text
                style={[
                  entryStyles.submitSub,
                  !memberHasCard && { color: IOS_COLORS.red, fontWeight: '600' },
                ]}
              >
                {!memberHasCard
                  ? '该会员无卡，请先开卡'
                  : `午 ${lunchQty} · 晚 ${dinnerQty} · 共 ${lunchQty + dinnerQty} 份`}
              </Text>
            </>
          ) : mode === 'adhoc' && adhocName.trim() ? (
            <>
              <Text style={entryStyles.submitMain}>{adhocName.trim()}</Text>
              <Text style={entryStyles.submitSub}>
                午 {adhocLunchQty} · 晚 {adhocDinnerQty} · 共 {adhocTotalQty} 份 · ¥
                {((parseFloat(adhocPrice) || 0) * adhocTotalQty).toFixed(0)}
              </Text>
            </>
          ) : (
            <Text style={entryStyles.submitHint}>
              {mode === 'member' ? '请选择会员并录入份数' : '请填写顾客姓名与份数'}
            </Text>
          )}
        </View>
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
