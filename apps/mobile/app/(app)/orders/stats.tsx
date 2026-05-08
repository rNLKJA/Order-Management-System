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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import {
  addCalendarDaysShanghai,
  addCalendarYearsShanghai,
  diffCalendarDaysInclusiveShanghai,
  formatCNY,
  formatDate,
} from '@meal/shared';
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
import { COLORS, RADIUS, SPACING, TYPE } from '../../../theme/paperTheme';
import { useScrollToTopOnFocus } from '../../../hooks/useScrollToTopOnFocus';

type ChartRange = 'today' | 'week' | 'month' | 'year' | 'custom';

function diffDaysInclusive(from: string, to: string): number {
  return diffCalendarDaysInclusiveShanghai(from, to);
}

function startOfRange(range: ChartRange, endDate: string): string {
  if (range === 'today') return endDate;
  if (range === 'week') return addCalendarDaysShanghai(endDate, -6);
  if (range === 'month') return addCalendarDaysShanghai(endDate, -29);
  if (range === 'year') return addCalendarYearsShanghai(endDate, -1);
  return endDate;
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
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(scrollRef);

  const [chartRange, setChartRange] = useState<ChartRange>('today');
  const [from, setFrom] = useState(() => formatDate(new Date()));
  const [to, setTo] = useState(() => formatDate(new Date()));

  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { effectiveFrom, effectiveTo } = useMemo(() => {
    if (from <= to) return { effectiveFrom: from, effectiveTo: to };
    return { effectiveFrom: to, effectiveTo: from };
  }, [from, to]);

  const fetchOrders = useCallback(
    async (mode: 'load' | 'refresh' = 'load') => {
      if (mode === 'refresh') setRefreshing(true);
      setError(null);
      try {
        const res = await ordersApi.list({
          from: effectiveFrom,
          to: effectiveTo,
          status: 'all',
          limit: 200,
        });
        setOrders(res.orders);
      } catch (e) {
        setOrders([]);
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setRefreshing(false);
      }
    },
    [effectiveFrom, effectiveTo],
  );

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const applyChartRange = useCallback((range: ChartRange) => {
    const end = formatDate(new Date());
    setChartRange(range);
    setTo(end);
    setFrom(startOfRange(range, end));
  }, []);

  const onChangeFrom = useCallback((next: string) => {
    setChartRange('custom');
    setFrom(next);
  }, []);

  const onChangeTo = useCallback((next: string) => {
    setChartRange('custom');
    setTo(next);
  }, []);

  const filtered = useMemo(() => orders, [orders]);

  const { totals, byDay, statusSnapshot } = useMemo(() => {
    const t = emptyTotals();
    const dayMap = new Map<string, DailyBucket>();

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
      }
    }

    const byDay = Array.from(dayMap.values()).sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );

    const fromMs = new Date(`${effectiveFrom}T00:00:00`).getTime();
    const toMs = new Date(`${effectiveTo}T23:59:59.999`).getTime();
    const inWindow = (ts?: string | null) => {
      if (!ts) return false;
      const ms = new Date(ts).getTime();
      return Number.isFinite(ms) && ms >= fromMs && ms <= toMs;
    };
    const snapshot = { pending: 0, fulfilled: 0, delivered: 0, cancelled: 0 };
    for (const o of filtered) {
      if (inWindow(o.created_at)) snapshot.pending += o.quantity;
      if (inWindow(o.fulfilled_at)) snapshot.fulfilled += o.quantity;
      if (inWindow(o.delivered_at)) snapshot.delivered += o.quantity;
      if (inWindow(o.cancelled_at)) snapshot.cancelled += o.quantity;
    }

    return { totals: t, byDay, statusSnapshot: snapshot };
  }, [filtered, effectiveFrom, effectiveTo]);

  const days = diffDaysInclusive(effectiveFrom, effectiveTo);
  const avgPerDay = days > 0 ? (totals.meals / days).toFixed(1) : '0';
  const trendBars = useMemo(() => {
    if (chartRange === 'year') {
      const monthMap = new Map<string, number>();
      for (const d of byDay) {
        const key = d.date.slice(0, 7);
        monthMap.set(key, (monthMap.get(key) ?? 0) + d.meals);
      }
      return Array.from(monthMap.entries())
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .slice(-12)
        .map(([date, meals]) => ({ date, meals }));
    }
    if (chartRange === 'custom' && days > 62) {
      const monthMap = new Map<string, number>();
      for (const d of byDay) {
        const key = d.date.slice(0, 7);
        monthMap.set(key, (monthMap.get(key) ?? 0) + d.meals);
      }
      return Array.from(monthMap.entries())
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .map(([date, meals]) => ({ date, meals }));
    }
    const visibleDays =
      chartRange === 'today' ? 1 : chartRange === 'week' ? 7 : 30;
    const base = chartRange === 'custom' ? byDay.slice().reverse() : byDay.slice(0, visibleDays).reverse();
    return base.map((d) => ({ date: d.date, meals: d.meals }));
  }, [byDay, chartRange, days]);
  const trendMaxMeals = useMemo(
    () => Math.max(1, ...trendBars.map((d) => d.meals)),
    [trendBars],
  );
  const lunchRatio = totals.meals > 0 ? totals.lunch / totals.meals : 0;
  const dinnerRatio = totals.meals > 0 ? totals.dinner / totals.meals : 0;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader title="订餐数据" />

        <ScrollView
          ref={scrollRef}
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

          {/* 时间范围 */}
          <View style={styles.block}>
            <SectionLabel>{`时间范围 · ${effectiveFrom} ~ ${effectiveTo}`}</SectionLabel>
            <GlassSurface padding={SPACING.md}>
              <View style={styles.rangeRow}>
                <DatePicker
                  value={from}
                  onChange={onChangeFrom}
                  label="起"
                  max={to || undefined}
                  style={styles.rangePicker}
                />
                <Text style={styles.rangeDash}>至</Text>
                <DatePicker
                  value={to}
                  onChange={onChangeTo}
                  label="止"
                  min={from || undefined}
                  style={styles.rangePicker}
                />
              </View>
              <View style={styles.chartRangeRow}>
                {(['today', 'week', 'month', 'year'] as const).map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.chartRangeChip, chartRange === r && styles.chartRangeChipActive]}
                    onPress={() => applyChartRange(r)}
                  >
                    <Text style={[styles.chartRangeText, chartRange === r && styles.chartRangeTextActive]}>
                      {r === 'today' ? '今天' : r === 'week' ? '近7天' : r === 'month' ? '近30天' : '近一年'}
                    </Text>
                  </Pressable>
                ))}
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

          {/* 图表速览 */}
          <View style={styles.block}>
            <SectionLabel>图表速览</SectionLabel>
            <BentoGrid gap={SPACING.md}>
              <Bento span={8} mobileSpan={12}>
                <GlassSurface padding={SPACING.md} style={styles.chartCard}>
                  <View style={styles.chartHead}>
                    <Text style={styles.chartTitle}>每日订餐趋势</Text>
                    <Text style={styles.chartHint}>
                      {chartRange === 'today'
                        ? '今天'
                        : chartRange === 'week'
                          ? '最近 7 天'
                          : chartRange === 'month'
                            ? '最近 30 天'
                            : chartRange === 'year'
                              ? '最近 12 个月'
                              : days > 62
                                ? '自定义区间（按月）'
                                : '自定义区间（按日）'}
                    </Text>
                  </View>
                  {trendBars.length === 0 ? (
                    <Text style={styles.emptyText}>当前筛选条件下没有数据</Text>
                  ) : (
                    <View style={styles.trendChart}>
                      {trendBars.map((d) => {
                        const barHeight = Math.max(6, Math.round((d.meals / trendMaxMeals) * 96));
                        return (
                          <View key={d.date} style={styles.trendCol}>
                            <View style={styles.trendBarTrack}>
                              <View style={[styles.trendBar, { height: barHeight }]} />
                            </View>
                            <Text style={styles.trendLabel}>
                              {chartRange === 'year' || (chartRange === 'custom' && days > 62)
                                ? d.date.length === 7
                                  ? `${d.date}-01`
                                  : d.date
                                : d.date}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </GlassSurface>
              </Bento>

              <Bento span={4} mobileSpan={12}>
                <GlassSurface padding={SPACING.md} style={styles.chartCard}>
                  <View style={styles.chartHead}>
                    <Text style={styles.chartTitle}>午晚餐占比</Text>
                  </View>
                  {totals.meals === 0 ? (
                    <Text style={styles.emptyText}>当前筛选条件下没有数据</Text>
                  ) : (
                    <>
                      <View style={styles.ratioBar}>
                        <View style={[styles.ratioLunch, { flex: Math.max(lunchRatio, 0.04) }]} />
                        <View style={[styles.ratioDinner, { flex: Math.max(dinnerRatio, 0.04) }]} />
                      </View>
                      <View style={styles.ratioLegend}>
                        <View style={styles.ratioLegendRow}>
                          <View style={[styles.ratioDot, { backgroundColor: COLORS.warning }]} />
                          <Text style={styles.ratioText}>{`午餐 ${totals.lunch} 份`}</Text>
                        </View>
                        <View style={styles.ratioLegendRow}>
                          <View style={[styles.ratioDot, { backgroundColor: COLORS.info }]} />
                          <Text style={styles.ratioText}>{`晚餐 ${totals.dinner} 份`}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </GlassSurface>
              </Bento>
            </BentoGrid>
          </View>

          {/* 状态分布 */}
          <View style={styles.block}>
            <SectionLabel>状态分布快照（按状态发生时间）</SectionLabel>
            <GlassSurface padding={SPACING.md}>
              <StatusRow
                label="待出餐"
                value={statusSnapshot.pending}
                color={COLORS.warning}
              />
              <StatusRow
                label="已出餐"
                value={statusSnapshot.fulfilled}
                color={COLORS.brand}
              />
              <StatusRow
                label="已送达"
                value={statusSnapshot.delivered}
                color={COLORS.success}
              />
              <StatusRow
                label="已取消"
                value={statusSnapshot.cancelled}
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
                  hint={`收入 ${formatCNY(totals.walkinRevenue)}`}
                />
              </Bento>
            </BentoGrid>
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

  chartCard: { minHeight: 172 },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  chartTitle: { ...TYPE.headline, color: COLORS.text.primary },
  chartHint: { ...TYPE.caption, color: COLORS.text.tertiary },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  rangePicker: { flex: 1 },
  rangeDash: { ...TYPE.caption, color: COLORS.text.tertiary, fontWeight: '600' },
  chartRangeRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  chartRangeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  chartRangeChipActive: { backgroundColor: 'rgba(0,122,255,0.16)' },
  chartRangeText: { ...TYPE.caption, color: COLORS.text.secondary, fontWeight: '600' },
  chartRangeTextActive: { color: COLORS.brand },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    minHeight: 126,
  },
  trendCol: { flex: 1, alignItems: 'center', minWidth: 14 },
  trendBarTrack: {
    width: '100%',
    maxWidth: 16,
    height: 98,
    justifyContent: 'flex-end',
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  trendBar: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: COLORS.brand,
  },
  trendLabel: {
    marginTop: 6,
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  ratioBar: {
    flexDirection: 'row',
    width: '100%',
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    marginTop: 2,
  },
  ratioLunch: { backgroundColor: COLORS.warning },
  ratioDinner: { backgroundColor: COLORS.info },
  ratioLegend: { marginTop: SPACING.sm, gap: 8 },
  ratioLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratioDot: { width: 8, height: 8, borderRadius: 4 },
  ratioText: { ...TYPE.footnote, color: COLORS.text.secondary },


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
  emptyText: {
    ...TYPE.body,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
});
