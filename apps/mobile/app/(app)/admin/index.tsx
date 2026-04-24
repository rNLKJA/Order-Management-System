import { useMemo } from 'react';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, type ApiUser } from '../../../api/users';
import { useAuth } from '../../../hooks/useAuth';
import { IOS_COLORS } from '../../../theme/paperTheme';
import { AppHeader, MeshBackground } from '../../../components/ui';

export default function AdminPermissionsScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: usersApi.permissions,
    staleTime: 30_000,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof usersApi.updateAccess>[1] }) =>
      usersApi.updateAccess(id, input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin', 'permissions'] }),
        qc.invalidateQueries({ queryKey: ['users', 'list-full'] }),
        qc.invalidateQueries({ queryKey: ['users'] }),
      ]);
    },
  });

  const users = useMemo(() => q.data?.users ?? [], [q.data?.users]);
  const activeUsers = users.filter((u) => u.is_active);

  if (user?.role !== 'admin') {
    return (
      <View style={styles.root}>
        <MeshBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <AppHeader title="权限管理" onBack={() => router.back()} />
          <View style={styles.center}>
            <Text style={styles.err}>仅管理员可访问</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader
          title="权限管理"
          subtitle={q.data ? `在职 ${activeUsers.length} 人` : ''}
          onBack={() => router.back()}
        />
        {q.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={IOS_COLORS.blue} />
          </View>
        ) : q.isError ? (
          <View style={styles.center}>
            <Text style={styles.err}>加载失败：{q.error.message}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listPad}>
            <View style={styles.tip}>
              <Text style={styles.tipText}>
                当前写操作开关：{q.data?.enforcement ? '已开启' : '测试模式（未开启）'}。即使未开启，也可先配置写权限名单。
              </Text>
            </View>
            {users.map((u) => (
              <PermissionRow
                key={u.id}
                user={u}
                loading={updateMut.isPending}
                onToggleActive={(next) =>
                  updateMut.mutate({ id: u.id, input: { is_active: next } })
                }
                onToggleRole={(nextRole) =>
                  updateMut.mutate({ id: u.id, input: { role: nextRole } })
                }
                onToggleWrite={(next) =>
                  updateMut.mutate({ id: u.id, input: { can_data_write: next } })
                }
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function PermissionRow({
  user,
  loading,
  onToggleRole,
  onToggleActive,
  onToggleWrite,
}: {
  user: ApiUser;
  loading: boolean;
  onToggleRole: (nextRole: 'admin' | 'staff') => void;
  onToggleActive: (next: boolean) => void;
  onToggleWrite: (next: boolean) => void;
}) {
  const roleLabel = user.role === 'admin' ? '管理员' : '员工';
  const writeEnabled = user.role === 'admin' || !!user.can_data_write;
  return (
    <View style={[styles.row, !user.is_active && styles.rowMuted]}>
      <View style={styles.rowTop}>
        <Text style={styles.name}>{user.full_name || user.username}</Text>
        <Text style={styles.sub}>@{user.username}</Text>
      </View>
      <View style={styles.ctrlRow}>
        <Text style={styles.ctrlLabel}>角色</Text>
        <Pressable
          disabled={loading}
          style={[styles.chip, { backgroundColor: user.role === 'admin' ? IOS_COLORS.blueLight : '#E8F8ED' }]}
          onPress={() => onToggleRole(user.role === 'admin' ? 'staff' : 'admin')}
        >
          <Text style={[styles.chipText, { color: user.role === 'admin' ? IOS_COLORS.blue : '#34C759' }]}>{roleLabel}</Text>
        </Pressable>
      </View>
      <View style={styles.ctrlRow}>
        <Text style={styles.ctrlLabel}>写权限</Text>
        <Pressable
          disabled={loading || user.role === 'admin'}
          style={[styles.toggle, writeEnabled && styles.toggleOn, user.role === 'admin' && styles.toggleDisabled]}
          onPress={() => onToggleWrite(!writeEnabled)}
        >
          <Text style={[styles.toggleText, writeEnabled && styles.toggleTextOn]}>
            {writeEnabled ? '允许' : '只读'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.ctrlRow}>
        <Text style={styles.ctrlLabel}>账号状态</Text>
        <Pressable
          disabled={loading}
          style={[styles.toggle, user.is_active && styles.toggleOn]}
          onPress={() => onToggleActive(!user.is_active)}
        >
          <Text style={[styles.toggleText, user.is_active && styles.toggleTextOn]}>
            {user.is_active ? '在职' : '停用'}
          </Text>
        </Pressable>
      </View>
      <Ionicons name="shield-checkmark-outline" size={14} color={IOS_COLORS.labelTertiary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  err: { color: IOS_COLORS.red, fontSize: 14 },
  listPad: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  tip: {
    backgroundColor: IOS_COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  tipText: { fontSize: 12, color: IOS_COLORS.labelSecondary, lineHeight: 18 },
  row: {
    backgroundColor: IOS_COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  rowMuted: { opacity: 0.6 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: IOS_COLORS.label },
  sub: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  ctrlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ctrlLabel: { fontSize: 13, color: IOS_COLORS.labelSecondary },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
  toggle: { borderRadius: 8, borderWidth: 1, borderColor: IOS_COLORS.separator, paddingHorizontal: 10, paddingVertical: 4 },
  toggleOn: { backgroundColor: IOS_COLORS.blueLight, borderColor: IOS_COLORS.blueLight },
  toggleDisabled: { opacity: 0.8 },
  toggleText: { fontSize: 12, color: IOS_COLORS.labelSecondary, fontWeight: '700' },
  toggleTextOn: { color: IOS_COLORS.blue },
});
