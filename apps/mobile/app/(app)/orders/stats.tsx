/**
 * 订单统计 — 日期范围汇总页。
 *
 * 设计对齐 `finance/index.tsx`：顶部 AppHeader + Mesh 背景 + Bento 速览 + GlassSurface 明细。
 *
 * 数据：GET /api/orders?from=&to=&limit=500
 * - 份数口径：cancelled 不计入「有效份数」；但会独立统计一列供核对。
 * - 收入口径：只有散客订单（customer_name 非空）会在订单层产生收入，会员订单收入已在购卡时记账，
 *   本页把这两口径分开显示，避免被误解为总收入。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text } from 'react-native-paper';
import { formatDate } from '@meal/shared';
import {
  AppHeader,
  Bento,
  BentoGrid,
  DatePicker,
  GlassSurface,
  MeshBackground,
  SectionLabel,
  StatTile,
} from '../../../components/ui';
import { ordersApi, type DailyOrder } from '../../../api/orders';
import { useMembersView } from '../../../hooks/useMembersView';
import { COLORS, RADIUS, SPACING, TYPE } from '../../../theme/paperTheme';

type ZoneFilter = 'all' | 'hospital' | 'regular';

function firstOfMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${y}-${m}-01`;
}

function diffDaysInclusive(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const ms = t.getTime() - f.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 1;
  return Math.floor(ms / 86_400_000) + 1;
}

interface Totals {
  orders: number;
  meals: number;
  lunch: number;
  dinner: number;
  pending: number;
  fulfilled: number;
  delivered: number;
  cancelled: number;
  memberOrders: number;
  walkinOrders: number;
  walkinRevenue: number;
}

interface DailyBucket {
  date: string;
  lunch: number;
  dinner: number;
  meals: number;
  walkin: number;
  member: number;
}

function emptyTotals(): Totals {
  return {
    orders: 0,
    meals: 0,
    lunch: 0,
    dinner: 0,
    pending: 0,
    fulfilled: 0,
    delivered: 0,
    cancelled: 0,
    memberOrders: 0,
    walkinOrders: 0,
    walkinRevenue: 0,
  };
}

export default function OrdersStatsScreen() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(() => formatDate(new Date()));
  const [zone, setZone] = useState<ZoneFilter>('all');

  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membersView = useMembersView();

  const memberZoneById = useMemo(() => {
    const map: Record<number, 'hospital' | 'regular'> = {};
    for (const m of membersView.data ?? []) {
      map[m.id] = m.is_hospital ? 'hospital' : 'regular';
    }
    return map;
  }, [membersView.data]);

  const memberNameById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const m of membersView.data ?? []) {
      map[m.id] = m.nickname || m.name;
    }
    return map;
  }, [membersView.data]);

  const fetchOrders = useCallback(
    async (mode: 'load' | 'refresh' = 'load') => {
      if (mode === 'load') setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const res = await ordersApi.list({
          from,
          to,
          status: 'all',
          limit: 500,
        });
        setOrders(res.orders);
      } catch (e) {
        setOrders([]);
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to],
  );

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const filtered = useMemo(() => {
    if (zone === 'all') return orders;
    return orders.filter((o) => {
      const isWalkin = (o.customer_name ?? '').trim().length > 0;
      if (isWalkin) return zone === 'regular';
      return memberZoneById[o.member_id] === zone;
    });
  }, [orders, zone, memberZoneById]);

  const { totals, byDay, byMember } = useMemo(() => {
    const t = emptyTotals();
    const dayMap = new Map<string, DailyBucket>();
    const memberMap = new Map<
      number | string,
      {
        key: number | string;
        label: string;
        meals: number;
        walkin: boolean;
        member_id: number;
      }
    >();

    for (const o of filtered) {
      const isWalkin = (o.customer_name ?? '').trim().length > 0;
      const isCancelled = o.status === 'cancelled';

      if (!isCancelled) {
        t.orders += 1;
        t.meals += o.quantity;
        if (o.meal_type === 'lunch') t.lunch += o.quantity;
        else t.dinner += o.quantity;
      }

      if (o.status === 'pending') t.pending += o.quantity;
      else if (o.status === 'fulfilled') t.fulfilled += o.quantity;
      else if (o.status === 'delivered') t.delivered += o.quantity;
      else if (o.status === 'cancelled') t.cancelled += o.quantity;

      if (!isCancelled) {
        if (isWalkin) {
          t.walkinOrders += 1;
          t.walkinRevenue += o.amount ?? 0;
        } else {
          t.memberOrders += 1;
        }
      }

      if (!isCancelled) {
        const day = dayMap.get(o.order_date) ?? {
          date: o.order_date,
          lunch: 0,
          dinner: 0,
          meals: 0,
          walkin: 0,
          member: 0,
        };
        day.meals += o.quantity;
        if (o.meal_type === 'lunch') day.lunch += o.quantity;
        else day.dinner += o.quantity;
        if (isWalkin) day.walkin += o.quantity;
        else day.member += o.quantity;
        dayMap.set(o.order_date, day);

        const key = isWalkin ? `walkin:${o.member_id}` : o.member_id;
        const label = isWalkin
          ? (o.customer_name || '散客')
          : (memberNameById[o.member_id] ?? `会员 #${o.member_id}`);
        const cur = memberMap.get(key) ?? { key, label, meals: 0, walkin: isWalkin, member_id: o.member_id };
        cur.meals += o.quantity;
        memberMap.set(key, cur);
      }
    }

    const byDay = Array.from(dayMap.values()).sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );
    const byMember = Array.from(memberMap.values())
      .sort((a, b) => b.meals - a.meals)
      .slice(0, 10);

    return { totals: t, byDay, byMember };
  }, [filtered, memberNameById]);

  const days = diffDaysInclusive(from, to);
  const avgPerDay = days > 0 ? (totals.meals / days).toFixed(1) : '0';

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader title="订单统计" subtitle={`${from} ~ ${to}`} />

        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchOrders('refresh')}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={styles.block}>
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>加载失败：{error}</Text>
              </View>
            </View>
          ) : null}

          {/* 筛选 */}
          <View style={styles.block}>
            <SectionLabel>筛选</SectionLabel>
            <GlassSurface padding={SPACING.md} style={styles.filterCard}>
              <View style={styles.dateRow}>
                <DatePicker
                  label="起"
                  value={from}
                  onChange={setFrom}
                  max={to || undefined}
                  style={styles.dateField}
                />
                <DatePicker
                  label="止"
                  value={to}
                  onChange={setTo}
                  min={from || undefined}
                  style={styles.dateField}
                />
              </View>

              <View style={styles.segmentedBar}>
                {(['all', 'hospital', 'regular'] as const).map((v) => {
                  const active = zone === v;
                  return (
                    <Pressable
                      key={v}
                      style={[styles.segment, active && styles.segmentActive]}
                      onPress={() => setZone(v)}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          active && styles.segmentTextActive,
                        ]}
                      >
                        {v === 'all' ? '全部' : v === 'hospital' ? '院内' : '院外'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassSurface>
          </View>

          {/* 汇总速览（4 格） */}
          <View style={styles.block}>
            <SectionLabel>{`汇总 · ${days} 天`}</SectionLabel>
            <BentoGrid gap={SPACING.md}>
              <Bento span={3} mobileSpan={6}>
                <StatTile
                  label="订单条数"
                  value={`${totals.orders}`}
                  icon="receipt-outline"
                  color={COLORS.brand}
                  tint="info"
                  hint={`取消 ${totals.cancelled}`}
                />
              </Bento>
              <Bento span={3} mobileSpan={6}>
                <StatTile
                  label="有效份数"
                  value={`${totals.meals}`}
                  icon="restaurant-outline"
                  color={COLORS.success}
                  tint="ok"
                  hint={`日均 ${avgPerDay}`}
                />
              </Bento>
              <Bento span={3} mobileSpan={6}>
                <StatTile
                  label="午餐份数"
                  value={`${totals.lunch}`}
                  icon="sunny-outline"
                  color={COLORS.warning}
                  tint="warn"
                />
              </Bento>
              <Bento span={3} mobileSpan={6}>
                <StatTile
                  label="晚餐份数"
                  value={`${totals.dinner}`}
                  icon="moon-outline"
                  color={COLORS.info}
                  tint="info"
                />
              </Bento>
            </BentoGrid>
          </View>

          {/* 状态分布 */}
          <View style={styles.block}>
            <SectionLabel>状态分布（份数）</SectionLabel>
            <GlassSurface padding={SPACING.md}>
              <StatusRow
                label="待出餐"
                value={totals.pending}
                color={COLORS.warning}
              />
              <StatusRow
                label="已出餐"
                value={totals.fulfilled}
                color={COLORS.brand}
              />
              <StatusRow
                label="已送达"
                value={totals.delivered}
                color={COLORS.success}
              />
              <StatusRow
                label="已取消"
                value={totals.cancelled}
                color={COLORS.text.tertiary}
                isLast
              />
            </GlassSurface>
          </View>

          {/* 会员 vs 散客 */}
          <View style={styles.block}>
            <SectionLabel>会员 vs 散客</SectionLabel>
            <BentoGrid gap={SPACING.md}>
              <Bento span={6} mobileSpan={6}>
                <StatTile
                  label="会员订单"
                  value={`${totals.memberOrders}`}
                  icon="people-outline"
                  color={COLORS.brand}
                  tint="info"
                  hint="收入记在购卡时"
                />
              </Bento>
              <Bento span={6} mobileSpan={6}>
                <StatTile
                  label="散客订单"
                  value={`${totals.walkinOrders}`}
                  icon="walk-outline"
                  color={COLORS.warning}
                  tint="warn"
                  hint={`收入 ¥${totals.walkinRevenue.toLocaleString()}`}
                />
              </Bento>
            </BentoGrid>
          </View>

          {/* TOP 10 会员 / 散客 */}
          <View style={styles.block}>
            <SectionLabel>点单最多（Top 10）</SectionLabel>
            {byMember.length === 0 ? (
              <GlassSurface padding={SPACING.lg}>
                <Text style={styles.emptyText}>当前筛选条件下没有订单</Text>
              </GlassSurface>
            ) : (
              <GlassSurface padding={SPACING.md}>
                {byMember.map((r, idx) => (
                  <Pressable
                    key={String(r.key)}
                    onPress={() =>
                      router.push(
                        (r.walkin
                          ? { pathname: '/(app)/walkins/[id]', params: { id: String(r.member_id) } }
                          : { pathname: '/(app)/members/[id]', params: { id: String(r.member_id) } }) as never,
                      )
                    }
                    style={[
                      styles.rankRow,
                      idx === byMember.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.rankLeft}>
                      <View style={[styles.rankBadge, rankBadgeColor(idx)]}>
                        <Text style={styles.rankBadgeText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.rankName} numberOfLines={1}>
                        {r.label}
                      </Text>
                      {r.walkin ? (
                        <View style={styles.walkinTag}>
                          <Text style={styles.walkinTagText}>散客</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rankValue}>{r.meals} 份</Text>
                  </Pressable>
                ))}
              </GlassSurface>
            )}
          </View>

          {/* 按日明细 */}
          <View style={styles.block}>
            <SectionLabel>{`按日明细（${byDay.length} 天）`}</SectionLabel>
            {loading && orders.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : byDay.length === 0 ? (
              <GlassSurface padding={SPACING.lg}>
                <Text style={styles.emptyText}>当前筛选条件下没有订单</Text>
              </GlassSurface>
            ) : (
              byDay.map((d) => (
                <GlassSurface
                  key={d.date}
                  padding={SPACING.md}
                  style={styles.dayCard}
                >
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayDate}>{d.date}</Text>
                    <Text style={styles.dayTotal}>{d.meals} 份</Text>
                  </View>
                  <View style={styles.dayBreakdown}>
                    <Pill icon="sunny-outline" label={`午 ${d.lunch}`} color={COLORS.warning} />
                    <Pill icon="moon-outline" label={`晚 ${d.dinner}`} color={COLORS.info} />
                    <Pill icon="people-outline" label={`会员 ${d.member}`} color={COLORS.brand} />
                    {d.walkin > 0 ? (
                      <Pill
                        icon="walk-outline"
                        label={`散客 ${d.walkin}`}
                        color={COLORS.warning}
                      />
                    ) : null}
                  </View>
                </GlassSurface>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// Small pieces
// ============================================================

function StatusRow({
  label,
  value,
  color,
  isLast,
}: {
  label: string;
  value: number;
  color: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.statusRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={styles.statusLeft}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={styles.statusLabel}>{label}</Text>
      </View>
      <Text style={styles.statusValue}>{value} 份</Text>
    </View>
  );
}

function Pill({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.pill, { borderColor: color + '55' }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function rankBadgeColor(idx: number): { backgroundColor: string } {
  if (idx === 0) return { backgroundColor: COLORS.warning };
  if (idx === 1) return { backgroundColor: COLORS.brand };
  if (idx === 2) return { backgroundColor: COLORS.success };
  return { backgroundColor: 'rgba(118,118,128,0.2)' };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  container: {
    padding: SPACING.md,
    paddingBottom: 48,
    width: '100%',
    maxWidth: SPACING.maxWidth,
    alignSelf: 'center',
  },
  block: { marginBottom: SPACING.lg },

  errorBanner: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.2)',
  },
  errorBannerText: { ...TYPE.footnote, color: COLORS.danger },

  filterCard: { gap: SPACING.md },
  dateRow: { flexDirection: 'row', gap: SPACING.sm },
  dateField: { flex: 1 },

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
  segmentText: { fontSize: 13, color: COLORS.text.secondary, fontWeight: '500' },
  segmentTextActive: { color: COLORS.text.primary, fontWeight: '600' },

  // status rows
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { ...TYPE.body, color: COLORS.text.primary },
  statusValue: {
    ...TYPE.body,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // rank
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    gap: SPACING.sm,
  },
  rankLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  rankName: { ...TYPE.body, color: COLORS.text.primary, flexShrink: 1 },
  rankValue: {
    ...TYPE.body,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  walkinTag: {
    backgroundColor: 'rgba(255,149,0,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  walkinTagText: { fontSize: 11, color: COLORS.warning, fontWeight: '600' },

  // day cards
  dayCard: { marginBottom: SPACING.sm, gap: SPACING.sm },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayDate: {
    ...TYPE.headline,
    color: COLORS.text.primary,
    fontVariant: ['tabular-nums'],
  },
  dayTotal: {
    ...TYPE.title3,
    color: COLORS.brand,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dayBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },

  emptyText: {
    ...TYPE.body,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
});
