import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { displayUserRole } from '@meal/shared';
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
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace('/(app)');
    }
  }, [user]);

  const qc = useQueryClient();
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [draftRole, setDraftRole] = useState<'admin' | 'staff'>('staff');
  const [draftActive, setDraftActive] = useState(true);
  const [draftCanWrite, setDraftCanWrite] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [staffUsername, setStaffUsername] = useState('');
  const [staffFullName, setStaffFullName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffPassword2, setStaffPassword2] = useState('');
  const [staffCanWrite, setStaffCanWrite] = useState(false);
  const [newUserRole, setNewUserRole] = useState<'staff' | 'admin'>('staff');
  const [staffHint, setStaffHint] = useState<string | null>(null);

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
  const createMut = useMutation({
    mutationFn: usersApi.createStaff,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin', 'permissions'] }),
        qc.invalidateQueries({ queryKey: ['users', 'list-full'] }),
        qc.invalidateQueries({ queryKey: ['users'] }),
      ]);
      setShowCreateModal(false);
      setStaffUsername('');
      setStaffFullName('');
      setStaffPassword('');
      setStaffPassword2('');
      setStaffCanWrite(false);
      setNewUserRole('staff');
      setStaffHint(null);
    },
    onError: (e) => {
      setStaffHint(e instanceof Error ? e.message : '创建账号失败，请稍后重试');
    },
  });

  const deleteMut = useMutation({
    mutationFn: usersApi.deleteUser,
    onSuccess: async () => {
      setEditingUser(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin', 'permissions'] }),
        qc.invalidateQueries({ queryKey: ['users', 'list-full'] }),
        qc.invalidateQueries({ queryKey: ['users'] }),
      ]);
    },
  });

  const users = useMemo(() => q.data?.users ?? [], [q.data?.users]);
  const activeUsers = users.filter((u) => u.is_active);
  const inactiveCount = users.length - activeUsers.length;

  const isSuper = !!user?.is_superadmin;

  const openRow = (target: ApiUser) => {
    if (!isSuper && target.role === 'admin') return;
    openEditor(target);
  };

  const openEditor = (target: ApiUser) => {
    setEditingUser(target);
    setDraftRole(target.role);
    setDraftActive(target.is_active);
    setDraftCanWrite(!!target.can_data_write);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setPasswordHint(null);
  };

  const saveEditor = async () => {
    if (!editingUser) return;
    const input: Parameters<typeof usersApi.updateAccess>[1] = {};
    if (isSuper) {
      input.role = draftRole;
      input.is_active = draftActive;
      input.can_data_write = draftCanWrite;
    } else if (editingUser.role === 'staff') {
      input.is_active = draftActive;
      input.can_data_write = draftCanWrite;
    }
    await updateMut.mutateAsync({
      id: editingUser.id,
      input,
    });
    setEditingUser(null);
  };

  const canDeleteEditing =
    !!editingUser &&
    !!user &&
    editingUser.id !== user.id &&
    (isSuper || (editingUser.role === 'staff' && !editingUser.is_superadmin));

  const confirmDeleteUser = () => {
    if (!editingUser || !canDeleteEditing) return;
    Alert.alert(
      '确认删除账号',
      `将停用「${editingUser.full_name || editingUser.username}」(@${editingUser.username})，对方将立即下线。是否继续？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '停用账号',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteMut.mutateAsync(editingUser.id);
              } catch (e) {
                Alert.alert('操作失败', e instanceof Error ? e.message : '请稍后重试');
              }
            })();
          },
        },
      ],
    );
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
  const createStaff = async () => {
    if (!staffUsername.trim()) return setStaffHint('请输入用户名。');
    if (!staffFullName.trim()) return setStaffHint('请输入姓名。');
    if (staffPassword.length < 8) return setStaffHint('初始密码至少 8 位。');
    if (staffPassword !== staffPassword2) return setStaffHint('两次输入的密码不一致。');
    setStaffHint(null);
    await createMut.mutateAsync({
      username: staffUsername.trim(),
      full_name: staffFullName.trim(),
      password: staffPassword,
      can_data_write: staffCanWrite,
      is_active: true,
      ...(isSuper && newUserRole === 'admin' ? { role: 'admin' as const } : {}),
    });
  };

  const canResetPassword = (target: ApiUser) =>
    !!user &&
    (user.id === target.id ||
      isSuper ||
      (target.role === 'staff' && !target.is_superadmin));

  if (user?.role !== 'admin') return null;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader title="权限管理" onBack={() => router.back()} />
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
              <View style={styles.tipStatsRow}>
                <View style={[styles.statChip, styles.statChipEmphasis]}>
                  <Text style={styles.statChipValue}>{activeUsers.length}</Text>
                  <Text style={styles.statChipLabel}>在职</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statChipValue}>{users.length}</Text>
                  <Text style={styles.statChipLabel}>全部账号</Text>
                </View>
                {inactiveCount > 0 ? (
                  <View style={styles.statChip}>
                    <Text style={[styles.statChipValue, styles.statChipValueMuted]}>{inactiveCount}</Text>
                    <Text style={styles.statChipLabel}>停用</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.tipHintRow}>
                <Ionicons name="hand-left-outline" size={14} color={COLORS.text.quaternary} />
                <Text style={styles.tipHintText}>点列表行或右侧铅笔编辑该账号</Text>
              </View>
              <View style={styles.tipRow}>
                <IconAvatar
                  icon="shield-checkmark-outline"
                  size={34}
                  color={COLORS.brand}
                  bg="rgba(0,122,255,0.12)"
                />
                <View style={styles.tipMain}>
                  <View style={styles.tipHeadRow}>
                    <Text style={styles.tipTitle}>快捷操作</Text>
                    <Button
                      label="新增人员"
                      style={styles.tipActionButton}
                      onPress={() => {
                        setStaffHint(null);
                        setNewUserRole('staff');
                        setShowCreateModal(true);
                      }}
                    />
                  </View>
                  <Text style={styles.tipText}>
                    当前写操作开关：
                    {q.data?.enforcement ? '已开启' : '测试模式（未开启）'}。即使未开启，也可以先分配写权限。
                  </Text>
                  <Text style={styles.tipText}>
                    {isSuper
                      ? '超级管理员可分配管理员；开启写操作管控后，「允许写操作」须单独授予（管理员也可只读防误触）。'
                      : '你为一般管理员：可编辑员工的读/写（数据录入）权限、账号状态，并可新增或停用在册员工。'}
                  </Text>
                </View>
              </View>
            </GlassSurface>

            {users.map((u) => {
              const rowLocked = !isSuper && u.role === 'admin';
              return (
                <Pressable
                  key={u.id}
                  onPress={() => openRow(u)}
                  disabled={rowLocked}
                  style={{ borderRadius: RADIUS.md }}
                >
                  {({ pressed }) => (
                    <GlassSurface
                      padding={SPACING.base}
                      style={[
                        styles.row,
                        !u.is_active && styles.rowMuted,
                        rowLocked && styles.rowLocked,
                        pressed && !rowLocked && styles.rowPressed,
                      ]}
                    >
                      <View style={styles.rowTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{u.full_name || u.username}</Text>
                          <Text style={styles.sub}>@{u.username}</Text>
                        </View>
                        <Pressable
                          onPress={() => openRow(u)}
                          disabled={rowLocked}
                          hitSlop={8}
                          style={({ pressed: p }) => [styles.editIconBtn, p && { opacity: 0.75 }]}
                        >
                          <Ionicons name="create-outline" size={16} color={COLORS.brand} />
                        </Pressable>
                      </View>
                      <Text style={styles.summaryLine}>
                        {displayUserRole(u)} ·{' '}
                        {u.can_data_write ? '允许写操作' : '只读'} ·{' '}
                        {u.is_active ? '在职' : '停用'}
                      </Text>
                      <View style={styles.summaryRow}>
                        <Tag
                          label={displayUserRole(u)}
                          active={u.role === 'admin' || !!u.is_superadmin}
                        />
                        <Tag
                          label={u.can_data_write ? '可写' : '只读'}
                          active={!!u.can_data_write}
                        />
                        <Tag label={u.is_active ? '在职' : '停用'} active={u.is_active} />
                      </View>
                    </GlassSurface>
                  )}
                </Pressable>
              );
            })}
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

            {isSuper ? (
              <View style={styles.editorBlock}>
                <Text style={styles.blockLabel}>角色</Text>
                <View style={styles.segmented}>
                  {(['staff', 'admin'] as const).map((role) => (
                    <Pressable
                      key={role}
                      disabled={!editingUser || (role === 'staff' && !!editingUser.is_superadmin)}
                      style={[
                        styles.segmentBtn,
                        draftRole === role && styles.segmentBtnActive,
                        (!editingUser || (role === 'staff' && !!editingUser.is_superadmin)) &&
                          styles.segmentBtnDisabled,
                      ]}
                      onPress={() => {
                        setDraftRole(role);
                      }}
                    >
                      <Text style={[styles.segmentText, draftRole === role && styles.segmentTextActive]}>
                        {role === 'admin' ? '管理员' : '员工'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.lockHint}>
                  超级管理员（@rNLKJA）不可降级为员工；其余账号可在管理员与员工之间调整。
                </Text>
              </View>
            ) : (
              <View style={styles.editorBlock}>
                <Text style={styles.blockLabel}>角色</Text>
                <Text style={styles.lockHint}>
                  仅超级管理员可分配「管理员」角色。你可修改下方写权限与在职状态。
                </Text>
              </View>
            )}

            <View style={styles.editorBlock}>
              <Text style={styles.blockLabel}>写权限</Text>
              <View style={styles.segmented}>
                {(['readonly', 'write'] as const).map((mode) => {
                  const active = mode === 'write' ? draftCanWrite : !draftCanWrite;
                  const readOnlyStaff = !isSuper && editingUser && editingUser.role !== 'staff';
                  return (
                    <Pressable
                      key={mode}
                      disabled={!!readOnlyStaff}
                      style={[
                        styles.segmentBtn,
                        active && styles.segmentBtnActive,
                        readOnlyStaff && styles.segmentBtnDisabled,
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

            {editingUser && canResetPassword(editingUser) ? (
              <View style={styles.editorBlock}>
                <Text style={styles.blockLabel}>重置密码</Text>
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
            ) : null}

            {canDeleteEditing ? (
              <View style={{ marginBottom: SPACING.md }}>
                <Button
                  label="停用此账号"
                  variant="danger"
                  loading={deleteMut.isPending}
                  onPress={() => confirmDeleteUser()}
                />
              </View>
            ) : null}

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

      <Modal
        transparent
        visible={showCreateModal}
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateModal(false)} />
        <View style={styles.modalWrap}>
          <GlassSurface padding={SPACING.lg} style={styles.modalCard}>
            <Text style={styles.modalTitle}>新增账号</Text>
            <Text style={styles.modalSub}>
              {isSuper
                ? '超级管理员可创建「管理员」或「员工」；一般管理员仅可创建员工。'
                : '创建在职员工账号并设置初始密码。'}
            </Text>

            <View style={styles.editorBlock}>
              <Text style={styles.blockLabel}>用户名</Text>
              <TextInput
                style={styles.simpleInput}
                value={staffUsername}
                onChangeText={setStaffUsername}
                autoCapitalize="none"
                placeholder="例如 zhangsan"
                placeholderTextColor={COLORS.text.quaternary}
              />
            </View>
            <View style={styles.editorBlock}>
              <Text style={styles.blockLabel}>姓名</Text>
              <TextInput
                style={styles.simpleInput}
                value={staffFullName}
                onChangeText={setStaffFullName}
                placeholder="输入显示名称"
                placeholderTextColor={COLORS.text.quaternary}
              />
            </View>
            {isSuper ? (
              <View style={styles.editorBlock}>
                <Text style={styles.blockLabel}>账号类型</Text>
                <View style={styles.segmented}>
                  {(['staff', 'admin'] as const).map((r) => (
                    <Pressable
                      key={r}
                      style={[styles.segmentBtn, newUserRole === r && styles.segmentBtnActive]}
                      onPress={() => {
                        setNewUserRole(r);
                        if (r === 'admin') setStaffCanWrite(false);
                      }}
                    >
                      <Text style={[styles.segmentText, newUserRole === r && styles.segmentTextActive]}>
                        {r === 'admin' ? '管理员' : '员工'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.editorBlock}>
              <Text style={styles.blockLabel}>初始密码</Text>
              <TextInput
                style={styles.simpleInput}
                value={staffPassword}
                onChangeText={setStaffPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="至少 8 位"
                placeholderTextColor={COLORS.text.quaternary}
              />
              <View style={{ height: 8 }} />
              <TextInput
                style={styles.simpleInput}
                value={staffPassword2}
                onChangeText={setStaffPassword2}
                secureTextEntry
                autoCapitalize="none"
                placeholder="再次输入密码"
                placeholderTextColor={COLORS.text.quaternary}
              />
            </View>
            <View style={styles.editorBlock}>
              <Text style={styles.blockLabel}>数据写权限</Text>
              <View style={styles.segmented}>
                {(['readonly', 'write'] as const).map((mode) => {
                  const active = mode === 'write' ? staffCanWrite : !staffCanWrite;
                  return (
                    <Pressable
                      key={mode}
                      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                      onPress={() => setStaffCanWrite(mode === 'write')}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {mode === 'write' ? '允许写操作' : '只读'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.lockHint}>
                测试阶段默认不拦写接口；生产设 DATA_OPERATOR_ENFORCEMENT=1
                后，仅此处勾选「允许写操作」的账号（含管理员）可改会员/订单/财务，超级管理员不受限。
              </Text>
            </View>
            {staffHint ? <Text style={styles.passwordHint}>{staffHint}</Text> : null}

            <View style={styles.modalActions}>
              <Button label="取消" variant="ghost" onPress={() => setShowCreateModal(false)} />
              <Button
                label="创建账号"
                loading={createMut.isPending}
                onPress={() => void createStaff()}
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
  tipStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  statChip: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(118,118,128,0.1)',
  },
  statChipEmphasis: {
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  statChipValue: {
    ...TYPE.headline,
    fontSize: 18,
    color: COLORS.text.primary,
    fontVariant: ['tabular-nums'],
  },
  statChipValueMuted: {
    color: COLORS.text.tertiary,
  },
  statChipLabel: {
    ...TYPE.caption,
    color: COLORS.text.secondary,
    fontWeight: '600',
    marginTop: 2,
  },
  tipHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  tipHintText: {
    ...TYPE.caption,
    color: COLORS.text.quaternary,
    flex: 1,
  },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  tipMain: { flex: 1, minWidth: 0 },
  tipHeadRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
  tipActionButton: { minWidth: 96 },
  tipTitle: { ...TYPE.body, color: COLORS.text.primary, fontWeight: '700' },
  tipText: { ...TYPE.footnote, color: COLORS.text.secondary, marginTop: 2, lineHeight: 18 },
  row: { borderWidth: 1, borderColor: GLASS.border, gap: 10 },
  rowMuted: { opacity: 0.6 },
  rowLocked: { opacity: 0.55 },
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
  lockHint: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    marginTop: 6,
  },
  simpleInput: {
    minHeight: 40,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: GLASS.outline,
    backgroundColor: GLASS.surface2,
    color: COLORS.text.primary,
    paddingHorizontal: SPACING.md,
    fontSize: 15,
  },
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
