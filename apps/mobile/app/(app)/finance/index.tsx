/**
 * 财务记账 — v3 毛玻璃 + Bento
 *
 * - 顶部：AppHeader 带「新增支出」按钮（替代右下 FAB）
 * - 筛选：日期区间 + 类型 Segmented（全部 / 收入 / 支出）+ 分类下拉 + 冲销开关
 * - 汇总与「履约/预收」Bento：直接来自接口 summary（全量聚合）
 * - 结构分布：同样基于 summary.byCategory（全量），不再仅用当前页 limited items 抽样
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { confirmDestructive, notify } from '../../../lib/confirm';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Menu, ActivityIndicator } from 'react-native-paper';
import {
  AppHeader,
  MeshBackground,
  GlassSurface,
  BentoGrid,
  Bento,
  StatTile,
  SectionLabel,
  DatePicker,
  IconAvatar,
  PressableCard,
  StatusChip,
} from '../../../components/ui';
import {
  FINANCE_CATEGORY_LABEL,
  type FinanceCategory,
  formatCNY,
  formatDate,
} from '@meal/shared';
import { useAuth } from '../../../hooks/useAuth';
import {
  listFinance,
  voidFinance,
  type FinanceEntryDTO,
  type FinanceListResponse,
  type ListFinanceParams,
} from '../../../api/finance';
import { ExpenseModal } from '../../../components/ExpenseModal';
import { COLORS, SPACING, RADIUS, TYPE } from '../../../theme/paperTheme';

type TypeFilter = 'all' | 'income' | 'expense';

/** 与 @meal/shared FinanceCategory 中支出类一致，用于从 byCategory 拆出支出结构 */
function isExpenseCategory(cat: string): boolean {
  return cat === 'manual_expense' || cat === 'legacy_expense';
}

const CATEGORY_OPTIONS: Array<FinanceCategory | 'all'> = [
  'all',
  'card_prepaid_hospital',
  'card_prepaid_regular',
  'meal_earned_hospital',
  'meal_earned_regular',
  'meal_earned_walkin',
  'hospital_sub',
  'regular_sub',
  'ad_hoc',
  'manual_expense',
  'legacy_income',
  'legacy_expense',
];

function firstOfMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${y}-${m}-01`;
}

function firstOfYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  return `${y}-01-01`;
}

function todayISO(): string {
  return formatDate(new Date());
}

function mondayOfWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + offset);
  return formatDate(now);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

function daysAgoFrom(baseISO: string, days: number): string {
  const d = new Date(`${baseISO}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return daysAgoISO(days);
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

export default function FinanceScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(() => formatDate(new Date()));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [category, setCategory] = useState<FinanceCategory | 'all'>('all');
  const [includeVoided, setIncludeVoided] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);

  const [data, setData] = useState<FinanceListResponse | null>(null);
  const [detailItems, setDetailItems] = useState<FinanceEntryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const params = useMemo<ListFinanceParams>(
    () => ({
      from: from || undefined,
      to: to || undefined,
      type: typeFilter,
      category: category === 'all' ? undefined : category,
      include_voided: includeVoided,
      limit: 200,
    }),
    [from, to, typeFilter, category, includeVoided],
  );

  const today = todayISO();
  const detailWindowTo = to || today;
  const detailWindowFromRaw = daysAgoFrom(detailWindowTo, 7);
  const detailWindowFrom = from && from > detailWindowFromRaw ? from : detailWindowFromRaw;
  const weekStart = mondayOfWeek();
  const monthStart = firstOfMonth();
  const yearStart = firstOfYear();
  const selectedQuickRange =
    from === today && to === today
      ? 'today'
      : from === weekStart && to === today
        ? 'week'
        : from === monthStart && to === today
          ? 'month'
          : from === yearStart && to === today
            ? 'year'
          : null;

  const applyQuickRange = useCallback(
    (range: 'today' | 'week' | 'month' | 'year') => {
      if (range === 'today') {
        setFrom(today);
        setTo(today);
        return;
      }
      if (range === 'week') {
        setFrom(weekStart);
        setTo(today);
        return;
      }
      if (range === 'month') {
        setFrom(monthStart);
        setTo(today);
        return;
      }
      setFrom(yearStart);
      setTo(today);
    },
    [today, weekStart, monthStart, yearStart],
  );

  const fetchData = useCallback(
    async (mode: 'load' | 'refresh' = 'load') => {
      if (mode === 'load') setLoading(true);
      else setRefreshing(true);
      setFetchError(null);
      try {
        const [res, detailRes] = await Promise.all([
          listFinance({ ...params, limit: 1 }),
          listFinance({
            ...params,
            from: detailWindowFrom,
            to: detailWindowTo,
            limit: 500,
          }),
        ]);
        setData(res);
        setDetailItems(detailRes.items);
      } catch (e) {
        setData({
          items: [],
          total: 0,
          summary: {
            income: 0,
            expense: 0,
            net: 0,
            realized_income: 0,
            prepaid_income: 0,
            realized_net: 0,
            realized_by_channel: { hospital: 0, regular: 0, walkin: 0 },
            byCategory: {},
          },
        });
        setDetailItems([]);
        setFetchError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [params, detailWindowFrom, detailWindowTo],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleDelete = (entry: FinanceEntryDTO) => {
    confirmDestructive(
      '确认冲销',
      `将把 ${entry.entry_date} ${formatCNY(entry.amount)} 的条目标记为已冲销。此操作会保留历史，但不计入汇总。`,
      async () => {
        if (entry.id < 0) {
          await notify('无法操作', '演示数据不能冲销，请对真实记录操作。');
          return;
        }
        try {
          await voidFinance(entry.id);
          await fetchData('refresh');
        } catch (err) {
          await notify(
            '操作失败',
            err instanceof Error ? err.message : '未知错误',
            'destructive',
          );
        }
      },
      '冲销',
    );
  };

  const summary = data?.summary;
  const structureGroups = useMemo(() => {
    const byCat = summary?.byCategory ?? {};
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    for (const [cat, rawAmt] of Object.entries(byCat)) {
      const amt = Number(rawAmt);
      if (!Number.isFinite(amt) || amt === 0) continue;
      const target = isExpenseCategory(cat) ? expenseMap : incomeMap;
      target.set(cat, (target.get(cat) ?? 0) + amt);
    }
    const toSortedList = (source: Map<string, number>) =>
      Array.from(source.entries())
        .map(([ckey, amt]) => ({
          key: ckey,
          label: FINANCE_CATEGORY_LABEL[ckey as FinanceCategory] ?? ckey,
          amount: amt,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);
    return {
      income: toSortedList(incomeMap),
      expense: toSortedList(expenseMap),
    };
  }, [summary?.byCategory]);

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader
          title="财务记账"
          right={
            <Pressable
              onPress={() => setModalVisible(true)}
              style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
            >
              <Ionicons name="add-circle-outline" size={16} color={COLORS.brand} />
              <Text style={styles.headerActionText}>新增支出</Text>
            </Pressable>
          }
        />

        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchData('refresh')}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.block}>
            <GlassSurface padding={SPACING.base} style={styles.heroCard}>
              <IconAvatar
                icon="wallet-outline"
                color={COLORS.warning}
                bg={COLORS.warningSoft}
                size={42}
              />
              <View style={styles.heroMain}>
                <Text style={styles.heroTitle}>财务总览</Text>
                <Text style={styles.heroRange}>{`${from} ~ ${to}`}</Text>
                <Text style={styles.heroSub}>支持按任意时间段筛选与核对</Text>
              </View>
              <StatusChip label={`${data?.total ?? 0} 条`} variant="neutral" />
            </GlassSurface>
          </View>

          {fetchError ? (
            <View style={styles.block}>
              <GlassSurface padding={SPACING.md} tint="danger" style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>
                  加载失败：{fetchError}
                </Text>
              </GlassSurface>
            </View>
          ) : null}

          <View style={styles.block}>
            <SectionLabel>履约收入（已送达餐费 · 院内 / 院外 / 散客）</SectionLabel>
            <BentoGrid gap={SPACING.md}>
              <Bento span={3} mobileSpan={6}>
                <StatTile
                  label="履约合计"
                  value={formatCNY(summary?.realized_income ?? 0)}
                  icon="restaurant-outline"
                  color={COLORS.success}
                  tint="ok"
                />
              </Bento>
              <Bento span={3} mobileSpan={6}>
                <StatTile
                  label="院内"
                  value={formatCNY(summary?.realized_by_channel?.hospital ?? 0)}
                  icon="medkit-outline"
                  color={COLORS.brand}
                  tint="info"
                />
              </Bento>
              <Bento span={3} mobileSpan={6}>
                <StatTile
                  label="院外"
                  value={formatCNY(summary?.realized_by_channel?.regular ?? 0)}
                  icon="home-outline"
                  color={COLORS.info}
                  tint="info"
                />
              </Bento>
              <Bento span={3} mobileSpan={6}>
                <StatTile
                  label="散客"
                  value={formatCNY(summary?.realized_by_channel?.walkin ?? 0)}
                  icon="walk-outline"
                  color={COLORS.warning}
                  tint="warn"
                />
              </Bento>
              <Bento span={6} mobileSpan={12}>
                <StatTile
                  label="办卡预收（同期）"
                  value={formatCNY(summary?.prepaid_income ?? 0)}
                  icon="card-outline"
                  color={COLORS.text.secondary}
                  tint="info"
                  hint="购卡/升级当天现金预收"
                />
              </Bento>
            </BentoGrid>
          </View>

          {/* 汇总（3 格 Bento） */}
          <View style={styles.block}>
            <SectionLabel>{`汇总 · ${from} ~ ${to}`}</SectionLabel>
            <BentoGrid gap={SPACING.md}>
              <Bento span={4} mobileSpan={6}>
                <StatTile
                  label="总收入"
                  value={formatCNY(summary?.income ?? 0)}
                  icon="arrow-up-circle-outline"
                  color={COLORS.brand}
                  tint="info"
                />
              </Bento>
              <Bento span={4} mobileSpan={6}>
                <StatTile
                  label="总支出"
                  value={formatCNY(summary?.expense ?? 0)}
                  icon="arrow-down-circle-outline"
                  color={COLORS.danger}
                  tint="danger"
                />
              </Bento>
              <Bento span={4} mobileSpan={12}>
                <StatTile
                  label="净额"
                  value={formatCNY(summary?.net ?? 0)}
                  icon={
                    (summary?.net ?? 0) >= 0
                      ? 'checkmark-circle-outline'
                      : 'close-circle-outline'
                  }
                  color={(summary?.net ?? 0) >= 0 ? COLORS.success : COLORS.danger}
                  tint={(summary?.net ?? 0) >= 0 ? 'ok' : 'danger'}
                />
              </Bento>
            </BentoGrid>
          </View>

          <View style={styles.block}>
            <SectionLabel>结构分布</SectionLabel>
            <BentoGrid gap={SPACING.md}>
              <Bento span={6} mobileSpan={12}>
                <CategoryBars
                  title="收入结构"
                  items={structureGroups.income}
                  color={COLORS.success}
                />
              </Bento>
              <Bento span={6} mobileSpan={12}>
                <CategoryBars
                  title="支出结构"
                  items={structureGroups.expense}
                  color={COLORS.danger}
                />
              </Bento>
            </BentoGrid>
          </View>

          {/* 筛选 */}
          <View style={styles.block}>
            <SectionLabel>筛选</SectionLabel>
            <GlassSurface padding={SPACING.md} style={styles.filterCard}>
              {/* 日期区间 */}
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

              {/* 类型 Segmented */}
              <View style={styles.segmentedBar}>
                {(['all', 'income', 'expense'] as const).map((v) => {
                  const active = typeFilter === v;
                  return (
                    <Pressable
                      key={v}
                      style={[styles.segment, active && styles.segmentActive]}
                      onPress={() => setTypeFilter(v)}
                    >
                      <Text
                        style={[styles.segmentText, active && styles.segmentTextActive]}
                      >
                        {v === 'all' ? '全部' : v === 'income' ? '收入' : '支出'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 分类 + 冲销 */}
              <View style={styles.chipRow}>
                <Menu
                  visible={categoryMenuVisible}
                  onDismiss={() => setCategoryMenuVisible(false)}
                  anchor={
                    <Pressable
                      onPress={() => setCategoryMenuVisible(true)}
                      style={styles.selectBtn}
                    >
                      <Ionicons
                        name="filter-outline"
                        size={14}
                        color={COLORS.brand}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.selectBtnText}>
                        分类：
                        {category === 'all'
                          ? '全部'
                          : FINANCE_CATEGORY_LABEL[category]}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color={COLORS.brand}
                        style={{ marginLeft: 2 }}
                      />
                    </Pressable>
                  }
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <Menu.Item
                      key={c}
                      title={c === 'all' ? '全部' : FINANCE_CATEGORY_LABEL[c]}
                      onPress={() => {
                        setCategory(c);
                        setCategoryMenuVisible(false);
                      }}
                    />
                  ))}
                </Menu>

                <PressableCard
                  onPress={() => setIncludeVoided((v) => !v)}
                  style={styles.toggle}
                  tint={includeVoided ? 'info' : undefined}
                  padding={SPACING.sm}
                >
                  <Ionicons
                    name={includeVoided ? 'eye-outline' : 'eye-off-outline'}
                    size={14}
                    color={includeVoided ? COLORS.brand : COLORS.text.secondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      includeVoided && { color: COLORS.brand },
                    ]}
                  >
                    含已冲销
                  </Text>
                </PressableCard>
              </View>

              <View style={styles.quickRangeRow}>
                <Pressable
                  style={[styles.quickRange, selectedQuickRange === 'today' && styles.quickRangeActive]}
                  onPress={() => applyQuickRange('today')}
                >
                  <Text style={[styles.quickRangeText, selectedQuickRange === 'today' && styles.quickRangeTextActive]}>今天</Text>
                </Pressable>
                <Pressable
                  style={[styles.quickRange, selectedQuickRange === 'week' && styles.quickRangeActive]}
                  onPress={() => applyQuickRange('week')}
                >
                  <Text style={[styles.quickRangeText, selectedQuickRange === 'week' && styles.quickRangeTextActive]}>本周</Text>
                </Pressable>
                <Pressable
                  style={[styles.quickRange, selectedQuickRange === 'month' && styles.quickRangeActive]}
                  onPress={() => applyQuickRange('month')}
                >
                  <Text style={[styles.quickRangeText, selectedQuickRange === 'month' && styles.quickRangeTextActive]}>本月</Text>
                </Pressable>
                <Pressable
                  style={[styles.quickRange, selectedQuickRange === 'year' && styles.quickRangeActive]}
                  onPress={() => applyQuickRange('year')}
                >
                  <Text style={[styles.quickRangeText, selectedQuickRange === 'year' && styles.quickRangeTextActive]}>本年</Text>
                </Pressable>
              </View>
            </GlassSurface>
          </View>

          {/* 明细 */}
          <View style={styles.block}>
            <View style={styles.listHeaderRow}>
              <SectionLabel>{`最近7天明细（${detailWindowFrom} ~ ${detailWindowTo}）`}</SectionLabel>
            </View>
            {loading && !data ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : detailItems.length === 0 ? (
              <GlassSurface padding={SPACING.lg}>
                <Text style={styles.emptyText}>当前筛选条件下没有记录</Text>
              </GlassSurface>
            ) : (
              detailItems.map((item) => (
                <EntryCard
                  key={item.id}
                  entry={item}
                  isAdmin={isAdmin}
                  onDelete={() => handleDelete(item)}
                />
              ))
            )}
          </View>
        </ScrollView>

        <ExpenseModal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          onSaved={() => void fetchData('refresh')}
        />
      </SafeAreaView>
    </View>
  );
}

function CategoryBars({
  title,
  items,
  color,
}: {
  title: string;
  items: Array<{ key: string; label: string; amount: number }>;
  color: string;
}) {
  const categoryMax = Math.max(1, ...items.map((c) => c.amount));
  return (
    <GlassSurface padding={SPACING.md}>
      <Text style={styles.groupTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>当前筛选条件下没有记录</Text>
      ) : (
        items.map((item, idx) => (
          <View
            key={item.key}
            style={[
              styles.chartRow,
              idx === items.length - 1 && { marginBottom: 0 },
            ]}
          >
            <Text style={styles.chartLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={styles.chartTrack}>
              <View
                style={[
                  styles.chartFill,
                  {
                    width: `${Math.max((item.amount / categoryMax) * 100, 8)}%`,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
            <Text style={styles.chartValue}>{formatCNY(item.amount)}</Text>
          </View>
        ))
      )}
    </GlassSurface>
  );
}

// ============================================================
// EntryCard
// ============================================================
function EntryCard({
  entry,
  isAdmin,
  onDelete,
}: {
  entry: FinanceEntryDTO;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  const isIncome = entry.type === 'income';
  const amountColor = isIncome ? COLORS.success : COLORS.danger;
  const amountPrefix = isIncome ? '+' : '-';
  const catLabel =
    FINANCE_CATEGORY_LABEL[entry.category as FinanceCategory] ?? entry.category;
  const isMock = entry.id < 0;

  return (
    <GlassSurface
      padding={SPACING.md}
      style={[styles.entry, entry.voided && { opacity: 0.5 }]}
    >
      <View style={styles.entryHeader}>
        <View style={styles.entryLeft}>
          <Text style={styles.entryDate}>{entry.entry_date}</Text>
          <View style={styles.entryBadges}>
            <View style={[styles.tag, isIncome ? styles.tagIncome : styles.tagExpense]}>
              <Text
                style={[
                  styles.tagText,
                  { color: isIncome ? COLORS.success : COLORS.danger },
                ]}
              >
                {isIncome ? '收入' : '支出'}
              </Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{catLabel}</Text>
            </View>
            {entry.voided && (
              <View style={[styles.tag, styles.tagVoided]}>
                <Text style={[styles.tagText, { color: COLORS.text.tertiary }]}>
                  已冲销
                </Text>
              </View>
            )}
            {isMock && (
              <View style={[styles.tag, styles.tagMock]}>
                <Text style={[styles.tagText, { color: COLORS.warning }]}>演示</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.amount, { color: amountColor }]}>
          {amountPrefix}
          {formatCNY(entry.amount)}
        </Text>
      </View>

      {entry.description ? (
        <Text style={styles.description}>{entry.description}</Text>
      ) : null}

      {isAdmin && !entry.voided && !isMock && (
        <Pressable onPress={onDelete} style={styles.voidBtn} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={COLORS.text.tertiary} />
        </Pressable>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  container: {
    padding: SPACING.md,
    paddingBottom: 48,
    gap: 0,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  block: { marginBottom: SPACING.lg },
  pressed: { opacity: 0.65 },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  headerActionText: { ...TYPE.footnote, color: COLORS.brand, fontWeight: '600' },
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.base },
  heroMain: { flex: 1, minWidth: 0 },
  heroTitle: { ...TYPE.headline, color: COLORS.text.primary },
  heroRange: { ...TYPE.footnote, color: COLORS.text.secondary, marginTop: 4, fontVariant: ['tabular-nums'] },
  heroSub: { ...TYPE.footnote, color: COLORS.text.tertiary, marginTop: 2 },

  errorBanner: {
    borderRadius: RADIUS.md,
  },
  errorBannerText: { ...TYPE.footnote, color: COLORS.danger },

  // 筛选卡
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

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'center' },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,122,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectBtnText: { fontSize: 13, color: COLORS.brand, fontWeight: '500' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 14,
  },
  toggleText: { fontSize: 13, color: COLORS.text.secondary, fontWeight: '500' },
  quickRangeRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  quickRange: {
    backgroundColor: 'rgba(0,122,255,0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickRangeActive: {
    backgroundColor: 'rgba(0,122,255,0.18)',
    borderColor: COLORS.warning,
  },
  quickRangeText: { ...TYPE.caption, color: COLORS.brand, fontWeight: '600' },
  quickRangeTextActive: { color: COLORS.brand, fontWeight: '700' },

  groupTitle: {
    ...TYPE.body,
    color: COLORS.text.primary,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  chartLabel: { ...TYPE.footnote, color: COLORS.text.primary, width: 84 },
  chartTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  chartFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.brand,
  },
  chartValue: {
    ...TYPE.caption,
    color: COLORS.text.secondary,
    width: 84,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  // 明细
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entry: { marginBottom: SPACING.sm, position: 'relative' },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.md },
  entryLeft: { flex: 1, gap: 6 },
  entryDate: {
    fontSize: 13,
    color: COLORS.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  entryBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(118,118,128,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tagIncome: { backgroundColor: 'rgba(52,199,89,0.12)' },
  tagExpense: { backgroundColor: 'rgba(255,59,48,0.1)' },
  tagVoided: { backgroundColor: 'rgba(0,0,0,0.05)' },
  tagMock: { backgroundColor: 'rgba(255,149,0,0.12)' },
  tagText: { fontSize: 11, fontWeight: '600', color: COLORS.text.secondary },

  amount: {
    ...TYPE.title3,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  description: {
    ...TYPE.footnote,
    color: COLORS.text.secondary,
    marginTop: 8,
  },
  voidBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(118,118,128,0.08)',
  },

  emptyText: {
    ...TYPE.body,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
});
