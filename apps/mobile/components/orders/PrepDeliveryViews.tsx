import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';
import { type MockMember, type MockOrder } from '../../constants/mockData';
import { prepDeliveryStyles as prepStyles } from './prepDeliveryStyles';

export function PrepView({
  orders,
  onMarkFulfilled,
  onOpenDetail,
  onShowMember,
}: {
  orders: MockOrder[];
  onMarkFulfilled: (order: MockOrder) => void;
  onOpenDetail: (o: MockOrder) => void;
  onShowMember: (memberId: number) => void;
}) {
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const lunch = pendingOrders.filter((o) => o.meal_type === 'lunch');
  const dinner = pendingOrders.filter((o) => o.meal_type === 'dinner');
  const totalLunch = lunch.reduce((s, o) => s + o.quantity, 0);
  const totalDinner = dinner.reduce((s, o) => s + o.quantity, 0);

  return (
    <ScrollView contentContainerStyle={prepStyles.scroll}>
      <View style={prepStyles.summary}>
        <View style={[prepStyles.summaryTile, { backgroundColor: IOS_COLORS.blueLight }]}>
          <Text style={prepStyles.summaryLabel}>待出午餐</Text>
          <Text style={[prepStyles.summaryValue, { color: IOS_COLORS.blue }]}>
            {totalLunch}
            <Text style={prepStyles.summaryUnit}> 份</Text>
          </Text>
          <Text style={prepStyles.summarySub}>{lunch.length} 位客户</Text>
        </View>
        <View style={[prepStyles.summaryTile, { backgroundColor: '#F5E9FC' }]}>
          <Text style={prepStyles.summaryLabel}>待出晚餐</Text>
          <Text style={[prepStyles.summaryValue, { color: '#AF52DE' }]}>
            {totalDinner}
            <Text style={prepStyles.summaryUnit}> 份</Text>
          </Text>
          <Text style={prepStyles.summarySub}>{dinner.length} 位客户</Text>
        </View>
      </View>

      {lunch.length > 0 && (
        <View style={prepStyles.mealBlock}>
          <View style={prepStyles.mealHeader}>
            <Text style={prepStyles.mealTitle}>午餐 · 优先出餐</Text>
            <Text style={prepStyles.mealCount}>{totalLunch} 份</Text>
          </View>
          {lunch.map((o) => (
            <PrepCard
              key={o.id}
              order={o}
              onConfirm={() => onMarkFulfilled(o)}
              onOpen={() => onOpenDetail(o)}
              onShowMember={onShowMember}
            />
          ))}
        </View>
      )}

      {dinner.length > 0 && (
        <View style={prepStyles.mealBlock}>
          <View style={prepStyles.mealHeader}>
            <Text style={prepStyles.mealTitle}>晚餐</Text>
            <Text style={prepStyles.mealCount}>{totalDinner} 份</Text>
          </View>
          {dinner.map((o) => (
            <PrepCard
              key={o.id}
              order={o}
              onConfirm={() => onMarkFulfilled(o)}
              onOpen={() => onOpenDetail(o)}
              onShowMember={onShowMember}
            />
          ))}
        </View>
      )}

      {pendingOrders.length === 0 && (
        <View style={prepStyles.empty}>
          <Ionicons name="checkmark-circle" size={48} color="#34C759" />
          <Text style={prepStyles.emptyTitle}>所有订单已出餐</Text>
          <Text style={prepStyles.emptySub}>请去「送餐」页面检查配送</Text>
        </View>
      )}
    </ScrollView>
  );
}

function PrepCard({
  order,
  onConfirm,
  onOpen,
  onShowMember,
}: {
  order: MockOrder;
  onConfirm: () => void;
  onOpen: () => void;
  onShowMember: (memberId: number) => void;
}) {
  const isAdhoc = order.card_type === null;
  const isLunch = order.meal_type === 'lunch';
  const hasNotes = !!order.dietary_notes || !!order.notes;
  return (
    <View style={prepStyles.card}>
      <Pressable style={prepStyles.cardBody} onPress={onOpen}>
        <View
          style={[
            prepStyles.cardAvatarLg,
            { backgroundColor: order.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' },
          ]}
        >
          <Text style={prepStyles.cardAvatarTextLg}>
            {(order.member_nickname || order.member_name)[0]}
          </Text>
        </View>
        <View style={prepStyles.cardContent}>
          <View style={prepStyles.cardTop}>
            <Pressable onPress={() => onShowMember(order.member_id)} style={prepStyles.nameLink} hitSlop={6}>
              <Text style={[prepStyles.cardName, prepStyles.cardNameLink]} numberOfLines={1}>
                {order.member_nickname || order.member_name}
              </Text>
              <Ionicons name="information-circle-outline" size={16} color={IOS_COLORS.blue} />
            </Pressable>
            {order.is_hospital ? (
              <View style={prepStyles.tag}>
                <Text style={prepStyles.tagText}>院内</Text>
              </View>
            ) : null}
            {isAdhoc ? (
              <View style={[prepStyles.tag, { backgroundColor: '#FFF4E5' }]}>
                <Text style={[prepStyles.tagText, { color: '#FF9500' }]}>散餐</Text>
              </View>
            ) : null}
            {order.is_staff_meal ? (
              <View style={[prepStyles.tag, { backgroundColor: '#E8F4FC' }]}>
                <Text style={[prepStyles.tagText, { color: '#007AFF' }]}>员工餐</Text>
              </View>
            ) : null}
          </View>
          <View style={prepStyles.metaRow}>
            <View
              style={[
                prepStyles.mealTypePill,
                isLunch ? prepStyles.mealTypePillLunch : prepStyles.mealTypePillDinner,
              ]}
            >
              <Text
                style={[
                  prepStyles.mealTypePillText,
                  isLunch ? prepStyles.mealTypePillTextLunch : prepStyles.mealTypePillTextDinner,
                ]}
              >
                {isLunch ? '午餐' : '晚餐'}
              </Text>
            </View>
            <View style={prepStyles.qtyPill}>
              <Text style={prepStyles.qtyPillText}>{order.quantity} 份</Text>
            </View>
            <Text style={prepStyles.cardMeta}>{isAdhoc ? `散餐 ¥${order.amount}` : order.card_type}</Text>
          </View>
          {hasNotes ? (
            <View style={prepStyles.noteBox}>
              {order.dietary_notes ? (
                <Text style={prepStyles.noteText}>
                  <Text style={prepStyles.noteLabel}>个人忌口：</Text>
                  {order.dietary_notes}
                </Text>
              ) : null}
              {order.notes ? (
                <Text style={prepStyles.noteText}>
                  <Text style={prepStyles.noteLabel}>订单备注：</Text>
                  {order.notes}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [prepStyles.sideConfirm, pressed && { opacity: 0.85 }]}
        onPress={onConfirm}
      >
        <Ionicons name="checkmark" size={20} color="#fff" />
        <Text style={prepStyles.sideConfirmText} numberOfLines={1}>
          出餐完成
        </Text>
      </Pressable>
    </View>
  );
}

export function DeliveryView({
  orders,
  membersById,
  onMarkDelivered,
  onMarkDeliveryFailed,
  onOpenDetail,
  onShowMember,
  channel = 'self',
}: {
  orders: MockOrder[];
  membersById: Record<number, MockMember>;
  onMarkDelivered: (order: MockOrder) => void;
  onMarkDeliveryFailed: (order: MockOrder) => void;
  onOpenDetail: (o: MockOrder) => void;
  onShowMember: (memberId: number) => void;
  channel?: 'self' | 'courier';
}) {
  const fulfilled = orders.filter(
    (o) => o.status === 'fulfilled' && (o.delivery_channel ?? 'self') === channel,
  );
  const lunch = fulfilled.filter((o) => o.meal_type === 'lunch');
  const dinner = fulfilled.filter((o) => o.meal_type === 'dinner');
  const hospitalCount = fulfilled.filter((o) => o.is_hospital).length;
  const outsideCount = fulfilled.filter((o) => !o.is_hospital).length;

  return (
    <ScrollView contentContainerStyle={prepStyles.scroll}>
      <View style={prepStyles.summary}>
        <View style={[prepStyles.summaryTile, { backgroundColor: IOS_COLORS.blueLight }]}>
          <Text style={prepStyles.summaryLabel}>院内配送</Text>
          <Text style={[prepStyles.summaryValue, { color: IOS_COLORS.blue }]}>
            {hospitalCount}
            <Text style={prepStyles.summaryUnit}> 单</Text>
          </Text>
          <Text style={prepStyles.summarySub}>门诊 / 病区</Text>
        </View>
        <View style={[prepStyles.summaryTile, { backgroundColor: '#E8F8ED' }]}>
          <Text style={prepStyles.summaryLabel}>院外配送</Text>
          <Text style={[prepStyles.summaryValue, { color: '#34C759' }]}>
            {outsideCount}
            <Text style={prepStyles.summaryUnit}> 单</Text>
          </Text>
          <Text style={prepStyles.summarySub}>家庭地址</Text>
        </View>
      </View>

      {lunch.length > 0 && (
        <View style={prepStyles.mealBlock}>
          <View style={prepStyles.mealHeader}>
            <Text style={prepStyles.mealTitle}>午餐 · 待送达</Text>
            <Text style={prepStyles.mealCount}>{lunch.length} 单</Text>
          </View>
          {lunch.map((o) => (
            <DeliveryCard
              key={o.id}
              order={o}
              member={membersById[o.member_id]}
              onConfirm={() => onMarkDelivered(o)}
              onMarkDeliveryFailed={() => onMarkDeliveryFailed(o)}
              onOpen={() => onOpenDetail(o)}
              onShowMember={onShowMember}
            />
          ))}
        </View>
      )}

      {dinner.length > 0 && (
        <View style={prepStyles.mealBlock}>
          <View style={prepStyles.mealHeader}>
            <Text style={prepStyles.mealTitle}>晚餐 · 待送达</Text>
            <Text style={prepStyles.mealCount}>{dinner.length} 单</Text>
          </View>
          {dinner.map((o) => (
            <DeliveryCard
              key={o.id}
              order={o}
              member={membersById[o.member_id]}
              onConfirm={() => onMarkDelivered(o)}
              onMarkDeliveryFailed={() => onMarkDeliveryFailed(o)}
              onOpen={() => onOpenDetail(o)}
              onShowMember={onShowMember}
            />
          ))}
        </View>
      )}

      {fulfilled.length === 0 && (
        <View style={prepStyles.empty}>
          <Ionicons
            name={channel === 'courier' ? 'cube-outline' : 'bicycle-outline'}
            size={48}
            color={IOS_COLORS.labelTertiary}
          />
          <Text style={prepStyles.emptyTitle}>
            {channel === 'courier' ? '当前没有交给快递的订单' : '当前没有待送达订单'}
          </Text>
          <Text style={prepStyles.emptySub}>
            {channel === 'courier'
              ? '在录单时把配送方式选「快递」，这里就会显示相应的单'
              : '请去「出餐」页面先打包出餐'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function DeliveryCard({
  order,
  member,
  onConfirm,
  onMarkDeliveryFailed,
  onOpen,
  onShowMember,
}: {
  order: MockOrder;
  member?: MockMember;
  onConfirm: () => void;
  onMarkDeliveryFailed: () => void;
  onOpen: () => void;
  onShowMember: (memberId: number) => void;
}) {
  const isWalkin = !!order.customer_name;
  const phone = member?.phone?.trim() || (isWalkin ? '' : '');
  const address =
    member?.address?.trim() ||
    (order.is_hospital ? '院内（门诊 / 病区）' : isWalkin ? '散客自取' : '未填写地址');

  return (
    <View style={prepStyles.card}>
      <Pressable style={prepStyles.cardBody} onPress={onOpen}>
        <View
          style={[
            prepStyles.cardAvatarLg,
            { backgroundColor: order.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' },
          ]}
        >
          <Text style={prepStyles.cardAvatarTextLg}>
            {(order.member_nickname || order.member_name)[0]}
          </Text>
        </View>
        <View style={prepStyles.cardContent}>
          <View style={prepStyles.cardTop}>
            <Pressable onPress={() => onShowMember(order.member_id)} style={prepStyles.nameLink} hitSlop={6}>
              <Text style={[prepStyles.cardName, prepStyles.cardNameLink]} numberOfLines={1}>
                {order.member_nickname || order.member_name}
              </Text>
              <Ionicons name="information-circle-outline" size={16} color={IOS_COLORS.blue} />
            </Pressable>
            {order.is_hospital ? (
              <View style={prepStyles.tag}>
                <Text style={prepStyles.tagText}>院内</Text>
              </View>
            ) : (
              <View style={[prepStyles.tag, { backgroundColor: '#E8F8ED' }]}>
                <Text style={[prepStyles.tagText, { color: '#34C759' }]}>院外</Text>
              </View>
            )}
            {isWalkin ? (
              <View style={[prepStyles.tag, { backgroundColor: '#FFF4E5' }]}>
                <Text style={[prepStyles.tagText, { color: '#FF9500' }]}>散客</Text>
              </View>
            ) : null}
            {order.delivery_channel === 'courier' ? (
              <View style={[prepStyles.tag, { backgroundColor: '#F5E9FC' }]}>
                <Text style={[prepStyles.tagText, { color: '#AF52DE' }]}>
                  快递{order.courier_ref ? ` · ${order.courier_ref}` : ''}
                </Text>
              </View>
            ) : null}
            {order.is_staff_meal ? (
              <View style={[prepStyles.tag, { backgroundColor: '#E8F4FC' }]}>
                <Text style={[prepStyles.tagText, { color: '#007AFF' }]}>员工餐</Text>
              </View>
            ) : null}
          </View>

          <View style={prepStyles.infoRow}>
            <Ionicons name="call-outline" size={14} color={IOS_COLORS.labelSecondary} />
            <Text style={[prepStyles.infoText, !phone && prepStyles.infoTextMuted]} numberOfLines={1}>
              {phone || '未填手机号'}
            </Text>
          </View>

          <View style={prepStyles.infoRow}>
            <Ionicons name="location-outline" size={14} color={IOS_COLORS.labelSecondary} />
            <Text style={prepStyles.infoText} numberOfLines={2}>
              {address}
            </Text>
          </View>

          <Text style={prepStyles.cardMetaDim}>
            {order.meal_type === 'lunch' ? '午餐' : '晚餐'} · {order.quantity} 份
          </Text>

          {order.dietary_notes || order.notes ? (
            <View style={prepStyles.noteBox}>
              {order.dietary_notes ? (
                <Text style={prepStyles.noteText}>
                  <Text style={prepStyles.noteLabel}>个人忌口：</Text>
                  {order.dietary_notes}
                </Text>
              ) : null}
              {order.notes ? (
                <Text style={prepStyles.noteText}>
                  <Text style={prepStyles.noteLabel}>订单备注：</Text>
                  {order.notes}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [prepStyles.deliveryFailedBtn, pressed && { opacity: 0.8 }]}
            onPress={onMarkDeliveryFailed}
          >
            <Ionicons name="alert-circle-outline" size={14} color={IOS_COLORS.red} />
            <Text style={prepStyles.deliveryFailedBtnText}>送餐失败并退餐</Text>
          </Pressable>
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          prepStyles.sideConfirm,
          { backgroundColor: '#34C759' },
          pressed && { opacity: 0.85 },
        ]}
        onPress={onConfirm}
      >
        <Ionicons name="checkmark-done" size={20} color="#fff" />
        <Text style={prepStyles.sideConfirmText} numberOfLines={1}>
          确认送达
        </Text>
      </Pressable>
    </View>
  );
}
