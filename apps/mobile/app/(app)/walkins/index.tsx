/**
 * 散客目录 — 和会员档案同风格，但更轻量。
 *
 * 散客 = is_walkin=true 的 member，数据由 POST /api/orders 的 customer_name 自动建。
 * 每一行显示 订单数 / 累计消费 / 最后订单日期，右上 + 号跳到"录入散餐"（会员 tab 的 adhoc 子模式）。
 * 点一行 → 散客详情页（可以开卡把他升为正式会员）。
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../../theme/paperTheme';
import { AppHeader, MeshBackground } from '../../../components/ui';
import { walkinsApi, type WalkinRow } from '../../../api/walkins';

const WALKINS_KEY = ['walkins', 'list'] as const;

export default function WalkinsScreen() {
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
              <Ionicons name="add" size={22} color={IOS_COLORS.blue} />
              <Text style={styles.addBtnText}>录单</Text>
            </Pressable>
          }
        />

        {/* 搜索框 */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Ionicons
              name="search-outline"
              size={16}
              color={IOS_COLORS.labelSecondary}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="按散客姓名搜索..."
              placeholderTextColor={IOS_COLORS.labelTertiary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={IOS_COLORS.labelTertiary}
                />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.countText}>{filtered.length} 位</Text>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(w) => String(w.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <WalkinRowItem walkin={item} />}
          refreshing={q.isLoading}
          onRefresh={() => void q.refetch()}
          ListEmptyComponent={
            q.isLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={IOS_COLORS.blue} />
                <Text style={styles.emptyText}>加载中...</Text>
              </View>
            ) : q.error ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>⚠︎</Text>
                <Text style={styles.emptyText}>
                  加载失败：{(q.error as Error).message}
                </Text>
                <Pressable onPress={() => void q.refetch()}>
                  <Text style={styles.retryLink}>重试</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>—</Text>
                <Text style={styles.emptyText}>
                  {walkins.length === 0
                    ? '还没有散客记录，去「每日订餐 · 录入 · 散餐」录一条'
                    : '没有找到匹配的散客'}
                </Text>
              </View>
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}

function WalkinRowItem({ walkin }: { walkin: WalkinRow }) {
  const { stats } = walkin;
  const last = stats.last_order_date;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() =>
        router.push({
          pathname: '/(app)/walkins/[id]',
          params: { id: String(walkin.id) },
        })
      }
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{walkin.name[0] ?? '散'}</Text>
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.name}>{walkin.name}</Text>
          <View style={styles.walkinBadge}>
            <Text style={styles.walkinBadgeText}>散客</Text>
          </View>
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
        color={IOS_COLORS.labelTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  addBtnText: { fontSize: 15, color: IOS_COLORS.blue, fontWeight: '500' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.fillLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 15, color: IOS_COLORS.label },
  countText: { fontSize: 13, color: IOS_COLORS.labelSecondary },

  list: { paddingHorizontal: 12, paddingBottom: 32, gap: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowPressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF4E5',
  },
  avatarText: { fontSize: 20, fontWeight: '600', color: IOS_COLORS.orange },

  rowContent: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '600', color: IOS_COLORS.label },
  walkinBadge: {
    backgroundColor: '#FFF4E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  walkinBadgeText: {
    fontSize: 11,
    color: IOS_COLORS.orange,
    fontWeight: '600',
  },
  sub: {
    fontSize: 13,
    color: IOS_COLORS.label,
    fontVariant: ['tabular-nums'],
  },
  metaRow: { fontSize: 12, color: IOS_COLORS.labelTertiary },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    fontSize: 15,
    color: IOS_COLORS.labelSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  retryLink: { fontSize: 15, color: IOS_COLORS.blue },
});
