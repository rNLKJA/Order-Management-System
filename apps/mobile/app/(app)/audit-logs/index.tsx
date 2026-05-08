/**
 * 操作记录（审计日志）— 仅管理员。聚合业务写入与账号/权限变更。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  AUDIT_ACTION_LABEL,
  AUDIT_ENTITY_LABEL,
  formatDateTimeWithSeconds,
  type AuditEntity,
} from '@meal/shared';
import { auditApi, type AuditLogRow } from '../../../api/audit';
import { useAuth } from '../../../hooks/useAuth';
import {
  COLORS,
  GLASS,
  RADIUS,
  SPACING,
  TYPE,
} from '../../../theme/paperTheme';
import {
  AppHeader,
  GlassSurface,
  MeshBackground,
} from '../../../components/ui';
import { useScrollToTopOnFocus } from '../../../hooks/useScrollToTopOnFocus';

type FilterKey = 'all' | AuditEntity;

const ENTITY_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'user', label: '账号权限' },
  { key: 'member', label: '会员' },
  { key: 'card', label: '会员卡' },
  { key: 'daily_order', label: '订餐' },
  { key: 'finance_entry', label: '财务' },
];

function formatTimeMs(ms: number): string {
  try {
    return formatDateTimeWithSeconds(new Date(ms));
  } catch {
    return '—';
  }
}

function shortenDiff(json: string, max = 220): string {
  if (!json || json === '{}') return '—';
  try {
    const o = JSON.parse(json) as unknown;
    const s = JSON.stringify(o, null, 0);
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  } catch {
    return json.length > max ? `${json.slice(0, max)}…` : json;
  }
}

export default function AuditLogsScreen() {
  const listRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(listRef);

  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace('/(app)');
    }
  }, [user]);

  const queryParams = useMemo(() => {
    if (filter === 'all') return { limit: 120 };
    return { entity: filter, limit: 120 };
  }, [filter]);

  const q = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => auditApi.list(queryParams),
    enabled: user?.role === 'admin',
    staleTime: 15_000,
  });

  const logs = q.data?.logs ?? [];

  const onBack = useCallback(() => router.back(), []);

  if (user && user.role !== 'admin') {
    return null;
  }

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader title="操作记录" onBack={onBack} />

        <View style={styles.body}>
          {q.data && !q.isLoading ? (
            <View style={styles.listHint}>
              <Text style={styles.listHintText}>
                最近 {logs.length} 条（最多拉取 120 条）
              </Text>
            </View>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
            keyboardShouldPersistTaps="handled"
          >
            {ENTITY_FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    active && styles.filterChipActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {q.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.brand} />
            </View>
          ) : q.isError ? (
            <View style={styles.center}>
              <GlassSurface tint="danger" padding={SPACING.md} style={styles.errCard}>
                <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
                <Text style={styles.errText}>{q.error.message}</Text>
              </GlassSurface>
            </View>
          ) : logs.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.empty}>暂无记录</Text>
              <Text style={styles.emptySub}>业务写入与权限变更会出现在此处</Text>
            </View>
          ) : (
            <ScrollView
              ref={listRef}
              style={styles.listScroll}
              contentContainerStyle={styles.listPad}
              keyboardShouldPersistTaps="handled"
            >
              {logs.map((row) => (
                <LogCard key={row.id} row={row} />
              ))}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function LogCard({ row }: { row: AuditLogRow }) {
  const entityLabel = AUDIT_ENTITY_LABEL[row.entity] ?? row.entity;
  const actionLabel = AUDIT_ACTION_LABEL[row.action] ?? row.action;
  const who =
    row.actor_full_name || row.actor_username
      ? `${row.actor_full_name ?? ''}${row.actor_username ? ` @${row.actor_username}` : ''}`.trim()
      : `用户 #${row.user_id}`;

  return (
    <GlassSurface padding={SPACING.base} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>
            {actionLabel} · {entityLabel}
          </Text>
          <Text style={styles.cardMeta}>
            #{row.id} · 实体 ID {row.entity_id} · {formatTimeMs(row.created_at)}
          </Text>
        </View>
        <Ionicons name="finger-print-outline" size={20} color={COLORS.text.quaternary} />
      </View>
      <Text style={styles.actor}>操作人：{who}</Text>
      <Text style={styles.diff} selectable>
        {shortenDiff(row.diff_json)}
      </Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  body: {
    flex: 1,
    minHeight: 0,
  },
  center: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    zIndex: 1,
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  filterRow: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listHint: {
    flexShrink: 0,
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.xs,
  },
  listHintText: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill ?? 20,
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: 'rgba(0,122,255,0.14)',
    borderColor: COLORS.brand,
  },
  filterChipText: {
    ...TYPE.footnote,
    color: COLORS.text.secondary,
    fontWeight: '600',
  },
  filterChipTextActive: { color: COLORS.brand },
  listPad: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.sm,
    paddingBottom: 32,
    gap: 10,
  },
  errCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  errText: { ...TYPE.body, color: COLORS.danger, flex: 1 },
  empty: { ...TYPE.headline, color: COLORS.text.secondary },
  emptySub: { ...TYPE.footnote, color: COLORS.text.tertiary, marginTop: 6, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: GLASS.border, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  cardTitle: { ...TYPE.body, color: COLORS.text.primary, fontWeight: '700' },
  cardMeta: { ...TYPE.caption, color: COLORS.text.tertiary, marginTop: 2 },
  actor: { ...TYPE.footnote, color: COLORS.text.secondary },
  diff: {
    ...TYPE.caption,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
});
