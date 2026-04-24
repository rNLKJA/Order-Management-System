/**
 * 员工详情页 —— 某员工录入的订单流水 + 聚合统计。
 *
 * 数据：
 *  - `/api/users/:id`                  基本信息
 *  - `/api/users/:id/order-summary`    聚合统计（总单数、总餐数、总金额、各状态数）
 *  - `/api/users/:id/orders`           明细流水，按日期+创建时间倒序，支持分页
 *
 * 暂不支持删除订单（取消走订单详情走 cancel 路由），这里是只读视图。
 */

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, type ApiUserOrder } from '../../../api/users';
import { IOS_COLORS } from '../../../theme/paperTheme';
import { AppHeader, MeshBackground } from '../../../components/ui';

const STATUS_LABEL = {
  pending: { label: '待出餐', fg: IOS_COLORS.orange, bg: '#FFF4E5' },
  fulfilled: { label: '已出餐', fg: IOS_COLORS.blue, bg: IOS_COLORS.blueLight },
  delivered: { label: '已送达', fg: '#34C759', bg: '#E8F8ED' },
  cancelled: { label: '已取消', fg: IOS_COLORS.labelSecondary, bg: IOS_COLORS.fillLight },
} as const;
const LIMIT_OPTIONS = [10, 50, 100, 200] as const;
type LimitOption = (typeof LIMIT_OPTIONS)[number];
type StatusFilter = 'all' | 'pending' | 'fulfilled' | 'delivered' | 'cancelled';

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const [limit, setLimit] = useState<LimitOption>(50);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const userQ = useQuery({
    queryKey: ['users', userId],
    enabled: Number.isFinite(userId) && userId > 0,
    queryFn: async () => (await usersApi.get(userId)).user,
  });

  const sumQ = useQuery({
    queryKey: ['users', userId, 'summary'],
    enabled: Number.isFinite(userId) && userId > 0,
    queryFn: () => usersApi.orderSummary(userId),
  });

  const ordQ = useQuery({
    queryKey: ['users', userId, 'orders', statusFilter, limit],
    enabled: Number.isFinite(userId) && userId > 0,
    queryFn: async () =>
      (
        await usersApi.orders(userId, {
          status: statusFilter,
          limit,
        })
      ).orders,
  });

  const user = userQ.data;
  const stats = sumQ.data;
  const orders = ordQ.data ?? [];

  const byDate = useMemo(() => {
    const map = new Map<string, ApiUserOrder[]>();
    for (const o of orders) {
      const k = o.order.order_date;
      const arr = map.get(k) ?? [];
      arr.push(o);
      map.set(k, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [orders]);

  if (!Number.isFinite(userId) || userId <= 0) {
    return (
      <View style={styles.root}>
        <MeshBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <AppHeader title="员工详情" onBack={() => router.back()} />
          <View style={styles.center}>
            <Text style={styles.muted}>用户 id 非法</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (userQ.isLoading || !user) {
    return (
      <View style={styles.root}>
        <MeshBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <AppHeader title="员工详情" onBack={() => router.back()} />
          <View style={styles.center}>
            <ActivityIndicator color={IOS_COLORS.blue} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader
          title={user.full_name || user.username}
          subtitle={`@${user.username} · ${user.role === 'admin' ? '管理员' : '员工'}`}
          onBack={() => router.back()}
        />

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {/* 统计卡 */}
          <View style={styles.statsGrid}>
            <StatTile value={stats?.total_orders ?? '—'} label="累计录单" />
            <StatTile value={stats?.total_meals ?? '—'} label="餐数" />
            <StatTile
              value={stats ? `¥${Number(stats.total_amount ?? 0).toFixed(0)}` : '—'}
              label="累计金额"
            />
          </View>

          {stats ? (
            <View style={styles.breakdownRow}>
              <StatusChip label="待出餐" count={stats.pending_count} color={IOS_COLORS.orange} />
              <StatusChip label="已出餐" count={stats.fulfilled_count} color={IOS_COLORS.blue} />
              <StatusChip label="已送达" count={stats.delivered_count} color="#34C759" />
              <StatusChip
                label="已取消"
                count={stats.cancelled_count}
                color={IOS_COLORS.labelSecondary}
              />
            </View>
          ) : null}

          {/* 明细 */}
          <Text style={styles.sectionTitle}>订单流水</Text>
          <View style={styles.filterBar}>
            {(['all', 'pending', 'fulfilled', 'delivered', 'cancelled'] as const).map((s) => {
              const active = statusFilter === s;
              const label =
                s === 'all'
                  ? '全部'
                  : s === 'pending'
                    ? '待出餐'
                    : s === 'fulfilled'
                      ? '已出餐'
                      : s === 'delivered'
                        ? '已送达'
                        : '已取消';
              return (
                <Pressable
                  key={s}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setStatusFilter(s)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.limitRow}>
            <Text style={styles.limitLabel}>每次加载</Text>
            {LIMIT_OPTIONS.map((n) => (
              <Pressable
                key={n}
                style={[styles.limitChip, limit === n && styles.limitChipActive]}
                onPress={() => setLimit(n)}
              >
                <Text style={[styles.limitChipText, limit === n && styles.limitChipTextActive]}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>

          {ordQ.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={IOS_COLORS.blue} />
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>该员工暂无录单记录</Text>
            </View>
          ) : (
            byDate.map(([date, list]) => (
              <View key={date} style={styles.dayBlock}>
                <Text style={styles.dayHeader}>
                  {date}
                  <Text style={styles.dayCount}> · {list.length} 单</Text>
                </Text>
                {list.map((item) => (
                  <OrderRow key={item.order.id} item={item} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function OrderRow({ item }: { item: ApiUserOrder }) {
  const o = item.order;
  const m = item.member;
  const isWalkin = !!o.customer_name || !!m?.is_walkin;
  const displayName = o.customer_name || m?.nickname || m?.name || '—';
  const status = STATUS_LABEL[o.status];
  const isAdhoc = o.card_id == null;

  const target = isWalkin
    ? { pathname: '/(app)/walkins/[id]', params: { id: String(o.member_id) } }
    : { pathname: '/(app)/members/[id]', params: { id: String(o.member_id) } };

  return (
    <Pressable
      onPress={() => router.push(target as never)}
      style={({ pressed }) => [
        styles.orderRow,
        pressed && { backgroundColor: IOS_COLORS.fillLight },
      ]}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.orderTop}>
          <Text style={styles.orderName} numberOfLines={1}>
            {displayName}
          </Text>
          {isWalkin ? (
            <View style={[styles.chip, { backgroundColor: '#FFF4E5' }]}>
              <Text style={[styles.chipText, { color: '#FF9500' }]}>散客</Text>
            </View>
          ) : null}
          {isAdhoc && !isWalkin ? (
            <View style={[styles.chip, { backgroundColor: '#FFF4E5' }]}>
              <Text style={[styles.chipText, { color: '#FF9500' }]}>散餐</Text>
            </View>
          ) : null}
          {o.delivery_channel === 'courier' ? (
            <View style={[styles.chip, { backgroundColor: '#F5E9FC' }]}>
              <Text style={[styles.chipText, { color: '#AF52DE' }]}>快递</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.orderMeta} numberOfLines={1}>
          {o.meal_type === 'lunch' ? '午餐' : '晚餐'} · {o.quantity} 份
          {o.amount > 0 ? ` · ¥${o.amount}` : ''}
        </Text>
        {o.notes ? (
          <Text style={styles.orderNotes} numberOfLines={1}>
            备注：{o.notes}
          </Text>
        ) : null}
      </View>
      <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
        <Text style={[styles.statusChipText, { color: status.fg }]}>{status.label}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={IOS_COLORS.labelTertiary}
        style={{ marginLeft: 4 }}
      />
    </Pressable>
  );
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.breakChip}>
      <Text style={[styles.breakCount, { color }]}>{count}</Text>
      <Text style={styles.breakLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 },
  muted: { fontSize: 14, color: IOS_COLORS.labelSecondary },

  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  statTile: {
    flex: 1,
    backgroundColor: IOS_COLORS.card,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: IOS_COLORS.label },
  statLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary },

  breakdownRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexWrap: 'wrap',
  },
  breakChip: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
    backgroundColor: IOS_COLORS.card,
    borderRadius: 10,
    paddingVertical: 8,
  },
  breakCount: { fontSize: 16, fontWeight: '700' },
  breakLabel: { fontSize: 11, color: IOS_COLORS.labelSecondary, marginTop: 2 },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.fillLight,
  },
  filterChipActive: { backgroundColor: IOS_COLORS.blueLight },
  filterChipText: { fontSize: 12, color: IOS_COLORS.labelSecondary, fontWeight: '600' },
  filterChipTextActive: { color: IOS_COLORS.blue },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  limitLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  limitChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.fillLight,
  },
  limitChipActive: { backgroundColor: IOS_COLORS.blueLight },
  limitChipText: { fontSize: 12, color: IOS_COLORS.labelSecondary, fontWeight: '600' },
  limitChipTextActive: { color: IOS_COLORS.blue },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 8,
  },

  dayBlock: { paddingHorizontal: 16, marginBottom: 10 },
  dayHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.label,
    paddingVertical: 6,
  },
  dayCount: { fontWeight: '400', color: IOS_COLORS.labelSecondary },

  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: IOS_COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  orderName: { fontSize: 15, fontWeight: '700', color: IOS_COLORS.label },
  orderMeta: { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: 2 },
  orderNotes: { fontSize: 12, color: IOS_COLORS.orange, marginTop: 2 },

  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  chipText: { fontSize: 10, fontWeight: '700' },

  statusChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
});
