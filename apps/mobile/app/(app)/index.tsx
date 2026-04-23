/**
 * 主界面 — v3 Bento + 毛玻璃。
 * 布局：问候 → 速览 4 连格 → 主入口 2×2 → 余餐提醒横条（若有）。
 */

import { StyleSheet, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { CARD_RENEWAL_THRESHOLD_MEALS } from '@meal/shared';
import { useAuth } from '../../hooks/useAuth';
import { useFinanceToday, useMembersView } from '../../hooks/useMembersView';
import { useOrdersToday } from '../../hooks/useOrdersToday';
import {
  COLORS,
  SPACING,
  TYPE,
} from '../../theme/paperTheme';
import {
  MeshBackground,
  BentoGrid,
  Bento,
  PressableCard,
  StatTile,
  IconAvatar,
  SectionLabel,
} from '../../components/ui';

type EntryDef = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  route: string;
  accent?: string;
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

  const membersView = useMembersView();
  const financeToday = useFinanceToday(todayISO());
  const ordersToday = useOrdersToday();

  const members = membersView.data ?? [];
  const renewalCount = members.filter(
    (m) => m.active_card && m.active_card.remaining_meals <= CARD_RENEWAL_THRESHOLD_MEALS,
  ).length;

  const fin = financeToday.data ?? { income: 0, expense: 0, net: 0 };

  const orders = ordersToday.data ?? [];
  const totalCount = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.quantity, 0);
  const pendingCount = orders
    .filter((o) => o.status === 'pending')
    .reduce((sum, o) => sum + o.quantity, 0);

  const entries: EntryDef[] = [
    {
      key: 'members',
      title: '会员档案',
      subtitle: membersView.isLoading
        ? '加载中...'
        : `${members.length} 位会员${renewalCount > 0 ? ` · ${renewalCount} 人需续卡` : ''}`,
      icon: 'people-outline',
      color: COLORS.brand,
      bg: COLORS.brandSoft,
      route: '/(app)/members',
    },
    {
      key: 'orders',
      title: '每日订餐',
      subtitle: ordersToday.isLoading
        ? '加载中...'
        : `${totalCount} 份 · 待出 ${pendingCount}`,
      icon: 'restaurant-outline',
      color: COLORS.success,
      bg: COLORS.successSoft,
      route: '/(app)/orders',
    },
    {
      key: 'finance',
      title: '财务记账',
      subtitle: financeToday.isLoading
        ? '加载中...'
        : `今日净额 ¥${fin.net.toLocaleString()}`,
      icon: 'wallet-outline',
      color: COLORS.warning,
      bg: COLORS.warningSoft,
      route: '/(app)/finance',
    },
    {
      key: 'profile',
      title: '当前用户',
      subtitle: user?.full_name
        ? `${user.full_name} · ${user.role === 'admin' ? '管理员' : '员工'}`
        : '未登录',
      icon: 'person-circle-outline',
      color: COLORS.info,
      bg: COLORS.infoSoft,
      route: '/(app)/profile',
    },
  ];

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.container}>
            {/* 问候 */}
            <View style={styles.greeting}>
              <Text style={styles.greetingDate}>{formatDate()}</Text>
              <View style={styles.greetingRow}>
                <Text style={styles.greetingHello}>{timeGreeting}，</Text>
                <Text style={styles.greetingName}>{user?.full_name ?? '朋友'}</Text>
              </View>
            </View>

            {/* 余餐提醒（条件显示） */}
            {renewalCount > 0 ? (
              <View style={styles.block}>
                <PressableCard
                  tint="warn"
                  padding={SPACING.base}
                  onPress={() => router.push('/(app)/reminders' as never)}
                  style={styles.reminderRow}
                >
                  <IconAvatar
                    icon="alert-circle-outline"
                    color={COLORS.warning}
                    bg="rgba(255,149,0,0.18)"
                    size={38}
                  />
                  <View style={{ flex: 1, marginLeft: SPACING.md }}>
                    <Text style={styles.reminderTitle}>
                      {renewalCount} 位会员余餐不足
                    </Text>
                    <Text style={styles.reminderSub}>点击查看续卡跟进列表</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.warning}
                  />
                </PressableCard>
              </View>
            ) : null}

            {/* 今日速览（4 格 Bento，统一 tint 风格） */}
            <View style={styles.block}>
              <SectionLabel>今日速览</SectionLabel>
              <BentoGrid gap={SPACING.md}>
                <Bento span={3} mobileSpan={6}>
                  <StatTile
                    label="今日收入"
                    value={`¥${fin.income.toLocaleString()}`}
                    icon="arrow-up-circle-outline"
                    color={COLORS.brand}
                    tint="info"
                  />
                </Bento>
                <Bento span={3} mobileSpan={6}>
                  <StatTile
                    label="今日支出"
                    value={`¥${fin.expense.toLocaleString()}`}
                    icon="arrow-down-circle-outline"
                    color={COLORS.danger}
                    tint="danger"
                  />
                </Bento>
                <Bento span={3} mobileSpan={6}>
                  <StatTile
                    label="今日净额"
                    value={`¥${fin.net.toLocaleString()}`}
                    icon={fin.net >= 0 ? 'checkmark-circle-outline' : 'close-circle-outline'}
                    color={fin.net >= 0 ? COLORS.success : COLORS.danger}
                    tint={fin.net >= 0 ? 'ok' : 'danger'}
                  />
                </Bento>
                <Bento span={3} mobileSpan={6}>
                  <StatTile
                    label="待出餐"
                    value={`${pendingCount} 份`}
                    icon="time-outline"
                    color={COLORS.warning}
                    tint="warn"
                  />
                </Bento>
              </BentoGrid>
            </View>

            {/* 快捷操作（4 行整宽大卡，图标｜文字 横排） */}
            <View style={styles.block}>
              <SectionLabel>快捷操作</SectionLabel>
              <BentoGrid gap={SPACING.md}>
                {entries.map((e) => (
                  <Bento key={e.key} span={12}>
                    <PressableCard
                      padding={SPACING.lg}
                      onPress={() => router.push(e.route as never)}
                      style={styles.entryCard}
                    >
                      <IconAvatar icon={e.icon} color={e.color} bg={e.bg} size={46} />
                      <View style={styles.entryText}>
                        <Text style={styles.entryTitle}>{e.title}</Text>
                        <Text style={styles.entrySubtitle} numberOfLines={2}>
                          {e.subtitle}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={COLORS.text.quaternary}
                      />
                    </PressableCard>
                  </Bento>
                ))}
              </BentoGrid>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function formatDate() {
  const d = new Date();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}月${d.getDate()}日  星期${days[d.getDay()]}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  scroll: { paddingBottom: 48, paddingTop: SPACING.sm },
  container: {
    width: '100%',
    maxWidth: SPACING.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: SPACING.page,
  },

  // greeting
  greeting: {
    paddingVertical: SPACING.lg,
    alignItems: 'flex-start',
  },
  greetingDate: {
    ...TYPE.footnote,
    color: COLORS.text.tertiary,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  greetingHello: { ...TYPE.title1, color: COLORS.text.tertiary, fontWeight: '500' },
  greetingName: { ...TYPE.title1, color: COLORS.text.primary },

  block: { marginBottom: SPACING.lg },

  reminderRow: { flexDirection: 'row', alignItems: 'center' },
  reminderTitle: { ...TYPE.headline, color: COLORS.text.primary },
  reminderSub: { ...TYPE.footnote, color: COLORS.text.tertiary, marginTop: 2 },

  // entries
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryText: { flex: 1, marginLeft: SPACING.md },
  entryTitle: { ...TYPE.title3, color: COLORS.text.primary, marginBottom: 4 },
  entrySubtitle: { ...TYPE.footnote, color: COLORS.text.secondary },
});
