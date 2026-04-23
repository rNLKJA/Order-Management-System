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
  TextInput,
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
import { MOCK_FINANCE } from '../../../constants/mockData';
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

/** 把 MOCK_FINANCE 映射为 API 格式。 */
function mockAsEntries(): FinanceEntryDTO[] {
  return MOCK_FINANCE.map((m) => ({
    id: -m.id, // 负 id 避免与真实 id 冲突
    entry_date: m.entry_date,
    type: m.type,
    amount: m.amount,
    category: m.category,
    description: m.description,
    ref_card_id: null,
    ref_order_id: null,
    source: m.source,
    voided: m.voided,
    collector_user_id: null,
    created_by_user_id: 0,
    created_at: m.entry_date,
    updated_at: m.entry_date,
  }));
}

function passesFilter(e: FinanceEntryDTO, p: ListFinanceParams): boolean {
  if (p.from && e.entry_date < p.from) return false;
  if (p.to && e.entry_date > p.to) return false;
  if (p.type && p.type !== 'all' && e.type !== p.type) return false;
  if (p.category && e.category !== p.category) return false;
  if (!p.include_voided && e.voided) return false;
  return true;
}

function summarise(items: FinanceEntryDTO[]): FinanceListResponse['summary'] {
  let income = 0;
  let expense = 0;
  const byCategory: Record<string, number> = {};
  for (const it of items) {
    if (it.voided) continue;
    if (it.type === 'income') income += it.amount;
    else expense += it.amount;
    byCategory[it.category] = (byCategory[it.category] ?? 0) + it.amount;
  }
  return { income, expense, net: income - expense, byCategory };
}

/** API + Mock 合并（去重：API 真实 id 为准，mock 只补 API 没有的 description+date+amount 组合）。 */
function mergeWithMock(
  apiItems: FinanceEntryDTO[],
  params: ListFinanceParams,
): FinanceListResponse {
  const key = (e: FinanceEntryDTO) =>
    `${e.entry_date}|${e.type}|${e.amount}|${e.description ?? ''}`;
  const seen = new Set(apiItems.map(key));
  const mockItems = mockAsEntries().filter(
    (e) => passesFilter(e, params) && !seen.has(key(e)),
  );
  const apiFiltered = apiItems.filter((e) => passesFilter(e, params));
  const items = [...apiFiltered, ...mockItems].sort((a, b) =>
    b.entry_date.localeCompare(a.entry_date),
  );
  return {
    items,
    total: items.length,
    summary: summarise(items),
  };
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

  const fetchData = useCallback(
    async (mode: 'load' | 'refresh' = 'load') => {
      if (mode === 'load') setLoading(true);
      else setRefreshing(true);
      try {
        const res = await listFinance(params);
        setData(mergeWithMock(res.items, params));
      } catch {
        // API 失败时用纯 mock，避免白屏
        setData(mergeWithMock([], params));
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
          right={
            <Pressable
              onPress={() => setModalVisible(true)}
              style={styles.headerAction}
              hitSlop={8}
            >
              <Ionicons name="add" size={22} color={COLORS.brand} />
              <Text style={styles.headerActionText}>新增</Text>
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
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>起</Text>
                  <TextInput
                    value={from}
                    onChangeText={setFrom}
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.text.quaternary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>止</Text>
                  <TextInput
                    value={to}
                    onChangeText={setTo}
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.text.quaternary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
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

  headerAction: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  headerActionText: { fontSize: 15, color: COLORS.brand, fontWeight: '500' },

  // 筛选卡
  filterCard: { gap: SPACING.md },
  dateRow: { flexDirection: 'row', gap: SPACING.sm },
  dateField: {
    flex: 1,
    backgroundColor: 'rgba(118,118,128,0.08)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fieldLabel: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateInput: {
    fontSize: 15,
    color: COLORS.text.primary,
    paddingVertical: 4,
    fontVariant: ['tabular-nums'],
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
