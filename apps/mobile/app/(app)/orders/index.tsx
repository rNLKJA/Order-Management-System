/**
 * 每日订餐 — 今日视图（午/晚分组）
 *
 * 数据源：
 *  - 订单：useOrdersToday()（GET /api/orders/today）
 *  - 会员：useMembersView() 用于丰富订单（会员名、是否院内、地址等）
 *
 * Mutation：
 *  - 创建：ordersApi.create（会员餐模式）；录入成功后 invalidate 今日订单缓存
 *  - 状态切换：ordersApi.setStatus（pending/fulfilled/delivered）
 *  - 取消：ordersApi.cancel（cancelled 是终态，走单独路由）
 *
 * TODO（后端未实现）：
 *  - 散客（无会员账户）录单：当前后端 POST /api/orders 要求 member_id > 0；
 *    录入 Tab 的「散餐」子模式仍显示，但提交时会提示未接入。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  Pressable,
  StyleSheet,
  SectionList,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { IOS_COLORS } from '../../../theme/paperTheme';
import { type MockMember, type MockOrder } from '../../../constants/mockData';
import { ordersApi } from '../../../api/orders';
import {
  useOrdersByDate,
  useOrdersToday,
  useInvalidateOrders,
} from '../../../hooks/useOrdersToday';
import {
  useMembersView,
  useInvalidateMembersView,
} from '../../../hooks/useMembersView';
import { dailyOrderToMockOrder, membersByIdFrom } from '../../../lib/order-view';
import { AppHeader, MeshBackground } from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { MemberQuickInfoModal } from '../../../components/MemberQuickInfoModal';
import { confirmAction, confirmDestructive } from '../../../lib/confirm';

const STATUS_MAP = {
  pending:   { label: '待出餐', color: IOS_COLORS.orange,         bg: '#FFF4E5' },
  fulfilled: { label: '已出餐', color: IOS_COLORS.blue,           bg: IOS_COLORS.blueLight },
  delivered: { label: '已送达', color: '#34C759',                  bg: '#E8F8ED' },
  cancelled: { label: '已取消', color: IOS_COLORS.labelSecondary, bg: IOS_COLORS.fillLight },
} as const;

const ADHOC_DEFAULT_PRICE = 35;
const DELIVERY_FAIL_REASON_OPTIONS = [
  '地址信息有误',
  '客户临时取消收餐',
  '联系不上客户',
  '配送超时，餐品不宜送达',
  '配送资源不足',
  '其他',
] as const;

function dateStrWithOffset(offsetDays: number): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  now.setUTCDate(now.getUTCDate() + offsetDays);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr(): string {
  return dateStrWithOffset(0);
}

function tomorrowStr(): string {
  return dateStrWithOffset(1);
}

// ============================================================
// Tabs
// ============================================================
type TabKey = 'entry' | 'overview' | 'prep' | 'delivery' | 'courier';
type PrimaryTab = 'manage' | 'fulfillment';
const LIMIT_OPTIONS = [10, 50, 100, 200] as const;
type LimitOption = (typeof LIMIT_OPTIONS)[number];

const TABS: {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'overview', label: '总览', icon: 'list-outline' },
  { key: 'entry', label: '录入', icon: 'add-circle-outline' },
  { key: 'prep', label: '出餐', icon: 'fast-food-outline' },
  { key: 'delivery', label: '送餐', icon: 'bicycle-outline' },
  { key: 'courier', label: '快递', icon: 'cube-outline' },
];

// ============================================================
// Main screen
// ============================================================
export default function OrdersScreen() {
  const { group } = useLocalSearchParams<{ group?: string }>();
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
    }) => {
      try {
        await ordersApi.create({
          member_id: payload.memberId,
          order_date: payload.orderDate,
          lunch_qty: payload.lunchQty,
          dinner_qty: payload.dinnerQty,
          notes: payload.notes ?? '',
          delivery_channel: payload.deliveryChannel,
          courier_ref: payload.courierRef,
        });
        // 会员卡可能被扣减，会员列表也要失效
        await Promise.all([invalidateOrders(), invalidateMembers(payload.memberId)]);
      } catch (e) {
        flashToast(e instanceof Error ? e.message : '录入失败');
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
    }) => {
      try {
        await ordersApi.create({
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
        });
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
        '确认送达后订单状态将被锁定，无法再回退或修改。',
        '如需纠错只能走「取消」走冲销流程后重新建单。',
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
    setActiveTab('overview');
  }, [group]);

  const currentOrdersQuery = activeTab === 'overview' ? overviewOrdersQuery : todayOrdersQuery;
  const currentLoadError = currentOrdersQuery.error;
  const currentLoading = currentOrdersQuery.isLoading && !currentOrdersQuery.data;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <AppHeader
        title={activePrimary === 'manage' ? '录入 / 总览' : '出餐 / 配送'}
      />

      {/* 当前分组内的功能筛选 */}
      <OrderTabBar
        activePrimary={activePrimary}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <View style={styles.pageMetaRow}>
        <Text style={styles.pageMetaText}>{`今日 ${now.getMonth() + 1}月${now.getDate()}日`}</Text>
        {activeTab !== 'entry' ? (
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
      {activeTab === 'entry' && (
        <EntryPanel
          members={membersView.data ?? []}
          onAddMemberOrder={handleAddMemberOrder}
          onAddWalkinOrder={handleAddWalkinOrder}
          onJumpToOverview={() => setActiveTab('overview')}
        />
      )}

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

// ============================================================
// OrderTabBar — 二级导航
// ============================================================
function OrderTabBar({
  activePrimary,
  activeTab,
  onTabChange,
}: {
  activePrimary: PrimaryTab;
  activeTab: TabKey;
  onTabChange: (t: TabKey) => void;
}) {
  const secondTabs = activePrimary === 'manage'
    ? TABS.filter((t) => t.key === 'overview' || t.key === 'entry')
    : TABS.filter((t) => t.key === 'prep' || t.key === 'delivery' || t.key === 'courier');

  return (
    <View style={styles.tabBar}>
      {secondTabs.map((t) => {
        const active = activeTab === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onTabChange(t.key)}
            style={[styles.tabItem, active && styles.tabItemActive]}
          >
            <Ionicons
              name={t.icon}
              size={18}
              color={active ? IOS_COLORS.blue : IOS_COLORS.labelSecondary}
            />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================================
// PrepView — 出餐预览（以午餐优先、按会员分组展示待出餐订单）
// ============================================================
function PrepView({
  orders,
  displayLimit,
  onMarkFulfilled,
  onOpenDetail,
  onShowMember,
}: {
  orders: MockOrder[];
  displayLimit: 10 | 50 | 100 | 200;
  onMarkFulfilled: (order: MockOrder) => void;
  onOpenDetail: (o: MockOrder) => void;
  onShowMember: (memberId: number) => void;
}) {
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const lunch = pendingOrders.filter((o) => o.meal_type === 'lunch').slice(0, displayLimit);
  const dinner = pendingOrders.filter((o) => o.meal_type === 'dinner').slice(0, displayLimit);
  const totalLunch = lunch.reduce((s, o) => s + o.quantity, 0);
  const totalDinner = dinner.reduce((s, o) => s + o.quantity, 0);

  return (
    <ScrollView contentContainerStyle={prepStyles.scroll}>
      {/* 顶部汇总：今天还需要出多少份 */}
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

      {/* 午餐优先 */}
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
        <View style={[prepStyles.cardAvatarLg, { backgroundColor: order.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
          <Text style={prepStyles.cardAvatarTextLg}>
            {(order.member_nickname || order.member_name)[0]}
          </Text>
        </View>
        <View style={prepStyles.cardContent}>
          <View style={prepStyles.cardTop}>
            <Pressable
              onPress={() => onShowMember(order.member_id)}
              style={prepStyles.nameLink}
              hitSlop={6}
            >
              <Text
                style={[prepStyles.cardName, prepStyles.cardNameLink]}
                numberOfLines={1}
              >
                {order.member_nickname || order.member_name}
              </Text>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={IOS_COLORS.blue}
              />
            </Pressable>
            {order.is_hospital ? (
              <View style={prepStyles.tag}><Text style={prepStyles.tagText}>院内</Text></View>
            ) : null}
            {isAdhoc ? (
              <View style={[prepStyles.tag, { backgroundColor: '#FFF4E5' }]}>
                <Text style={[prepStyles.tagText, { color: '#FF9500' }]}>散餐</Text>
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
        <Text style={prepStyles.sideConfirmText} numberOfLines={1}>出餐完成</Text>
      </Pressable>
    </View>
  );
}

// ============================================================
// DeliveryView — 送餐（已出餐但未送达）
// ============================================================
function DeliveryView({
  orders,
  displayLimit,
  membersById,
  onMarkDelivered,
  onMarkDeliveryFailed,
  onOpenDetail,
  onShowMember,
  channel = 'self',
}: {
  orders: MockOrder[];
  displayLimit: 10 | 50 | 100 | 200;
  membersById: Record<number, MockMember>;
  onMarkDelivered: (order: MockOrder) => void;
  onMarkDeliveryFailed: (order: MockOrder) => void;
  onOpenDetail: (o: MockOrder) => void;
  onShowMember: (memberId: number) => void;
  /** 'self' → 员工自送；'courier' → 外包快递 */
  channel?: 'self' | 'courier';
}) {
  const fulfilled = orders.filter(
    (o) => o.status === 'fulfilled' && (o.delivery_channel ?? 'self') === channel,
  );
  const lunch = fulfilled.filter((o) => o.meal_type === 'lunch').slice(0, displayLimit);
  const dinner = fulfilled.filter((o) => o.meal_type === 'dinner').slice(0, displayLimit);
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
            {channel === 'courier'
              ? '当前没有交给快递的订单'
              : '当前没有待送达订单'}
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
        <View style={[prepStyles.cardAvatarLg, { backgroundColor: order.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
          <Text style={prepStyles.cardAvatarTextLg}>
            {(order.member_nickname || order.member_name)[0]}
          </Text>
        </View>
        <View style={prepStyles.cardContent}>
          <View style={prepStyles.cardTop}>
            <Pressable
              onPress={() => onShowMember(order.member_id)}
              style={prepStyles.nameLink}
              hitSlop={6}
            >
              <Text
                style={[prepStyles.cardName, prepStyles.cardNameLink]}
                numberOfLines={1}
              >
                {order.member_nickname || order.member_name}
              </Text>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={IOS_COLORS.blue}
              />
            </Pressable>
            {order.is_hospital ? (
              <View style={prepStyles.tag}><Text style={prepStyles.tagText}>院内</Text></View>
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
                <Text style={[prepStyles.tagText, { color: '#AF52DE' }]}>快递{order.courier_ref ? ` · ${order.courier_ref}` : ''}</Text>
              </View>
            ) : null}
          </View>

          {/* 手机号 */}
          <View style={prepStyles.infoRow}>
            <Ionicons
              name="call-outline"
              size={14}
              color={IOS_COLORS.labelSecondary}
            />
            <Text
              style={[prepStyles.infoText, !phone && prepStyles.infoTextMuted]}
              numberOfLines={1}
            >
              {phone || '未填手机号'}
            </Text>
          </View>

          {/* 地址 */}
          <View style={prepStyles.infoRow}>
            <Ionicons
              name="location-outline"
              size={14}
              color={IOS_COLORS.labelSecondary}
            />
            <Text style={prepStyles.infoText} numberOfLines={2}>
              {address}
            </Text>
          </View>

          <Text style={prepStyles.cardMetaDim}>
            {order.meal_type === 'lunch' ? '午餐' : '晚餐'} · {order.quantity} 份
          </Text>

          {(order.dietary_notes || order.notes) ? (
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
            style={({ pressed }) => [
              prepStyles.deliveryFailedBtn,
              pressed && { opacity: 0.8 },
            ]}
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
        <Text style={prepStyles.sideConfirmText} numberOfLines={1}>确认送达</Text>
      </Pressable>
    </View>
  );
}

// ============================================================
// SummaryItem
// ============================================================
function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

// ============================================================
// OrderRow
// ============================================================
function OrderRow({
  order, member, isLast, onPress,
}: {
  order: MockOrder;
  member?: MockMember;
  isLast: boolean;
  onPress: () => void;
}) {
  const s = STATUS_MAP[order.status];
  const isAdhoc = order.card_type === null;
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
        <Text style={styles.orderAvatarText}>
          {(order.member_nickname || order.member_name)[0]}
        </Text>
      </View>

      <View style={styles.orderContent}>
        <View style={styles.orderTop}>
          <Text style={styles.orderName}>{order.member_nickname || order.member_name}</Text>
          {order.is_hospital && (
            <View style={styles.hospitalBadge}><Text style={styles.hospitalText}>院内</Text></View>
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
          {isAdhoc ? (
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

// ============================================================
// EntryPanel — 快速录入（会员餐 / 散餐），内嵌在「录入」Tab 中
// ============================================================
type EntryMode = 'member' | 'adhoc';

function EntryPanel({
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
      <View style={eStyles.modeRow}>
        <View style={eStyles.modeGroup}>
          {(['member', 'adhoc'] as const).map((m) => (
            <Pressable
              key={m}
              style={[eStyles.modeBtn, mode === m && eStyles.modeBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[eStyles.modeBtnText, mode === m && eStyles.modeBtnTextActive]}>
                {m === 'member' ? '会员餐' : '散餐'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={eStyles.modeHint} numberOfLines={1}>
          {mode === 'member' ? '从会员档案中选择，自动扣卡' : '无需会员账户，现金收费'}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={eStyles.scroll}
          keyboardShouldPersistTaps="handled"
        >
            <Text style={eStyles.sectionLabel}>录入日期</Text>
            <View style={eStyles.dateCard}>
              <DatePicker
                value={entryDate}
                onChange={setEntryDate}
                label="日期"
              />
            </View>
            <Text style={eStyles.dateHint}>
              默认是次日，可按需要改成今天或任意日期。
            </Text>

            {mode === 'member' ? (
              /* ===== 会员餐 ===== */
              <>
                <Text style={eStyles.sectionLabel}>选择会员</Text>
                <View style={eStyles.searchBox}>
                  <TextInput
                    style={eStyles.searchInput}
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
                    <View style={eStyles.selectedMemberCard}>
                      <View style={[eStyles.selAvatar, { backgroundColor: selectedMember.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
                        <Text style={eStyles.selAvatarText}>
                          {(selectedMember.nickname || selectedMember.name)[0]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={eStyles.selName}>
                          {selectedMember.name}「{selectedMember.nickname}」
                        </Text>
                        <Text style={eStyles.selSub}>
                          {selectedMember.is_hospital ? '院内' : '院外'} ·{' '}
                          {selectedMember.active_card?.card_name ?? '无有效卡'} · 剩{' '}
                          {selectedMember.active_card?.remaining_meals ?? 0} 份
                        </Text>
                        {selectedMember.dietary_notes ? (
                          <Text style={eStyles.selDiet}>忌：{selectedMember.dietary_notes}</Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => { setSelectedMember(null); setMemberQuery(''); }}
                      >
                        <Text style={eStyles.changeBtn}>更换</Text>
                      </Pressable>
                    </View>
                    {!memberHasCard ? (
                      <View style={eStyles.warnBanner}>
                        <Ionicons name="alert-circle" size={18} color={IOS_COLORS.red} />
                        <View style={{ flex: 1 }}>
                          <Text style={eStyles.warnTitle}>该会员暂无进行中的卡</Text>
                          <Text style={eStyles.warnHint}>
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
                          style={eStyles.warnCta}
                        >
                          <Text style={eStyles.warnCtaText}>去开卡</Text>
                        </Pressable>
                      </View>
                    ) : memberHasCard && lunchQty + dinnerQty > 0 && !memberCardEnough ? (
                      <View style={eStyles.warnBanner}>
                        <Ionicons name="alert-circle" size={18} color={IOS_COLORS.red} />
                        <Text style={[eStyles.warnTitle, { flex: 1 }]}>
                          剩 {selectedMember.active_card!.remaining_meals} 份，不够扣 {lunchQty + dinnerQty} 份。请先续卡或减少份数。
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : dropdownOpen ? (
                  /* 搜索结果下拉 */
                  filteredMembers.length > 0 ? (
                    <View style={eStyles.memberList}>
                      {filteredMembers.map((m, i) => (
                        <Pressable
                          key={m.id}
                          style={({ pressed }) => [
                            eStyles.memberRow,
                            i === filteredMembers.length - 1 && eStyles.memberRowLast,
                            pressed && { backgroundColor: IOS_COLORS.fillLight },
                          ]}
                          onPress={() => {
                            setSelectedMember(m);
                            setMemberQuery(m.nickname || m.name);
                          }}
                        >
                          <View style={[eStyles.memberAvatar, { backgroundColor: m.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
                            <Text style={eStyles.memberAvatarText}>{(m.nickname || m.name)[0]}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={eStyles.memberName}>{m.name}</Text>
                            <Text style={eStyles.memberNick}>
                              「{m.nickname}」· {m.is_hospital ? '院内' : '院外'}
                            </Text>
                          </View>
                          {m.active_card ? (
                            <Text style={eStyles.memberCardBadge}>
                              {m.active_card.card_name} 剩{m.active_card.remaining_meals}份
                            </Text>
                          ) : (
                            <Text style={eStyles.memberNoCard}>无卡 · 需先开卡</Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View style={eStyles.dropdownEmpty}>
                      <Text style={eStyles.dropdownEmptyText}>
                        没有匹配的会员
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={eStyles.searchHintSpacer} />
                )}

                <View style={eStyles.divider} />
                <Text style={eStyles.sectionLabel}>份数</Text>
                <View style={eStyles.qtySection}>
                  <QtyRow label="午餐份数" value={lunchQty}  onChange={setLunchQty} />
                  <QtyRow label="晚餐份数" value={dinnerQty} onChange={setDinnerQty} />
                </View>

                <Text style={[eStyles.sectionLabel, { marginTop: 16 }]}>配送方式</Text>
                <ChannelPicker
                  value={deliveryChannel}
                  onChange={setDeliveryChannel}
                  courierRef={courierRef}
                  onCourierRefChange={setCourierRef}
                />

                <View style={eStyles.notesBox}>
                  <TextInput
                    style={eStyles.notesInput}
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
                <Text style={eStyles.sectionLabel}>顾客信息</Text>
                <View style={eStyles.inlineCard}>
                  <View style={eStyles.fieldRow}>
                    <Text style={eStyles.fieldLabel}>
                      姓名 / 称呼 <Text style={eStyles.fieldRequired}>*</Text>
                    </Text>
                    <TextInput
                      style={eStyles.fieldInput}
                      placeholder="必填"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={adhocName}
                      onChangeText={setAdhocName}
                    />
                  </View>
                  <View style={eStyles.fieldDivider} />
                  <View style={eStyles.fieldRow}>
                    <Text style={eStyles.fieldLabel}>
                      手机号 <Text style={eStyles.fieldRequired}>*</Text>
                    </Text>
                    <TextInput
                      style={eStyles.fieldInput}
                      placeholder="11 位手机号，必填"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={adhocPhone}
                      onChangeText={setAdhocPhone}
                      keyboardType="phone-pad"
                      maxLength={11}
                    />
                  </View>
                  <View style={eStyles.fieldDivider} />
                  <View style={eStyles.fieldRowTop}>
                    <Text style={eStyles.fieldLabel}>送餐地址</Text>
                    <TextInput
                      style={[eStyles.fieldInput, eStyles.fieldInputMulti]}
                      placeholder="必填：送餐地址 / 科室"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={adhocAddress}
                      onChangeText={setAdhocAddress}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                  <View style={eStyles.fieldDivider} />
                  <View style={eStyles.fieldRow}>
                    <Text style={eStyles.fieldLabel}>
                      微信号 <Text style={eStyles.fieldRequired}>*</Text>
                    </Text>
                    <TextInput
                      style={eStyles.fieldInput}
                      placeholder="必填"
                      placeholderTextColor={IOS_COLORS.labelTertiary}
                      value={adhocWechat}
                      onChangeText={setAdhocWechat}
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={eStyles.fieldDivider} />
                  <View style={eStyles.fieldRow}>
                    <Text style={eStyles.fieldLabel}>类型</Text>
                    <View style={eStyles.toggleGroup}>
                      {([false, true] as const).map((v) => (
                        <Pressable
                          key={String(v)}
                          style={[eStyles.toggleBtn, adhocHospital === v && eStyles.toggleBtnActive]}
                          onPress={() => setAdhocHospital(v)}
                        >
                          <Text style={[eStyles.toggleText, adhocHospital === v && eStyles.toggleTextActive]}>
                            {v ? '院内' : '院外'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={eStyles.hintUnderCard}>
                  散客手机号、微信号、地址均为必填，同名散客会自动合并并更新这些资料。
                </Text>

                <Text style={[eStyles.sectionLabel, { marginTop: 20 }]}>份数</Text>
                <View style={eStyles.qtySection}>
                  <QtyRow label="午餐份数" value={adhocLunchQty}  onChange={setAdhocLunchQty} />
                  <QtyRow label="晚餐份数" value={adhocDinnerQty} onChange={setAdhocDinnerQty} />
                </View>

                <Text style={[eStyles.sectionLabel, { marginTop: 20 }]}>单价</Text>
                <View style={eStyles.inlineCard}>
                  <View style={eStyles.fieldRow}>
                    <Text style={eStyles.fieldLabel}>单价（元）</Text>
                    <TextInput
                      style={[eStyles.fieldInput, { textAlign: 'right' }]}
                      value={adhocPrice}
                      onChangeText={setAdhocPrice}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Text style={[eStyles.sectionLabel, { marginTop: 20 }]}>配送方式</Text>
                <ChannelPicker
                  value={deliveryChannel}
                  onChange={setDeliveryChannel}
                  courierRef={courierRef}
                  onCourierRefChange={setCourierRef}
                />

                <View style={eStyles.notesBox}>
                  <TextInput
                    style={eStyles.notesInput}
                    placeholder="备注（可选）"
                    placeholderTextColor={IOS_COLORS.labelTertiary}
                    value={adhocNotes}
                    onChangeText={setAdhocNotes}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* 合计 —— 放最底，订餐前最后一眼确认金额 */}
                <View style={eStyles.adhocTotal}>
                  <Text style={eStyles.adhocTotalLabel}>合计应收</Text>
                  <Text style={eStyles.adhocTotalValue}>
                    ¥{((parseFloat(adhocPrice) || 0) * adhocTotalQty).toFixed(0)}
                  </Text>
                </View>
              </>
            )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 底部提交条 */}
      <View style={eStyles.submitBar}>
        <View style={{ flex: 1 }}>
          {mode === 'member' && selectedMember ? (
            <>
              <Text style={eStyles.submitMain}>
                {selectedMember.nickname || selectedMember.name}
              </Text>
              <Text
                style={[
                  eStyles.submitSub,
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
              <Text style={eStyles.submitMain}>{adhocName.trim()}</Text>
              <Text style={eStyles.submitSub}>
                午 {adhocLunchQty} · 晚 {adhocDinnerQty} · 共 {adhocTotalQty} 份 · ¥
                {((parseFloat(adhocPrice) || 0) * adhocTotalQty).toFixed(0)}
              </Text>
            </>
          ) : (
            <Text style={eStyles.submitHint}>
              {mode === 'member' ? '请选择会员并录入份数' : '请填写顾客姓名与份数'}
            </Text>
          )}
        </View>
        <Pressable
          style={[eStyles.submitBtn, !canSubmit && eStyles.submitBtnDisabled]}
          disabled={!canSubmit}
          onPress={() => {
            if (mode === 'member') void handleSubmitMember();
            else void handleSubmitAdhoc();
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={eStyles.submitBtnText}>确认录入</Text>
          )}
        </Pressable>
      </View>

      {/* Toast */}
      {toast ? (
        <View style={eStyles.toast}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={eStyles.toastText}>{toast}</Text>
          {onJumpToOverview ? (
            <Pressable onPress={onJumpToOverview} hitSlop={8}>
              <Text style={eStyles.toastLink}>查看总览</Text>
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
    <View style={eStyles.inlineCard}>
      <View style={eStyles.fieldRow}>
        <Text style={eStyles.fieldLabel}>配送方式</Text>
        <View style={eStyles.toggleGroup}>
          {([['self', '员工自送'], ['courier', '快递']] as const).map(([v, label]) => (
            <Pressable
              key={v}
              style={[eStyles.toggleBtn, value === v && eStyles.toggleBtnActive]}
              onPress={() => onChange(v)}
            >
              <Text style={[eStyles.toggleText, value === v && eStyles.toggleTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {value === 'courier' ? (
        <>
          <View style={eStyles.fieldDivider} />
          <View style={eStyles.fieldRow}>
            <Text style={eStyles.fieldLabel}>承运方</Text>
            <TextInput
              style={eStyles.fieldInput}
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
    <View style={eStyles.qtyRow}>
      <Text style={eStyles.qtyLabel}>{label}</Text>
      <View style={eStyles.qtyControls}>
        <Pressable
          style={[eStyles.qtyBtn, value <= min && eStyles.qtyBtnDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Text style={eStyles.qtyBtnText}>−</Text>
        </Pressable>
        <Text style={eStyles.qtyValue}>{value}</Text>
        <Pressable style={eStyles.qtyBtn} onPress={() => onChange(value + 1)}>
          <Text style={eStyles.qtyBtnText}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================
// StatusSheet — 点击订单行更新出餐状态
// ============================================================
const STATUS_FLOW = [
  { key: 'pending'   as const, label: '待出餐', color: IOS_COLORS.orange,         bg: '#FFF4E5',            icon: 'time-outline' as const },
  { key: 'fulfilled' as const, label: '已出餐', color: IOS_COLORS.blue,           bg: IOS_COLORS.blueLight, icon: 'checkmark-circle-outline' as const },
  { key: 'delivered' as const, label: '已送达', color: '#34C759',                  bg: '#E8F8ED',            icon: 'checkmark-done-outline' as const },
  { key: 'cancelled' as const, label: '已取消', color: IOS_COLORS.labelSecondary, bg: IOS_COLORS.fillLight, icon: 'close-circle-outline' as const },
];

function StatusSheet({
  order, onClose, onUpdate, onMarkFulfilled, onMarkDelivered, onMarkDeliveryFailed, onOpenProfile,
}: {
  order: MockOrder;
  onClose: () => void;
  onUpdate: (id: number, status: MockOrder['status']) => void;
  /** 点"已出餐"/"已送达"时走二次确认；状态网格里这两个 chip 都会先弹 Modal。 */
  onMarkFulfilled: (o: MockOrder) => void;
  onMarkDelivered: (o: MockOrder) => void;
  onMarkDeliveryFailed: (o: MockOrder) => void;
  onOpenProfile: (o: MockOrder) => void;
}) {
  const isAdhoc = order.card_type === null;
  const cur = STATUS_MAP[order.status];
  // 送达 / 取消 是终态，所有按钮都禁用（后端同样会 422，这里先在 UI 阻止）
  const locked = order.status === 'delivered' || order.status === 'cancelled';
  // 合法流转图（与后端 ALLOWED_TRANSITIONS 对齐）
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
          {/* 拖拽指示条 */}
          <View style={sStyles.handle} />

          {/* 订单信息 */}
          <View style={sStyles.orderInfo}>
            <View style={sStyles.orderInfoLeft}>
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenProfile(order);
                }}
                style={({ pressed }) => [
                  sStyles.orderAvatarPress,
                  pressed && { opacity: 0.75 },
                ]}
                hitSlop={8}
              >
                <View style={[sStyles.orderAvatar, { backgroundColor: order.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
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
                  {' · '}{isAdhoc ? `散餐 ¥${order.amount}` : order.card_type}
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
            {locked
              ? order.status === 'delivered'
                ? '订单已送达，状态已锁定'
                : '订单已取消，状态不可变更'
              : '更新出餐状态'}
          </Text>

          <View style={sStyles.statusGrid}>
            {statusFlow.map((s) => {
              const isCurrent = order.status === s.key;
              const isDeliveryFailedAction =
                order.status === 'fulfilled' && s.key === 'cancelled';
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
                    // 先关弹层再弹确认，避免两个 Modal 叠在一起遮挡
                    if (order.status === 'fulfilled' && s.key === 'cancelled') {
                      onClose();
                      onMarkDeliveryFailed(order);
                    } else if (s.key === 'delivered') {
                      onClose();
                      onMarkDelivered(order);
                    } else if (s.key === 'fulfilled' && order.status === 'pending') {
                      // pending → fulfilled 也走一次确认（只在 pending→fulfilled，
                      // 回退 delivered→fulfilled 是 UI 回滚，不需要再确认）
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

function DeliveryFailSheet({
  order,
  reason,
  reasonOptions,
  extra,
  submitting,
  onSelectReason,
  onChangeExtra,
  onClose,
  onSubmit,
}: {
  order: MockOrder | null;
  reason: string;
  reasonOptions: readonly string[];
  extra: string;
  submitting: boolean;
  onSelectReason: (v: string) => void;
  onChangeExtra: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!order) return null;
  const memberName = order.member_nickname || order.member_name;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={fStyles.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={fStyles.sheet}
      >
        <View style={fStyles.card}>
          <View style={fStyles.handle} />
          <Text style={fStyles.title}>送餐失败</Text>
          <Text style={fStyles.sub}>
            {memberName} · {order.meal_type === 'lunch' ? '午餐' : '晚餐'} {order.quantity} 份
          </Text>
          <Text style={fStyles.hint}>选择失败原因（会自动退回餐数）</Text>

          <View style={fStyles.reasonWrap}>
            {reasonOptions.map((item) => {
              const active = reason === item;
              return (
                <Pressable
                  key={item}
                  style={[
                    fStyles.reasonChip,
                    active && fStyles.reasonChipActive,
                  ]}
                  onPress={() => onSelectReason(item)}
                >
                  <Text style={[fStyles.reasonChipText, active && fStyles.reasonChipTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={fStyles.inputBox}>
            <TextInput
              value={extra}
              onChangeText={onChangeExtra}
              placeholder="补充说明（可选）"
              placeholderTextColor={IOS_COLORS.labelTertiary}
              style={fStyles.input}
              multiline
              maxLength={120}
            />
          </View>

          <View style={fStyles.actions}>
            <Pressable style={fStyles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={fStyles.cancelBtnText}>暂不处理</Text>
            </Pressable>
            <Pressable
              style={[fStyles.confirmBtn, submitting && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={submitting}
            >
              <Text style={fStyles.confirmBtnText}>
                {submitting ? '提交中...' : '确认送餐失败'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================
// Styles — main screen
// ============================================================
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },

  // ======= 当前分组功能 Tab =======
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 14,
    padding: 5,
    gap: 4,
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: IOS_COLORS.blueLight,
  },
  tabLabel: { fontSize: 13, color: IOS_COLORS.labelSecondary, fontWeight: '600' },
  tabLabelActive: { color: IOS_COLORS.blue, fontWeight: '700' },
  pageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: -2,
    marginBottom: 8,
    gap: 10,
  },
  pageMetaText: {
    fontSize: 13,
    color: IOS_COLORS.labelSecondary,
    fontWeight: '500',
  },
  overviewDateCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.08)',
    padding: 10,
    gap: 8,
  },
  overviewDateQuickRow: { flexDirection: 'row', gap: 8 },
  overviewDateQuick: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.fillLight,
  },
  overviewDateQuickActive: {
    backgroundColor: IOS_COLORS.blueLight,
  },
  overviewDateQuickText: {
    fontSize: 12,
    color: IOS_COLORS.labelSecondary,
    fontWeight: '600',
  },
  overviewDateQuickTextActive: {
    color: IOS_COLORS.blue,
  },
  limitRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  limitLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  limitChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.fillLight,
  },
  limitChipActive: { backgroundColor: IOS_COLORS.blueLight },
  limitChipText: { fontSize: 12, color: IOS_COLORS.labelSecondary, fontWeight: '600' },
  limitChipTextActive: { color: IOS_COLORS.blue },

  summaryBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    marginHorizontal: 12, marginBottom: 10,
    paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.08)',
  },
  summaryItem:    { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue:   { fontSize: 18, fontWeight: '700' },
  summaryLabel:   { fontSize: 12, color: IOS_COLORS.labelSecondary },
  summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 4 },
  summaryHint: {
    marginTop: -4,
    marginBottom: 8,
    marginHorizontal: 16,
    fontSize: 12,
    color: IOS_COLORS.labelSecondary,
  },

  filterSection: {
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  segmentText: { fontSize: 13, color: IOS_COLORS.labelSecondary, fontWeight: '500' },
  segmentTextActive: { color: IOS_COLORS.label, fontWeight: '600' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  pillGap: { flexBasis: '100%', height: 0 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  pillStatusActive: { backgroundColor: '#34C759' },
  pillTypeActive:   { backgroundColor: '#FF9500' },
  pillText:         { fontSize: 12, color: IOS_COLORS.labelSecondary, fontWeight: '500' },
  pillTextActive:   { color: '#fff', fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 4,
  },
  sectionHeaderTitle: { fontSize: 13, fontWeight: '700', color: IOS_COLORS.labelSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionCount:       { fontSize: 13, color: IOS_COLORS.labelSecondary },

  orderRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.08)',
  },
  orderRowLast: {},
  orderAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  orderAvatarText: { fontSize: 18, fontWeight: '600', color: IOS_COLORS.blue },
  orderContent:    { flex: 1, gap: 4 },
  orderTop:        { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  orderName:       { fontSize: 15, fontWeight: '600', color: IOS_COLORS.label },
  hospitalBadge:   { backgroundColor: IOS_COLORS.blueLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  hospitalText:    { fontSize: 11, color: IOS_COLORS.blue, fontWeight: '600' },
  statusBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText:      { fontSize: 11, fontWeight: '600' },
  deliveryFailedBadge: {
    backgroundColor: '#FDECEC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  deliveryFailedText: { fontSize: 11, color: '#D97A00', fontWeight: '700' },
  orderMeta:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTag:  { fontSize: 12, color: IOS_COLORS.labelSecondary, backgroundColor: IOS_COLORS.fillLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  remainingTag: {
    fontSize: 12,
    color: IOS_COLORS.blue,
    backgroundColor: IOS_COLORS.blueLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  noCardTag: {
    fontSize: 12,
    color: IOS_COLORS.red,
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  adhocTag: { fontSize: 12, color: '#FF9500', backgroundColor: '#FFF4E5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  orderQty: { fontSize: 14, fontWeight: '600', color: IOS_COLORS.label },
  orderNote: { fontSize: 13, color: IOS_COLORS.orange, lineHeight: 18 },
  orderNoteLabel: { fontWeight: '700' },
  rowChevron: { marginLeft: 4 },

  empty:     { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, color: IOS_COLORS.labelSecondary },
  emptyLink: { fontSize: 16, color: IOS_COLORS.blue },

  errorToast: {
    position: 'absolute', left: 16, right: 16, bottom: 24,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,59,48,0.94)',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
  },
  errorToastText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  errorToastLink: { color: '#fff', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },

  loadingToast: {
    position: 'absolute', left: 16, right: 16, bottom: 24,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)',
  },
  loadingToastText: { color: IOS_COLORS.labelSecondary, fontSize: 14 },
});

// ============================================================
// Styles — EntrySheet
// ============================================================
const eStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: IOS_COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  cancel:  { fontSize: 17, color: IOS_COLORS.labelSecondary },
  title:   { fontSize: 17, fontWeight: '600', color: IOS_COLORS.label },
  confirm: { fontSize: 17, color: IOS_COLORS.blue, fontWeight: '600' },

  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.card,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
    gap: 10,
  },
  modeGroup: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.fillMedium, borderRadius: 10, padding: 3, alignSelf: 'flex-start',
  },
  modeBtn:         { paddingHorizontal: 20, paddingVertical: 7, borderRadius: 8 },
  modeBtnActive:   { backgroundColor: IOS_COLORS.card },
  modeBtnText:     { fontSize: 15, color: IOS_COLORS.labelSecondary },
  modeBtnTextActive: { color: IOS_COLORS.label, fontWeight: '600' },
  modeHint: { flex: 1, fontSize: 12, color: IOS_COLORS.labelTertiary },

  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginBottom: 8, paddingLeft: 4,
  },

  searchBox: {
    backgroundColor: IOS_COLORS.card, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 2, marginBottom: 10,
  },
  searchInput: {
    fontSize: 15, color: IOS_COLORS.label, paddingVertical: 10,
  },

  memberList: {
    backgroundColor: IOS_COLORS.card, borderRadius: 14, overflow: 'hidden', marginBottom: 4,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  memberRowLast: { borderBottomWidth: 0 },
  memberAvatar:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 15, fontWeight: '600', color: IOS_COLORS.blue },
  memberName:       { fontSize: 15, fontWeight: '600', color: IOS_COLORS.label },
  memberNick:       { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: 1 },
  memberCardBadge:  { fontSize: 12, color: IOS_COLORS.blue, backgroundColor: IOS_COLORS.blueLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  memberNoCard:     { fontSize: 11, color: IOS_COLORS.red, backgroundColor: '#FFE5E5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: '600' },

  warnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF0F0', borderColor: '#FFD2D2', borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    marginTop: 10,
  },
  warnTitle: { fontSize: 14, fontWeight: '700', color: IOS_COLORS.red },
  warnHint:  { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: 2, lineHeight: 16 },
  warnCta:   {
    backgroundColor: IOS_COLORS.red, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8,
  },
  warnCtaText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  selectedMemberCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: IOS_COLORS.blueLight, borderRadius: 14,
    padding: 14, marginBottom: 4,
  },

  searchHintSpacer: { height: 4 },
  dropdownEmpty: {
    backgroundColor: IOS_COLORS.card, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 18,
    alignItems: 'center',
  },
  dropdownEmptyText: { fontSize: 13, color: IOS_COLORS.labelSecondary },
  selAvatar:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  selAvatarText: { fontSize: 18, fontWeight: '700', color: IOS_COLORS.blue },
  selName:       { fontSize: 15, fontWeight: '600', color: IOS_COLORS.label },
  selSub:        { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: 2 },
  selDiet:       { fontSize: 12, color: IOS_COLORS.orange, marginTop: 2 },
  changeBtn:     { fontSize: 15, color: IOS_COLORS.blue },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: IOS_COLORS.separatorLight, marginVertical: 16 },

  qtySection: { backgroundColor: IOS_COLORS.card, borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  qtyLabel:        { fontSize: 15, color: IOS_COLORS.label, fontWeight: '500' },
  qtyControls:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: IOS_COLORS.blue, alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled:  { backgroundColor: IOS_COLORS.fillMedium },
  qtyBtnText:      { fontSize: 20, color: '#fff', fontWeight: '500', lineHeight: 24 },
  qtyValue:        { fontSize: 20, fontWeight: '700', color: IOS_COLORS.label, minWidth: 32, textAlign: 'center' },

  notesBox: {
    backgroundColor: IOS_COLORS.card, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 4, marginTop: 12,
  },
  notesInput: { fontSize: 15, color: IOS_COLORS.label, paddingVertical: 10, minHeight: 60 },
  dateCard: {
    backgroundColor: IOS_COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  dateHint: {
    fontSize: 12,
    color: IOS_COLORS.labelTertiary,
    marginBottom: 16,
    paddingLeft: 4,
  },

  // 散餐专用
  inlineCard: { backgroundColor: IOS_COLORS.card, borderRadius: 14, overflow: 'hidden' },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  fieldRowTop: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    gap: 12,
  },
  fieldDivider: { height: StyleSheet.hairlineWidth, backgroundColor: IOS_COLORS.separatorLight, marginLeft: 16 },
  fieldLabel: { fontSize: 15, color: IOS_COLORS.label },
  fieldRequired: { color: IOS_COLORS.red, fontWeight: '700' },
  fieldInput: { fontSize: 15, color: IOS_COLORS.label, flex: 1, textAlign: 'right', paddingLeft: 8 },
  fieldInputMulti: {
    textAlign: 'right',
    minHeight: 44,
    lineHeight: 20,
    paddingTop: 4,
  },
  hintUnderCard: {
    fontSize: 12,
    color: IOS_COLORS.labelTertiary,
    paddingHorizontal: 20,
    paddingTop: 6,
  },

  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.fillMedium, borderRadius: 8, padding: 2,
  },
  toggleBtn:         { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6 },
  toggleBtnActive:   { backgroundColor: IOS_COLORS.card },
  toggleText:        { fontSize: 14, color: IOS_COLORS.labelSecondary },
  toggleTextActive:  { color: IOS_COLORS.label, fontWeight: '600' },

  adhocTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: IOS_COLORS.blueLight, borderRadius: 14, marginTop: 10,
  },
  adhocTotalLabel: { fontSize: 15, color: IOS_COLORS.blue },
  adhocTotalValue: { fontSize: 24, fontWeight: '700', color: IOS_COLORS.blue },

  // —— 底部提交条（inline 录入）——
  submitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  submitMain: { fontSize: 15, fontWeight: '700', color: IOS_COLORS.label },
  submitSub: { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: 2 },
  submitHint: { fontSize: 13, color: IOS_COLORS.labelTertiary },
  submitBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, backgroundColor: IOS_COLORS.blue,
    alignItems: 'center', justifyContent: 'center', minWidth: 110,
  },
  submitBtnDisabled: { backgroundColor: IOS_COLORS.labelTertiary },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 15 },

  toast: {
    position: 'absolute', left: 16, right: 16, bottom: 80,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(52,199,89,0.94)',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  toastLink: { color: '#fff', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});

// ============================================================
// Styles — PrepView / DeliveryView
// ============================================================
const prepStyles = StyleSheet.create({
  scroll: { paddingHorizontal: 12, paddingBottom: 32 },

  summary: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryTile: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 2,
  },
  summaryLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary, fontWeight: '500' },
  summaryValue: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, lineHeight: 32 },
  summaryUnit:  { fontSize: 14, fontWeight: '500' },
  summarySub:   { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: 2 },

  mealBlock: { marginBottom: 18 },
  mealHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingVertical: 8,
  },
  mealTitle: { fontSize: 13, fontWeight: '700', color: IOS_COLORS.labelSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  mealCount: { fontSize: 13, color: IOS_COLORS.labelSecondary },

  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    minHeight: 110,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.08)',
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16, paddingVertical: 16, gap: 14,
    alignItems: 'flex-start',
  },
  cardContent: { flex: 1, gap: 6 },
  cardAvatarLg: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardAvatarTextLg: { fontSize: 24, fontWeight: '700', color: IOS_COLORS.blue },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName: { fontSize: 18, fontWeight: '700', color: IOS_COLORS.label },
  cardNameLink: { color: IOS_COLORS.blue },
  nameLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginRight: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.label,
    fontWeight: '500',
  },
  infoTextMuted: {
    color: IOS_COLORS.labelTertiary,
    fontWeight: '400',
  },
  cardMetaDim: {
    fontSize: 12,
    color: IOS_COLORS.labelTertiary,
    marginTop: 4,
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mealTypePill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mealTypePillLunch: { backgroundColor: '#FFF4E5' },
  mealTypePillDinner: { backgroundColor: '#F5E9FC' },
  mealTypePillText: { fontSize: 12, fontWeight: '700' },
  mealTypePillTextLunch: { color: '#FF9500' },
  mealTypePillTextDinner: { color: '#AF52DE' },
  qtyPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: IOS_COLORS.fillLight,
  },
  qtyPillText: {
    fontSize: 12,
    color: IOS_COLORS.label,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cardMeta: { fontSize: 13, color: IOS_COLORS.labelSecondary, fontWeight: '500' },

  tag: {
    backgroundColor: IOS_COLORS.blueLight,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  tagText: { fontSize: 12, fontWeight: '700', color: IOS_COLORS.blue },

  noteBox: {
    marginTop: 4,
    backgroundColor: '#FFF8E6',
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    gap: 2,
  },
  noteText: { fontSize: 13, color: '#8A5A00', lineHeight: 18 },
  noteLabel: { fontWeight: '700' },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: { flex: 1, fontSize: 15, color: IOS_COLORS.label, fontWeight: '600', lineHeight: 20 },

  // 右侧确认按钮：纵向贯穿整张卡片高度
  sideConfirm: {
    width: 82,
    backgroundColor: IOS_COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.35)',
  },
  sideConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  deliveryFailedBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4E5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deliveryFailedBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.red,
  },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: IOS_COLORS.label },
  emptySub:   { fontSize: 13, color: IOS_COLORS.labelSecondary },
});

// ============================================================
// Styles — StatusSheet
// ============================================================
const sStyles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  sheetCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: IOS_COLORS.fillMedium,
    alignSelf: 'center', marginTop: 10, marginBottom: 10,
  },

  orderInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 10,
  },
  orderInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  orderAvatarPress: { position: 'relative' },
  orderAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  orderAvatarLink: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 1,
  },
  orderAvatarText: { fontSize: 16, fontWeight: '700', color: IOS_COLORS.blue },
  orderName: { fontSize: 16, fontWeight: '600', color: IOS_COLORS.label },
  orderSub:  { fontSize: 13, color: IOS_COLORS.labelSecondary, marginTop: 2 },
  curStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  curStatusText:  { fontSize: 12, fontWeight: '600' },

  notesRow: {
    paddingHorizontal: 14, paddingVertical: 10,
    marginHorizontal: 10,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: '#FFF8E6',
  },
  notesText: { fontSize: 13, color: '#8A5A00', lineHeight: 18 },
  notesLabel: { fontWeight: '700' },

  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: IOS_COLORS.labelSecondary,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

  statusGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  statusBtn: {
    flex: 1, minWidth: 130,
    paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
  },
  statusBtnCurrent: { borderWidth: 2 },
  statusBtnIcon:    {},
  statusBtnLabel:   { fontSize: 14, fontWeight: '600' },
  closeBtn: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: 'rgba(118,118,128,0.12)', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  closeBtnText: { fontSize: 17, color: IOS_COLORS.label, fontWeight: '600' },
});

const fStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_COLORS.fillMedium,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '700', color: IOS_COLORS.label },
  sub: { marginTop: 3, fontSize: 13, color: IOS_COLORS.labelSecondary },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: IOS_COLORS.labelSecondary,
    fontWeight: '600',
  },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  reasonChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: IOS_COLORS.fillLight,
  },
  reasonChipActive: { backgroundColor: '#FDECEC' },
  reasonChipText: { fontSize: 12, color: IOS_COLORS.labelSecondary, fontWeight: '600' },
  reasonChipTextActive: { color: IOS_COLORS.red },
  inputBox: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.fillLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    minHeight: 44,
    color: IOS_COLORS.label,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(118,118,128,0.12)',
    paddingVertical: 12,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: IOS_COLORS.label },
  confirmBtn: {
    flex: 1.4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.red,
    paddingVertical: 12,
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
