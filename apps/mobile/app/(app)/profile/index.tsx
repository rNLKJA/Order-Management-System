/**
 * 当前用户信息页（含退出登录）
 */

import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { IOS_COLORS } from '../../../theme/paperTheme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    if (typeof Alert !== 'undefined' && Alert.alert) {
      Alert.alert('退出登录', '确定要退出登录吗？', [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: async () => { await signOut(); } },
      ]);
    } else {
      // Web fallback
      if (window.confirm('确定要退出登录吗？')) signOut();
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView>
        {/* 头部导航 */}
        <View style={styles.nav}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>‹ 返回</Text>
          </Pressable>
          <Text style={styles.navTitle}>当前用户</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* 用户卡片 */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.full_name?.[0] ?? '?'}</Text>
          </View>
          <Text style={styles.fullName}>{user?.full_name ?? '—'}</Text>
          <Text style={styles.username}>@{user?.username ?? '—'}</Text>
          <View style={[styles.roleBadge, user?.role === 'admin' ? styles.adminBadge : styles.staffBadge]}>
            <Text style={styles.roleText}>{user?.role === 'admin' ? '管理员' : '员工'}</Text>
          </View>
        </View>

        {/* 信息列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>账号信息</Text>
          <View style={styles.infoCard}>
            <InfoRow label="用户名" value={user?.username ?? '—'} />
            <InfoRow label="显示名称" value={user?.full_name ?? '—'} />
            <InfoRow label="权限角色" value={user?.role === 'admin' ? '管理员（全部权限）' : '员工（日常操作）'} isLast />
          </View>
        </View>

        {/* 权限说明 */}
        {user?.role === 'staff' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>我能做什么</Text>
            <View style={styles.permCard}>
              {['建档会员 / 编辑会员信息', '购卡 / 升级 / 换卡', '录入每日订餐', '新增支出', '完成出餐 / 确认送达 / 取消订单', '查看财务概览'].map((p) => (
                <View key={p} style={styles.permRow}>
                  <Text style={styles.permCheck}>✓</Text>
                  <Text style={styles.permText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 退出按钮 */}
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>退出登录</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>如需修改密码，请联系管理员重置</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separatorLight,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 17, color: IOS_COLORS.blue },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: IOS_COLORS.label },

  profileCard: {
    alignItems: 'center',
    backgroundColor: IOS_COLORS.card,
    paddingVertical: 32,
    marginBottom: 20,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: IOS_COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  fullName: { fontSize: 22, fontWeight: '700', color: IOS_COLORS.label, marginBottom: 4 },
  username: { fontSize: 15, color: IOS_COLORS.labelSecondary, marginBottom: 10 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  adminBadge: { backgroundColor: '#FFE5E5' },
  staffBadge: { backgroundColor: IOS_COLORS.blueLight },
  roleText: { fontSize: 13, fontWeight: '600', color: IOS_COLORS.label },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: IOS_COLORS.labelSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 },

  infoCard: { backgroundColor: IOS_COLORS.card, borderRadius: 12, overflow: 'hidden' },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 15, color: IOS_COLORS.label },
  infoValue: { fontSize: 15, color: IOS_COLORS.labelSecondary },

  permCard: { backgroundColor: IOS_COLORS.card, borderRadius: 12, padding: 14, gap: 10 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  permCheck: { fontSize: 15, color: '#34C759', fontWeight: '700', width: 20 },
  permText: { fontSize: 15, color: IOS_COLORS.label },

  signOutBtn: {
    backgroundColor: '#FFF0F0',
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtnPressed: { opacity: 0.8 },
  signOutText: { fontSize: 17, fontWeight: '600', color: IOS_COLORS.red },

  footer: { textAlign: 'center', fontSize: 13, color: IOS_COLORS.labelSecondary, marginBottom: 32, paddingHorizontal: 20 },
});
