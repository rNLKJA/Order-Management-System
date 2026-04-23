/**
 * 主界面 — 2×2 Grid Dashboard
 * iOS 卡片风格
 */

import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { IOS_COLORS } from '../../theme/paperTheme';
import { MOCK_TODAY_SUMMARY, MOCK_MEMBERS } from '../../constants/mockData';

type CardDef = {
  key: string;
  title: string;
  icon: string;
  color: string;
  bg: string;
  badge?: number | string;
  subtitle: string;
  route: string;
};

const renewalCount = MOCK_MEMBERS.filter(
  (m) => m.active_card && m.active_card.remaining_meals <= 2,
).length;

export default function HomeScreen() {
  const { user } = useAuth();

  const cards: CardDef[] = [
    {
      key: 'members',
      title: '会员档案',
      icon: '👥',
      color: IOS_COLORS.blue,
      bg: IOS_COLORS.blueLight,
      badge: renewalCount > 0 ? renewalCount : undefined,
      subtitle: `共 ${MOCK_MEMBERS.length} 位会员${renewalCount > 0 ? ` · ${renewalCount} 人需续卡` : ''}`,
      route: '/(app)/members',
    },
    {
      key: 'orders',
      title: '每日订餐',
      icon: '🥗',
      color: '#34C759',
      bg: '#E8F8ED',
      badge: MOCK_TODAY_SUMMARY.pending,
      subtitle: `今日 午${MOCK_TODAY_SUMMARY.lunch_count}份 晚${MOCK_TODAY_SUMMARY.dinner_count}份`,
      route: '/(app)/orders',
    },
    {
      key: 'finance',
      title: '财务记账',
      icon: '💰',
      color: '#FF9500',
      bg: '#FFF4E5',
      subtitle: `今日净额 ¥${(MOCK_TODAY_SUMMARY.income_today - MOCK_TODAY_SUMMARY.expense_today).toLocaleString()}`,
      route: '/(app)/finance',
    },
    {
      key: 'profile',
      title: '当前用户',
      icon: '👤',
      color: '#AF52DE',
      bg: '#F5EAFF',
      subtitle: user ? `${user.full_name} · ${user.role === 'admin' ? '管理员' : '员工'}` : '未登录',
      route: '/(app)/profile',
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 顶部问候 */}
        <View style={styles.greeting}>
          <Text style={styles.greetingDate}>{formatDate()}</Text>
          <Text style={styles.greetingName}>你好，{user?.full_name ?? '—'}</Text>
        </View>

        {/* 2×2 Grid */}
        <View style={styles.grid}>
          {cards.map((card, i) => (
            <DashboardCard key={card.key} card={card} index={i} />
          ))}
        </View>

        {/* 今日快讯 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日快讯</Text>
          <View style={styles.newsFeed}>
            {renewalCount > 0 && (
              <NewsRow
                icon="⚠️"
                color={IOS_COLORS.orange}
                text={`${renewalCount} 位会员剩余餐数不足，需要续卡`}
                onPress={() => router.push('/(app)/members')}
              />
            )}
            <NewsRow
              icon="📋"
              color={IOS_COLORS.blue}
              text={`今日共 ${MOCK_TODAY_SUMMARY.lunch_count + MOCK_TODAY_SUMMARY.dinner_count} 份餐，${MOCK_TODAY_SUMMARY.pending} 份待出餐`}
              onPress={() => router.push('/(app)/orders')}
            />
            <NewsRow
              icon="💳"
              color="#34C759"
              text={`今日收入 ¥${MOCK_TODAY_SUMMARY.income_today.toLocaleString()}，支出 ¥${MOCK_TODAY_SUMMARY.expense_today.toLocaleString()}`}
              onPress={() => router.push('/(app)/finance')}
              isLast
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DashboardCard({ card, index }: { card: CardDef; index: number }) {
  const isRight = index % 2 === 1;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isRight && styles.cardRight,
        pressed && styles.cardPressed,
      ]}
      onPress={() => router.push(card.route as never)}
    >
      {/* Badge */}
      {card.badge !== undefined && (
        <View style={[styles.badge, { backgroundColor: card.color }]}>
          <Text style={styles.badgeText}>{card.badge}</Text>
        </View>
      )}

      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: card.bg }]}>
        <Text style={styles.iconText}>{card.icon}</Text>
      </View>

      {/* Title + Subtitle */}
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.cardSubtitle} numberOfLines={2}>{card.subtitle}</Text>

      {/* Arrow */}
      <Text style={[styles.cardArrow, { color: card.color }]}>›</Text>
    </Pressable>
  );
}

function NewsRow({
  icon, color, text, onPress, isLast,
}: {
  icon: string; color: string; text: string; onPress: () => void; isLast?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.newsRow, isLast && styles.newsRowLast, pressed && styles.newsRowPressed]}
      onPress={onPress}
    >
      <View style={[styles.newsDot, { backgroundColor: color }]}>
        <Text style={{ fontSize: 12 }}>{icon}</Text>
      </View>
      <Text style={styles.newsText} numberOfLines={2}>{text}</Text>
      <Text style={styles.newsArrow}>›</Text>
    </Pressable>
  );
}

function formatDate() {
  const d = new Date();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${days[d.getDay()]}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },

  greeting: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  greetingDate: { fontSize: 14, color: IOS_COLORS.labelSecondary },
  greetingName: { fontSize: 28, fontWeight: '700', color: IOS_COLORS.label, letterSpacing: -0.5, marginTop: 2 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  card: {
    width: Platform.OS === 'web' ? 'calc(50% - 6px)' as any : '47%',
    backgroundColor: IOS_COLORS.card,
    borderRadius: 18,
    padding: 18,
    minHeight: 150,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardRight: { marginLeft: 0 },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },

  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  iconContainer: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  iconText: { fontSize: 24 },

  cardTitle: { fontSize: 16, fontWeight: '600', color: IOS_COLORS.label, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: IOS_COLORS.labelSecondary, lineHeight: 18, flex: 1 },
  cardArrow: { fontSize: 22, fontWeight: '300', position: 'absolute', bottom: 14, right: 16 },

  section: { paddingHorizontal: 20, marginBottom: 32 },
  sectionTitle: {
    fontSize: 20, fontWeight: '700', color: IOS_COLORS.label,
    marginBottom: 12, letterSpacing: -0.3,
  },
  newsFeed: {
    backgroundColor: IOS_COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  newsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separatorLight,
    gap: 12,
  },
  newsRowLast: { borderBottomWidth: 0 },
  newsRowPressed: { backgroundColor: IOS_COLORS.fillLight },
  newsDot: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  newsText: { flex: 1, fontSize: 15, color: IOS_COLORS.label, lineHeight: 20 },
  newsArrow: { fontSize: 20, color: IOS_COLORS.labelTertiary, fontWeight: '300' },
});
