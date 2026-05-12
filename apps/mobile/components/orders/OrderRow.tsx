import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';
import { type MockMember, type MockOrder } from '../../constants/mockData';
import { STATUS_MAP } from './constants';
import { orderScreenStyles as styles } from './orderScreenStyles';

/** 元信息拆成「份数前 / 份数后」，便于单独高亮本单点了多少份 */
function buildOverviewMetaAroundQty(
  order: MockOrder,
  opts: { isWalkinAdhoc: boolean; deliveryFailed: boolean; remainingMeals: number | undefined },
): { before: string; after: string } {
  const before: string[] = [];
  if (order.is_hospital) before.push('院内');
  if (order.is_gift) {
    before.push('赠送餐');
  } else if (opts.isWalkinAdhoc) {
    before.push(`散餐 ¥${order.amount}`);
  } else {
    if (order.card_type) before.push(order.card_type);
    if (typeof opts.remainingMeals === 'number') before.push(`剩 ${opts.remainingMeals} 份`);
    else before.push('无有效卡');
  }
  if (order.is_staff_meal) before.push('员工餐');

  const after: string[] = [];
  const nProof = order.proof_images?.length ?? 0;
  if (nProof > 0) after.push(`凭证 ${nProof} 张`);
  if (opts.deliveryFailed) after.push('送餐失败');

  return { before: before.join(' · '), after: after.join(' · ') };
}

export function OrderRow({
  order,
  member,
  isLast,
  onPress,
}: {
  order: MockOrder;
  member?: MockMember;
  isLast: boolean;
  onPress: () => void;
}) {
  const s = STATUS_MAP[order.status];
  const isWalkinAdhoc = order.card_type === null && !!order.customer_name;
  const deliveryFailed = order.status === 'cancelled' && (order.cancel_reason ?? '').startsWith('配送失败');
  const remainingMeals = member?.active_card?.remaining_meals;
  const metaAround = buildOverviewMetaAroundQty(order, {
    isWalkinAdhoc,
    deliveryFailed,
    remainingMeals,
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.orderRow,
        isLast && styles.orderRowLast,
        pressed && { backgroundColor: IOS_COLORS.fillLight },
      ]}
    >
      <View style={[styles.orderAvatar, { backgroundColor: order.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
        <Text style={styles.orderAvatarText}>{(order.member_nickname || order.member_name)[0]}</Text>
      </View>

      <View style={styles.orderContent}>
        <View style={styles.orderTop}>
          <Text style={styles.orderName} numberOfLines={1} ellipsizeMode="tail">
            {order.member_nickname || order.member_name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
            <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
          </View>
        </View>

        <Text style={styles.orderMetaLine} numberOfLines={3}>
          {metaAround.before ? (
            <Text style={styles.orderMetaLine}>{`${metaAround.before} · `}</Text>
          ) : null}
          <Text style={styles.orderMetaQty}>{order.quantity} 份</Text>
          {metaAround.after ? (
            <Text style={styles.orderMetaLine}>{` · ${metaAround.after}`}</Text>
          ) : null}
        </Text>

        {order.dietary_notes ? (
          <Text style={styles.orderNote}>
            <Text style={styles.orderNoteLabel}>个人忌口：</Text>
            {order.dietary_notes}
          </Text>
        ) : null}
        {order.notes ? (
          <Text style={styles.orderNote}>
            <Text style={styles.orderNoteLabel}>订单备注：</Text>
            {order.notes}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color={IOS_COLORS.labelTertiary} style={styles.rowChevron} />
    </Pressable>
  );
}
