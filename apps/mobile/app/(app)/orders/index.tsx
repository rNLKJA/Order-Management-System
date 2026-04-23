/**
 * 每日订餐录入页 —— MEA-12。
 *
 * 功能：
 * - 今日 pending 订单列表（按 pending 状态过滤）
 * - 顶部日期选择器（默认今日；桌面场景默认明天）
 * - "快速录入"按钮 → OrderEntryModal
 * - 每条订单显示：会员名 / 餐别 Badge / 份数 / 状态
 */

import { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  Divider,
  useTheme,
  ActivityIndicator,
  FAB,
} from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { ordersApi, type DailyOrder } from '../../../api/orders';
import { OrderEntryModal } from '../../../components/OrderEntryModal';

function todayDate(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function tomorrowDate(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待出餐',
  fulfilled: '已出餐',
  delivered: '已送达',
  cancelled: '已取消',
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  lunch: '午',
  dinner: '晚',
};

function OrderCard({ order }: { order: DailyOrder }) {
  const theme = useTheme();
  const mealColor = order.meal_type === 'lunch' ? '#F59E0B' : '#6366F1';
  const statusColor =
    order.status === 'cancelled'
      ? theme.colors.error
      : order.status === 'delivered'
      ? '#10B981'
      : order.status === 'fulfilled'
      ? '#0EA5E9'
      : theme.colors.secondary;

  return (
    <Card mode="outlined" style={styles.orderCard}>
      <Card.Content style={styles.orderContent}>
        <View style={styles.orderRow}>
          <Chip
            compact
            style={[styles.mealBadge, { backgroundColor: mealColor }]}
            textStyle={{ color: 'white', fontWeight: '700' }}
          >
            {MEAL_TYPE_LABELS[order.meal_type]}
          </Chip>
          <Text variant="bodyLarge" style={{ flex: 1, marginLeft: 8 }}>
            {order.quantity} 份
          </Text>
          <Chip
            compact
            style={[styles.statusBadge, { borderColor: statusColor }]}
            textStyle={{ color: statusColor }}
            mode="outlined"
          >
            {STATUS_LABELS[order.status] ?? order.status}
          </Chip>
        </View>
        {order.notes ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            备注：{order.notes}
          </Text>
        ) : null}
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
          {order.card_id ? '订阅卡扣减' : `散餐 ¥${order.amount}`}
        </Text>
      </Card.Content>
    </Card>
  );
}

export default function OrdersScreen() {
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async (date: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await ordersApi.list({ date, status: 'all' });
      setOrders(res.orders);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOrders(selectedDate);
    }, [loadOrders, selectedDate]),
  );

  const handleDateChange = (offset: number) => {
    const base = new Date(selectedDate + 'T00:00:00+08:00');
    base.setDate(base.getDate() + offset);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    const newDate = `${yyyy}-${mm}-${dd}`;
    setSelectedDate(newDate);
    void loadOrders(newDate);
  };

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const otherOrders = orders.filter((o) => o.status !== 'pending');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 日期导航 */}
      <View style={[styles.dateBar, { backgroundColor: theme.colors.surface }]}>
        <Button compact onPress={() => handleDateChange(-1)}>
          &lt;
        </Button>
        <View style={styles.dateCenter}>
          <Text variant="titleMedium" style={{ fontWeight: '700' }}>
            {selectedDate}
          </Text>
          <Button
            compact
            onPress={() => { setSelectedDate(todayDate()); void loadOrders(todayDate()); }}
            style={{ marginTop: -4 }}
          >
            今天
          </Button>
        </View>
        <Button compact onPress={() => handleDateChange(1)}>
          &gt;
        </Button>
      </View>

      {/* 快捷按钮 */}
      <View style={styles.quickRow}>
        <Button
          mode="outlined"
          icon="calendar-today"
          onPress={() => { setSelectedDate(todayDate()); void loadOrders(todayDate()); }}
          compact
        >
          今天
        </Button>
        <Button
          mode="outlined"
          icon="calendar-arrow-right"
          onPress={() => { setSelectedDate(tomorrowDate()); void loadOrders(tomorrowDate()); }}
          compact
        >
          明天
        </Button>
      </View>

      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={[...pendingOrders, ...otherOrders]}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <>
              {index === pendingOrders.length && otherOrders.length > 0 && index > 0 && (
                <Divider style={{ marginVertical: 8 }} />
              )}
              <OrderCard order={item} />
            </>
          )}
          ListHeaderComponent={
            orders.length > 0 ? (
              <Text variant="bodySmall" style={[styles.summary, { color: theme.colors.onSurfaceVariant }]}>
                共 {orders.length} 条 · 待出餐 {pendingOrders.length} 条
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              {selectedDate} 暂无订单
            </Text>
          }
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadOrders(selectedDate, true)}
            />
          }
        />
      )}

      {/* 快速录入 FAB */}
      <FAB
        icon="plus"
        label="快速录入"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setShowModal(true)}
      />

      <OrderEntryModal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        defaultDate={selectedDate}
        onSuccess={() => {
          setShowModal(false);
          void loadOrders(selectedDate);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  list: {
    padding: 12,
    paddingBottom: 100,
  },
  orderCard: {
    marginBottom: 8,
    borderRadius: 10,
  },
  orderContent: {
    paddingVertical: 8,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealBadge: {
    height: 28,
    borderRadius: 6,
  },
  statusBadge: {
    height: 28,
    borderRadius: 6,
  },
  summary: {
    marginBottom: 8,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    padding: 16,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    borderRadius: 16,
  },
});
