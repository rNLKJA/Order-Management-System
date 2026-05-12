/**
 * 每日订餐 — 今日视图（午/晚分组）
 *
 * 子组件见 components/orders/。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, Pressable, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { formatDate } from '@meal/shared';
import { IOS_COLORS } from '../../../theme/paperTheme';
import { type MockMember, type MockOrder } from '../../../constants/mockData';
import { ordersApi } from '../../../api/orders';
import { useOrdersByDate, useOrdersToday, useInvalidateOrders } from '../../../hooks/useOrdersToday';
import { useMembersView, useInvalidateMembersView } from '../../../hooks/useMembersView';
import { dailyOrderToMockOrder, membersByIdFrom } from '../../../lib/order-view';
import { AppHeader, MeshBackground } from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { MemberQuickInfoModal } from '../../../components/MemberQuickInfoModal';
import { confirmAction, confirmDestructive } from '../../../lib/confirm';
import {
  DELIVERY_FAIL_REASON_OPTIONS,
  LIMIT_OPTIONS,
  type TabKey,
  type PrimaryTab,
  type LimitOption,
} from '../../../components/orders/constants';
import { todayStr, tomorrowStr } from '../../../components/orders/date-utils';
import { orderScreenStyles as styles } from '../../../components/orders/orderScreenStyles';
import { OrderTabBar } from '../../../components/orders/OrderTabBar';
import { SummaryItem } from '../../../components/orders/SummaryItem';
import { OrderRow } from '../../../components/orders/OrderRow';
import { EntryPanel } from '../../../components/orders/EntryPanel';
import { PrepView, DeliveryView } from '../../../components/orders/PrepDeliveryViews';
import { RetailSalesPanel } from '../../../components/orders/RetailSalesPanel';
import { StatusSheet } from '../../../components/orders/StatusSheet';
import { DeliveryFailSheet } from '../../../components/orders/DeliveryFailSheet';
import { createIdempotencyKey } from '../../../lib/idempotencyKey';
import { useAuth } from '../../../hooks/useAuth';
import { useScrollToTopOnFocus } from '../../../hooks/useScrollToTopOnFocus';

export default function OrdersScreen() {
  const sectionRef = useRef<SectionList>(null);
  useScrollToTopOnFocus(sectionRef);

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { group, tab } = useLocalSearchParams<{ group?: string; tab?: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [activePrimary, setActivePrimary] = useState<PrimaryTab>('manage');
  const [displayLimit, setDisplayLimit] = useState<LimitOption>(50);
  const [overviewDate, setOverviewDate] = useState<string>(() => todayStr());
  const [activeOrder, setActiveOrder] = useState<MockOrder | null>(null);
  const [deliveryFailOrder, setDeliveryFailOrder] = useState<MockOrder | null>(null);
  const [deliveryFailReason, setDeliveryFailReason] = useState<string>(DELIVERY_FAIL_REASON_OPTIONS[0]);
  const [deliveryFailExtra, setDeliveryFailExtra] = useState('');
  const [deliveryFailSubmitting, setDeliveryFailSubmitting] = useState(false);
  const [quickInfoMember, setQuickInfoMember] = useState<MockMember | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const todayOrdersQuery = useOrdersToday();
  const overviewOrdersQuery = useOrdersByDate(overviewDate);
  const membersView = useMembersView();
  const invalidateOrders = useInvalidateOrders();
  const invalidateMembers = useInvalidateMembersView();

  const membersById = useMemo(
    () => membersByIdFrom(membersView.data ?? []),
    [membersView.data],
  );

  const ordersToday: MockOrder[] = useMemo(() => {
    const raw = todayOrdersQuery.data ?? [];
    return raw.map((o) => dailyOrderToMockOrder(o, membersById));
  }, [todayOrdersQuery.data, membersById]);
  const overviewOrders: MockOrder[] = useMemo(() => {
    const raw = overviewOrdersQuery.data ?? [];
    return raw.map((o) => dailyOrderToMockOrder(o, membersById));
  }, [overviewOrdersQuery.data, membersById]);

  const lunch = overviewOrders.filter((o) => o.meal_type === 'lunch');
  const dinner = overviewOrders.filter((o) => o.meal_type === 'dinner');
  const lunchVisible = lunch.slice(0, displayLimit);
  const dinnerVisible = dinner.slice(0, displayLimit);
  const allSections = [
    ...(lunchVisible.length  > 0 ? [{ title: '午餐', data: lunchVisible  }] : []),
    ...(dinnerVisible.length > 0 ? [{ title: '晚餐', data: dinnerVisible }] : []),
  ];

  // 统计统一按“待出餐份数”口径，避免与出餐页口径不一致导致漏餐。
  const pendingOrders = overviewOrders.filter((o) => o.status === 'pending');
  const totalLunch = pendingOrders
    .filter((o) => o.meal_type === 'lunch')
    .reduce((s, o) => s + o.quantity, 0);
  const totalDinner = pendingOrders
    .filter((o) => o.meal_type === 'dinner')
    .reduce((s, o) => s + o.quantity, 0);
  const pending = pendingOrders.reduce((s, o) => s + o.quantity, 0);
  const adhocCount = pendingOrders
    .filter((o) => o.card_type === null)
    .reduce((s, o) => s + o.quantity, 0);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const jumpToOrderProfile = useCallback((order: MockOrder) => {
    const isWalkin = !!order.customer_name;
    if (isWalkin) {
      router.push({
        pathname: '/(app)/walkins/[id]',
        params: { id: String(order.member_id) },
      });
      return;
    }
    router.push({
      pathname: '/(app)/members/[id]',
      params: { id: String(order.member_id) },
    });
  }, []);

  const handleAddMemberOrder = useCallback(
    async (payload: {
      memberId: number;
      orderDate: string;
      lunchQty: number;
      dinnerQty: number;
      notes?: string;
      deliveryChannel: 'self' | 'courier';
      courierRef?: string;
      proofImages: string[];
      isGift?: boolean;
    }) => {
      try {
        await ordersApi.create(
          {
            member_id: payload.memberId,
            order_date: payload.orderDate,
            lunch_qty: payload.lunchQty,
            dinner_qty: payload.dinnerQty,
            notes: payload.notes ?? '',
            delivery_channel: payload.deliveryChannel,
            courier_ref: payload.courierRef,
            proof_images: payload.proofImages,
            is_gift: payload.isGift,
          },
          createIdempotencyKey(),
        );
        // 会员卡可能被扣减，会员列表也要失效
        await Promise.all([invalidateOrders(), invalidateMembers(payload.memberId)]);
      } catch (e) {
        flashToast(e instanceof Error ? e.message : '录入失败');
        throw e;
      }
    },
    [invalidateOrders, invalidateMembers, flashToast],
  );

  const handleAddMemberBatchOrder = useCallback(
    async (payload: {
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
    }) => {
      try {
        await ordersApi.batchCreate({
          proof_images: payload.proof_images,
          entries: payload.entries.map((e) => ({
            member_id: e.memberId,
            order_date: e.orderDate,
            lunch_qty: e.lunchQty,
            dinner_qty: e.dinnerQty,
            notes: e.notes ?? '',
            is_gift: e.isGift,
            delivery_channel: e.deliveryChannel,
            courier_ref: e.courierRef,
          })),
        });
        await Promise.all([invalidateOrders(), invalidateMembers()]);
      } catch (e) {
        flashToast(e instanceof Error ? e.message : '批量录入失败');
        throw e;
      }
    },
    [invalidateOrders, invalidateMembers, flashToast],
  );

  const handleAddWalkinOrder = useCallback(
    async (payload: {
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
    }) => {
      try {
        await ordersApi.create(
          {
            order_date: payload.orderDate,
            lunch_qty: payload.lunchQty,
            dinner_qty: payload.dinnerQty,
            notes: payload.notes ?? '',
            customer_name: payload.customerName,
            customer_phone: payload.customerPhone,
            customer_wechat: payload.customerWechat,
            customer_address: payload.customerAddress,
            customer_is_hospital: payload.customerIsHospital,
            adhoc_unit_price: payload.unitPrice,
            delivery_channel: payload.deliveryChannel,
            courier_ref: payload.courierRef,
            proof_images: payload.proofImages,
            is_gift: payload.isGift,
          },
          createIdempotencyKey(),
        );
        // 散客本人的 phone/address 写回了 member 表，会员列表要刷一下
        await Promise.all([invalidateOrders(), invalidateMembers()]);
      } catch (e) {
        flashToast(e instanceof Error ? e.message : '录入失败');
        throw e;
      }
    },
    [invalidateOrders, invalidateMembers, flashToast],
  );

  const handleUpdateStatus = useCallback(
    async (id: number, status: MockOrder['status']) => {
      setActiveOrder(null);
      try {
        if (status === 'cancelled') {
          await ordersApi.cancel(id);
        } else {
          await ordersApi.setStatus(id, status);
        }
        await invalidateOrders();
        // 取消订单会退餐给卡，会员列表也要刷新
        if (status === 'cancelled') await invalidateMembers();
      } catch (e) {
        flashToast(e instanceof Error ? e.message : '更新状态失败');
      }
    },
    [invalidateOrders, invalidateMembers, flashToast],
  );

  /**
   * 出餐：不是终态（可以 fulfilled → pending 回退），但出错会影响厨房节奏，
   * 所以加一道蓝色二次确认，把订单摘要亮出来，避免"点歪了把别家订单当成出餐完成"。
   */
  const handleMarkFulfilled = useCallback(
    (order: MockOrder) => {
      const displayName = order.member_nickname || order.member_name;
      const mealLabel = order.meal_type === 'lunch' ? '午餐' : '晚餐';
      const zone = order.is_hospital ? '院内' : '院外';
      const lines = [
        `${displayName} · ${mealLabel} ${order.quantity} 份 · ${zone}`,
        '确认本单餐品已打包出餐。',
        '出错了可以在订单详情把状态回退到"待出餐"。',
      ].join('\n');
      confirmAction(
        '确认出餐？',
        lines,
        () => void handleUpdateStatus(order.id, 'fulfilled'),
        '已出餐',
      );
    },
    [handleUpdateStatus],
  );

  /**
   * 送达是终态。后端会把 delivered 的订单锁死，UI 层先弹一次二次确认，
   * 让点击必须是"有意识的"动作，避免配送途中误触。
   */
  const handleMarkDelivered = useCallback(
    (order: MockOrder) => {
      const displayName = order.member_nickname || order.member_name;
      const mealLabel = order.meal_type === 'lunch' ? '午餐' : '晚餐';
      const zone = order.is_hospital ? '院内' : '院外';
      const lines = [
        `${displayName} · ${mealLabel} ${order.quantity} 份 · ${zone}`,
        '确认送达后员工端无法再改状态。',
        '若误点「已送达」而实际需退餐，请通知管理员在订单详情中操作「送餐失败并退餐（纠正误送达）」。',
      ].join('\n');
      confirmDestructive(
        '确认送达？',
        lines,
        () => void handleUpdateStatus(order.id, 'delivered'),
        '已送达',
      );
    },
    [handleUpdateStatus],
  );

  const handleOpenDeliveryFailed = useCallback((order: MockOrder) => {
    setActiveOrder(null);
    setDeliveryFailOrder(order);
    setDeliveryFailReason(DELIVERY_FAIL_REASON_OPTIONS[0]);
    setDeliveryFailExtra('');
  }, []);

  const handleSubmitDeliveryFailed = useCallback(async () => {
    if (!deliveryFailOrder || !deliveryFailReason.trim()) return;
    const extra = deliveryFailExtra.trim();
    const reason = extra ? `${deliveryFailReason}；补充：${extra}` : deliveryFailReason;
    setDeliveryFailSubmitting(true);
    try {
      await ordersApi.markDeliveryFailed(deliveryFailOrder.id, reason);
      setDeliveryFailOrder(null);
      setDeliveryFailExtra('');
      await Promise.all([invalidateOrders(), invalidateMembers()]);
      flashToast('已标记送餐失败，餐数已退回');
    } catch (e) {
      flashToast(e instanceof Error ? e.message : '标记送餐失败失败');
    } finally {
      setDeliveryFailSubmitting(false);
    }
  }, [
    deliveryFailOrder,
    deliveryFailReason,
    deliveryFailExtra,
    invalidateOrders,
    invalidateMembers,
    flashToast,
  ]);

  const now = new Date();

  useEffect(() => {
    if (group === 'fulfillment') {
      setActivePrimary('fulfillment');
      setActiveTab('prep');
      return;
    }
    setActivePrimary('manage');
    const t = Array.isArray(tab) ? tab[0] : tab;
    if (t === 'entry') setActiveTab('entry');
    else if (t === 'batch') setActiveTab('entry_batch');
    else if (t === 'gift') setActiveTab('entry_gift');
    else if (t === 'retail') setActiveTab('retail');
    else setActiveTab('overview');
  }, [group, tab]);

  const isEntryTab =
    activeTab === 'entry' || activeTab === 'entry_batch' || activeTab === 'entry_gift';
  const hideOrderLimitRow = isEntryTab || activeTab === 'retail';
  const currentOrdersQuery = activeTab === 'overview' ? overviewOrdersQuery : todayOrdersQuery;
  const currentLoadError = currentOrdersQuery.error;
  const currentLoading = currentOrdersQuery.isLoading && !currentOrdersQuery.data;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <AppHeader
        title={activePrimary === 'manage' ? '每日订餐' : '出餐 / 配送'}
      />

      {/* 当前分组内的功能筛选 */}
      <OrderTabBar
        activePrimary={activePrimary}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <View style={styles.pageMetaRow}>
        <Text style={styles.pageMetaText}>{`今日 ${formatDate(now)}`}</Text>
        {!hideOrderLimitRow ? (
          <View style={styles.limitRowInline}>
            <Text style={styles.limitLabel}>每次加载</Text>
            {LIMIT_OPTIONS.map((n) => (
              <Pressable
                key={n}
                style={[styles.limitChip, displayLimit === n && styles.limitChipActive]}
                onPress={() => setDisplayLimit(n)}
              >
                <Text style={[styles.limitChipText, displayLimit === n && styles.limitChipTextActive]}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* —— 总览 —— */}
      {activeTab === 'overview' && (
        <>
          <View style={styles.overviewDateCard}>
            <View style={styles.overviewDateQuickRow}>
              <Pressable
                style={[
                  styles.overviewDateQuick,
                  overviewDate === todayStr() && styles.overviewDateQuickActive,
                ]}
                onPress={() => setOverviewDate(todayStr())}
              >
                <Text
                  style={[
                    styles.overviewDateQuickText,
                    overviewDate === todayStr() && styles.overviewDateQuickTextActive,
                  ]}
                >
                  今天
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.overviewDateQuick,
                  overviewDate === tomorrowStr() && styles.overviewDateQuickActive,
                ]}
                onPress={() => setOverviewDate(tomorrowStr())}
              >
                <Text
                  style={[
                    styles.overviewDateQuickText,
                    overviewDate === tomorrowStr() && styles.overviewDateQuickTextActive,
                  ]}
                >
                  明天
                </Text>
              </Pressable>
            </View>
            <DatePicker
              value={overviewDate}
              onChange={setOverviewDate}
              label="总览日期"
              labelMinWidth={60}
            />
          </View>

          {/* 今日汇总条 */}
          <View style={styles.summaryBar}>
            <SummaryItem label="午餐"  value={`${totalLunch}份`}  color={IOS_COLORS.blue} />
            <View style={styles.summaryDivider} />
            <SummaryItem label="晚餐"  value={`${totalDinner}份`} color="#AF52DE" />
            <View style={styles.summaryDivider} />
            <SummaryItem label="待出餐" value={`${pending}份`}    color={IOS_COLORS.orange} />
            <View style={styles.summaryDivider} />
            <SummaryItem label="散餐"  value={`${adhocCount}份`}  color="#FF9500" />
          </View>
          <Text style={styles.summaryHint}>口径说明：以上均按待出餐份数统计</Text>

          {/* 订单列表 — 展示当日全部订单，午晚分组 */}
          <SectionList
            ref={sectionRef}
            sections={allSections}
            keyExtractor={(item) => String(item.id)}
            stickySectionHeadersEnabled
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>
                  {section.data.reduce((s, o) => s + o.quantity, 0)} 份
                </Text>
              </View>
            )}
            renderItem={({ item, index, section }) => (
              <OrderRow
                order={item}
                member={membersById[item.member_id]}
                isLast={index === section.data.length - 1}
                onPress={() => setActiveOrder(item)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{`${overviewDate} 暂无订餐记录`}</Text>
                <Pressable onPress={() => setActiveTab('entry')}>
                  <Text style={styles.emptyLink}>+ 点此录入</Text>
                </Pressable>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </>
      )}

      {/* —— 录入 —— */}
      {isEntryTab && (
        <EntryPanel
          key={activeTab}
          memberQuickEntry={
            activeTab === 'entry' ? 'single' : activeTab === 'entry_batch' ? 'batch' : 'gift'
          }
          onAddMemberOrder={handleAddMemberOrder}
          onAddMemberBatchOrder={handleAddMemberBatchOrder}
          onAddWalkinOrder={handleAddWalkinOrder}
          onJumpToOverview={() => setActiveTab('overview')}
        />
      )}

      {activeTab === 'retail' && <RetailSalesPanel />}

      {/* —— 出餐 —— */}
      {activeTab === 'prep' && (
        <PrepView
          orders={ordersToday}
          displayLimit={displayLimit}
          onMarkFulfilled={handleMarkFulfilled}
          onOpenDetail={setActiveOrder}
          onShowMember={(id) => setQuickInfoMember(membersById[id] ?? null)}
        />
      )}

      {/* —— 送餐（员工自送）—— */}
      {activeTab === 'delivery' && (
        <DeliveryView
          orders={ordersToday}
          displayLimit={displayLimit}
          membersById={membersById}
          onMarkDelivered={handleMarkDelivered}
          onMarkDeliveryFailed={handleOpenDeliveryFailed}
          onOpenDetail={setActiveOrder}
          onShowMember={(id) => setQuickInfoMember(membersById[id] ?? null)}
          channel="self"
        />
      )}

      {/* —— 快递（外包配送）—— */}
      {activeTab === 'courier' && (
        <DeliveryView
          orders={ordersToday}
          displayLimit={displayLimit}
          membersById={membersById}
          onMarkDelivered={handleMarkDelivered}
          onMarkDeliveryFailed={handleOpenDeliveryFailed}
          onOpenDetail={setActiveOrder}
          onShowMember={(id) => setQuickInfoMember(membersById[id] ?? null)}
          channel="courier"
        />
      )}

      {/* 会员快速资料 */}
      <MemberQuickInfoModal
        visible={!!quickInfoMember}
        member={quickInfoMember}
        onClose={() => setQuickInfoMember(null)}
      />

      {/* 状态更新弹层 */}
      {activeOrder && (
        <StatusSheet
          order={activeOrder}
          isAdmin={isAdmin}
          onClose={() => setActiveOrder(null)}
          onUpdate={handleUpdateStatus}
          onMarkFulfilled={handleMarkFulfilled}
          onMarkDelivered={handleMarkDelivered}
          onMarkDeliveryFailed={handleOpenDeliveryFailed}
          onOpenProfile={jumpToOrderProfile}
        />
      )}

      <DeliveryFailSheet
        order={deliveryFailOrder}
        reason={deliveryFailReason}
        reasonOptions={DELIVERY_FAIL_REASON_OPTIONS}
        extra={deliveryFailExtra}
        submitting={deliveryFailSubmitting}
        onSelectReason={setDeliveryFailReason}
        onChangeExtra={setDeliveryFailExtra}
        onClose={() => {
          if (deliveryFailSubmitting) return;
          setDeliveryFailOrder(null);
        }}
        onSubmit={() => void handleSubmitDeliveryFailed()}
      />

      {/* 顶部错误 / 加载指示（订单加载失败时挂在 tab bar 下） */}
      {currentLoadError ? (
        <View style={styles.errorToast}>
          <Ionicons name="alert-circle-outline" size={14} color="#fff" />
          <Text style={styles.errorToastText} numberOfLines={1}>
            订单加载失败：{currentLoadError.message}
          </Text>
          <Pressable
            onPress={() => void currentOrdersQuery.refetch()}
            hitSlop={8}
          >
            <Text style={styles.errorToastLink}>重试</Text>
          </Pressable>
        </View>
      ) : currentLoading ? (
        <View style={styles.loadingToast}>
          <ActivityIndicator color={IOS_COLORS.blue} size="small" />
          <Text style={styles.loadingToastText}>加载订单...</Text>
        </View>
      ) : null}

      {/* 全局 mutation 错误提示 */}
      {toast ? (
        <View style={styles.errorToast}>
          <Ionicons name="information-circle-outline" size={14} color="#fff" />
          <Text style={styles.errorToastText}>{toast}</Text>
        </View>
      ) : null}
      </SafeAreaView>
    </View>
  );
}
