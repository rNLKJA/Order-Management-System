import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { usersApi, type ApiUser } from '../../../api/users';
import { useAuth } from '../../../hooks/useAuth';
import {
  COLORS,
  GLASS,
  RADIUS,
  SHADOW,
  SPACING,
  TYPE,
} from '../../../theme/paperTheme';
import {
  AppHeader,
  Button,
  GlassSurface,
  IconAvatar,
  MeshBackground,
} from '../../../components/ui';

export default function AdminPermissionsScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [draftRole, setDraftRole] = useState<'admin' | 'staff'>('staff');
  const [draftActive, setDraftActive] = useState(true);
  const [draftCanWrite, setDraftCanWrite] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);

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
  const passwordMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      usersApi.updatePassword(id, password),
    onSuccess: async () => {
      setNewPassword('');
      setConfirmPassword('');
      setPasswordHint('密码已更新，目标账号需要重新登录。');
      await qc.invalidateQueries({ queryKey: ['admin', 'permissions'] });
    },
    onError: (e) => {
      setPasswordHint(e instanceof Error ? e.message : '密码更新失败，请重试');
    },
  });

  const users = useMemo(() => q.data?.users ?? [], [q.data?.users]);
  const activeUsers = users.filter((u) => u.is_active);

  const openEditor = (target: ApiUser) => {
    setEditingUser(target);
    setDraftRole(target.role);
    setDraftActive(target.is_active);
    setDraftCanWrite(target.role === 'admin' ? true : !!target.can_data_write);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setPasswordHint(null);
  };

  const saveEditor = async () => {
    if (!editingUser) return;
    await updateMut.mutateAsync({
      id: editingUser.id,
      input: {
        role: draftRole,
        is_active: draftActive,
        can_data_write: draftCanWrite,
      },
    });
    setEditingUser(null);
  };

  const changePassword = async () => {
    if (!editingUser) return;
    if (newPassword.length < 8) {
      setPasswordHint('新密码至少 8 位。');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordHint('两次输入的密码不一致。');
      return;
    }
    setPasswordHint(null);
    await passwordMut.mutateAsync({ id: editingUser.id, password: newPassword });
  };

  if (user?.role !== 'admin') {
    return (
      <View style={styles.root}>
        <MeshBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <AppHeader title="权限管理" onBack={() => router.back()} />
          <View style={styles.center}>
            <GlassSurface tint="danger" padding={SPACING.md} style={styles.errCard}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errTitle}>仅管理员可访问</Text>
                <Text style={styles.err}>请使用管理员账号登录后再编辑权限。</Text>
              </View>
            </GlassSurface>
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
          subtitle={q.data ? `在职 ${activeUsers.length} 人 · 点击编辑权限进行修改` : ''}
          onBack={() => router.back()}
        />
        {q.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.brand} />
          </View>
        ) : q.isError ? (
          <View style={styles.center}>
            <GlassSurface tint="danger" padding={SPACING.md} style={styles.errCard}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errTitle}>加载失败</Text>
                <Text style={styles.err}>{q.error.message}</Text>
              </View>
            </GlassSurface>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listPad}>
            <GlassSurface padding={SPACING.base} style={styles.tip}>
              <View style={styles.tipRow}>
                <IconAvatar
                  icon="shield-checkmark-outline"
                  size={34}
                  color={COLORS.brand}
                  bg="rgba(0,122,255,0.12)"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>点击“编辑权限”即可修改</Text>
                  <Text style={styles.tipText}>
                    当前写操作开关：
                    {q.data?.enforcement ? '已开启' : '测试模式（未开启）'}。即使未开启，也可以先分配写权限。
                  </Text>
                </View>
              </View>
            </GlassSurface>

            {users.map((u) => (
              <Pressable key={u.id} onPress={() => openEditor(u)} style={{ borderRadius: RADIUS.md }}>
                {({ pressed }) => (
                  <GlassSurface
                    padding={SPACING.base}
                    style={[styles.row, !u.is_active && styles.rowMuted, pressed && styles.rowPressed]}
                  >
                    <View style={styles.rowTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{u.full_name || u.username}</Text>
                        <Text style={styles.sub}>@{u.username}</Text>
                      </View>
                      <Pressable
                        onPress={() => openEditor(u)}
                        hitSlop={8}
                        style={({ pressed: p }) => [styles.editIconBtn, p && { opacity: 0.75 }]}
                      >
                        <Ionicons name="create-outline" size={16} color={COLORS.brand} />
                      </Pressable>
                    </View>
                    <Text style={styles.summaryLine}>
                      {u.role === 'admin' ? '管理员' : '员工'} ·{' '}
                      {u.role === 'admin' || u.can_data_write ? '允许写操作' : '只读'} ·{' '}
                      {u.is_active ? '在职' : '停用'}
                    </Text>
                    <View style={styles.summaryRow}>
                      <Tag
                        label={u.role === 'admin' ? '管理员' : '员工'}
                        active={u.role === 'admin'}
                      />
                      <Tag
                        label={u.role === 'admin' || u.can_data_write ? '可写' : '只读'}
                        active={u.role === 'admin' || !!u.can_data_write}
                      />
                      <Tag label={u.is_active ? '在职' : '停用'} active={u.is_active} />
                    </View>
                  </GlassSurface>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal
        transparent
        visible={!!editingUser}
        animationType="fade"
        onRequestClose={() => setEditingUser(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditingUser(null)} />
        <View style={styles.modalWrap}>
          <GlassSurface padding={SPACING.lg} style={styles.modalCard}>
            <Text style={styles.modalTitle}>编辑权限</Text>
            <Text style={styles.modalSub}>
              {editingUser
                ? `${editingUser.full_name || editingUser.username} · @${editingUser.username}`
                : ''}
            </Text>

            <View style={styles.editorBlock}>
              <Text style={styles.blockLabel}>角色</Text>
              <View style={styles.segmented}>
                {(['staff', 'admin'] as const).map((role) => (
                  <Pressable
                    key={role}
                    style={[styles.segmentBtn, draftRole === role && styles.segmentBtnActive]}
                    onPress={() => {
                      setDraftRole(role);
                      if (role === 'admin') setDraftCanWrite(true);
                    }}
                  >
                    <Text style={[styles.segmentText, draftRole === role && styles.segmentTextActive]}>
                      {role === 'admin' ? '管理员' : '员工'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.editorBlock}>
              <Text style={styles.blockLabel}>写权限</Text>
              <View style={styles.segmented}>
                {(['readonly', 'write'] as const).map((mode) => {
                  const active = mode === 'write' ? draftCanWrite : !draftCanWrite;
                  return (
                    <Pressable
                      key={mode}
                      disabled={draftRole === 'admin'}
                      style={[
                        styles.segmentBtn,
                        active && styles.segmentBtnActive,
                        draftRole === 'admin' && styles.segmentBtnDisabled,
                      ]}
                      onPress={() => setDraftCanWrite(mode === 'write')}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {mode === 'write' ? '允许写操作' : '只读'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.editorBlock}>
              <Text style={styles.blockLabel}>账号状态</Text>
              <View style={styles.segmented}>
                {[true, false].map((flag) => (
                  <Pressable
                    key={String(flag)}
                    style={[styles.segmentBtn, draftActive === flag && styles.segmentBtnActive]}
                    onPress={() => setDraftActive(flag)}
                  >
                    <Text style={[styles.segmentText, draftActive === flag && styles.segmentTextActive]}>
                      {flag ? '在职' : '停用'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.editorBlock}>
              <Text style={styles.blockLabel}>修改账户密码（仅管理员）</Text>
              <View style={styles.passwordCard}>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={COLORS.text.tertiary} />
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    placeholder="输入新密码（至少 8 位）"
                    placeholderTextColor={COLORS.text.quaternary}
                  />
                </View>
                <View style={styles.inputDivider} />
                <View style={styles.inputRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.text.tertiary} />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    placeholder="再次输入新密码"
                    placeholderTextColor={COLORS.text.quaternary}
                  />
                  <Pressable
                    hitSlop={8}
                    onPress={() => setShowPassword((v) => !v)}
                    style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={16}
                      color={COLORS.text.tertiary}
                    />
                  </Pressable>
                </View>
              </View>
              {passwordHint ? <Text style={styles.passwordHint}>{passwordHint}</Text> : null}
              <View style={styles.passwordActionRow}>
                <Button
                  label="更新密码"
                  variant="secondary"
                  loading={passwordMut.isPending}
                  onPress={() => void changePassword()}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button
                label="取消"
                variant="ghost"
                onPress={() => setEditingUser(null)}
              />
              <Button
                label="保存修改"
                loading={updateMut.isPending}
                onPress={() => void saveEditor()}
              />
            </View>
          </GlassSurface>
        </View>
      </Modal>
    </View>
  );
}

function Tag({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.tag, active && styles.tagActive]}>
      <Text style={[styles.tagText, active && styles.tagTextActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.base,
  },
  listPad: { paddingHorizontal: SPACING.base, paddingBottom: 28, gap: 10 },
  errCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  errTitle: { ...TYPE.body, color: COLORS.danger, fontWeight: '700' },
  err: { ...TYPE.footnote, color: COLORS.text.secondary, marginTop: 2 },
  tip: { borderWidth: 1, borderColor: GLASS.border },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  tipTitle: { ...TYPE.body, color: COLORS.text.primary, fontWeight: '700' },
  tipText: { ...TYPE.footnote, color: COLORS.text.secondary, marginTop: 2, lineHeight: 18 },
  row: { borderWidth: 1, borderColor: GLASS.border, gap: 10 },
  rowMuted: { opacity: 0.6 },
  rowPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  name: { ...TYPE.headline, color: COLORS.text.primary },
  sub: { ...TYPE.footnote, color: COLORS.text.tertiary, marginTop: 2 },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  summaryLine: { ...TYPE.footnote, color: COLORS.text.secondary },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagActive: { backgroundColor: 'rgba(0,122,255,0.14)' },
  tagText: { ...TYPE.caption, color: COLORS.text.secondary, fontWeight: '600' },
  tagTextActive: { color: COLORS.brand },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  modalWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
  modalCard: {
    borderWidth: 1,
    borderColor: GLASS.border,
    ...SHADOW.modal,
  },
  modalTitle: { ...TYPE.title3, color: COLORS.text.primary },
  modalSub: {
    ...TYPE.footnote,
    color: COLORS.text.tertiary,
    marginTop: 4,
    marginBottom: SPACING.base,
  },
  editorBlock: { marginBottom: SPACING.md },
  blockLabel: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(118,118,128,0.12)',
    borderRadius: RADIUS.sm,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 8,
  },
  segmentBtnActive: { backgroundColor: '#FFFFFF' },
  segmentBtnDisabled: { opacity: 0.65 },
  segmentText: { ...TYPE.footnote, color: COLORS.text.secondary, fontWeight: '600' },
  segmentTextActive: { color: COLORS.brand },
  passwordCard: {
    borderWidth: 1,
    borderColor: GLASS.outline,
    borderRadius: RADIUS.md,
    backgroundColor: GLASS.surface2,
    overflow: 'hidden',
  },
  inputRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  inputDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS.outline,
    marginLeft: SPACING.md,
  },
  input: {
    flex: 1,
    minHeight: 30,
    fontSize: 15,
    color: COLORS.text.primary,
    paddingVertical: 2,
  },
  eyeBtn: { padding: 2, borderRadius: 8 },
  passwordHint: {
    ...TYPE.footnote,
    color: COLORS.text.secondary,
    marginTop: 6,
  },
  passwordActionRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
});
