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
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, type ApiUserOrder } from '../../../api/users';
import { COLORS, GLASS, SPACING, TYPE } from '../../../theme/paperTheme';
import {
  AppHeader,
  Bento,
  BentoGrid,
  GlassSurface,
  IconAvatar,
  MeshBackground,
  PressableCard,
  SectionLabel,
  StatTile,
  StatusChip,
} from '../../../components/ui';

const STATUS_LABEL = {
  pending: { label: '待出餐', fg: COLORS.warning, bg: COLORS.warningSoft, chip: 'warning' as const },
  fulfilled: { label: '已出餐', fg: COLORS.brand, bg: COLORS.brandSoft, chip: 'info' as const },
  delivered: { label: '已送达', fg: COLORS.success, bg: COLORS.successSoft, chip: 'success' as const },
  cancelled: { label: '已取消', fg: COLORS.text.secondary, bg: GLASS.surface3, chip: 'neutral' as const },
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
            <GlassSurface tint="danger" padding={SPACING.base} style={styles.messageCard}>
              <IconAvatar
                icon="alert-circle-outline"
                size={32}
                color={COLORS.danger}
                bg="rgba(255,59,48,0.14)"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.messageTitle}>用户 ID 不合法</Text>
                <Text style={styles.messageSub}>请从员工列表重新进入详情页。</Text>
              </View>
            </GlassSurface>
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
            <ActivityIndicator color={COLORS.brand} />
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
          <GlassSurface padding={SPACING.base} style={styles.heroCard}>
            <View style={styles.heroRow}>
              <IconAvatar
                icon={user.role === 'admin' ? 'shield-checkmark-outline' : 'person-outline'}
                size={48}
                color={user.role === 'admin' ? COLORS.brand : COLORS.text.secondary}
                  bg={user.role === 'admin' ? COLORS.brandSoft : GLASS.surface3}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.heroTitleRow}>
                  <Text style={styles.heroTitle}>{user.full_name || user.username}</Text>
                  <StatusChip
                    label={user.role === 'admin' ? '管理员' : '员工'}
                    variant={user.role === 'admin' ? 'hospital' : 'neutral'}
                  />
                </View>
                <Text style={styles.heroSub}>@{user.username}</Text>
              </View>
            </View>
          </GlassSurface>

          <SectionLabel>账户概览</SectionLabel>
          <BentoGrid>
            <Bento span={4}>
              <StatTile
                label="累计录单"
                value={String(stats?.total_orders ?? '—')}
                icon="receipt-outline"
                color={COLORS.brand}
              />
            </Bento>
            <Bento span={4}>
              <StatTile
                label="餐数"
                value={String(stats?.total_meals ?? '—')}
                icon="restaurant-outline"
                color={COLORS.warning}
              />
            </Bento>
            <Bento span={4}>
              <StatTile
                label="累计金额"
                value={stats ? `¥${Number(stats.total_amount ?? 0).toFixed(0)}` : '—'}
                icon="cash-outline"
                color={COLORS.success}
              />
            </Bento>
          </BentoGrid>

          {stats ? (
            <GlassSurface padding={SPACING.sm} style={styles.breakdownRow}>
              <StatusChip label={`待出餐 ${stats.pending_count}`} variant="warning" dot />
              <StatusChip label={`已出餐 ${stats.fulfilled_count}`} variant="fulfilled" dot />
              <StatusChip label={`已送达 ${stats.delivered_count}`} variant="delivered" dot />
              <StatusChip label={`已取消 ${stats.cancelled_count}`} variant="neutral" dot />
            </GlassSurface>
          ) : null}

          <SectionLabel>订单流水</SectionLabel>
          <GlassSurface padding={SPACING.base} style={styles.filterCard}>
            <Text style={styles.filterLabel}>状态筛选</Text>
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
                  <PressableCard
                    key={s}
                    padding={8}
                    tint={active ? 'info' : undefined}
                    level={1}
                    onPress={() => setStatusFilter(s)}
                    style={styles.filterChip}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {label}
                    </Text>
                  </PressableCard>
                );
              })}
            </View>
            <Text style={[styles.filterLabel, { marginTop: SPACING.sm }]}>每次加载</Text>
            <View style={styles.filterBar}>
              {LIMIT_OPTIONS.map((n) => (
                <PressableCard
                  key={n}
                  padding={8}
                  tint={limit === n ? 'info' : undefined}
                  level={1}
                  onPress={() => setLimit(n)}
                  style={styles.limitChip}
                >
                  <Text style={[styles.filterChipText, limit === n && styles.filterChipTextActive]}>
                    {n}
                  </Text>
                </PressableCard>
              ))}
            </View>
          </GlassSurface>

          {ordQ.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.brand} />
            </View>
          ) : orders.length === 0 ? (
            <GlassSurface padding={SPACING.lg} style={styles.emptyCard}>
              <IconAvatar icon="document-text-outline" size={36} color={COLORS.text.tertiary} bg={GLASS.surface3} />
              <Text style={styles.messageTitle}>该员工暂无录单记录</Text>
              <Text style={styles.messageSub}>可先回到订餐页面录入后再查看。</Text>
            </GlassSurface>
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
    <PressableCard
      onPress={() => router.push(target as never)}
      padding={SPACING.sm}
      style={styles.orderRow}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.orderTop}>
          <Text style={styles.orderName} numberOfLines={1}>
            {displayName}
          </Text>
          {isWalkin ? (
            <StatusChip label="散客" variant="warning" />
          ) : null}
          {isAdhoc && !isWalkin ? (
            <StatusChip label="散餐" variant="warning" />
          ) : null}
          {o.delivery_channel === 'courier' ? (
            <StatusChip label="快递" variant="hospital" />
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
      <StatusChip label={status.label} fg={status.fg} bg={status.bg} dot />
      <Ionicons
        name="chevron-forward"
        size={16}
        color={COLORS.text.quaternary}
        style={{ marginLeft: 4 }}
      />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.lg, gap: SPACING.sm },
  messageCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.page },
  messageTitle: { ...TYPE.body, color: COLORS.text.primary, fontWeight: '700' },
  messageSub: { ...TYPE.footnote, color: COLORS.text.secondary, marginTop: 2 },
  heroCard: { marginHorizontal: SPACING.page, marginTop: SPACING.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  heroTitle: { ...TYPE.title3, color: COLORS.text.primary },
  heroSub: { ...TYPE.footnote, color: COLORS.text.secondary, marginTop: 2 },
  breakdownRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: SPACING.page,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  filterCard: { marginHorizontal: SPACING.page },
  filterLabel: { ...TYPE.caption, color: COLORS.text.tertiary },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 6,
  },
  filterChip: { minWidth: 64, alignItems: 'center' },
  limitChip: { minWidth: 54, alignItems: 'center' },
  filterChipText: { ...TYPE.caption, color: COLORS.text.secondary, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.brand },
  dayBlock: { paddingHorizontal: SPACING.page, marginBottom: SPACING.sm },
  dayHeader: {
    ...TYPE.callout,
    fontWeight: '700',
    color: COLORS.text.primary,
    paddingVertical: SPACING.xs,
  },
  dayCount: { fontWeight: '400', color: COLORS.text.secondary },

  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  orderName: { ...TYPE.body, fontWeight: '700', color: COLORS.text.primary },
  orderMeta: { ...TYPE.footnote, color: COLORS.text.secondary, marginTop: 2 },
  orderNotes: { ...TYPE.footnote, color: COLORS.warning, marginTop: 2 },
  emptyCard: {
    alignItems: 'center',
    gap: SPACING.xs,
    marginHorizontal: SPACING.page,
    marginTop: SPACING.sm,
  },
});
