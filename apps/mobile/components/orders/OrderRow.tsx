import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';
import { type MockMember, type MockOrder } from '../../constants/mockData';
import { STATUS_MAP } from './constants';
import { orderScreenStyles as styles } from './orderScreenStyles';

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
          <Text style={styles.orderName}>{order.member_nickname || order.member_name}</Text>
          {order.is_hospital && (
            <View style={styles.hospitalBadge}>
              <Text style={styles.hospitalText}>院内</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
            <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
          </View>
          {deliveryFailed ? (
            <View style={styles.deliveryFailedBadge}>
              <Text style={styles.deliveryFailedText}>送餐失败</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.orderMeta}>
          {order.is_gift ? (
            <Text style={styles.giftTag}>赠送餐</Text>
          ) : isWalkinAdhoc ? (
            <Text style={styles.adhocTag}>散餐 ¥{order.amount}</Text>
          ) : (
            <>
              <Text style={styles.cardTag}>{order.card_type}</Text>
              {typeof remainingMeals === 'number' ? (
                <Text style={styles.remainingTag}>剩 {remainingMeals} 份</Text>
              ) : (
                <Text style={styles.noCardTag}>无有效卡</Text>
              )}
            </>
          )}
          <Text style={styles.orderQty}>{order.quantity} 份</Text>
          {(order.proof_images?.length ?? 0) > 0 ? (
            <View style={styles.proofPill} accessibilityLabel={`订餐凭证 ${order.proof_images!.length} 张`}>
              <Ionicons name="images-outline" size={12} color={IOS_COLORS.blue} />
              <Text style={styles.proofPillText}>{order.proof_images!.length}</Text>
            </View>
          ) : null}
        </View>

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
