/**
 * 会员详情页 - MEA-10（plan §16 骨架）。
 *
 * 本期覆盖：
 * - 基本信息展示 + 编辑（staff/admin 都可改）
 * - 创建信息行（由 XXX 于 YYYY-MM-DD HH:mm 创建）
 * - admin 专属"归档"按钮
 * - 订阅记录 / 订餐记录：本期以"待 MEA-11/MEA-12 实现"占位
 */

import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Appbar,
  Card,
  Text,
  Chip,
  Button,
  Divider,
  ActivityIndicator,
  Dialog,
  Portal,
  Snackbar,
  useTheme,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { formatDateTime } from '@meal/shared';
import { MemberForm } from '../../../components/MemberForm';
import { membersApi, type Member } from '../../../api/members';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../api/client';

export default function MemberDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(id);

  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['members', memberId],
    queryFn: () => membersApi.detail(memberId),
    enabled: Number.isFinite(memberId) && memberId > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (values: Parameters<typeof membersApi.update>[1]) =>
      membersApi.update(memberId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['members', memberId] });
      setEditing(false);
      setSnack('已保存');
    },
    onError: (err) => {
      setSnack(err instanceof ApiError ? err.message : '保存失败');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => membersApi.archive(memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['members', memberId] });
      setArchiveOpen(false);
      setSnack('已归档');
    },
    onError: (err) => {
      setArchiveOpen(false);
      setSnack(err instanceof ApiError ? err.message : '归档失败');
    },
  });

  const isAdmin = user?.role === 'admin';
  const member: Member | undefined = query.data?.member;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={member?.uid ?? '会员详情'} />
        {member && !editing ? (
          <Appbar.Action icon="pencil" onPress={() => setEditing(true)} />
        ) : null}
      </Appbar.Header>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : query.isError || !member ? (
        <View style={styles.center}>
          <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
            {query.isError ? (query.error as Error).message : '会员不存在'}
          </Text>
          <Button mode="outlined" onPress={() => router.back()} style={{ marginTop: 12 }}>
            返回列表
          </Button>
        </View>
      ) : editing ? (
        <MemberForm
          initial={{
            name: member.name,
            nickname: member.nickname,
            phone: member.phone,
            wechat_id: member.wechat_id,
            address: member.address,
            dietary_notes: member.dietary_notes,
            is_hospital: member.is_hospital,
          }}
          submitLabel="保存修改"
          submitting={updateMutation.isPending}
          onCancel={() => setEditing(false)}
          onSubmit={(values) => updateMutation.mutate(values)}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {!member.is_active ? (
            <Chip
              icon="archive"
              style={[styles.archivedBadge, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              已归档（不在常规列表中显示）
            </Chip>
          ) : null}

          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                基本信息
              </Text>
              <InfoRow label="UID" value={member.uid} />
              <InfoRow label="姓名" value={member.name} />
              <InfoRow label="昵称" value={member.nickname || '—'} />
              <InfoRow label="手机号" value={member.phone} />
              <InfoRow label="微信号" value={member.wechat_id || '—'} />
              <InfoRow label="地址" value={member.address || '—'} />
              <InfoRow label="忌口" value={member.dietary_notes || '—'} />
              <InfoRow
                label="医院订阅"
                value={member.is_hospital ? '是（院内）' : '否（院外）'}
              />
            </Card.Content>
          </Card>

          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                创建信息
              </Text>
              <InfoRow
                label="创建时间"
                value={formatDateTime(member.created_at)}
              />
              <InfoRow label="创建人 ID" value={String(member.created_by_user_id)} />
              <InfoRow
                label="最后修改"
                value={formatDateTime(member.updated_at)}
              />
            </Card.Content>
          </Card>

          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                订阅记录
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                本期（MEA-10）还未实现；MEA-11 上线后会显示当前卡、历史卡列表和购卡按钮。
              </Text>
            </Card.Content>
          </Card>

          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                订餐记录（最近 90 天）
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                本期（MEA-10）还未实现；MEA-12 上线后会显示订单明细 + 状态徽章。
              </Text>
            </Card.Content>
          </Card>

          {isAdmin && member.is_active ? (
            <>
              <Divider style={{ marginVertical: 16 }} />
              <Button
                mode="outlined"
                icon="archive-arrow-down"
                onPress={() => setArchiveOpen(true)}
                style={styles.dangerButton}
                textColor={theme.colors.error}
              >
                归档该会员（软删除）
              </Button>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
              >
                归档后默认不在列表中显示，可在列表开"显示已归档"恢复查看。
              </Text>
            </>
          ) : null}
        </ScrollView>
      )}

      <Portal>
        <Dialog visible={archiveOpen} onDismiss={() => setArchiveOpen(false)}>
          <Dialog.Title>确认归档？</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              归档后该会员将从默认列表隐藏，已有的卡 / 订单 / 财务记录不受影响。之后可以重新打开详情解档（后续版本支持）。
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setArchiveOpen(false)}>取消</Button>
            <Button
              mode="contained"
              loading={archiveMutation.isPending}
              onPress={() => archiveMutation.mutate()}
            >
              确认归档
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack ?? ''}
      </Snackbar>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text
        variant="bodySmall"
        style={[styles.rowLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 48,
  },
  card: { borderRadius: 12 },
  sectionTitle: { fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    gap: 12,
  },
  rowLabel: { width: 96 },
  rowValue: { flex: 1 },
  archivedBadge: {
    alignSelf: 'flex-start',
  },
  dangerButton: {
    marginTop: 8,
    borderRadius: 10,
  },
});
