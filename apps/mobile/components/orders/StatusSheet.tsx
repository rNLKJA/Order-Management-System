import { useState } from 'react';
import { Modal, View, Text, Pressable, Image, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDateTimeWithSeconds } from '@meal/shared';
import { IOS_COLORS } from '../../theme/paperTheme';
import { type MockOrder } from '../../constants/mockData';
import { isPrintSupported } from '../../lib/print';
import { STATUS_MAP } from './constants';
import { statusSheetStyles as sStyles } from './statusSheetStyles';

function coerceCreatedAtInput(v: string | number | bigint | undefined): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'bigint') {
    const ms = Number(v);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = v > 0 && v < 1e12 ? v * 1000 : v;
    return new Date(ms).toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    const ms = n < 1e12 ? n * 1000 : n;
    return new Date(ms).toISOString();
  }
  return s;
}

function formatRecordedAt(order: MockOrder): string | null {
  const raw = coerceCreatedAtInput(order.created_at);
  if (!raw) return null;
  try {
    return formatDateTimeWithSeconds(raw);
  } catch {
    return null;
  }
}

function formatRecorderLabel(order: MockOrder): string | null {
  const fn = order.created_by_full_name?.trim();
  const un = order.created_by_username?.trim();
  if (fn && un) return `${fn}（${un}）`;
  if (fn) return fn;
  if (un) return un;
  const uid = order.created_by_user_id;
  if (uid != null && uid > 0) return `用户 #${uid}`;
  return null;
}

const STATUS_FLOW = [
  { key: 'pending' as const, label: '待出餐', color: IOS_COLORS.orange, bg: '#FFF4E5', icon: 'time-outline' as const },
  {
    key: 'fulfilled' as const,
    label: '已出餐',
    color: IOS_COLORS.blue,
    bg: IOS_COLORS.blueLight,
    icon: 'checkmark-circle-outline' as const,
  },
  { key: 'delivered' as const, label: '已送达', color: '#34C759', bg: '#E8F8ED', icon: 'checkmark-done-outline' as const },
  {
    key: 'cancelled' as const,
    label: '已取消',
    color: IOS_COLORS.labelSecondary,
    bg: IOS_COLORS.fillLight,
    icon: 'close-circle-outline' as const,
  },
];

export function StatusSheet({
  order,
  isAdmin = false,
  onClose,
  onUpdate,
  onMarkFulfilled,
  onMarkDelivered,
  onMarkDeliveryFailed,
  onOpenProfile,
  onPrintLabel,
}: {
  order: MockOrder;
  /** 已送达订单按送餐失败退餐仅管理员可用（与后端 403 一致） */
  isAdmin?: boolean;
  onClose: () => void;
  onUpdate: (id: number, status: MockOrder['status']) => void;
  onMarkFulfilled: (o: MockOrder) => void;
  onMarkDelivered: (o: MockOrder) => void;
  onMarkDeliveryFailed: (o: MockOrder) => void;
  onOpenProfile: (o: MockOrder) => void;
  onPrintLabel?: (o: MockOrder) => void;
}) {
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const proofUris = order.proof_images ?? [];
  const isAdhoc = order.card_type === null;
  const recorderLine = formatRecorderLabel(order);
  const recordedAtLine = formatRecordedAt(order);
  const showEntryMeta = Boolean(
    recorderLine || recordedAtLine || (order.created_by_user_id != null && order.created_by_user_id > 0),
  );
  const sheetScrollMaxH = Math.round(Dimensions.get('window').height * 0.7);
  const cur = STATUS_MAP[order.status];
  const deliveredLockedForStaff = order.status === 'delivered' && !isAdmin;
  const showDeliveredAdminCorrect = order.status === 'delivered' && isAdmin;
  const ALLOWED: Record<MockOrder['status'], MockOrder['status'][]> = {
    pending: ['fulfilled', 'cancelled'],
    fulfilled: ['pending', 'delivered'],
    delivered: [],
    cancelled: [],
  };
  const allowedNext = new Set(ALLOWED[order.status]);
  const statusFlow = STATUS_FLOW.map((s) => {
    if (order.status === 'fulfilled' && s.key === 'cancelled') {
      return {
        ...s,
        label: '送餐失败并退餐',
        color: IOS_COLORS.red,
        bg: '#FDECEC',
        icon: 'alert-circle-outline' as const,
      };
    }
    return s;
  });

  return (
    <>
      <Modal visible animationType="slide" transparent onRequestClose={onClose}>
        <Pressable style={sStyles.overlay} onPress={onClose} />
        <View style={sStyles.sheet}>
          <View style={sStyles.sheetCard}>
            <View style={sStyles.handle} />

            <ScrollView
              style={{ maxHeight: sheetScrollMaxH }}
              contentContainerStyle={{ paddingBottom: 6 }}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
            <View style={sStyles.orderInfo}>
            <View style={sStyles.orderInfoLeft}>
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenProfile(order);
                }}
                style={({ pressed }) => [sStyles.orderAvatarPress, pressed && { opacity: 0.75 }]}
                hitSlop={8}
              >
                <View
                  style={[
                    sStyles.orderAvatar,
                    { backgroundColor: order.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' },
                  ]}
                >
                  <Text style={sStyles.orderAvatarText}>
                    {(order.member_nickname || order.member_name)[0]}
                  </Text>
                </View>
                <Ionicons
                  name="open-outline"
                  size={12}
                  color={IOS_COLORS.blue}
                  style={sStyles.orderAvatarLink}
                />
              </Pressable>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={sStyles.orderName}>{order.member_nickname || order.member_name}</Text>
                <Text style={sStyles.orderSub}>
                  {order.meal_type === 'lunch' ? '午餐' : '晚餐'} · {order.quantity} 份
                  {' · '}
                  {isAdhoc ? `散餐 ¥${order.amount}` : order.card_type}
                  {order.is_hospital ? ' · 院内' : ''}
                  {order.is_gift ? ' · 赠送餐' : ''}
                  {order.is_staff_meal ? ' · 员工餐' : ''}
                </Text>
              </View>
            </View>
            <View style={[sStyles.curStatusBadge, { backgroundColor: cur.bg }]}>
              <Text style={[sStyles.curStatusText, { color: cur.color }]}>{cur.label}</Text>
            </View>
          </View>

          {proofUris.length > 0 ? (
            <View style={sStyles.proofBlock}>
              <Text style={sStyles.proofBlockTitle}>订餐凭证 · {proofUris.length} 张</Text>
              <Text style={sStyles.proofBlockHint}>点缩略图可放大查看</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={sStyles.proofStrip}
              >
                {proofUris.map((uri, i) => (
                  <Pressable
                    key={`${i}-${uri.slice(0, 24)}`}
                    onPress={() => setLightboxUri(uri)}
                    style={({ pressed }) => [sStyles.proofThumbWrap, pressed && { opacity: 0.85 }]}
                  >
                    <Image source={{ uri }} style={sStyles.proofThumb} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {order.dietary_notes || order.notes || order.cancel_reason ? (
            <View style={sStyles.notesRow}>
              {order.dietary_notes ? (
                <Text style={sStyles.notesText}>
                  <Text style={sStyles.notesLabel}>个人忌口：</Text>
                  {order.dietary_notes}
                </Text>
              ) : null}
              {order.notes ? (
                <Text style={sStyles.notesText}>
                  <Text style={sStyles.notesLabel}>订单备注：</Text>
                  {order.notes}
                </Text>
              ) : null}
              {order.cancel_reason ? (
                <Text style={sStyles.notesText}>
                  <Text style={sStyles.notesLabel}>取消原因：</Text>
                  {order.cancel_reason}
                </Text>
              ) : null}
            </View>
          ) : null}

          {showEntryMeta ? (
            <View style={sStyles.metaBlock}>
              <Text style={sStyles.metaTitle}>录入信息</Text>
              <Text style={sStyles.metaWho}>
                录入人：
                {recorderLine ?? '—'}
              </Text>
              {recordedAtLine ? (
                <Text style={sStyles.metaWhen}>录入时间：{recordedAtLine}</Text>
              ) : (
                <Text style={sStyles.metaWhen}>录入时间：—</Text>
              )}
            </View>
          ) : null}

          {isPrintSupported() && onPrintLabel && order.status !== 'cancelled' ? (
            <Pressable
              style={({ pressed }) => [
                sStyles.statusBtn,
                {
                  backgroundColor: IOS_COLORS.blueLight,
                  borderColor: IOS_COLORS.blue,
                  borderWidth: 1,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => {
                onClose();
                onPrintLabel(order);
              }}
            >
              <Ionicons name="print-outline" size={20} color={IOS_COLORS.blue} />
              <Text style={[sStyles.statusBtnLabel, { color: IOS_COLORS.blue }]}>补打餐盒标签</Text>
            </Pressable>
          ) : null}

          <Text style={sStyles.sectionLabel}>
            {order.status === 'cancelled'
              ? '订单已取消，状态不可变更'
              : showDeliveredAdminCorrect
                ? '本单已送达。若实际未送达或误点「已送达」，管理员可按送餐失败退餐并恢复餐数。'
                : deliveredLockedForStaff
                  ? '订单已送达，状态已锁定。如需按送餐失败退餐，请联系管理员。'
                  : '更新出餐状态'}
          </Text>

          {showDeliveredAdminCorrect ? (
            <Pressable
              style={({ pressed }) => [
                sStyles.statusBtn,
                {
                  backgroundColor: '#FDECEC',
                  borderColor: IOS_COLORS.red,
                  borderWidth: 1,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => {
                onClose();
                onMarkDeliveryFailed(order);
              }}
            >
              <Ionicons name="alert-circle-outline" size={20} color={IOS_COLORS.red} />
              <Text style={[sStyles.statusBtnLabel, { color: IOS_COLORS.red }]}>
                送餐失败并退餐（纠正误送达）
              </Text>
            </Pressable>
          ) : null}

          <View style={sStyles.statusGrid}>
            {statusFlow.map((s) => {
              const isCurrent = order.status === s.key;
              const isDeliveryFailedAction = order.status === 'fulfilled' && s.key === 'cancelled';
              const isAllowed = isDeliveryFailedAction || allowedNext.has(s.key);
              const disabled = isCurrent || !isAllowed;
              return (
                <Pressable
                  key={s.key}
                  disabled={disabled}
                  style={({ pressed }) => [
                    sStyles.statusBtn,
                    { backgroundColor: s.bg, borderColor: isCurrent ? s.color : 'transparent' },
                    isCurrent && sStyles.statusBtnCurrent,
                    disabled && !isCurrent && { opacity: 0.35 },
                    !disabled && pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => {
                    if (order.status === 'fulfilled' && s.key === 'cancelled') {
                      onClose();
                      onMarkDeliveryFailed(order);
                    } else if (s.key === 'delivered') {
                      onClose();
                      onMarkDelivered(order);
                    } else if (s.key === 'fulfilled' && order.status === 'pending') {
                      onClose();
                      onMarkFulfilled(order);
                    } else {
                      onUpdate(order.id, s.key);
                    }
                  }}
                >
                  <Ionicons name={s.icon} size={20} color={s.color} style={sStyles.statusBtnIcon} />
                  <Text style={[sStyles.statusBtnLabel, { color: s.color }]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>

            </ScrollView>

          <Pressable style={sStyles.closeBtn} onPress={onClose}>
            <Text style={sStyles.closeBtnText}>关闭</Text>
          </Pressable>
        </View>
      </View>
      </Modal>

      <Modal
        visible={lightboxUri != null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUri(null)}
      >
        <Pressable style={sStyles.lightboxBackdrop} onPress={() => setLightboxUri(null)}>
          {lightboxUri ? (
            <Image
              source={{ uri: lightboxUri }}
              style={sStyles.lightboxImage}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
