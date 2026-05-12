/**
 * 快速录入页 —— 手机端独立页面。
 *
 * 默认 order_date = 今天（对应手机场景），
 * 展示 OrderEntryModal 内联版（不弹 Modal，直接渲染表单）。
 */

import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../api/client';
import { ordersApi } from '../../../api/orders';
import { type Member, type MemberListResp } from '../../../api/members';
import {
  AppHeader,
  Button,
  GlassSurface,
  IconAvatar,
  MeshBackground,
  PressableCard,
  SectionLabel,
  StatusChip,
} from '../../../components/ui';
import { COLORS, GLASS, RADIUS, SPACING, TYPE } from '../../../theme/paperTheme';
import { createIdempotencyKey } from '../../../lib/idempotencyKey';
import { formatDate } from '@meal/shared';
import { useScrollToTopOnFocus } from '../../../hooks/useScrollToTopOnFocus';
import { OrderProofSection } from '../../../components/orders/OrderProofSection';

function todayDate(): string {
  return formatDate(new Date());
}

export default function QuickOrderScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(scrollRef);

  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [orderDate] = useState(todayDate());
  const [lunchQty, setLunchQty] = useState(0);
  const [dinnerQty, setDinnerQty] = useState(0);
  const [notes, setNotes] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackMsg, setSnackMsg] = useState<string | null>(null);
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [isGift, setIsGift] = useState(false);
  const [isStaffMeal, setIsStaffMeal] = useState(false);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<MemberListResp>(
        `/api/members?q=${encodeURIComponent(q)}&limit=8&type=member`,
      );
      setSearchResults(res.items);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMember = (m: Member) => {
    setSelectedMember(m);
    setSearchQuery(m.name);
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!selectedMember) {
      setError('请先选择会员');
      return;
    }
    if (lunchQty + dinnerQty === 0) {
      setError('午餐份数和晚餐份数至少有一项 > 0');
      return;
    }
    if (proofImages.length < 1) {
      setError('请上传至少一张订餐凭证截图');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await ordersApi.create(
        {
          member_id: selectedMember.id,
          order_date: orderDate,
          lunch_qty: lunchQty > 0 ? lunchQty : undefined,
          dinner_qty: dinnerQty > 0 ? dinnerQty : undefined,
          notes: notes.trim() || undefined,
          proof_images: proofImages,
          is_gift: isGift,
          is_staff_meal: isStaffMeal,
        },
        createIdempotencyKey(),
      );

      const msg = result.card_exhausted
        ? `录入成功！餐卡已耗尽，请及时续卡。`
        : `录入成功！${result.orders.length} 条订单已创建。`;
      setSnackMsg(msg);

      // 重置（保留日期以便连续录入）
      setSelectedMember(null);
      setSearchQuery('');
      setSearchResults([]);
      setLunchQty(0);
      setDinnerQty(0);
      setNotes('');
      setProofImages([]);
      setIsGift(false);
      setIsStaffMeal(false);
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      if (e.code === 'INSUFFICIENT_MEAL_BALANCE') {
        setError(`余额不足：${e.message ?? '请先续卡或升级'}`);
      } else {
        setError(e.message ?? '录入失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader title="快速录入" onBack={() => router.back()} />
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.dateContext}>用餐日期：{orderDate}（今天）</Text>
          {error ? (
            <GlassSurface tint="danger" padding={SPACING.base} style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => setError(null)} hitSlop={8}>
                <Text style={styles.errorClose}>关闭</Text>
              </Pressable>
            </GlassSurface>
          ) : null}

          <SectionLabel>选择会员</SectionLabel>
          <GlassSurface padding={SPACING.base} style={styles.card}>
            <View style={styles.inputRow}>
              <Ionicons name="search-outline" size={16} color={COLORS.text.tertiary} />
              <TextInput
                value={searchQuery}
                onChangeText={handleSearch}
                style={styles.input}
                placeholder="输入姓名 / 昵称 / 手机"
                placeholderTextColor={COLORS.text.quaternary}
              />
              {searching ? <ActivityIndicator size="small" color={COLORS.brand} /> : null}
            </View>

            {searchResults.length > 0 ? (
              <View style={styles.dropdown}>
                {searchResults.map((m) => (
                  <PressableCard
                    key={m.id}
                    padding={SPACING.sm}
                    level={1}
                    onPress={() => handleSelectMember(m)}
                    style={styles.dropdownItem}
                  >
                    <View style={styles.dropdownRow}>
                      <Text style={styles.dropdownName}>
                        {m.name}
                        {m.nickname ? `（${m.nickname}）` : ''}
                      </Text>
                      <StatusChip label={m.is_hospital ? '院内' : '院外'} variant={m.is_hospital ? 'hospital' : 'neutral'} />
                    </View>
                  </PressableCard>
                ))}
              </View>
            ) : null}

            {selectedMember ? (
              <View style={styles.selectedMember}>
                <IconAvatar
                  icon="person-outline"
                  size={34}
                  color={selectedMember.is_hospital ? COLORS.brand : COLORS.text.secondary}
                  bg={selectedMember.is_hospital ? COLORS.brandSoft : GLASS.surface3}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedName}>{selectedMember.name}</Text>
                  <Text style={styles.selectedMeta}>
                    {selectedMember.nickname ? `「${selectedMember.nickname}」 · ` : ''}
                    {selectedMember.is_hospital ? '院内会员' : '院外会员'}
                  </Text>
                </View>
                <Pressable onPress={() => { setSelectedMember(null); setSearchQuery(''); }} hitSlop={8}>
                  <Text style={styles.removeText}>清除</Text>
                </Pressable>
              </View>
            ) : null}
          </GlassSurface>

          <SectionLabel>订餐凭证</SectionLabel>
          <GlassSurface padding={SPACING.base} style={styles.card}>
            <OrderProofSection images={proofImages} onChange={setProofImages} disabled={submitting} />
            <View style={[styles.giftRow, { marginTop: SPACING.sm }]}>
              <Text style={styles.qtyLabel}>赠送餐（不扣次）</Text>
              <Pressable
                onPress={() => !submitting && setIsGift(!isGift)}
                style={[styles.giftToggle, isGift && styles.giftToggleOn]}
              >
                <Text style={[styles.giftToggleText, isGift && styles.giftToggleTextOn]}>
                  {isGift ? '是' : '否'}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.giftRow, { marginTop: SPACING.sm }]}>
              <Text style={styles.qtyLabel}>员工餐</Text>
              <Pressable
                onPress={() => !submitting && setIsStaffMeal(!isStaffMeal)}
                style={[styles.giftToggle, isStaffMeal && styles.giftToggleOn]}
              >
                <Text style={[styles.giftToggleText, isStaffMeal && styles.giftToggleTextOn]}>
                  {isStaffMeal ? '是' : '否'}
                </Text>
              </Pressable>
            </View>
          </GlassSurface>

          <SectionLabel>订餐信息</SectionLabel>
          <GlassSurface padding={SPACING.base} style={styles.card}>
            <QtyRow label="午餐份数" value={lunchQty} onDecrease={() => setLunchQty(Math.max(0, lunchQty - 1))} onIncrease={() => setLunchQty(lunchQty + 1)} />
            <View style={styles.divider} />
            <QtyRow label="晚餐份数" value={dinnerQty} onDecrease={() => setDinnerQty(Math.max(0, dinnerQty - 1))} onIncrease={() => setDinnerQty(dinnerQty + 1)} />
            <View style={styles.divider} />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={styles.notesInput}
              placeholder="备注（可选）"
              placeholderTextColor={COLORS.text.quaternary}
              multiline
              numberOfLines={2}
            />
          </GlassSurface>

          <View style={styles.actionRow}>
            <Button
              label="返回列表"
              variant="ghost"
              onPress={() => router.back()}
              style={styles.actionBtn}
            />
            <Button
              label={submitting ? '提交中...' : `确认录入${isStaffMeal ? '（员工餐）' : ''}`}
              onPress={() => void handleSubmit()}
              disabled={
                submitting || !selectedMember || lunchQty + dinnerQty === 0 || proofImages.length < 1
              }
              style={styles.actionBtn}
            />
          </View>

          {snackMsg ? (
            <GlassSurface tint="ok" padding={SPACING.base} style={styles.snackCard}>
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
              <Text style={styles.snackText}>{snackMsg}</Text>
              <Pressable onPress={() => setSnackMsg(null)} hitSlop={8}>
                <Text style={styles.errorClose}>好的</Text>
              </Pressable>
            </GlassSurface>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function QtyRow({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.qtyRow}>
      <Text style={styles.qtyLabel}>{label}</Text>
      <View style={styles.qtyControls}>
        <Pressable onPress={onDecrease} style={styles.qtyBtn}>
          <Text style={styles.qtyBtnText}>−</Text>
        </Pressable>
        <Text style={styles.qtyValue}>{value}</Text>
        <Pressable onPress={onIncrease} style={[styles.qtyBtn, styles.qtyBtnPrimary]}>
          <Text style={[styles.qtyBtnText, styles.qtyBtnTextPrimary]}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dateContext: {
    ...TYPE.footnote,
    color: COLORS.text.tertiary,
    paddingHorizontal: 2,
  },
  container: {
    paddingHorizontal: SPACING.page,
    paddingTop: SPACING.sm,
    paddingBottom: 40,
    gap: SPACING.sm,
  },
  card: {
    gap: SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.52)',
    paddingHorizontal: SPACING.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    fontSize: 15,
    color: COLORS.text.primary,
    backgroundColor: 'transparent',
    paddingVertical: 9,
  },
  dropdown: {
    gap: 6,
  },
  dropdownItem: {
    borderWidth: 1,
    borderColor: GLASS.border,
  },
  dropdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dropdownName: {
    ...TYPE.body,
    color: COLORS.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  selectedMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  selectedName: { ...TYPE.body, color: COLORS.text.primary, fontWeight: '700' },
  selectedMeta: { ...TYPE.footnote, color: COLORS.text.secondary, marginTop: 2 },
  removeText: { ...TYPE.footnote, color: COLORS.brand, fontWeight: '700' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS.outline,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyLabel: {
    ...TYPE.body,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GLASS.outline,
    backgroundColor: GLASS.surface2,
  },
  qtyBtnPrimary: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brandSoft,
  },
  qtyBtnText: {
    ...TYPE.body,
    color: COLORS.text.secondary,
    fontWeight: '700',
  },
  qtyBtnTextPrimary: {
    color: COLORS.brand,
  },
  qtyValue: {
    ...TYPE.title3,
    minWidth: 36,
    textAlign: 'center',
    color: COLORS.text.primary,
    fontVariant: ['tabular-nums'],
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  giftToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.surface2,
  },
  giftToggleOn: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brandSoft,
  },
  giftToggleText: {
    ...TYPE.footnote,
    color: COLORS.text.secondary,
    fontWeight: '600',
  },
  giftToggleTextOn: {
    color: COLORS.brand,
  },
  notesInput: {
    minHeight: 44,
    color: COLORS.text.primary,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  actionBtn: {
    flex: 1,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  errorText: {
    ...TYPE.footnote,
    color: COLORS.text.secondary,
    flex: 1,
  },
  errorClose: {
    ...TYPE.footnote,
    color: COLORS.brand,
    fontWeight: '700',
  },
  snackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  snackText: {
    ...TYPE.footnote,
    color: COLORS.text.primary,
    flex: 1,
  },
});
