/**
 * 财务记账 — v3 毛玻璃 + Bento
 *
 * - 顶部：AppHeader 带「新增支出」按钮（替代右下 FAB）
 * - 筛选：日期区间 + 类型 Segmented（全部 / 收入 / 支出）+ 分类下拉 + 冲销开关
 * - 汇总：BentoGrid 3 格 — 总收入 / 总支出 / 净额（与主界面速览同风格）
 * - 明细：按日期倒序卡片列表；每条包含日期、类型/分类 Pill、金额、描述
 *
 * 数据策略（demo 阶段）：
 *   API 与 Mock 的 income 记录都会合并显示，避免后端还没有接入开卡/升级事件时看不到收入流水；
 *   API 与 Mock 的 expense 同样合并去重。等真实数据稳定后可切换为只用 API。
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

const CATEGORY_OPTIONS: Array<FinanceCategory | 'all'> = [
  'all',
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
  const weekStart = mondayOfWeek();
  const monthStart = firstOfMonth();
  const selectedQuickRange =
    from === today && to === today
      ? 'today'
      : from === weekStart && to === today
        ? 'week'
        : from === monthStart && to === today
          ? 'month'
          : null;

  const fetchData = useCallback(
    async (mode: 'load' | 'refresh' = 'load') => {
      if (mode === 'load') setLoading(true);
      else setRefreshing(true);
      setFetchError(null);
      try {
        const res = await listFinance(params);
        setData(res);
      } catch (e) {
        setData({
          items: [],
          total: 0,
          summary: { income: 0, expense: 0, net: 0, byCategory: {} },
        });
        setFetchError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [params],
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

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader
          title="财务记账"
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
            <GlassSurface padding={SPACING.base} style={styles.heroRow}>
              <View style={styles.heroMain}>
                <Text style={styles.heroTitle}>财务总览</Text>
                <Text style={styles.heroSub}>{from} ~ {to}</Text>
              </View>
              <Pressable onPress={() => setModalVisible(true)} style={styles.heroAction}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.brand} />
                <Text style={styles.heroActionText}>新增支出</Text>
              </Pressable>
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

          {/* 汇总（3 格 Bento） */}
          <View style={styles.block}>
            <SectionLabel>{`汇总 · ${from} ~ ${to}`}</SectionLabel>
            <BentoGrid gap={SPACING.md}>
              <Bento span={4} mobileSpan={6}>
                <StatTile
                  label="总收入"
                  value={`¥${(summary?.income ?? 0).toLocaleString()}`}
                  icon="arrow-up-circle-outline"
                  color={COLORS.brand}
                  tint="info"
                />
              </Bento>
              <Bento span={4} mobileSpan={6}>
                <StatTile
                  label="总支出"
                  value={`¥${(summary?.expense ?? 0).toLocaleString()}`}
                  icon="arrow-down-circle-outline"
                  color={COLORS.danger}
                  tint="danger"
                />
              </Bento>
              <Bento span={4} mobileSpan={12}>
                <StatTile
                  label="净额"
                  value={`¥${(summary?.net ?? 0).toLocaleString()}`}
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

                <Pressable
                  onPress={() => setIncludeVoided((v) => !v)}
                  style={[styles.toggle, includeVoided && styles.toggleActive]}
                >
                  <Ionicons
                    name={includeVoided ? 'eye-outline' : 'eye-off-outline'}
                    size={14}
                    color={includeVoided ? '#fff' : COLORS.text.secondary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      includeVoided && styles.toggleTextActive,
                    ]}
                  >
                    含已冲销
                  </Text>
                </Pressable>
              </View>

              <View style={styles.quickRangeRow}>
                <Pressable
                  style={[styles.quickRange, selectedQuickRange === 'today' && styles.quickRangeActive]}
                  onPress={() => { setFrom(today); setTo(today); }}
                >
                  <Text style={[styles.quickRangeText, selectedQuickRange === 'today' && styles.quickRangeTextActive]}>今天</Text>
                </Pressable>
                <Pressable
                  style={[styles.quickRange, selectedQuickRange === 'week' && styles.quickRangeActive]}
                  onPress={() => { setFrom(weekStart); setTo(today); }}
                >
                  <Text style={[styles.quickRangeText, selectedQuickRange === 'week' && styles.quickRangeTextActive]}>本周</Text>
                </Pressable>
                <Pressable
                  style={[styles.quickRange, selectedQuickRange === 'month' && styles.quickRangeActive]}
                  onPress={() => { setFrom(monthStart); setTo(today); }}
                >
                  <Text style={[styles.quickRangeText, selectedQuickRange === 'month' && styles.quickRangeTextActive]}>本月</Text>
                </Pressable>
              </View>
            </GlassSurface>
          </View>

          {/* 按分类小计（仅当有数据时） */}
          {summary && Object.keys(summary.byCategory).length > 0 && (
            <View style={styles.block}>
              <SectionLabel>按分类</SectionLabel>
              <GlassSurface padding={SPACING.md}>
                {Object.entries(summary.byCategory).map(([cat, amt], idx, arr) => (
                  <View
                    key={cat}
                    style={[
                      styles.catRow,
                      idx === arr.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <Text style={styles.catLabel}>
                      {FINANCE_CATEGORY_LABEL[cat as FinanceCategory] ?? cat}
                    </Text>
                    <Text style={styles.catValue}>{formatCNY(amt)}</Text>
                  </View>
                ))}
              </GlassSurface>
            </View>
          )}

          {/* 明细 */}
          <View style={styles.block}>
            <View style={styles.listHeaderRow}>
              <SectionLabel>{`明细（${data?.total ?? 0} 条）`}</SectionLabel>
            </View>
            {loading && !data ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : (data?.items ?? []).length === 0 ? (
              <GlassSurface padding={SPACING.lg}>
                <Text style={styles.emptyText}>当前筛选条件下没有记录</Text>
              </GlassSurface>
            ) : (
              (data?.items ?? []).map((item) => (
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
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroMain: { flex: 1, minWidth: 0 },
  heroTitle: { ...TYPE.headline, color: COLORS.text.primary },
  heroSub: { ...TYPE.footnote, color: COLORS.text.tertiary, marginTop: 2, fontVariant: ['tabular-nums'] },
  heroAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  heroActionText: { ...TYPE.body, color: COLORS.brand, fontWeight: '600' },

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
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleActive: { backgroundColor: COLORS.info },
  toggleText: { fontSize: 13, color: COLORS.text.secondary, fontWeight: '500' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
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

  // 按分类
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  catLabel: { ...TYPE.body, color: COLORS.text.primary },
  catValue: {
    ...TYPE.body,
    color: COLORS.text.primary,
    fontWeight: '600',
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
