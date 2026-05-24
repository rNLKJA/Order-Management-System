/**
 * 散客详情页。
 *
 * 顶部：头像 + 姓名 + "散客"badge
 * 统计卡：订单数 / 累计消费 / 首次/最近订单日期
 * 订单流水：按日期倒序列出
 * 开卡按钮：打开 CardFlowModal（purchase 模式），购卡成功后后端自动把
 *          is_walkin 翻成 false，该人晋升为正式会员。UI 这边收到成功
 *          就跳到 /members/:id 查看新会员。
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Snackbar } from 'react-native-paper';
import { IOS_COLORS } from '../../../theme/paperTheme';
import {
  AppHeader,
  HeaderTextAction,
  MeshBackground,
  GlassSurface,
  SectionLabel,
  BentoGrid,
  Bento,
  StatTile,
  PressableCard,
  IconAvatar,
} from '../../../components/ui';
import { walkinsApi, type WalkinDetailResp } from '../../../api/walkins';
import { cardsApi } from '../../../api/cards';
import { useAuth } from '../../../hooks/useAuth';
import { useUsersMap } from '../../../hooks/useMembersView';
import { useScrollToTopOnFocus } from '../../../hooks/useScrollToTopOnFocus';
import {
  CardFlowModal,
  type CardFlowSubmitPayload,
  type CardFlowUser,
} from '../../../components/CardFlowModal';
import { MemberEditModal } from '../../../components/MemberEditModal';
import type { MockMember } from '../../../constants/mockData';

const STATUS_MAP = {
  pending: { label: '待出餐', color: IOS_COLORS.orange, bg: '#FFF4E5' },
  fulfilled: { label: '已出餐', color: IOS_COLORS.blue, bg: IOS_COLORS.blueLight },
  delivered: { label: '已送达', color: '#34C759', bg: '#E8F8ED' },
  cancelled: {
    label: '已取消',
    color: IOS_COLORS.labelSecondary,
    bg: IOS_COLORS.fillLight,
  },
} as const;

export default function WalkinDetailScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(scrollRef);

  const { id } = useLocalSearchParams<{ id: string }>();
  const walkinId = Number(id);
  const qc = useQueryClient();

  const detailKey = ['walkins', 'detail', walkinId] as const;

  const q = useQuery({
    queryKey: detailKey,
    enabled: Number.isFinite(walkinId) && walkinId > 0,
    queryFn: async (): Promise<WalkinDetailResp | { notFound: true }> => {
      try {
        return await walkinsApi.detail(walkinId);
      } catch (e) {
        if (
          e &&
          typeof e === 'object' &&
          'status' in e &&
          (e as { status?: number }).status === 404
        ) {
          return { notFound: true };
        }
        throw e;
      }
    },
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: detailKey });
    }, [qc, detailKey]),
  );

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  const { user: authUser } = useAuth();
  const usersQuery = useUsersMap();
  const pickerUsers = useMemo<CardFlowUser[]>(
    () =>
      Object.values(usersQuery.data ?? {})
        .filter((u) => u.is_active)
        .map((u) => ({
          id: u.id,
          name: u.full_name || u.username,
        })),
    [usersQuery.data],
  );
  const defaultCollectorId =
    pickerUsers.find((u) => u.name.includes('孙梦瑶'))?.id ??
    authUser?.id ??
    pickerUsers[0]?.id ??
    0;
  const defaultRecorderId =
    pickerUsers.find((u) => u.name.includes('高平'))?.id ??
    authUser?.id ??
    pickerUsers[0]?.id ??
    0;

  const handlePurchase = useCallback(
    async (p: CardFlowSubmitPayload) => {
      setPromoting(true);
      try {
        await cardsApi.purchase(
          p.spec.code === 'custom'
            ? {
                member_id: walkinId,
                card_code: 'custom',
                custom_label: p.spec.name,
                total_meals: p.spec.meals,
                paid_amount: p.spec.totalPrice,
                is_hospital: p.isHospital,
                collector_user_id: p.collectorUserId,
                created_by_user_id: p.createdByUserId,
                notes: p.notes,
              }
            : {
                member_id: walkinId,
                card_code: p.spec.code,
                is_hospital: p.isHospital,
                collector_user_id: p.collectorUserId,
                created_by_user_id: p.createdByUserId,
                notes: p.notes,
              },
        );
        setShowPurchaseModal(false);
        setToast(`已开通【${p.spec.name}】，该散客已转为正式会员`);
        // 后端把 is_walkin 翻成 false 了，失效当前 walkin 详情缓存
        await qc.invalidateQueries({ queryKey: ['walkins'] });
        await qc.invalidateQueries({ queryKey: ['members'] });
        // 跳去会员详情页
        setTimeout(() => {
          router.replace({
            pathname: '/(app)/members/[id]',
            params: { id: String(walkinId) },
          });
        }, 800);
      } finally {
        setPromoting(false);
      }
    },
    [walkinId, qc],
  );

  if (q.isLoading || !q.data) {
    return (
      <View style={styles.root}>
        <MeshBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <AppHeader title="散客详情" />
          <View style={styles.center}>
            {q.error ? (
              <>
                <Text style={styles.centerText}>
                  加载失败：{(q.error as Error).message}
                </Text>
                <Pressable onPress={() => void q.refetch()}>
                  <Text style={styles.link}>重试</Text>
                </Pressable>
              </>
            ) : (
              <ActivityIndicator color={IOS_COLORS.blue} />
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if ('notFound' in q.data) {
    return (
      <View style={styles.root}>
        <MeshBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <AppHeader title="散客详情" />
          <View style={styles.center}>
            <Text style={styles.centerText}>
              没找到这个散客。他可能已经开卡转成正式会员了。
            </Text>
            <Pressable
              onPress={() =>
                router.replace({
                  pathname: '/(app)/members/[id]',
                  params: { id: String(walkinId) },
                })
              }
            >
              <Text style={styles.link}>去会员详情</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const { member, orders, stats } = q.data;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader
          title="散客详情"
          right={
            <HeaderTextAction label="编辑" onPress={() => setShowEditModal(true)} />
          }
        />

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* 头部 */}
          <View style={styles.sectionWrap}>
            <GlassSurface padding={16} style={styles.heroCard}>
              <IconAvatar icon="walk-outline" size={64} color={IOS_COLORS.orange} bg="#FFF4E5" />
              <View style={styles.heroMain}>
                <Text style={styles.bigName}>{member.name}</Text>
                <Text style={styles.heroSub}>散客档案</Text>
              </View>
              <View style={styles.walkinBadge}>
                <Text style={styles.walkinBadgeText}>散客</Text>
              </View>
            </GlassSurface>
          </View>

          {/* 统计 */}
          <View style={styles.sectionWrap}>
            <SectionLabel>累计数据</SectionLabel>
            <BentoGrid gap={12}>
              <Bento span={4} mobileSpan={6}>
                <StatTile label="订单数" value={`${stats.active_order_count}`} icon="receipt-outline" color={IOS_COLORS.blue} tint="info" />
              </Bento>
              <Bento span={4} mobileSpan={6}>
                <StatTile label="消费餐数" value={`${stats.total_meals}`} icon="restaurant-outline" color="#34C759" tint="ok" />
              </Bento>
              <Bento span={4} mobileSpan={12}>
                <StatTile label="累计消费" value={`¥${stats.total_spent.toFixed(0)}`} icon="wallet-outline" color="#FF9500" tint="warn" />
              </Bento>
            </BentoGrid>
            {(stats.first_order_date || stats.last_order_date) && (
              <GlassSurface padding={12} style={styles.rangeCard}>
                <Text style={styles.rangeText}>
                  {stats.first_order_date ? `首单 ${stats.first_order_date}` : ''}
                  {stats.first_order_date && stats.last_order_date ? ' · ' : ''}
                  {stats.last_order_date ? `最近 ${stats.last_order_date}` : ''}
                </Text>
              </GlassSurface>
            )}
          </View>

          {/* 开卡按钮 */}
          <View style={styles.cardSection}>
            <PressableCard
              onPress={() => setShowPurchaseModal(true)}
              padding={14}
              style={[styles.purchaseBtn, promoting && { opacity: 0.6 }]}
            >
              {promoting ? <ActivityIndicator color="#fff" /> : <Ionicons name="add-circle-outline" size={20} color="#fff" />}
              <Text style={styles.purchaseBtnText}>为 TA 开卡</Text>
            </PressableCard>
          </View>

          {/* 历史订单 */}
          <View style={styles.sectionWrap}>
            <SectionLabel>{`订单历史（${orders.length}）`}</SectionLabel>
          {orders.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Text style={styles.emptyOrdersText}>暂无订单</Text>
            </View>
          ) : (
            <GlassSurface padding={0} style={styles.ordersList}>
              {orders.map((o, i) => {
                const s = STATUS_MAP[o.status];
                return (
                  <View
                    key={o.id}
                    style={[
                      styles.orderRow,
                      i === orders.length - 1 && styles.orderRowLast,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.orderTop}>
                        <Text style={styles.orderDate}>
                          {o.order_date} ·{' '}
                          {o.meal_type === 'lunch' ? '午餐' : '晚餐'}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: s.bg },
                          ]}
                        >
                          <Text
                            style={[styles.statusText, { color: s.color }]}
                          >
                            {s.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.orderMeta}>
                        {o.quantity} 份 · ¥{o.amount.toFixed(0)}
                      </Text>
                      {o.notes ? (
                        <Text style={styles.orderNote}>
                          订单备注：{o.notes}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </GlassSurface>
          )}
          </View>
        </ScrollView>

        {/* 开卡 Modal —— 复用和会员详情一样的 CardFlowModal */}
        <CardFlowModal
          visible={showPurchaseModal}
          mode="purchase"
          memberName={member.name}
          memberIsHospital={member.is_hospital}
          pickerUsers={pickerUsers}
        defaultCollectorId={defaultCollectorId}
        defaultRecorderId={defaultRecorderId}
          onClose={() => setShowPurchaseModal(false)}
          onSubmit={handlePurchase}
        />

        {/* 编辑资料 Modal —— 和会员详情共用 */}
        <MemberEditModal
          visible={showEditModal}
          member={toMockMemberLite(member)}
          onClose={() => setShowEditModal(false)}
          onSaved={async () => {
            setShowEditModal(false);
            await qc.invalidateQueries({ queryKey: detailKey });
            await qc.invalidateQueries({ queryKey: ['walkins'] });
            setToast('资料已保存');
          }}
        />

        <Snackbar
          visible={!!toast}
          onDismiss={() => setToast(null)}
          duration={2400}
          style={styles.snackbar}
          action={{ label: '知道了', onPress: () => setToast(null) }}
        >
          {toast}
        </Snackbar>
      </SafeAreaView>
    </View>
  );
}

/**
 * 把 /api/walkins 返回的 Member 塞进 MemberEditModal 要的 MockMember 形状。
 * 只有基础资料字段会被 modal 读；卡 / stats 给默认空值。
 */
function toMockMemberLite(
  member: WalkinDetailResp['member'],
): MockMember {
  return {
    id: member.id,
    uid: member.uid,
    name: member.name,
    nickname: member.nickname ?? '',
    phone: member.phone ?? '',
    wechat_id: member.wechat_id ?? '',
    address: member.address ?? '',
    dietary_notes: member.dietary_notes ?? '',
    is_hospital: member.is_hospital,
    is_staff: member.is_staff ?? false,
    is_walkin: true,
    active_card: null,
    queued_card: null,
    card_history: [],
    stats: {
      total_purchased_meals: 0,
      total_consumed_meals: 0,
      total_paid_amount: 0,
    },
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  centerText: {
    fontSize: 15,
    color: IOS_COLORS.labelSecondary,
    textAlign: 'center',
  },
  link: { fontSize: 15, color: IOS_COLORS.blue },
  editBtn: { fontSize: 15, color: IOS_COLORS.blue, fontWeight: '500' },

  profileSection: {
    alignItems: 'center',
    backgroundColor: IOS_COLORS.card,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  heroCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroMain: { flex: 1, minWidth: 0 },
  heroSub: { fontSize: 13, color: IOS_COLORS.labelSecondary, marginTop: 2 },
  bigAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: '#FFF4E5',
  },
  bigAvatarText: { fontSize: 28, fontWeight: '700', color: IOS_COLORS.orange },
  bigName: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: 8,
  },
  tagRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  walkinBadge: {
    backgroundColor: '#FFF4E5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  walkinBadgeText: {
    fontSize: 12,
    color: IOS_COLORS.orange,
    fontWeight: '600',
  },

  sectionWrap: { paddingHorizontal: 20, marginBottom: 16 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingLeft: 4,
  },
  sectionBody: {
    backgroundColor: 'transparent',
  },
  rangeCard: { marginTop: 8, alignItems: 'center' },
  rangeText: { fontSize: 12, color: IOS_COLORS.labelTertiary },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },
  statCard: {
    flex: 1,
    backgroundColor: IOS_COLORS.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statUnit: { fontSize: 11, color: IOS_COLORS.labelSecondary },
  statLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary },

  cardSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  purchaseBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  purchaseBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  sectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.3,
  },

  ordersList: {
    backgroundColor: IOS_COLORS.card,
    borderRadius: 14,
    overflow: 'hidden',
  },
  orderRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separatorLight,
    gap: 4,
  },
  orderRowLast: { borderBottomWidth: 0 },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderDate: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  orderMeta: {
    fontSize: 13,
    color: IOS_COLORS.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  orderNote: { fontSize: 12, color: IOS_COLORS.orange },

  emptyOrders: {
    padding: 24,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.card,
    alignItems: 'center',
  },
  emptyOrdersText: { fontSize: 14, color: IOS_COLORS.labelSecondary },

  snackbar: { marginBottom: 24 },
});
