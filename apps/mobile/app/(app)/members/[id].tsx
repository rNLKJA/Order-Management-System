/**
 * 会员详情页 — 含卡管理（开卡、升级、历史卡）
 */

import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { IOS_COLORS } from '../../../theme/paperTheme';
import { MOCK_MEMBERS, type MockCard } from '../../../constants/mockData';
import { CARD_CATALOG, listCards, listUpgradeOptions, type CardSpec } from '@meal/shared';

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const member = MOCK_MEMBERS.find((m) => m.id === Number(id));

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isHospital, setIsHospital] = useState(member?.is_hospital ?? false);

  if (!member) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.centerText}>会员不存在</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>返回</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const card = member.active_card;
  const progressPct = card ? (card.remaining_meals / card.total_meals) * 100 : 0;
  const progressColor = progressPct > 50 ? '#34C759' : progressPct > 20 ? '#FF9500' : '#FF3B30';
  const renewal = card && card.remaining_meals <= 2;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 导航栏 */}
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backText}>‹ 返回</Text>
          </Pressable>
          <Text style={styles.navTitle}>会员详情</Text>
          <Pressable>
            <Text style={styles.editBtn}>编辑</Text>
          </Pressable>
        </View>

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
                <Text style={styles.renewalBannerText}>⚠️ 剩余 {card.remaining_meals} 餐，建议尽快续卡</Text>
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
                收款人：{card.collector} · {new Date(card.purchased_at).toLocaleDateString('zh-CN')}
              </Text>
            </View>

            {/* 升级按钮 */}
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.upgradeBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setShowUpgradeModal(true)}
            >
              <Text style={styles.upgradeBtnText}>升级卡片</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.noCardSection}>
            <Text style={styles.noCardText}>暂无有效卡片</Text>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.purchaseBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setShowPurchaseModal(true)}
            >
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

      {/* 购卡 Modal */}
      <PurchaseModal
        visible={showPurchaseModal}
        isHospital={isHospital}
        onToggleHospital={setIsHospital}
        onClose={() => setShowPurchaseModal(false)}
        memberName={member.nickname || member.name}
      />

      {/* 升级 Modal */}
      {card && (
        <UpgradeModal
          visible={showUpgradeModal}
          currentCard={card}
          isHospital={isHospital}
          onToggleHospital={setIsHospital}
          onClose={() => setShowUpgradeModal(false)}
          memberName={member.nickname || member.name}
        />
      )}
    </SafeAreaView>
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
          <Text style={styles.historyUpgrade}>⬆ 由{card.upgraded_from}升级</Text>
        )}
        <Text style={styles.historyMeta}>
          {card.used_meals}/{card.total_meals}份 · ¥{card.paid_amount} · {new Date(card.purchased_at).toLocaleDateString('zh-CN')}
        </Text>
      </View>
    </View>
  );
}

// ========== 购卡 Modal ==========

function PurchaseModal({
  visible, isHospital, onToggleHospital, onClose, memberName,
}: {
  visible: boolean; isHospital: boolean; onToggleHospital: (v: boolean) => void;
  onClose: () => void; memberName: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const cards = listCards(isHospital);
  const selectedSpec = cards.find((c) => c.code === selected);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: IOS_COLORS.systemGrouped }} edges={['top', 'bottom']}>
        {/* 标题栏 */}
        <View style={mStyles.header}>
          <Pressable onPress={onClose}><Text style={mStyles.cancel}>取消</Text></Pressable>
          <Text style={mStyles.title}>购买新卡</Text>
          <Pressable
            disabled={!selected}
            onPress={() => {
              Alert.alert('购卡', `确认为 ${memberName} 购买 ${selectedSpec?.name}，应收 ¥${selectedSpec?.totalPrice}？`, [
                { text: '取消' },
                { text: '确认', onPress: onClose },
              ]);
            }}
          >
            <Text style={[mStyles.confirm, !selected && { opacity: 0.3 }]}>确认</Text>
          </Pressable>
        </View>

        {/* 院内/院外切换 */}
        <View style={mStyles.toggleRow}>
          <Text style={mStyles.toggleLabel}>订阅类型</Text>
          <View style={mStyles.toggleGroup}>
            {([false, true] as const).map((v) => (
              <Pressable
                key={String(v)}
                style={[mStyles.toggleBtn, isHospital === v && mStyles.toggleBtnActive]}
                onPress={() => { onToggleHospital(v); setSelected(null); }}
              >
                <Text style={[mStyles.toggleText, isHospital === v && mStyles.toggleTextActive]}>
                  {v ? '院内' : '院外'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {isHospital && (
          <Text style={mStyles.hint}>勾选院内后，送餐默认由孙漫林负责。</Text>
        )}

        {/* 卡片选择 */}
        <ScrollView contentContainerStyle={mStyles.cardGrid}>
          {cards.map((card) => (
            <Pressable
              key={card.code}
              style={[mStyles.cardOption, selected === card.code && mStyles.cardOptionSelected]}
              onPress={() => setSelected(card.code)}
            >
              <Text style={mStyles.cardOptionName}>{card.name}</Text>
              <Text style={mStyles.cardOptionMeals}>{card.meals} 份</Text>
              <Text style={mStyles.cardOptionPrice}>¥{card.totalPrice}</Text>
              <Text style={mStyles.cardOptionUnit}>¥{card.unitPrice}/份</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* 底部汇总 */}
        {selectedSpec && (
          <View style={mStyles.summary}>
            <Text style={mStyles.summaryText}>
              应收 <Text style={mStyles.summaryAmount}>¥{selectedSpec.totalPrice}</Text>
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ========== 升级 Modal ==========

function UpgradeModal({
  visible, currentCard, isHospital, onToggleHospital, onClose, memberName,
}: {
  visible: boolean; currentCard: MockCard; isHospital: boolean;
  onToggleHospital: (v: boolean) => void;
  onClose: () => void; memberName: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const options = listUpgradeOptions(isHospital, currentCard.paid_amount);
  const allCards = listCards(isHospital);
  const selectedSpec = options.find((c) => c.code === selected);
  const diff = selectedSpec ? selectedSpec.totalPrice - currentCard.paid_amount : 0;
  const newRemain = selectedSpec ? selectedSpec.meals - currentCard.used_meals : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: IOS_COLORS.systemGrouped }} edges={['top', 'bottom']}>
        <View style={mStyles.header}>
          <Pressable onPress={onClose}><Text style={mStyles.cancel}>取消</Text></Pressable>
          <Text style={mStyles.title}>升级卡片</Text>
          <Pressable
            disabled={!selected}
            onPress={() => {
              Alert.alert('升级确认', `${memberName} 补差价 ¥${diff}，升级后剩 ${newRemain} 份`, [
                { text: '取消' },
                { text: '确认升级', onPress: onClose },
              ]);
            }}
          >
            <Text style={[mStyles.confirm, !selected && { opacity: 0.3 }]}>确认</Text>
          </Pressable>
        </View>

        {/* 当前卡 */}
        <View style={mStyles.currentCard}>
          <Text style={mStyles.currentCardLabel}>当前：{currentCard.card_name}</Text>
          <Text style={mStyles.currentCardSub}>已支付 ¥{currentCard.paid_amount} · 已用 {currentCard.used_meals} 份</Text>
        </View>

        {/* 院内/院外切换 */}
        <View style={mStyles.toggleRow}>
          <Text style={mStyles.toggleLabel}>价目表</Text>
          <View style={mStyles.toggleGroup}>
            {([false, true] as const).map((v) => (
              <Pressable
                key={String(v)}
                style={[mStyles.toggleBtn, isHospital === v && mStyles.toggleBtnActive]}
                onPress={() => { onToggleHospital(v); setSelected(null); }}
              >
                <Text style={[mStyles.toggleText, isHospital === v && mStyles.toggleTextActive]}>
                  {v ? '院内' : '院外'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={mStyles.cardGrid}>
          {allCards.map((card) => {
            const canUpgrade = card.totalPrice > currentCard.paid_amount;
            return (
              <Pressable
                key={card.code}
                disabled={!canUpgrade}
                style={[
                  mStyles.cardOption,
                  !canUpgrade && mStyles.cardOptionDisabled,
                  selected === card.code && mStyles.cardOptionSelected,
                ]}
                onPress={() => canUpgrade && setSelected(card.code)}
              >
                <Text style={[mStyles.cardOptionName, !canUpgrade && { color: IOS_COLORS.labelTertiary }]}>
                  {card.name}
                </Text>
                <Text style={[mStyles.cardOptionMeals, !canUpgrade && { color: IOS_COLORS.labelTertiary }]}>
                  {card.meals} 份
                </Text>
                <Text style={[mStyles.cardOptionPrice, !canUpgrade && { color: IOS_COLORS.labelTertiary }]}>
                  ¥{card.totalPrice}
                </Text>
                {!canUpgrade && (
                  <Text style={mStyles.noUpgradeText}>不支持降级</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {selectedSpec && (
          <View style={mStyles.summary}>
            <Text style={mStyles.summaryText}>
              补差价 <Text style={mStyles.summaryAmount}>¥{diff}</Text>
              {'  '}升级后剩 <Text style={[mStyles.summaryAmount, { color: '#34C759' }]}>{newRemain} 份</Text>
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerText: { fontSize: 16, color: IOS_COLORS.labelSecondary },
  link: { fontSize: 16, color: IOS_COLORS.blue },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: IOS_COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  backText: { fontSize: 17, color: IOS_COLORS.blue, width: 60 },
  navTitle: { fontSize: 17, fontWeight: '600', color: IOS_COLORS.label },
  editBtn: { fontSize: 17, color: IOS_COLORS.blue, width: 60, textAlign: 'right' },

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

  actionBtn: {
    height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  upgradeBtn: { backgroundColor: IOS_COLORS.blue },
  upgradeBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  purchaseBtn: { backgroundColor: '#34C759' },
  purchaseBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  noCardSection: { paddingHorizontal: 20, marginBottom: 24, gap: 12, alignItems: 'center' },
  noCardText: { fontSize: 15, color: IOS_COLORS.labelSecondary },

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
});

const mStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: IOS_COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  cancel: { fontSize: 17, color: IOS_COLORS.labelSecondary },
  title: { fontSize: 17, fontWeight: '600', color: IOS_COLORS.label },
  confirm: { fontSize: 17, color: IOS_COLORS.blue, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: IOS_COLORS.card,
  },
  toggleLabel: { fontSize: 16, color: IOS_COLORS.label },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.fillMedium, borderRadius: 8, padding: 2,
  },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: IOS_COLORS.card },
  toggleText: { fontSize: 14, color: IOS_COLORS.labelSecondary },
  toggleTextActive: { color: IOS_COLORS.label, fontWeight: '600' },
  hint: { fontSize: 13, color: IOS_COLORS.labelSecondary, paddingHorizontal: 20, paddingBottom: 8, backgroundColor: IOS_COLORS.card },
  cardGrid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12,
  },
  cardOption: {
    width: 'calc(50% - 6px)' as any, minWidth: 140,
    backgroundColor: IOS_COLORS.card, borderRadius: 14, padding: 14, gap: 4,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  cardOptionSelected: { borderColor: IOS_COLORS.blue },
  cardOptionDisabled: { backgroundColor: IOS_COLORS.fillLight, opacity: 0.6 },
  cardOptionName: { fontSize: 16, fontWeight: '700', color: IOS_COLORS.label },
  cardOptionMeals: { fontSize: 13, color: IOS_COLORS.labelSecondary },
  cardOptionPrice: { fontSize: 20, fontWeight: '700', color: IOS_COLORS.blue },
  cardOptionUnit: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  noUpgradeText: { fontSize: 12, color: IOS_COLORS.red, marginTop: 2 },
  currentCard: {
    backgroundColor: IOS_COLORS.card, paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  currentCardLabel: { fontSize: 15, fontWeight: '600', color: IOS_COLORS.label },
  currentCardSub: { fontSize: 13, color: IOS_COLORS.labelSecondary, marginTop: 2 },
  summary: {
    backgroundColor: IOS_COLORS.card, padding: 16, alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: IOS_COLORS.separatorLight,
  },
  summaryText: { fontSize: 16, color: IOS_COLORS.label },
  summaryAmount: { fontSize: 20, fontWeight: '700', color: IOS_COLORS.blue },
});
