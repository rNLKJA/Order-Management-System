/**
 * 会员列表页 - MEA-10。
 *
 * - 顶部：搜索框（uid / 姓名 / 昵称 / 手机 / 微信号）+ 新增按钮
 * - 筛选开关：仅院内订阅、显示已归档（admin 才能看到归档开关的效果）
 * - 列表项：点击跳转到会员详情；带 UID / 姓名 / 手机 / 院内订阅徽章
 *
 * 数据走 TanStack Query，弱网时复用缓存。
 */

import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import {
  Appbar,
  Searchbar,
  Chip,
  List,
  Text,
  Button,
  Divider,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { membersApi, type Member } from '../../../api/members';

export default function MembersListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [onlyHospital, setOnlyHospital] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);

  const query = useQuery({
    queryKey: ['members', { q, onlyHospital, includeArchived }],
    queryFn: () =>
      membersApi.list({
        q: q.trim() || undefined,
        is_hospital: onlyHospital ? true : undefined,
        include_archived: includeArchived,
        limit: 100,
      }),
  });

  const items: Member[] = query.data?.items ?? [];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="会员管理" />
        <Appbar.Action
          icon="plus"
          accessibilityLabel="新增会员"
          onPress={() => router.push('/(app)/members/new')}
        />
      </Appbar.Header>

      <View style={styles.toolbar}>
        <Searchbar
          placeholder="搜索 UID / 姓名 / 昵称 / 手机 / 微信"
          value={q}
          onChangeText={setQ}
          style={styles.search}
        />
        <View style={styles.chipRow}>
          <Chip
            selected={onlyHospital}
            onPress={() => setOnlyHospital((v) => !v)}
            style={styles.chip}
          >
            仅院内订阅
          </Chip>
          <Chip
            selected={includeArchived}
            onPress={() => setIncludeArchived((v) => !v)}
            style={styles.chip}
          >
            显示已归档
          </Chip>
        </View>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          共 {query.data?.total ?? 0} 位会员
        </Text>
      </View>

      {query.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      ) : query.isError ? (
        <View style={styles.empty}>
          <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
            加载失败：{(query.error as Error).message}
          </Text>
          <Button mode="outlined" onPress={() => query.refetch()} style={styles.retry}>
            重试
          </Button>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            暂无会员。点击右上角 + 新增一位。
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => String(m.id)}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => (
            <List.Item
              title={item.uid}
              description={
                [
                  item.phone,
                  item.is_hospital ? '院内订阅' : '院外',
                  item.is_active ? null : '已归档',
                  item.wechat_id || null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              }
              left={(props) => (
                <List.Icon
                  {...props}
                  icon={item.is_hospital ? 'hospital-building' : 'account'}
                />
              )}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push(`/(app)/members/${item.id}`)}
              style={!item.is_active ? styles.archived : undefined}
            />
          )}
          refreshing={query.isFetching}
          onRefresh={() => query.refetch()}
          contentContainerStyle={items.length === 0 ? styles.empty : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    padding: 12,
    gap: 8,
  },
  search: {
    borderRadius: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderRadius: 12,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  archived: {
    opacity: 0.55,
  },
  retry: {
    marginTop: 12,
  },
});
