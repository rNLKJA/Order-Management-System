/**
 * 财务流水 — 简版视图
 *
 * - 选日期 → 看本区间总收入/支出/净额 → 下面就是逐条流水
 * - 「更多筛选」内：按财务细类、是否含已冲销（默认收起，减少干扰）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { confirmDestructive, notify } from '../../../lib/confirm';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Menu, ActivityIndicator } from 'react-native-paper';
import {
  AppHeader,
  HeaderTextAction,
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
  FloatingBottomBar,
  FloatingSegmentBar,
  floatingSegmentBarReserve,
} from '../../../components/ui';
import {
  FINANCE_CATEGORY_LABEL,
  type FinanceCategory,
  formatCNY,
  formatDate,
  mondayOfWeekShanghai,
  startOfMonthShanghai,
  startOfYearShanghai,
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
import { OtherProductIncomeModal } from '../../../components/OtherProductIncomeModal';
import { COLORS, SPACING, RADIUS, TYPE } from '../../../theme/paperTheme';
import { useScrollToTopOnFocus } from '../../../hooks/useScrollToTopOnFocus';
import { usersApi } from '../../../api/users';

type TypeFilter = 'all' | 'income' | 'expense';

const FINANCE_TYPE_SEGMENTS = [
  { key: 'all' as const, label: '全部', icon: 'layers-outline' as const },
  { key: 'income' as const, label: '只要收入', icon: 'trending-up-outline' as const },
  { key: 'expense' as const, label: '只要支出', icon: 'trending-down-outline' as const },
];

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
  'salary_expense',
  'legacy_income',
  'legacy_expense',
  'misc_retail_income',
];

export default function FinanceScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(scrollRef);

  const insets = useSafeAreaInsets();
  /** 与底部「全部 / 只要收入 / 只要支出」条实际高度对齐（含 FloatingBottomBar 胶囊内边距），避免压住流水卡片 */
  const financeTypeBarReserve = useMemo(
    () => floatingSegmentBarReserve(insets.bottom),
    [insets.bottom],
  );

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [from, setFrom] = useState(() => formatDate(new Date()));
  const [to, setTo] = useState(() => formatDate(new Date()));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [category, setCategory] = useState<FinanceCategory | 'all'>('all');
  const [includeVoided, setIncludeVoided] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [periodData, setPeriodData] = useState<FinanceListResponse | null>(null);
  const [listData, setListData] = useState<FinanceListResponse | null>(null);
  const [detailItems, setDetailItems] = useState<FinanceEntryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [otherIncomeModalVisible, setOtherIncomeModalVisible] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [collectorNameById, setCollectorNameById] = useState<Record<number, string>>({});

  /** 期间总览：只按日期，便于与下方列表筛选解耦 */
  const periodParams = useMemo<ListFinanceParams>(
    () => ({
      from: from || undefined,
      to: to || undefined,
      type: 'all',
      limit: 1,
    }),
    [from, to],
  );

  const listParams = useMemo<ListFinanceParams>(
    () => ({
      from: from || undefined,
      to: to || undefined,
      type: typeFilter,
      category: category === 'all' ? undefined : category,
      include_voided: includeVoided,
      limit: 500,
    }),
    [from, to, typeFilter, category, includeVoided],
  );

  const listFilterActive =
    typeFilter !== 'all' || category !== 'all' || includeVoided;

  const today = formatDate(new Date());
  const weekStart = mondayOfWeekShanghai(today);
  const monthStart = startOfMonthShanghai(today);
  const yearStart = startOfYearShanghai(today);
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

  const emptySummary: FinanceListResponse['summary'] = {
    income: 0,
    expense: 0,
    net: 0,
    realized_income: 0,
    prepaid_income: 0,
    realized_net: 0,
    realized_by_channel: { hospital: 0, regular: 0, walkin: 0 },
    byCategory: {},
  };

  const fetchData = useCallback(
    async (mode: 'load' | 'refresh' = 'load') => {
      if (mode === 'load') setLoading(true);
      else setRefreshing(true);
      setFetchError(null);
      try {
        const [periodRes, detailRes] = await Promise.all([
          listFinance(periodParams),
          listFinance(listParams),
        ]);
        setPeriodData(periodRes);
        setListData(detailRes);
        setDetailItems(detailRes.items);
      } catch (e) {
        setPeriodData({
          items: [],
          total: 0,
          summary: emptySummary,
        });
        setListData({ items: [], total: 0, summary: emptySummary });
        setDetailItems([]);
        setFetchError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [periodParams, listParams],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    void usersApi
      .list()
      .then((res) => {
        if (cancelled) return;
        const m: Record<number, string> = {};
        for (const u of res.users ?? []) {
          m[u.id] = u.full_name;
        }
        setCollectorNameById(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const summary = periodData?.summary;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader
          title="财务流水"
          right={
            <View style={styles.headerActionsRow}>
              <HeaderTextAction
                label="零售收入"
                icon="pricetag-outline"
                onPress={() => setOtherIncomeModalVisible(true)}
              />
              <HeaderTextAction
                label="新增支出"
                icon="add-circle-outline"
                onPress={() => setModalVisible(true)}
              />
            </View>
          }
        />

        <View style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.container,
            { paddingBottom: financeTypeBarReserve + SPACING.xxl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchData('refresh')}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.block, { marginBottom: SPACING.md }]}>
            <GlassSurface padding={SPACING.md} style={styles.heroCard}>
              <IconAvatar
                icon="wallet-outline"
                color={COLORS.warning}
                bg={COLORS.warningSoft}
                size={40}
              />
              <View style={styles.heroMain}>
                <Text style={styles.heroTitle}>财务流水</Text>
                <Text style={styles.heroRange}>{`${from} ~ ${to}`}</Text>
                <Text style={styles.heroSub}>上面选日期，中间是这笔钱怎么进出，再往下逐条对账</Text>
              </View>
              <StatusChip
                label={`${periodData?.total ?? 0} 笔记账`}
                variant="neutral"
              />
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
            <SectionLabel>时间范围</SectionLabel>
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

          <View style={styles.block}>
            <SectionLabel>{`这段时间 · ${from} ~ ${to}`}</SectionLabel>
            <BentoGrid gap={SPACING.md}>
              <Bento span={4} mobileSpan={6}>
                <StatTile
                  layout="compact"
                  label="入账合计"
                  value={formatCNY(summary?.income ?? 0)}
                  icon="arrow-up-circle-outline"
                  color={COLORS.brand}
                  tint="info"
                />
              </Bento>
              <Bento span={4} mobileSpan={6}>
                <StatTile
                  layout="compact"
                  label="支出合计"
                  value={formatCNY(summary?.expense ?? 0)}
                  icon="arrow-down-circle-outline"
                  color={COLORS.danger}
                  tint="danger"
                />
              </Bento>
              <Bento span={4} mobileSpan={6}>
                <StatTile
                  layout="compact"
                  label="结余（入−出）"
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
            <SectionLabel>怎么查流水</SectionLabel>
            <GlassSurface padding={SPACING.md} style={styles.filterCard}>
              <Text style={styles.filterHint}>
                收入类型在屏幕底部切换。要按办卡、送餐分类再点「更多筛选」。
              </Text>

              {!showAdvancedFilters && (category !== 'all' || includeVoided) ? (
                <Text style={[styles.filterHint, { marginBottom: 0 }]}>
                  列表还限在：
                  {category !== 'all' ? FINANCE_CATEGORY_LABEL[category] : '任意细类'}
                  {includeVoided ? ' · 含已冲销' : ''}
                  {' · 点下方可改'}
                </Text>
              ) : null}

              <Pressable
                onPress={() => setShowAdvancedFilters((s) => !s)}
                style={({ pressed }) => [styles.moreFiltersBtn, pressed && styles.pressed]}
              >
                <Text style={styles.moreFiltersBtnText}>
                  {showAdvancedFilters ? '收起更多筛选' : '更多筛选（财务细类、已冲销）'}
                </Text>
                <Ionicons
                  name={showAdvancedFilters ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={COLORS.brand}
                />
              </Pressable>

              {showAdvancedFilters ? (
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
                          细类：
                          {category === 'all'
                            ? '不限制'
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
                        title={c === 'all' ? '不限制' : FINANCE_CATEGORY_LABEL[c]}
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
              ) : null}
            </GlassSurface>
          </View>

          {/* 流水列表 */}
          <View style={styles.block}>
            <View style={styles.listHeaderRow}>
              <SectionLabel>
                {listFilterActive
                  ? `流水明细 · ${listData?.total ?? 0} 条（已筛选）`
                  : `流水明细 · ${listData?.total ?? 0} 条`}
              </SectionLabel>
            </View>
            {loading && !periodData ? (
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
                  collectorNameById={collectorNameById}
                  onDelete={() => handleDelete(item)}
                />
              ))
            )}
          </View>
        </ScrollView>

        <FloatingBottomBar>
          <FloatingSegmentBar
            segments={FINANCE_TYPE_SEGMENTS}
            value={typeFilter}
            onChange={setTypeFilter}
          />
        </FloatingBottomBar>
        </View>

        <ExpenseModal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          onSaved={() => void fetchData('refresh')}
        />
        <OtherProductIncomeModal
          visible={otherIncomeModalVisible}
          onDismiss={() => setOtherIncomeModalVisible(false)}
          onSaved={() => void fetchData('refresh')}
        />
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// EntryCard
// ============================================================
function EntryCard({
  entry,
  isAdmin,
  collectorNameById,
  onDelete,
}: {
  entry: FinanceEntryDTO;
  isAdmin: boolean;
  collectorNameById: Record<number, string>;
  onDelete: () => void;
}) {
  const isIncome = entry.type === 'income';
  const amountColor = isIncome ? COLORS.success : COLORS.danger;
  const amountPrefix = isIncome ? '+' : '-';
  const catLabel =
    FINANCE_CATEGORY_LABEL[entry.category as FinanceCategory] ?? entry.category;
  const isMock = entry.id < 0;
  const collectorName =
    entry.collector_user_id != null
      ? collectorNameById[entry.collector_user_id]
      : undefined;

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
      {collectorName ? (
        <Text style={styles.collectorLine}>收款：{collectorName}</Text>
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
  headerActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    maxWidth: 220,
  },
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.base },
  heroMain: { flex: 1, minWidth: 0 },
  heroTitle: { ...TYPE.headline, color: COLORS.text.primary },
  heroRange: { ...TYPE.footnote, color: COLORS.text.secondary, marginTop: 3, fontVariant: ['tabular-nums'] },
  heroSub: { ...TYPE.caption, color: COLORS.text.tertiary, marginTop: 4, lineHeight: 17 },

  errorBanner: {
    borderRadius: RADIUS.md,
  },
  errorBannerText: { ...TYPE.footnote, color: COLORS.danger },

  filterHint: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },

  // 筛选卡
  filterCard: { gap: SPACING.md },
  dateRow: { flexDirection: 'row', gap: SPACING.sm },
  dateField: { flex: 1 },

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
  moreFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: SPACING.xs,
  },
  moreFiltersBtnText: { fontSize: 14, color: COLORS.brand, fontWeight: '600' },
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
  collectorLine: {
    ...TYPE.footnote,
    color: COLORS.text.secondary,
    marginTop: 4,
    fontWeight: '600',
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
