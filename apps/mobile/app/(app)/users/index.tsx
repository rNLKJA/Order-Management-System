/**
 * 员工名单页 —— v3 Glass + Bento。
 * 布局：概览 Bento → 在职列表 → 已停用列表。
 */

import { useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { displayUserRole } from '@meal/shared';
import { usersApi, type ApiUser } from '../../../api/users';
import {
  AppHeader,
  MeshBackground,
  PressableCard,
  StatusChip,
  SectionLabel,
  BentoGrid,
  Bento,
  StatTile,
  IconAvatar,
  GlassSurface,
} from '../../../components/ui';
import { COLORS, SPACING, TYPE } from '../../../theme/paperTheme';
import { useScrollToTopOnFocus } from '../../../hooks/useScrollToTopOnFocus';

export default function UsersScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(scrollRef);

  const q = useQuery({
    queryKey: ['users', 'list-full'],
    queryFn: async () => (await usersApi.list()).users,
    staleTime: 2 * 60 * 1000,
  });

  const users = q.data ?? [];
  const active = useMemo(() => users.filter((u) => u.is_active), [users]);
  const inactive = useMemo(() => users.filter((u) => !u.is_active), [users]);
  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users]);

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader title="员工名单" onBack={() => router.back()} />

        {q.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.brand} />
          </View>
        ) : q.error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>加载失败：{q.error.message}</Text>
          </View>
        ) : (
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.container}>
              <View style={styles.block}>
                <SectionLabel>人员概览</SectionLabel>
                <BentoGrid gap={SPACING.md}>
                  <Bento span={4} mobileSpan={6}>
                    <StatTile label="总人数" value={`${users.length}`} icon="people-outline" color={COLORS.brand} tint="info" />
                  </Bento>
                  <Bento span={4} mobileSpan={6}>
                    <StatTile label="在职" value={`${active.length}`} icon="checkmark-circle-outline" color={COLORS.success} tint="ok" />
                  </Bento>
                  <Bento span={4} mobileSpan={12}>
                    <StatTile label="管理员" value={`${adminCount}`} icon="shield-checkmark-outline" color={COLORS.info} tint="warn" />
                  </Bento>
                </BentoGrid>
              </View>

              <View style={styles.block}>
                <SectionLabel>{`在职 · ${active.length}`}</SectionLabel>
                {active.length === 0 ? (
                  <GlassSurface padding={SPACING.base}>
                    <Text style={styles.emptyText}>当前没有在职员工</Text>
                  </GlassSurface>
                ) : (
                  active.map((u) => <UserRow key={u.id} user={u} />)
                )}
              </View>

              {inactive.length > 0 ? (
                <View style={styles.block}>
                  <SectionLabel>{`已停用 · ${inactive.length}`}</SectionLabel>
                  {inactive.map((u) => (
                    <UserRow key={u.id} user={u} disabled />
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function UserRow({ user, disabled }: { user: ApiUser; disabled?: boolean }) {
  const initial = (user.full_name || user.username)[0] ?? '?';
  const roleLabel = displayUserRole(user);
  const roleVariant = user.role === 'admin' || user.is_superadmin ? 'warning' : 'fulfilled';

  return (
    <PressableCard
      onPress={() =>
        router.push({
          pathname: '/(app)/users/[id]',
          params: { id: String(user.id) },
        })
      }
      padding={SPACING.base}
      style={[styles.row, disabled && styles.rowDisabled]}
    >
      <View style={styles.avatarBlock}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
        ) : (
          <IconAvatar icon="person-outline" size={44} color={COLORS.brand} bg={COLORS.brandSoft} />
        )}
        <StatusChip label={roleLabel} variant={roleVariant} />
      </View>
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {user.full_name || user.username}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>
      <View style={styles.meta}>
        <StatusChip label={user.is_active ? '在职' : '停用'} variant={user.is_active ? 'fulfilled' : 'neutral'} />
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.text.quaternary} />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...TYPE.body, color: COLORS.danger, paddingHorizontal: 16, textAlign: 'center' },
  scroll: { paddingBottom: 32 },
  container: {
    width: '100%',
    maxWidth: SPACING.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: SPACING.page,
  },
  block: { marginBottom: SPACING.lg },
  emptyText: { ...TYPE.body, color: COLORS.text.tertiary, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  rowDisabled: { opacity: 0.56 },
  avatarBlock: { alignItems: 'center', gap: 6 },
  avatarImage: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.brandSoft },
  main: { flex: 1, minWidth: 0 },
  name: { ...TYPE.headline, color: COLORS.text.primary },
  sub: { ...TYPE.caption, color: COLORS.text.tertiary, marginTop: 2 },
  meta: { gap: 6, marginRight: 4 },
});
