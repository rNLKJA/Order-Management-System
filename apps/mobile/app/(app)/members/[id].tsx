/**
 * 会员详情页 - MEA-14（完善）。
 *
 * 覆盖：
 * - 基本信息：姓名 / 昵称 / 手机（点拨） / 微信号（点复制）/ 地址 / 忌口 / 院内外 / 创建信息
 * - 当前卡面板：卡种 Badge + 剩餐进度条 + 购卡时间；无卡时显示"暂无有效卡"
 * - 累计数据卡（StatsCards）
 * - 订阅记录（CardHistoryCard）
 * - 订餐记录（最近 90 天，空状态兜底）
 * - 操作区（底部 FAB 区域）：无 active 卡 → 购买新卡；有 active 卡 → 升级 + 录入用餐
 */

import { useState } from 'react';
import { View, ScrollView, StyleSheet, Linking, Clipboard } from 'react-native';
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
  ProgressBar,
  Badge,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { formatDateTime, getCardSpec } from '@meal/shared';
import { MemberForm } from '../../../components/MemberForm';
import { CardPurchaseModal } from '../../../components/CardPurchaseModal';
import { CardUpgradeModal } from '../../../components/CardUpgradeModal';
import { StatsCards } from '../../../components/StatsCards';
import { CardHistoryCard } from '../../../components/CardHistoryCard';
import { membersApi, type Member, type DailyOrder } from '../../../api/members';
import type { Card as CardModel } from '../../../api/cards';
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
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  // Fetch basic member detail (existing endpoint)
  const memberQuery = useQuery({
    queryKey: ['members', memberId],
    queryFn: () => membersApi.detail(memberId),
    enabled: Number.isFinite(memberId) && memberId > 0,
  });

  // Fetch aggregated stats (new endpoint)
  const statsQuery = useQuery({
    queryKey: ['members', memberId, 'stats'],
    queryFn: () => membersApi.stats(memberId),
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

  function invalidateStats() {
    qc.invalidateQueries({ queryKey: ['members', memberId] });
    qc.invalidateQueries({ queryKey: ['members', memberId, 'stats'] });
  }

  const isAdmin = user?.role === 'admin';
  const member: Member | undefined = memberQuery.data?.member;
  const activeCard: CardModel | null = statsQuery.data?.active_card ?? null;
  const cardHistory: CardModel[] = statsQuery.data?.card_history ?? [];
  const orderHistory: DailyOrder[] = statsQuery.data?.order_history ?? [];
  const stats = statsQuery.data?.stats;

  function handleCall() {
    if (member?.phone) {
      Linking.openURL(`tel:${member.phone}`);
    }
  }

  function handleCopyWechat() {
    if (member?.wechat_id) {
      Clipboard.setString(member.wechat_id);
      setSnack('微信号已复制');
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={member?.uid ?? '会员详情'} />
        {member && !editing ? (
          <Appbar.Action icon="pencil" onPress={() => setEditing(true)} />
        ) : null}
      </Appbar.Header>

      {memberQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : memberQuery.isError || !member ? (
        <View style={styles.center}>
          <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
            {memberQuery.isError ? (memberQuery.error as Error).message : '会员不存在'}
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
          {/* 归档提示 */}
          {!member.is_active ? (
            <Chip
              icon="archive"
              style={[styles.archivedBadge, { backgroundColor: theme.colors.surfaceVariant }]}
            >
              已归档（不在常规列表中显示）
            </Chip>
          ) : null}

          {/* 基本信息 */}
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                基本信息
              </Text>
              <InfoRow label="UID" value={member.uid} />
              <InfoRow label="姓名" value={member.name} />
              <InfoRow label="昵称" value={member.nickname || '—'} />
              <InfoRow
                label="手机号"
                value={member.phone}
                onPress={handleCall}
                pressHint="点击拨打"
              />
              <InfoRow
                label="微信号"
                value={member.wechat_id || '—'}
                onPress={member.wechat_id ? handleCopyWechat : undefined}
                pressHint={member.wechat_id ? '点击复制' : undefined}
              />
              <InfoRow label="地址" value={member.address || '—'} />
              <View style={styles.row}>
                <Text
                  variant="bodySmall"
                  style={[styles.rowLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  忌口
                </Text>
                <View style={styles.rowValue}>
                  {member.dietary_notes ? (
                    <Chip compact icon="alert-circle-outline">
                      {member.dietary_notes}
                    </Chip>
                  ) : (
                    <Text variant="bodyMedium">—</Text>
                  )}
                </View>
              </View>
              <View style={styles.row}>
                <Text
                  variant="bodySmall"
                  style={[styles.rowLabel, { color: theme.colors.onSurfaceVariant }]}
                >
                  订阅类型
                </Text>
                <Chip
                  compact
                  style={{
                    backgroundColor: member.is_hospital
                      ? theme.colors.primaryContainer
                      : theme.colors.surfaceVariant,
                  }}
                  textStyle={{
                    color: member.is_hospital
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurfaceVariant,
                  }}
                >
                  {member.is_hospital ? '院内订阅' : '院外订阅'}
                </Chip>
              </View>
            </Card.Content>
          </Card>

          {/* 创建信息 */}
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                创建信息
              </Text>
              <InfoRow label="创建时间" value={formatDateTime(member.created_at)} />
              <InfoRow label="创建人 ID" value={String(member.created_by_user_id)} />
              <InfoRow label="最后修改" value={formatDateTime(member.updated_at)} />
            </Card.Content>
          </Card>

          {/* 当前卡面板 */}
          <CurrentCardPanel
            activeCard={activeCard}
            loading={statsQuery.isLoading}
            onBuyCard={() => setPurchaseOpen(true)}
          />

          {/* 累计数据 */}
          {stats ? (
            <StatsCards
              totalPurchasedMeals={stats.total_purchased_meals}
              totalConsumedMeals={stats.total_consumed_meals}
              totalPaidAmount={stats.total_paid_amount}
            />
          ) : null}

          {/* 订阅记录 */}
          <CardHistoryCard cards={cardHistory} />

          {/* 订餐记录 */}
          <OrderHistorySection orders={orderHistory} loading={statsQuery.isLoading} />

          {/* 操作区 */}
          <View style={styles.actions}>
            {activeCard ? (
              <>
                <Button
                  mode="contained-tonal"
                  icon="arrow-up-circle"
                  onPress={() => setUpgradeOpen(true)}
                  style={styles.actionBtn}
                >
                  升级卡种
                </Button>
                <Button
                  mode="contained"
                  icon="silverware-fork-knife"
                  onPress={() => router.push('/orders/quick' as any)}
                  style={styles.actionBtn}
                >
                  录入用餐
                </Button>
              </>
            ) : (
              <Button
                mode="contained"
                icon="credit-card-plus"
                onPress={() => setPurchaseOpen(true)}
                style={styles.actionBtn}
              >
                购买新卡
              </Button>
            )}
          </View>

          {/* 归档操作（admin） */}
          {isAdmin && member.is_active ? (
            <>
              <Divider style={{ marginVertical: 8 }} />
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

      {/* 购卡 Modal */}
      {member ? (
        <CardPurchaseModal
          visible={purchaseOpen}
          memberId={member.id}
          memberIsHospital={member.is_hospital}
          onDismiss={() => setPurchaseOpen(false)}
          onSuccess={() => {
            setPurchaseOpen(false);
            invalidateStats();
            setSnack('购卡成功');
          }}
        />
      ) : null}

      {/* 升级 Modal */}
      {activeCard ? (
        <CardUpgradeModal
          visible={upgradeOpen}
          currentCard={activeCard}
          onDismiss={() => setUpgradeOpen(false)}
          onSuccess={() => {
            setUpgradeOpen(false);
            invalidateStats();
            setSnack('升级成功');
          }}
        />
      ) : null}

      <Portal>
        <Dialog visible={archiveOpen} onDismiss={() => setArchiveOpen(false)}>
          <Dialog.Title>确认归档？</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              归档后该会员将从默认列表隐藏，已有的卡 / 订单 / 财务记录不受影响。
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

// =========== 当前卡面板 ===========

function CurrentCardPanel({
  activeCard,
  loading,
  onBuyCard,
}: {
  activeCard: CardModel | null;
  loading: boolean;
  onBuyCard: () => void;
}) {
  const theme = useTheme();

  if (loading) {
    return (
      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            当前有效卡
          </Text>
          <ActivityIndicator size="small" />
        </Card.Content>
      </Card>
    );
  }

  if (!activeCard) {
    return (
      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            当前有效卡
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
          >
            暂无有效卡
          </Text>
          <Button mode="contained-tonal" icon="credit-card-plus" onPress={onBuyCard}>
            购买新卡
          </Button>
        </Card.Content>
      </Card>
    );
  }

  const spec = getCardSpec(activeCard.is_hospital, activeCard.card_code);
  const cardName = spec?.name ?? activeCard.card_code;
  const progress =
    activeCard.total_meals > 0 ? activeCard.used_meals / activeCard.total_meals : 0;

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content>
        <View style={styles.cardPanelHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            当前有效卡
          </Text>
          <Chip
            compact
            style={{ backgroundColor: theme.colors.primaryContainer }}
            textStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 12 }}
          >
            {cardName}
          </Chip>
        </View>

        <View style={styles.mealsRow}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
            {activeCard.remaining_meals}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {' '}/ {activeCard.total_meals} 餐
          </Text>
        </View>

        <ProgressBar
          progress={progress}
          color={theme.colors.primary}
          style={styles.cardProgress}
        />

        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          已用 {activeCard.used_meals} 餐 · 购卡 {formatDateTime(new Date(activeCard.purchased_at))}
        </Text>
      </Card.Content>
    </Card>
  );
}

// =========== 订餐记录区块 ===========

const MEAL_TYPE_LABEL: Record<string, string> = {
  lunch: '午餐',
  dinner: '晚餐',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '等待出餐',
  fulfilled: '已出餐',
  delivered: '已送达',
  cancelled: '已取消',
};

function OrderHistorySection({
  orders,
  loading,
}: {
  orders: DailyOrder[];
  loading: boolean;
}) {
  const theme = useTheme();

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          订餐记录（最近 90 天）
        </Text>

        {loading ? (
          <ActivityIndicator size="small" />
        ) : orders.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            暂无订餐记录
          </Text>
        ) : (
          orders.map((order, index) => (
            <OrderRow
              key={order.id}
              order={order}
              isLast={index === orders.length - 1}
            />
          ))
        )}
      </Card.Content>
    </Card>
  );
}

function OrderRow({ order, isLast }: { order: DailyOrder; isLast: boolean }) {
  const theme = useTheme();
  const mealLabel = MEAL_TYPE_LABEL[order.meal_type] ?? order.meal_type;
  const statusLabel = ORDER_STATUS_LABEL[order.status] ?? order.status;
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';

  const statusColor = isCancelled
    ? theme.colors.error
    : isDelivered
      ? theme.colors.primary
      : theme.colors.secondary;

  return (
    <View
      style={[
        styles.orderRow,
        !isLast && styles.itemBorder,
        isCancelled && { opacity: 0.55 },
      ]}
    >
      <View style={styles.orderRowLeft}>
        <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
          {order.order_date}
        </Text>
        <View style={styles.orderChips}>
          <Chip
            compact
            style={[
              styles.mealChip,
              {
                backgroundColor:
                  order.meal_type === 'lunch'
                    ? theme.colors.primaryContainer
                    : theme.colors.secondaryContainer,
              },
            ]}
            textStyle={{
              color:
                order.meal_type === 'lunch'
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onSecondaryContainer,
              fontSize: 11,
            }}
          >
            {mealLabel}
          </Chip>
          <Chip
            compact
            style={[styles.mealChip, { backgroundColor: `${statusColor}20` }]}
            textStyle={{ color: statusColor, fontSize: 11 }}
          >
            {statusLabel}
          </Chip>
        </View>
      </View>
      <View style={styles.orderRowRight}>
        <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
          {order.quantity} 份
        </Text>
        {order.card_id ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            扣卡
          </Text>
        ) : (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            散餐
          </Text>
        )}
      </View>
    </View>
  );
}

// =========== 基础行组件 ===========

function InfoRow({
  label,
  value,
  onPress,
  pressHint,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  pressHint?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text
        variant="bodySmall"
        style={[styles.rowLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        {label}
      </Text>
      <View style={styles.rowValue}>
        <Text
          variant="bodyMedium"
          style={onPress ? { color: theme.colors.primary } : undefined}
          onPress={onPress}
        >
          {value}
        </Text>
        {pressHint && onPress ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {pressHint}
          </Text>
        ) : null}
      </View>
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
    paddingBottom: 64,
  },
  card: { borderRadius: 12 },
  sectionTitle: { fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    gap: 12,
    alignItems: 'center',
  },
  rowLabel: { width: 80 },
  rowValue: { flex: 1, gap: 2 },
  archivedBadge: { alignSelf: 'flex-start' },
  dangerButton: { marginTop: 8, borderRadius: 10 },
  cardPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mealsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  cardProgress: { height: 8, borderRadius: 4, marginBottom: 6 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: { flex: 1, borderRadius: 10 },
  orderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  orderRowLeft: { gap: 4 },
  orderRowRight: { alignItems: 'flex-end', gap: 2 },
  orderChips: { flexDirection: 'row', gap: 4 },
  mealChip: {},
});
