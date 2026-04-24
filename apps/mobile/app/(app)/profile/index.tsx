/**
 * 当前用户信息页 — v3 玻璃。
 *
 * 头像：点击弹动作菜单（拍照 / 从相册选 / 移除），上传成功后 refresh()
 * 让全应用订阅 useAuth 的页面都拿到最新头像 URL。
 */

import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, ScrollView, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { COLORS, GLASS, SPACING, TYPE } from '../../../theme/paperTheme';
import { confirmDestructive, notify } from '../../../lib/confirm';
import { confirmDialog } from '../../../components/ui';
import { pickAvatar } from '../../../lib/avatar';
import { usersApi } from '../../../api/users';
import {
  AppHeader,
  Bento,
  BentoGrid,
  Button,
  GlassSurface,
  IconAvatar,
  MeshBackground,
  SectionLabel,
  StatTile,
  StatusChip,
} from '../../../components/ui';

export default function ProfileScreen() {
  const { user, signOut, refresh } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [avatarMenuVisible, setAvatarMenuVisible] = useState(false);

  const handleSignOut = () => {
    confirmDestructive(
      '退出登录',
      '确定要退出登录吗？',
      () => { void signOut(); },
      '退出',
    );
  };

  const runUpload = async (dataUrl: string) => {
    setUploading(true);
    try {
      await usersApi.updateMyAvatar(dataUrl);
      await refresh();
    } catch (err) {
      await notify(
        '上传失败',
        err instanceof Error ? err.message : '请稍后重试',
        'destructive',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleCamera = async () => {
    if (uploading) return;
    setAvatarMenuVisible(false);
    const dataUrl = await pickAvatar({ fromLibrary: false });
    if (dataUrl) await runUpload(dataUrl);
  };

  const handleLibrary = async () => {
    if (uploading) return;
    setAvatarMenuVisible(false);
    const dataUrl = await pickAvatar({ fromLibrary: true });
    if (dataUrl) await runUpload(dataUrl);
  };

  const handleRemove = async () => {
    if (uploading) return;
    setAvatarMenuVisible(false);
    const ok = await confirmDialog({
      title: '移除头像？',
      message: '移除后将显示默认头像，可以随时重新上传。',
      confirmLabel: '移除',
      cancelLabel: '保留',
      tone: 'destructive',
    });
    if (!ok) return;
    setUploading(true);
    try {
      await usersApi.clearMyAvatar();
      await refresh();
    } catch (err) {
      await notify(
        '移除失败',
        err instanceof Error ? err.message : '请稍后重试',
        'destructive',
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.container}>
            <AppHeader title="当前用户" />

            <GlassSurface padding={SPACING.lg} style={styles.profileCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle}>个人名片</Text>
                <Pressable
                  onPress={() => setAvatarMenuVisible(true)}
                  disabled={uploading}
                  style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                  hitSlop={8}
                >
                  <Ionicons name="create-outline" size={16} color={COLORS.brand} />
                  <Text style={styles.editBtnText}>编辑</Text>
                </Pressable>
              </View>
              <View style={styles.profileTop}>
                <Pressable
                  onPress={() => setAvatarMenuVisible(true)}
                  disabled={uploading}
                  style={styles.avatarWrap}
                  hitSlop={8}
                >
                  {user?.avatar_url ? (
                    <Image
                      source={{ uri: user.avatar_url }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <IconAvatar
                      icon="person-outline"
                      size={76}
                      color="#FFFFFF"
                      bg={COLORS.brand}
                    />
                  )}
                  {uploading ? (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator color="#FFFFFF" />
                    </View>
                  ) : (
                    <View style={styles.avatarCameraBadge}>
                      <Ionicons name="camera" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
                <View style={styles.profileIdentity}>
                  <Text style={styles.fullName}>{user?.full_name ?? '未登录'}</Text>
                  <Text style={styles.username}>@{user?.username ?? '—'}</Text>
                  <StatusChip
                    label={user?.role === 'admin' ? '管理员' : '员工'}
                    variant={user?.role === 'admin' ? 'warning' : 'fulfilled'}
                    dot
                    style={styles.roleChip}
                  />
                </View>
              </View>
              <Text style={styles.avatarHint}>点击头像或编辑按钮可更新照片</Text>
            </GlassSurface>

            <View style={styles.section}>
              <SectionLabel>账户概览</SectionLabel>
              <BentoGrid gap={SPACING.md}>
                <Bento span={4} mobileSpan={6}>
                  <StatTile label="角色" value={user?.role === 'admin' ? '管理员' : '员工'} icon="shield-checkmark-outline" color={COLORS.info} tint="info" />
                </Bento>
                <Bento span={4} mobileSpan={6}>
                  <StatTile label="状态" value="已登录" icon="checkmark-circle-outline" color={COLORS.success} tint="ok" />
                </Bento>
                <Bento span={4} mobileSpan={12}>
                  <StatTile label="用户 ID" value={`${user?.id ?? '-'}`} icon="person-circle-outline" color={COLORS.brand} tint="warn" />
                </Bento>
              </BentoGrid>
            </View>

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

            <View style={styles.section}>
              <SectionLabel>隐私与合规</SectionLabel>
              <GlassSurface padding={0} style={styles.infoCard}>
                <Pressable
                  onPress={() => router.push('/(app)/profile/privacy')}
                  style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.72 }]}
                >
                  <View style={styles.linkLeft}>
                    <Ionicons name="document-text-outline" size={16} color={COLORS.text.tertiary} />
                    <Text style={styles.linkTitle}>隐私政策</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.text.quaternary} />
                </Pressable>
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

      <Modal
        transparent
        visible={avatarMenuVisible}
        animationType="fade"
        onRequestClose={() => setAvatarMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setAvatarMenuVisible(false)} />
        <View style={styles.menuWrap}>
          <GlassSurface padding={SPACING.md} style={styles.menuCard}>
            <Text style={styles.menuTitle}>编辑头像</Text>
            <Pressable onPress={handleCamera} disabled={uploading} style={styles.menuAction}>
              <Ionicons name="camera-outline" size={16} color={COLORS.brand} />
              <Text style={styles.menuActionText}>拍照</Text>
            </Pressable>
            <Pressable onPress={handleLibrary} disabled={uploading} style={styles.menuAction}>
              <Ionicons name="image-outline" size={16} color={COLORS.brand} />
              <Text style={styles.menuActionText}>从相册选择</Text>
            </Pressable>
            {user?.avatar_url ? (
              <Pressable onPress={handleRemove} disabled={uploading} style={styles.menuAction}>
                <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                <Text style={[styles.menuActionText, { color: COLORS.danger }]}>移除头像</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setAvatarMenuVisible(false)} style={styles.menuCancel}>
              <Text style={styles.menuCancelText}>取消</Text>
            </Pressable>
          </GlassSurface>
        </View>
      </Modal>
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
  cardTopRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cardTitle: { ...TYPE.footnote, color: COLORS.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,122,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: { ...TYPE.caption, color: COLORS.brand, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  profileTop: { flexDirection: 'row', width: '100%', alignItems: 'center', gap: SPACING.base, marginBottom: SPACING.md },
  profileIdentity: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: SPACING.md,
    position: 'relative',
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.brandSoft,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 38,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fullName: { ...TYPE.title2, color: COLORS.text.primary, marginBottom: 2 },
  username: { ...TYPE.footnote, color: COLORS.text.tertiary, marginBottom: SPACING.sm },
  roleChip: { alignSelf: 'flex-start' },
  avatarHint: { ...TYPE.caption, color: COLORS.text.tertiary },

  menuOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  menuWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: SPACING.page, paddingBottom: 24 },
  menuCard: { gap: 6 },
  menuTitle: { ...TYPE.callout, color: COLORS.text.primary, marginBottom: 4 },
  menuAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  menuActionText: { ...TYPE.body, color: COLORS.text.primary },
  menuCancel: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  menuCancelText: { ...TYPE.body, color: COLORS.text.tertiary, fontWeight: '600' },

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
  linkRow: {
    minHeight: 48,
    paddingHorizontal: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  linkTitle: {
    ...TYPE.body,
    color: COLORS.text.primary,
    fontWeight: '600',
  },

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
