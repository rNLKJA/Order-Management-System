/**
 * 当前用户信息页 — v3 玻璃。
 */

import { StyleSheet, ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { COLORS, GLASS, SPACING, TYPE } from '../../../theme/paperTheme';
import { confirmDestructive } from '../../../lib/confirm';
import {
  AppHeader,
  Button,
  GlassSurface,
  IconAvatar,
  MeshBackground,
  SectionLabel,
  StatusChip,
} from '../../../components/ui';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    confirmDestructive(
      '退出登录',
      '确定要退出登录吗？',
      () => { void signOut(); },
      '退出',
    );
  };

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.container}>
            <AppHeader title="当前用户" />

            <GlassSurface padding={SPACING.xl} style={styles.profileCard}>
              <IconAvatar
                icon="person-outline"
                size={76}
                color="#FFFFFF"
                bg={COLORS.brand}
                style={styles.avatar}
              />
              <Text style={styles.fullName}>{user?.full_name ?? '未登录'}</Text>
              <Text style={styles.username}>@{user?.username ?? '—'}</Text>
              <StatusChip
                label={user?.role === 'admin' ? '管理员' : '员工'}
                variant={user?.role === 'admin' ? 'danger' : 'fulfilled'}
                dot
                style={styles.roleChip}
              />
            </GlassSurface>

            <View style={styles.section}>
              <SectionLabel>账号信息</SectionLabel>
              <GlassSurface padding={0} style={styles.infoCard}>
                <InfoRow label="用户名" value={user?.username ?? '—'} />
                <InfoRow label="显示名称" value={user?.full_name ?? '—'} />
                <InfoRow
                  label="权限角色"
                  value={user?.role === 'admin' ? '管理员（全部权限）' : '员工（日常操作）'}
                  isLast
                />
              </GlassSurface>
            </View>

            {user?.role === 'staff' ? (
              <View style={styles.section}>
                <SectionLabel>我能做什么</SectionLabel>
                <GlassSurface padding={SPACING.base} style={styles.permCard}>
                  {[
                    '建档会员 / 编辑会员信息',
                    '购卡 / 升级 / 换卡',
                    '录入每日订餐',
                    '新增支出',
                    '完成出餐 / 确认送达 / 取消订单',
                    '查看财务概览',
                  ].map((p) => (
                    <View key={p} style={styles.permRow}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={16}
                        color={COLORS.success}
                      />
                      <Text style={styles.permText}>{p}</Text>
                    </View>
                  ))}
                </GlassSurface>
              </View>
            ) : null}

            <View style={styles.section}>
              <Button
                label="退出登录"
                variant="danger"
                fullWidth
                onPress={handleSignOut}
              />
            </View>

            <Text style={styles.footer}>如需修改密码，请联系管理员重置</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
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

  profileCard: { alignItems: 'center', marginTop: SPACING.sm, marginBottom: SPACING.lg },
  avatar: { marginBottom: SPACING.md },
  fullName: { ...TYPE.title2, color: COLORS.text.primary, marginBottom: 2 },
  username: { ...TYPE.footnote, color: COLORS.text.tertiary, marginBottom: SPACING.sm },
  roleChip: { alignSelf: 'center' },

  section: { marginBottom: SPACING.lg },

  infoCard: {},
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingVertical: 14,
  },
  infoRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GLASS.outline,
  },
  infoLabel: { ...TYPE.body, color: COLORS.text.primary },
  infoValue: { ...TYPE.body, color: COLORS.text.tertiary, flexShrink: 1, marginLeft: 12 },

  permCard: { gap: SPACING.sm },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  permText: { ...TYPE.body, color: COLORS.text.primary, flex: 1 },

  footer: {
    textAlign: 'center',
    ...TYPE.footnote,
    color: COLORS.text.tertiary,
    marginBottom: 32,
  },
});
