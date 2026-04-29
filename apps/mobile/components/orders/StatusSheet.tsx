import { Modal, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';
import { type MockOrder } from '../../constants/mockData';
import { STATUS_MAP } from './constants';
import { statusSheetStyles as sStyles } from './statusSheetStyles';

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
}) {
  const isAdhoc = order.card_type === null;
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
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={sStyles.overlay} onPress={onClose} />
      <View style={sStyles.sheet}>
        <View style={sStyles.sheetCard}>
          <View style={sStyles.handle} />

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
                </Text>
              </View>
            </View>
            <View style={[sStyles.curStatusBadge, { backgroundColor: cur.bg }]}>
              <Text style={[sStyles.curStatusText, { color: cur.color }]}>{cur.label}</Text>
            </View>
          </View>

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

          <Pressable style={sStyles.closeBtn} onPress={onClose}>
            <Text style={sStyles.closeBtnText}>关闭</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
