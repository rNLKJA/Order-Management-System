/**
 * 会员详情页 — 含卡管理（开卡、升级、续卡、退卡、历史卡）。
 *
 * 数据：useMemberView(id) 从 /api/members/:id + /api/cards?member_id=:id 拉真实数据
 * 卡动作：统一走 components/CardFlowModal → cardsApi.purchase/upgrade/renew
 * 退卡：components/RefundCardModal → cardsApi.refund
 * 卡 mutation 成功后用 useInvalidateMembersView() 失效缓存，列表和首页自动刷新。
 */

import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Snackbar } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { IOS_COLORS } from '../../../theme/paperTheme';
import { AppHeader, MeshBackground } from '../../../components/ui';
import { CARD_RENEWAL_THRESHOLD_MEALS, type SubscriptionCardCode } from '@meal/shared';
import { type MockCard } from '../../../constants/mockData';
import { cardsApi } from '../../../api/cards';
import { membersApi } from '../../../api/members';
import { useMemberView, useInvalidateMembersView } from '../../../hooks/useMembersView';
import { CardFlowModal, type CardFlowSubmitPayload } from '../../../components/CardFlowModal';
import { RefundCardModal, type RefundSubmitPayload } from '../../../components/RefundCardModal';
import { MemberEditModal } from '../../../components/MemberEditModal';

function triggerSuccessHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(id);
  const { data: member, isLoading, notFound, error } = useMemberView(memberId);
  const invalidate = useInvalidateMembersView();

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handlePurchase = useCallback(
    async (p: CardFlowSubmitPayload) => {
      if (!member) throw new Error('会员不存在');
      const { card } = await cardsApi.purchase({
        member_id: member.id,
        card_code: p.spec.code,
        is_hospital: p.isHospital,
        notes: p.notes,
      });
      setShowPurchaseModal(false);
      await invalidate(member.id);
      triggerSuccessHaptic();
      setToast(
        `已为 ${member.nickname || member.name} 开通【${p.spec.name}】，应收 ¥${card.paid_amount}`,
      );
    },
    [member, invalidate],
  );

  const handleUpgrade = useCallback(
    async (p: CardFlowSubmitPayload) => {
      if (!member || !member.active_card) throw new Error('会员当前无进行中的卡');
      const fromName = member.active_card.card_name;
      const { new_card, diff } = await cardsApi.upgrade(member.active_card.id, {
        card_code: p.spec.code,
        is_hospital: p.isHospital,
        notes: p.notes,
      });
      setShowUpgradeModal(false);
      await invalidate(member.id);
      triggerSuccessHaptic();
      setToast(
        `已升级：${fromName} → ${p.spec.name}，补差价 ¥${diff}，剩 ${new_card.remaining_meals} 份`,
      );
    },
    [member, invalidate],
  );

  const handleRenew = useCallback(
    async (p: CardFlowSubmitPayload) => {
      if (!member || !member.active_card) throw new Error('会员当前无进行中的卡');
      const { new_card, carried_meals, paid_amount } = await cardsApi.renew(
        member.active_card.id,
        { notes: p.notes },
      );
      setShowRenewModal(false);
      await invalidate(member.id);
      triggerSuccessHaptic();
      setToast(
        `已续卡：${p.spec.name}，应收 ¥${paid_amount}，结转 ${carried_meals} 份，共剩 ${new_card.remaining_meals} 份`,
      );
    },
    [member, invalidate],
  );

  const handleEditSave = useCallback(async () => {
    setShowEditModal(false);
    if (member) await invalidate(member.id);
    triggerSuccessHaptic();
    setToast('会员资料已更新');
  }, [member, invalidate]);

  const handleRefund = useCallback(
    async (p: RefundSubmitPayload) => {
      if (!member || !member.active_card) throw new Error('会员当前无进行中的卡');
      await cardsApi.refund(member.active_card.id, {
        refund_amount: p.refund_amount,
        reason: p.reason,
      });
      setShowRefundModal(false);
      await invalidate(member.id);
      triggerSuccessHaptic();
      setToast(
        `已退卡：${member.active_card.card_name}，退款 ¥${p.refund_amount}`,
      );
    },
    [member, invalidate],
  );

  if (isLoading || !member) {
    if (notFound) {
      return (
        <View style={styles.root}>
          <MeshBackground />
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <AppHeader title="会员详情" />
            <View style={styles.center}>
              <Text style={styles.centerText}>会员不存在</Text>
              <Pressable onPress={() => router.back()}>
                <Text style={styles.link}>返回</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.root}>
          <MeshBackground />
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <AppHeader title="会员详情" />
            <View style={styles.center}>
              <Text style={styles.centerText}>加载失败：{error.message}</Text>
              <Pressable onPress={() => router.back()}>
                <Text style={styles.link}>返回</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      );
    }
    return (
      <View style={styles.root}>
        <MeshBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <AppHeader title="会员详情" />
          <View style={styles.center}>
            <ActivityIndicator color={IOS_COLORS.blue} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const card = member.active_card;
  const progressPct = card ? (card.remaining_meals / card.total_meals) * 100 : 0;
  const progressColor = progressPct > 50 ? '#34C759' : progressPct > 20 ? '#FF9500' : '#FF3B30';
  const renewal = card ? card.remaining_meals <= CARD_RENEWAL_THRESHOLD_MEALS : false;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <AppHeader
          title="会员详情"
          right={
            <Pressable onPress={() => setShowEditModal(true)} hitSlop={8} style={{ paddingHorizontal: 6 }}>
              <Text style={styles.editBtn}>编辑</Text>
            </Pressable>
          }
        />

        {/* 头部信息卡 */}
        <View style={styles.profileSection}>
          <View style={[styles.bigAvatar, { backgroundColor: member.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
            <Text style={styles.bigAvatarText}>{member.nickname?.[0] ?? member.name[0]}</Text>
          </View>
          <Text style={styles.bigName}>{member.name}</Text>
          {member.nickname && <Text style={styles.bigNickname}>"{member.nickname}"</Text>}
          <View style={styles.tagRow}>
            <Tag label={member.is_hospital ? '院内会员' : '院外会员'} color={IOS_COLORS.blue} />
          </View>
        </View>

        {/* 联系信息 */}
        <Section title="联系方式">
          <InfoRow label="手机号" value={member.phone} />
          <InfoRow label="微信号" value={member.wechat_id || '未填写'} />
          <InfoRow label="地址" value={member.address || '未填写'} isLast />
        </Section>

        {member.dietary_notes ? (
          <Section title="忌口">
            <View style={styles.dietRow}>
              <Text style={styles.dietText}>{member.dietary_notes}</Text>
            </View>
          </Section>
        ) : null}

        {/* 当前卡 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>当前卡片</Text>
        </View>

        {card ? (
          <View style={styles.cardSection}>
            {renewal && (
              <View style={styles.renewalBanner}>
                <Text style={styles.renewalBannerText}>
                  注意：剩余 {card.remaining_meals} 餐，建议尽快升级或续卡
                </Text>
              </View>
            )}
            <View style={styles.activeCard}>
              <View style={styles.activeCardHeader}>
                <Text style={styles.activeCardName}>{card.card_name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#E8F8ED' }]}>
                  <Text style={[styles.statusText, { color: '#34C759' }]}>进行中</Text>
                </View>
              </View>
              <Text style={styles.cardType}>{card.is_hospital ? '院内价目' : '院外价目'} · ¥{card.unit_price}/份</Text>

              {/* 进度条 */}
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>剩余 {card.remaining_meals} / {card.total_meals} 份</Text>
                  <Text style={[styles.progressPct, { color: progressColor }]}>{Math.round(progressPct)}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: progressColor }]} />
                </View>
              </View>

              <View style={styles.cardMeta}>
                <MetaItem label="总餐数" value={`${card.total_meals} 份`} />
                <MetaItem label="已用" value={`${card.used_meals} 份`} />
                <MetaItem label="支付" value={`¥${card.paid_amount}`} />
              </View>
              <Text style={styles.cardCollector}>
                收款人：{card.collector}
                {card.recorder ? ` · 录入：${card.recorder}` : ''} ·{' '}
                {new Date(card.purchased_at).toLocaleDateString('zh-CN')}
              </Text>
              {card.notes ? (
                <Text style={styles.cardNotes}>备注：{card.notes}</Text>
              ) : null}
            </View>

            {/* 升级 / 续卡按钮：同一行并排，剩餐足够时只显示升级（占满） */}
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnFlex,
                  styles.upgradeBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setShowUpgradeModal(true)}
              >
                <Text style={styles.upgradeBtnText}>升级卡片</Text>
              </Pressable>
              {renewal ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.actionBtnFlex,
                    styles.renewBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setShowRenewModal(true)}
                >
                  <Text style={styles.renewBtnText}>续卡</Text>
                </Pressable>
              ) : null}
            </View>

            {/* 退卡：破坏性操作，放次级位置避免误触 */}
            <Pressable
              style={({ pressed }) => [styles.refundBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setShowRefundModal(true)}
              hitSlop={6}
            >
              <Ionicons name="close-circle-outline" size={16} color="#FF3B30" />
              <Text style={styles.refundBtnText}>申请退卡</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.noCardSection}>
            <View style={styles.noCardCard}>
              <View style={styles.noCardIconWrap}>
                <Ionicons name="card-outline" size={30} color={IOS_COLORS.blue} />
              </View>
              <Text style={styles.noCardTitle}>暂无有效卡片</Text>
              <Text style={styles.noCardHint}>
                该会员当前没有进行中的餐卡，可为其开通一张新卡。
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.purchaseBtn,
                styles.purchaseBtnFull,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setShowPurchaseModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.purchaseBtnText}>购买新卡</Text>
            </Pressable>
          </View>
        )}

        {/* 统计 */}
        <Section title="累计数据">
          <View style={styles.statsRow}>
            <StatCard label="购买餐数" value={`${member.stats.total_purchased_meals}`} unit="份" color={IOS_COLORS.blue} />
            <StatCard label="消费餐数" value={`${member.stats.total_consumed_meals}`} unit="份" color="#34C759" />
            <StatCard label="累计消费" value={`¥${member.stats.total_paid_amount.toLocaleString()}`} unit="" color="#FF9500" />
          </View>
        </Section>

        {/* 历史卡片 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>历史卡片</Text>
        </View>
        <View style={styles.historyCards}>
          {member.card_history.map((c, i) => (
            <HistoryCardRow key={c.id} card={c} isLast={i === member.card_history.length - 1} />
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 购卡 / 升级 统一 Modal */}
      <CardFlowModal
        visible={showPurchaseModal}
        mode="purchase"
        memberName={member.nickname || member.name}
        memberIsHospital={member.is_hospital}
        onClose={() => setShowPurchaseModal(false)}
        onSubmit={handlePurchase}
      />
      {card ? (
        <CardFlowModal
          visible={showUpgradeModal}
          mode="upgrade"
          memberName={member.nickname || member.name}
          memberIsHospital={member.is_hospital}
          currentCard={{
            card_name: card.card_name,
            card_code: card.card_code as SubscriptionCardCode,
            is_hospital: card.is_hospital,
            paid_amount: card.paid_amount,
            used_meals: card.used_meals,
            total_meals: card.total_meals,
            remaining_meals: card.remaining_meals,
          }}
          onClose={() => setShowUpgradeModal(false)}
          onSubmit={handleUpgrade}
        />
      ) : null}
      {card ? (
        <CardFlowModal
          visible={showRenewModal}
          mode="renew"
          memberName={member.nickname || member.name}
          memberIsHospital={member.is_hospital}
          currentCard={{
            card_name: card.card_name,
            card_code: card.card_code as SubscriptionCardCode,
            is_hospital: card.is_hospital,
            paid_amount: card.paid_amount,
            used_meals: card.used_meals,
            total_meals: card.total_meals,
            remaining_meals: card.remaining_meals,
          }}
          onClose={() => setShowRenewModal(false)}
          onSubmit={handleRenew}
        />
      ) : null}
      {card ? (
        <RefundCardModal
          visible={showRefundModal}
          memberName={member.nickname || member.name}
          currentCard={{
            card_name: card.card_name,
            is_hospital: card.is_hospital,
            paid_amount: card.paid_amount,
            total_meals: card.total_meals,
            used_meals: card.used_meals,
            remaining_meals: card.remaining_meals,
            unit_price: card.unit_price,
          }}
          onClose={() => setShowRefundModal(false)}
          onSubmit={handleRefund}
        />
      ) : null}

      <MemberEditModal
        visible={showEditModal}
        member={member}
        onClose={() => setShowEditModal(false)}
        onSaved={handleEditSave}
      />

      <Snackbar
        visible={!!toast}
        onDismiss={() => setToast(null)}
        duration={3200}
        style={styles.snackbar}
        action={{ label: '知道了', onPress: () => setToast(null) }}
      >
        {toast}
      </Snackbar>
      </SafeAreaView>
    </View>
  );
}

// ========== 子组件 ==========

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.infoCard}>{children}</View>
    </View>
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: color + '22' }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

function HistoryCardRow({ card, isLast }: { card: MockCard; isLast: boolean }) {
  const statusMap = {
    active: { label: '进行中', color: '#34C759', bg: '#E8F8ED' },
    upgraded: { label: '已升级', color: '#007AFF', bg: IOS_COLORS.blueLight },
    exhausted: { label: '已用完', color: IOS_COLORS.labelSecondary, bg: IOS_COLORS.fillLight },
    refunded: { label: '已退卡', color: '#FF3B30', bg: '#FFE8E6' },
  };
  const s = statusMap[card.status];
  return (
    <View style={[styles.historyRow, isLast && styles.historyRowLast]}>
      <View style={styles.historyLeft}>
        <View style={styles.historyTopRow}>
          <Text style={styles.historyName}>{card.card_name}</Text>
          <Text style={styles.historyType}>{card.is_hospital ? '院内' : '院外'}</Text>
          <View style={[styles.historySt, { backgroundColor: s.bg }]}>
            <Text style={[styles.historyStText, { color: s.color }]}>{s.label}</Text>
          </View>
        </View>
        {card.upgraded_from && (
          <Text style={styles.historyUpgrade}>自「{card.upgraded_from}」升级</Text>
        )}
        <Text style={styles.historyMeta}>
          {card.used_meals}/{card.total_meals}份 · ¥{card.paid_amount} · {new Date(card.purchased_at).toLocaleDateString('zh-CN')}
        </Text>
        {card.status === 'refunded' && card.refund_amount != null ? (
          <Text style={styles.historyRefund}>
            退卡退款 ¥{card.refund_amount}
            {card.refunded_at ? ` · ${new Date(card.refunded_at).toLocaleDateString('zh-CN')}` : ''}
            {card.refund_reason ? ` · ${card.refund_reason}` : ''}
          </Text>
        ) : null}
        {card.notes ? <Text style={styles.historyNotes}>备注：{card.notes}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerText: { fontSize: 16, color: IOS_COLORS.labelSecondary },
  link: { fontSize: 16, color: IOS_COLORS.blue },

  editBtn: { fontSize: 15, color: IOS_COLORS.blue, fontWeight: '500' },

  profileSection: {
    alignItems: 'center', backgroundColor: IOS_COLORS.card,
    paddingTop: 24, paddingBottom: 20, marginBottom: 20,
  },
  bigAvatar: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  bigAvatarText: { fontSize: 28, fontWeight: '700', color: IOS_COLORS.blue },
  bigName: { fontSize: 22, fontWeight: '700', color: IOS_COLORS.label, marginBottom: 2 },
  bigNickname: { fontSize: 15, color: IOS_COLORS.labelSecondary, marginBottom: 10 },
  tagRow: { flexDirection: 'row', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '600' },

  sectionWrap: { paddingHorizontal: 20, marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: IOS_COLORS.labelSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 },
  infoCard: { backgroundColor: IOS_COLORS.card, borderRadius: 14, overflow: 'hidden' },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 15, color: IOS_COLORS.label },
  infoValue: { fontSize: 15, color: IOS_COLORS.labelSecondary, maxWidth: '60%', textAlign: 'right' },

  dietRow: { paddingHorizontal: 16, paddingVertical: 14 },
  dietText: { fontSize: 15, color: IOS_COLORS.label, lineHeight: 22 },

  sectionHeader: {
    paddingHorizontal: 24, paddingTop: 4, paddingBottom: 8,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: IOS_COLORS.label, letterSpacing: -0.3 },

  cardSection: { paddingHorizontal: 20, marginBottom: 24, gap: 10 },
  renewalBanner: {
    backgroundColor: '#FFF4E5', borderRadius: 10, padding: 12,
  },
  renewalBannerText: { fontSize: 14, color: IOS_COLORS.orange },

  activeCard: {
    backgroundColor: IOS_COLORS.card, borderRadius: 18, padding: 18, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  activeCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeCardName: { fontSize: 18, fontWeight: '700', color: IOS_COLORS.label },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardType: { fontSize: 13, color: IOS_COLORS.labelSecondary },
  progressSection: { gap: 6 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 14, color: IOS_COLORS.labelSecondary },
  progressPct: { fontSize: 14, fontWeight: '600' },
  progressBar: { height: 8, backgroundColor: IOS_COLORS.fillMedium, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  metaItem: { alignItems: 'center', gap: 2 },
  metaValue: { fontSize: 16, fontWeight: '600', color: IOS_COLORS.label },
  metaLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  cardCollector: { fontSize: 12, color: IOS_COLORS.labelTertiary },
  cardNotes: { fontSize: 12, color: IOS_COLORS.labelSecondary, fontStyle: 'italic' },

  actionRow: {
    flexDirection: 'row', gap: 10,
  },
  actionBtn: {
    height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  actionBtnFlex: { flex: 1 },
  upgradeBtn: { backgroundColor: IOS_COLORS.blue },
  upgradeBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  renewBtn: { backgroundColor: '#FF9500' },
  renewBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  purchaseBtn: {
    backgroundColor: '#34C759',
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  refundBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  refundBtnText: { fontSize: 14, color: '#FF3B30', fontWeight: '500' },
  purchaseBtnFull: { width: '100%' },
  purchaseBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  noCardSection: { paddingHorizontal: 20, marginBottom: 24, gap: 12 },
  noCardCard: {
    backgroundColor: IOS_COLORS.card,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  noCardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: IOS_COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  noCardTitle: { fontSize: 17, fontWeight: '600', color: IOS_COLORS.label },
  noCardHint: {
    fontSize: 13,
    color: IOS_COLORS.labelSecondary,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },

  statsRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 4,
  },
  statCard: {
    flex: 1, backgroundColor: IOS_COLORS.card, borderRadius: 14, padding: 14,
    alignItems: 'center', gap: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statUnit: { fontSize: 11, color: IOS_COLORS.labelSecondary },
  statLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary },

  historyCards: { marginHorizontal: 20, marginBottom: 8, backgroundColor: IOS_COLORS.card, borderRadius: 14, overflow: 'hidden' },
  historyRow: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  historyRowLast: { borderBottomWidth: 0 },
  historyLeft: { gap: 3 },
  historyTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyName: { fontSize: 15, fontWeight: '600', color: IOS_COLORS.label },
  historyType: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  historySt: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  historyStText: { fontSize: 11, fontWeight: '600' },
  historyUpgrade: { fontSize: 12, color: IOS_COLORS.blue },
  historyMeta: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  historyRefund: { fontSize: 12, color: '#FF3B30' },
  historyNotes: { fontSize: 12, color: IOS_COLORS.labelTertiary, fontStyle: 'italic' },

  snackbar: { marginBottom: 24 },
});
