/**
 * 记账页（MEA-13）。
 *
 * 功能：
 * - 顶部：日期区间（默认本月 1 号到今天）、类型筛选（全部 / 收入 / 支出）、分类筛选、含已冲销开关
 * - 汇总卡：总收入 / 总支出 / 净额 / 按分类小计（formatCNY）
 * - 明细表：日期 / 类型 Badge / 分类 Badge / 金额（支出显示 -）/ 备注 / 操作（admin 显示"删除"）
 * - voided 行浅色虚线
 * - 右下浮动按钮「新增支出」打开 ExpenseModal
 *
 * 数据来源：GET /api/finance；admin 才显示删除按钮（useAuth 拿到 role）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Card,
  Text,
  Button,
  Chip,
  FAB,
  IconButton,
  Menu,
  SegmentedButtons,
  TextInput,
  useTheme,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
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

export default function FinanceScreen() {
  const theme = useTheme();
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
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
      try {
        const res = await listFinance(params);
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
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
    Alert.alert(
      '确认冲销',
      `将把 ${entry.entry_date} ${formatCNY(entry.amount)} 的条目标记为已冲销。此操作会保留历史，但不计入汇总。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '冲销',
          style: 'destructive',
          onPress: async () => {
            try {
              await voidFinance(entry.id);
              await fetchData('refresh');
            } catch (err) {
              Alert.alert('操作失败', err instanceof Error ? err.message : '未知错误');
            }
          },
        },
      ],
    );
  };

  const summary = data?.summary;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void fetchData('refresh')}
          />
        }
      >
        {/* 筛选区 */}
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              筛选
            </Text>
            <View style={styles.rangeRow}>
              <TextInput
                dense
                mode="outlined"
                label="起"
                value={from}
                onChangeText={setFrom}
                style={styles.rangeField}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                dense
                mode="outlined"
                label="止"
                value={to}
                onChangeText={setTo}
                style={styles.rangeField}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <SegmentedButtons
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TypeFilter)}
              style={styles.segment}
              buttons={[
                { value: 'all', label: '全部' },
                { value: 'income', label: '收入' },
                { value: 'expense', label: '支出' },
              ]}
            />

            <View style={styles.categoryRow}>
              <Menu
                visible={categoryMenuVisible}
                onDismiss={() => setCategoryMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setCategoryMenuVisible(true)}
                    icon="filter-variant"
                  >
                    分类：
                    {category === 'all'
                      ? '全部'
                      : FINANCE_CATEGORY_LABEL[category]}
                  </Button>
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

              <Chip
                selected={includeVoided}
                onPress={() => setIncludeVoided((v) => !v)}
                icon={includeVoided ? 'check' : 'eye-off'}
              >
                含已冲销
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* 汇总区 */}
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              汇总（{from} ~ {to}）
            </Text>
            {summary ? (
              <>
                <View style={styles.summaryRow}>
                  <SummaryTile
                    label="总收入"
                    value={formatCNY(summary.income)}
                    color={theme.colors.primary}
                  />
                  <SummaryTile
                    label="总支出"
                    value={formatCNY(summary.expense)}
                    color={theme.colors.error}
                  />
                  <SummaryTile
                    label="净额"
                    value={formatCNY(summary.net)}
                    color={theme.colors.onSurface}
                  />
                </View>
                <Divider style={{ marginVertical: 12 }} />
                <Text variant="bodyMedium" style={styles.subHeader}>
                  按分类
                </Text>
                {Object.entries(summary.byCategory).length === 0 ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    暂无数据
                  </Text>
                ) : (
                  Object.entries(summary.byCategory).map(([cat, amt]) => (
                    <View key={cat} style={styles.catRow}>
                      <Text variant="bodyMedium">
                        {FINANCE_CATEGORY_LABEL[cat as FinanceCategory] ?? cat}
                      </Text>
                      <Text variant="bodyMedium" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatCNY(amt)}
                      </Text>
                    </View>
                  ))
                )}
              </>
            ) : loading ? (
              <ActivityIndicator />
            ) : (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                暂无数据
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* 明细 */}
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              明细（{data?.total ?? 0}）
            </Text>
            {error && (
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                {error}
              </Text>
            )}
            {(data?.items ?? []).map((item) => (
              <EntryRow
                key={item.id}
                entry={item}
                isAdmin={isAdmin}
                onDelete={() => handleDelete(item)}
              />
            ))}
            {!loading && (data?.items.length ?? 0) === 0 && (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                当前筛选条件下没有记录
              </Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <FAB
        icon="plus"
        label="新增支出"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => setModalVisible(true)}
      />

      <ExpenseModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        onSaved={() => void fetchData('refresh')}
      />
    </View>
  );
}

function SummaryTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.tile}>
      <Text variant="bodySmall" style={styles.tileLabel}>
        {label}
      </Text>
      <Text
        variant="titleMedium"
        style={[styles.tileValue, { color, fontVariant: ['tabular-nums'] }]}
      >
        {value}
      </Text>
    </View>
  );
}

function EntryRow({
  entry,
  isAdmin,
  onDelete,
}: {
  entry: FinanceEntryDTO;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const isIncome = entry.type === 'income';
  const amountColor = isIncome ? theme.colors.primary : theme.colors.error;
  const amountPrefix = isIncome ? '+' : '-';
  const catLabel =
    FINANCE_CATEGORY_LABEL[entry.category as FinanceCategory] ?? entry.category;

  return (
    <View
      style={[
        styles.entryRow,
        entry.voided && {
          opacity: 0.5,
          borderStyle: 'dashed',
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.entryHeader}>
        <Text variant="bodyMedium" style={{ fontVariant: ['tabular-nums'] }}>
          {entry.entry_date}
        </Text>
        <View style={styles.entryBadges}>
          <Chip
            compact
            style={[
              styles.badge,
              { backgroundColor: isIncome ? '#E0F2FE' : '#FEE2E2' },
            ]}
            textStyle={styles.badgeText}
          >
            {isIncome ? '收入' : '支出'}
          </Chip>
          <Chip compact style={styles.badge} textStyle={styles.badgeText}>
            {catLabel}
          </Chip>
          {entry.voided && (
            <Chip
              compact
              style={[styles.badge, { backgroundColor: '#F1F5F9' }]}
              textStyle={styles.badgeText}
            >
              已冲销
            </Chip>
          )}
        </View>
      </View>

      <View style={styles.entryBody}>
        <Text
          variant="titleMedium"
          style={{ color: amountColor, fontVariant: ['tabular-nums'] }}
        >
          {amountPrefix}
          {formatCNY(entry.amount)}
        </Text>
        {isAdmin && !entry.voided && (
          <IconButton
            icon="delete-outline"
            size={20}
            onPress={onDelete}
            accessibilityLabel="冲销"
          />
        )}
      </View>

      {entry.description ? (
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
        >
          {entry.description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 96,
    gap: 12,
  },
  card: {
    borderRadius: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeField: {
    flex: 1,
  },
  segment: {
    marginTop: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  tileLabel: {
    color: '#64748B',
  },
  tileValue: {
    fontWeight: '600',
    marginTop: 2,
  },
  subHeader: {
    fontWeight: '600',
    marginBottom: 8,
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  entryRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    height: 24,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    marginVertical: 0,
  },
  entryBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 28,
  },
});
