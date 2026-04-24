/**
 * 员工名单页 —— 列出所有 admin / staff，点击进该员工的订单流水。
 *
 * 数据来自 `/api/users`，带每人的订单汇总统计。
 */

import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, type ApiUser } from '../../../api/users';
import { IOS_COLORS } from '../../../theme/paperTheme';
import { AppHeader, MeshBackground } from '../../../components/ui';

export default function UsersScreen() {
  const q = useQuery({
    queryKey: ['users', 'list-full'],
    queryFn: async () => (await usersApi.list()).users,
    staleTime: 2 * 60 * 1000,
  });

  const active = useMemo(
    () => (q.data ?? []).filter((u) => u.is_active),
    [q.data],
  );
  const inactive = useMemo(
    () => (q.data ?? []).filter((u) => !u.is_active),
    [q.data],
  );

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader
          title="员工名单"
          subtitle={q.data ? `共 ${q.data.length} 人，${active.length} 位在职` : ''}
          onBack={() => router.back()}
        />

        {q.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={IOS_COLORS.blue} />
          </View>
        ) : q.error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>加载失败：{q.error.message}</Text>
          </View>
        ) : (
          <FlatList
            data={active}
            keyExtractor={(u) => String(u.id)}
            renderItem={({ item }) => <UserRow user={item} />}
            ListHeaderComponent={
              <Text style={styles.sectionLabel}>在职 · {active.length}</Text>
            }
            ListFooterComponent={
              inactive.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
                    已停用 · {inactive.length}
                  </Text>
                  {inactive.map((u) => (
                    <UserRow key={u.id} user={u} disabled />
                  ))}
                </>
              ) : null
            }
            contentContainerStyle={styles.listPad}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function UserRow({ user, disabled }: { user: ApiUser; disabled?: boolean }) {
  const initial = (user.full_name || user.username)[0] ?? '?';
  const roleLabel = user.role === 'admin' ? '管理员' : '员工';
  const roleBg = user.role === 'admin' ? IOS_COLORS.blueLight : '#E8F8ED';
  const roleFg = user.role === 'admin' ? IOS_COLORS.blue : '#34C759';

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(app)/users/[id]',
          params: { id: String(user.id) },
        })
      }
      style={({ pressed }) => [
        styles.row,
        disabled && styles.rowDisabled,
        pressed && { backgroundColor: IOS_COLORS.fillLight },
      ]}
    >
      {user.avatar_url ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <View style={styles.avatar}>{(null as any)}</View>
      ) : (
        <View style={[styles.avatar, { backgroundColor: roleBg }]}>
          <Text style={[styles.avatarText, { color: roleFg }]}>{initial}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {user.full_name || user.username}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          @{user.username} · id {user.id}
        </Text>
      </View>
      <View style={[styles.roleChip, { backgroundColor: roleBg }]}>
        <Text style={[styles.roleChipText, { color: roleFg }]}>{roleLabel}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={IOS_COLORS.labelTertiary}
        style={{ marginLeft: 6 }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: IOS_COLORS.red, paddingHorizontal: 16, textAlign: 'center' },

  listPad: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: IOS_COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  rowDisabled: { opacity: 0.45 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600', color: IOS_COLORS.label },
  sub: { fontSize: 12, color: IOS_COLORS.labelSecondary, marginTop: 2 },

  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleChipText: { fontSize: 12, fontWeight: '700' },
});
