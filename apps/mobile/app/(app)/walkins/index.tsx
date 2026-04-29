/**
 * 散客目录 — 与会员档案同构布局（仅业务动作不同）。
 */

import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { COLORS, SPACING, TYPE } from '../../../theme/paperTheme';
import {
  AppHeader,
  MeshBackground,
  SectionLabel,
  GlassSurface,
  BentoGrid,
  Bento,
  StatTile,
  PressableCard,
  StatusChip,
  IconAvatar,
} from '../../../components/ui';
import { walkinsApi, type WalkinRow } from '../../../api/walkins';
import { useScrollToTopOnFocus } from '../../../hooks/useScrollToTopOnFocus';

const WALKINS_KEY = ['walkins', 'list'] as const;

export default function WalkinsScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(scrollRef);

  const [query, setQuery] = useState('');
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: WALKINS_KEY,
    queryFn: async () => (await walkinsApi.list()).items,
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: WALKINS_KEY });
    }, [qc]),
  );

  const walkins = q.data ?? [];
  const filtered = query.trim()
    ? walkins.filter((w) =>
        w.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : walkins;
  const withOrders = filtered.filter((w) => w.stats.active_order_count > 0).length;
  const totalMeals = filtered.reduce((sum, w) => sum + w.stats.total_meals, 0);
  const totalSpent = filtered.reduce((sum, w) => sum + w.stats.total_spent, 0);

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader
          title="散客目录"
          right={
            <Pressable
              onPress={() => router.push('/(app)/orders')}
              style={styles.addBtn}
              hitSlop={8}
            >
              <Ionicons name="add" size={22} color={COLORS.brand} />
              <Text style={styles.addBtnText}>录单</Text>
            </Pressable>
          }
        />

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.container}>
            <View style={styles.block}>
              <SectionLabel>概览</SectionLabel>
              <BentoGrid gap={SPACING.md}>
                <Bento span={4} mobileSpan={6}>
                  <StatTile label="散客数" value={`${filtered.length}`} icon="walk-outline" color={COLORS.warning} tint="warn" />
                </Bento>
                <Bento span={4} mobileSpan={6}>
                  <StatTile label="有订单" value={`${withOrders}`} icon="receipt-outline" color={COLORS.info} tint="info" />
                </Bento>
                <Bento span={4} mobileSpan={12}>
                  <StatTile label="累计消费" value={`¥${Math.round(totalSpent)}`} icon="wallet-outline" color={COLORS.success} tint="ok" />
                </Bento>
              </BentoGrid>
            </View>

            <View style={styles.block}>
              <SectionLabel>筛选</SectionLabel>
              <GlassSurface padding={SPACING.md} style={styles.filterCard}>
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={16} color={COLORS.text.tertiary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="按散客姓名搜索..."
                    placeholderTextColor={COLORS.text.quaternary}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                  />
                  {query ? (
                    <Pressable onPress={() => setQuery('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={COLORS.text.quaternary} />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.countText}>{filtered.length} 位散客 · 累计 {totalMeals} 份</Text>
              </GlassSurface>
            </View>

            <View style={styles.block}>
              <SectionLabel>{`散客列表 · ${filtered.length}`}</SectionLabel>
              {q.isLoading ? (
                <View style={styles.empty}>
                  <ActivityIndicator color={COLORS.brand} />
                  <Text style={styles.emptyText}>加载中...</Text>
                </View>
              ) : q.error ? (
                <GlassSurface padding={SPACING.base} tint="danger" style={styles.emptyCard}>
                  <Text style={styles.emptyError}>加载失败：{(q.error as Error).message}</Text>
                  <Pressable onPress={() => void q.refetch()}>
                    <Text style={styles.retryLink}>重试</Text>
                  </Pressable>
                </GlassSurface>
              ) : filtered.length === 0 ? (
                <GlassSurface padding={SPACING.base} style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    {walkins.length === 0
                      ? '还没有散客记录，请在每日订餐中录入散餐。'
                      : '没有找到匹配的散客。'}
                  </Text>
                </GlassSurface>
              ) : (
                filtered.map((item) => <WalkinRowItem key={item.id} walkin={item} />)
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function WalkinRowItem({ walkin }: { walkin: WalkinRow }) {
  const { stats } = walkin;
  const last = stats.last_order_date;
  return (
    <PressableCard
      style={styles.row}
      onPress={() =>
        router.push({
          pathname: '/(app)/walkins/[id]',
          params: { id: String(walkin.id) },
        })
      }
      padding={SPACING.base}
    >
      <IconAvatar icon="walk-outline" size={50} color={COLORS.warning} bg="#FFF4E5" />
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.name}>{walkin.name}</Text>
          <StatusChip label="散客" variant="warning" />
        </View>
        <Text style={styles.sub}>
          {stats.active_order_count} 单 · {stats.total_meals} 份 · 累计 ¥
          {stats.total_spent.toFixed(0)}
        </Text>
        <Text style={styles.metaRow}>
          {last ? `最近订单 ${last}` : '暂无订单'}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={COLORS.text.quaternary}
      />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  scroll: { paddingBottom: 32 },
  container: {
    width: '100%',
    maxWidth: SPACING.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: SPACING.page,
  },
  block: { marginBottom: SPACING.lg },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  addBtnText: { ...TYPE.body, color: COLORS.brand, fontWeight: '600' },
  filterCard: { gap: SPACING.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.systemGrouped,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
  },
  searchInput: { flex: 1, ...TYPE.body, color: COLORS.text.primary },
  countText: { ...TYPE.caption, color: COLORS.text.tertiary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  rowContent: { flex: 1, gap: 2, marginLeft: SPACING.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...TYPE.headline, color: COLORS.text.primary },
  sub: {
    ...TYPE.caption,
    color: COLORS.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  metaRow: { ...TYPE.caption, color: COLORS.text.tertiary },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyCard: { alignItems: 'center', gap: 8 },
  emptyText: { ...TYPE.body, color: COLORS.text.tertiary, textAlign: 'center' },
  emptyError: { ...TYPE.body, color: COLORS.danger, textAlign: 'center' },
  retryLink: { ...TYPE.body, color: COLORS.brand, fontWeight: '600' },
});
