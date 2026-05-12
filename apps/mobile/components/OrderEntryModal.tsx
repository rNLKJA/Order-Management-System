/**
 * 快速录入订餐 Modal。
 *
 * 功能：
 * - 会员搜索（姓名 / 昵称 / 手机）
 * - 日期选择（默认今天）
 * - 午餐份数 ± 控制
 * - 晚餐份数 ± 控制
 * - 备注输入
 * - 提交 → POST /api/orders（自动处理扣卡/散餐）
 */

import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Modal,
  Portal,
  Text,
  TextInput,
  Button,
  Divider,
  useTheme,
  Chip,
  ActivityIndicator,
  Banner,
  Switch,
} from 'react-native-paper';
import { api } from '../api/client';
import { ordersApi, type CreateOrderResponse } from '../api/orders';
import { type Member, type MemberListResp } from '../api/members';
import { createIdempotencyKey } from '../lib/idempotencyKey';
import { formatDate } from '@meal/shared';
import { OrderProofSection } from './orders/OrderProofSection';

interface OrderEntryModalProps {
  visible: boolean;
  onDismiss: () => void;
  defaultDate?: string;
  onSuccess?: (result: CreateOrderResponse) => void;
}

function todayDate(): string {
  return formatDate(new Date());
}

export function OrderEntryModal({ visible, onDismiss, defaultDate, onSuccess }: OrderEntryModalProps) {
  const theme = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [orderDate, setOrderDate] = useState(defaultDate ?? todayDate());
  const [lunchQty, setLunchQty] = useState(0);
  const [dinnerQty, setDinnerQty] = useState(0);
  const [notes, setNotes] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [isGift, setIsGift] = useState(false);
  const [isStaffMeal, setIsStaffMeal] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<MemberListResp>(
        `/api/members?q=${encodeURIComponent(q)}&limit=10&type=member`,
      );
      setSearchResults(res.items);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

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
        : `录入成功！共 ${result.orders.length} 条订单。`;
      setSuccessMsg(msg);

      onSuccess?.(result);
      resetForm();
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

  const resetForm = () => {
    setSelectedMember(null);
    setSearchQuery('');
    setSearchResults([]);
    setLunchQty(0);
    setDinnerQty(0);
    setNotes('');
    setProofImages([]);
    setIsGift(false);
    setIsStaffMeal(false);
    setOrderDate(defaultDate ?? todayDate());
  };

  const handleDismiss = () => {
    resetForm();
    setError(null);
    setSuccessMsg(null);
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text variant="titleLarge" style={styles.title}>
            快速录入订餐
          </Text>

          {error && (
            <Banner
              visible
              actions={[{ label: '关闭', onPress: () => setError(null) }]}
              icon="alert"
            >
              {error}
            </Banner>
          )}

          {successMsg && (
            <Banner
              visible
              actions={[{ label: '关闭', onPress: () => setSuccessMsg(null) }]}
              icon="check-circle"
            >
              {successMsg}
            </Banner>
          )}

          {/* 会员搜索 */}
          <TextInput
            label="搜索会员（姓名 / 昵称 / 手机）"
            value={searchQuery}
            onChangeText={handleSearch}
            mode="outlined"
            right={searching ? <TextInput.Icon icon="loading" /> : undefined}
            style={styles.input}
          />

          {searchResults.length > 0 && (
            <View style={[styles.dropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
              {searchResults.map((m) => (
                <Button
                  key={m.id}
                  onPress={() => handleSelectMember(m)}
                  style={styles.dropdownItem}
                  contentStyle={styles.dropdownItemContent}
                >
                  <Text variant="bodyMedium">
                    {m.name}
                    {m.nickname ? `（${m.nickname}）` : ''}
                    {m.is_hospital ? ' 院内' : ''}
                  </Text>
                </Button>
              ))}
            </View>
          )}

          {selectedMember && (
            <Chip
              icon="account"
              onClose={() => {
                setSelectedMember(null);
                setSearchQuery('');
              }}
              style={styles.memberChip}
            >
              {selectedMember.name}
              {selectedMember.is_hospital ? ' · 院内' : ' · 院外'}
            </Chip>
          )}

          <Divider style={styles.divider} />

          {/* 日期 */}
          <TextInput
            label="用餐日期（YYYY-MM-DD）"
            value={orderDate}
            onChangeText={setOrderDate}
            mode="outlined"
            style={styles.input}
            keyboardType="numeric"
          />

          {/* 午餐份数 */}
          <View style={styles.qtyRow}>
            <Text variant="bodyLarge" style={styles.qtyLabel}>
              午餐份数
            </Text>
            <View style={styles.qtyControls}>
              <Button
                mode="outlined"
                onPress={() => setLunchQty(Math.max(0, lunchQty - 1))}
                style={styles.qtyBtn}
                compact
              >
                −
              </Button>
              <Text variant="titleMedium" style={styles.qtyValue}>
                {lunchQty}
              </Text>
              <Button
                mode="outlined"
                onPress={() => setLunchQty(lunchQty + 1)}
                style={styles.qtyBtn}
                compact
              >
                ＋
              </Button>
            </View>
          </View>

          {/* 晚餐份数 */}
          <View style={styles.qtyRow}>
            <Text variant="bodyLarge" style={styles.qtyLabel}>
              晚餐份数
            </Text>
            <View style={styles.qtyControls}>
              <Button
                mode="outlined"
                onPress={() => setDinnerQty(Math.max(0, dinnerQty - 1))}
                style={styles.qtyBtn}
                compact
              >
                −
              </Button>
              <Text variant="titleMedium" style={styles.qtyValue}>
                {dinnerQty}
              </Text>
              <Button
                mode="outlined"
                onPress={() => setDinnerQty(dinnerQty + 1)}
                style={styles.qtyBtn}
                compact
              >
                ＋
              </Button>
            </View>
          </View>

          {/* 备注 */}
          <TextInput
            label="备注（可选，本次临时要求）"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={2}
          />

          <View style={styles.giftRow}>
            <Text variant="bodyLarge">赠送餐（不扣次）</Text>
            <Switch value={isGift} onValueChange={setIsGift} disabled={submitting} />
          </View>

          <View style={styles.giftRow}>
            <Text variant="bodyLarge">员工餐</Text>
            <Switch value={isStaffMeal} onValueChange={setIsStaffMeal} disabled={submitting} />
          </View>

          <OrderProofSection images={proofImages} onChange={setProofImages} disabled={submitting} />

          <Divider style={styles.divider} />

          {/* 操作按钮 */}
          <View style={styles.actions}>
            <Button mode="outlined" onPress={handleDismiss} style={styles.actionBtn}>
              取消
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={
                submitting ||
                !selectedMember ||
                lunchQty + dinnerQty === 0 ||
                proofImages.length < 1
              }
              style={styles.actionBtn}
            >
              {submitting ? (
                <ActivityIndicator size={16} color="white" />
              ) : (
                `确认录入${isStaffMeal ? '（员工餐）' : ''}`
              )}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 16,
    borderRadius: 12,
    padding: 20,
    maxHeight: '90%',
  },
  title: {
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    maxHeight: 200,
  },
  dropdownItem: {
    justifyContent: 'flex-start',
  },
  dropdownItemContent: {
    justifyContent: 'flex-start',
  },
  memberChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  qtyLabel: {
    flex: 1,
    fontWeight: '500',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    borderRadius: 8,
    minWidth: 40,
  },
  qtyValue: {
    minWidth: 32,
    textAlign: 'center',
    fontWeight: '700',
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    borderRadius: 10,
  },
});
