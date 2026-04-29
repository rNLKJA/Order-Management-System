/**
 * 主界面 — v3 Bento + 毛玻璃。
 * 布局：欢迎卡（左图标右文案）→ 速览 4 连格 → 余餐提醒 → 快捷操作分层。
 */

import { StyleSheet, ScrollView, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  CARD_RENEWAL_THRESHOLD_MEALS,
  displayUserRole,
  formatCNY,
  formatDate,
  shanghaiCalendarMetaLine,
} from '@meal/shared';
import { useAuth } from '../../hooks/useAuth';
import { useFinanceToday, useMembersView } from '../../hooks/useMembersView';
import { useOrdersToday } from '../../hooks/useOrdersToday';
import { walkinsApi } from '../../api/walkins';
import {
  COLORS,
  SPACING,
  TYPE,
} from '../../theme/paperTheme';
import {
  MeshBackground,
  BentoGrid,
  Bento,
  GlassSurface,
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
};

const ICON_OPTICAL_NUDGE: Partial<
  Record<EntryDef['icon'], { x?: number; y?: number }>
> = {
  'wallet-outline': { x: 0.5, y: -0.5 },
  'bar-chart-outline': { x: 0.5, y: -1 },
};

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompactPhone = width <= 430;
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

  const membersView = useMembersView();
  const financeToday = useFinanceToday(formatDate(new Date()));
  const ordersToday = useOrdersToday();
  const walkinsQuery = useQuery({
    queryKey: ['walkins', 'list'],
    queryFn: async () => (await walkinsApi.list()).items,
    refetchOnWindowFocus: true,
  });

  // 首页"会员档案"统计只算正式会员，散客另入"散客目录"tile
  const members = (membersView.data ?? []).filter((m) => !m.is_walkin);
  const renewalCount = members.filter(
    (m) => m.active_card && m.active_card.remaining_meals <= CARD_RENEWAL_THRESHOLD_MEALS,
  ).length;

  const fin = financeToday.data ?? {
    income: 0,
    expense: 0,
    net: 0,
    realized_income: 0,
    prepaid_income: 0,
    realized_net: 0,
    realized_by_channel: { hospital: 0, regular: 0, walkin: 0 },
    byCategory: {},
  };

  const orders = ordersToday.data ?? [];
  const totalCount = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.quantity, 0);
  const pendingCount = orders
    .filter((o) => o.status === 'pending')
    .reduce((sum, o) => sum + o.quantity, 0);

  const walkinCount = walkinsQuery.data?.length ?? 0;
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
      key: 'walkins',
      title: '散客目录',
      subtitle: walkinsQuery.isLoading
        ? '加载中...'
        : walkinCount === 0
          ? '还没有散客记录 · 可从每日订餐录入'
          : `${walkinCount} 位散客`,
      icon: 'walk-outline',
      color: COLORS.warning,
      bg: COLORS.warningSoft,
      route: '/(app)/walkins',
    },
    {
      key: 'orders-manage',
      title: '录入 / 总览',
      subtitle: ordersToday.isLoading
        ? '加载中...'
        : `${totalCount} 份 · 待出 ${pendingCount}`,
      icon: 'restaurant-outline',
      color: COLORS.success,
      bg: COLORS.successSoft,
      route: '/(app)/orders?group=manage',
    },
    {
      key: 'orders-fulfillment',
      title: '出餐 / 配送',
      subtitle: ordersToday.isLoading
        ? '加载中...'
        : `待出 ${pendingCount} 份 · 配送执行`,
      icon: 'bicycle-outline',
      color: COLORS.info,
      bg: COLORS.infoSoft,
      route: '/(app)/orders?group=fulfillment',
    },
    {
      key: 'finance',
      title: '财务流水',
      subtitle: financeToday.isLoading
        ? '加载中...'
        : `今日履约 ${formatCNY(fin.realized_income)} · 预收 ${formatCNY(fin.prepaid_income)}`,
      icon: 'wallet-outline',
      color: COLORS.warning,
      bg: COLORS.warningSoft,
      route: '/(app)/finance',
    },
    {
      key: 'orders-stats',
      title: '订餐数据',
      subtitle: ordersToday.isLoading
        ? '加载中...'
        : `按日期分析全员订餐 · 今日 ${totalCount} 份`,
      icon: 'bar-chart-outline',
      color: COLORS.info,
      bg: COLORS.infoSoft,
      route: '/(app)/orders/stats',
    },
    {
      key: 'users',
      title: '员工名单',
      subtitle: '查看所有账号 · 点进去看各人录单流水',
      icon: 'people-circle-outline',
      color: COLORS.brand,
      bg: COLORS.brandSoft,
      route: '/(app)/users',
    },
    ...(user?.role === 'admin'
      ? ([
          {
            key: 'admin',
            title: '权限管理',
            subtitle: user?.is_superadmin
              ? '超级管理员：分配管理员、管理全员账号'
              : '管理员：管理员工写权限与账号',
            icon: 'shield-checkmark-outline' as const,
            color: COLORS.info,
            bg: COLORS.infoSoft,
            route: '/(app)/admin',
          },
          {
            key: 'audit-logs',
            title: '操作记录',
            subtitle: '审计日志：权限、会员、订单、财务等',
            icon: 'clipboard-outline' as const,
            color: COLORS.text.secondary,
            bg: 'rgba(118,118,128,0.12)',
            route: '/(app)/audit-logs',
          },
        ] as EntryDef[])
      : []),
    {
      key: 'profile',
      title: '当前用户',
      subtitle: user?.full_name
        ? `${user.full_name} · ${displayUserRole(user)}`
        : '未登录',
      icon: 'person-circle-outline',
      color: COLORS.info,
      bg: COLORS.infoSoft,
      route: '/(app)/profile',
    },
  ];
  const entriesByKey = Object.fromEntries(entries.map((e) => [e.key, e])) as Record<string, EntryDef>;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          // 手动应用顶部安全区：状态栏 / 刘海屏 / 动态岛都让开
          // 加 SPACING.sm 保证即使 insets.top = 0（如 Android 透明状态栏）也有呼吸
          { paddingTop: Math.max(insets.top, 20) + SPACING.sm },
          { paddingBottom: 48 + insets.bottom },
        ]}
      >
        <View style={styles.container}>
            {/* 欢迎卡（与登录页同语言：左图标 + 右文案） */}
            <View style={styles.greeting}>
              <GlassSurface padding={SPACING.base} style={styles.heroCard}>
                <IconAvatar
                  icon="sparkles-outline"
                  size={50}
                  color={COLORS.brand}
                  bg="rgba(0,122,255,0.14)"
                />
                <View style={styles.heroTextWrap}>
                  <Text style={styles.greetingDate}>{shanghaiCalendarMetaLine()}</Text>
                  <View style={styles.greetingRow}>
                    <Text style={styles.greetingHello}>{timeGreeting}，</Text>
                    <Text style={styles.greetingName}>{user?.full_name ?? '朋友'}</Text>
                  </View>
                </View>
              </GlassSurface>
            </View>

            {/* 今日速览（4 格 Bento，统一 tint 风格） */}
            <View style={styles.block}>
              <SectionLabel>今日速览</SectionLabel>
              <BentoGrid gap={SPACING.md}>
                <Bento span={3} mobileSpan={6}>
                  <StatTile
                    label="今日履约收入"
                    value={formatCNY(fin.realized_income)}
                    icon="restaurant-outline"
                    color={COLORS.success}
                    tint="ok"
                    hint="已送达餐费（院内/院外/散客）"
                  />
                </Bento>
                <Bento span={3} mobileSpan={6}>
                  <StatTile
                    label="今日支出"
                    value={formatCNY(fin.expense)}
                    icon="arrow-down-circle-outline"
                    color={COLORS.danger}
                    tint="danger"
                  />
                </Bento>
                <Bento span={3} mobileSpan={6}>
                  <StatTile
                    label="今日净额（履约−支出）"
                    value={formatCNY(fin.realized_net)}
                    icon={fin.realized_net >= 0 ? 'checkmark-circle-outline' : 'close-circle-outline'}
                    color={fin.realized_net >= 0 ? COLORS.success : COLORS.danger}
                    tint={fin.realized_net >= 0 ? 'ok' : 'danger'}
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
                  <View style={styles.reminderTextWrap}>
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

            {/* 快捷操作 */}
            <View style={styles.block}>
              <SectionLabel>快捷操作</SectionLabel>
              <BentoGrid gap={SPACING.md}>
                <Bento span={6} mobileSpan={12}>
                  <View style={styles.primaryColumn}>
                    {entriesByKey.members ? <QuickEntryCard entry={entriesByKey.members} /> : null}
                    {entriesByKey.walkins ? <QuickEntryCard entry={entriesByKey.walkins} /> : null}
                  </View>
                </Bento>
                <Bento span={6} mobileSpan={12}>
                  <View style={styles.primaryColumn}>
                    {entriesByKey['orders-manage'] ? <QuickEntryCard entry={entriesByKey['orders-manage']} compactPhone={isCompactPhone} /> : null}
                    {entriesByKey['orders-fulfillment'] ? <QuickEntryCard entry={entriesByKey['orders-fulfillment']} compactPhone={isCompactPhone} /> : null}
                  </View>
                </Bento>

                {['finance', 'orders-stats', 'users', 'admin', 'audit-logs']
                  .filter((key) => Boolean(entriesByKey[key]))
                  .map((key) => (
                    <Bento key={key} span={6} mobileSpan={12}>
                      <QuickEntryCard entry={entriesByKey[key]!} compact compactPhone={isCompactPhone} />
                    </Bento>
                  ))}

                {entriesByKey.profile ? (
                  <Bento span={12}>
                    <QuickEntryCard entry={entriesByKey.profile} compactPhone={isCompactPhone} />
                  </Bento>
                ) : null}
              </BentoGrid>
            </View>
          </View>
      </ScrollView>
    </View>
  );
}

function QuickEntryCard({
  entry,
  compact,
  tall,
  compactPhone,
}: {
  entry: EntryDef;
  compact?: boolean;
  tall?: boolean;
  compactPhone?: boolean;
}) {
  const iconSize = compact ? 40 : 42;
  const nudge = ICON_OPTICAL_NUDGE[entry.icon];
  return (
    <PressableCard
      padding={compact ? SPACING.base : SPACING.lg}
      onPress={() => router.push(entry.route as never)}
      style={[
        styles.entryCard,
        compact && styles.entryCardCompact,
        tall && styles.entryCardTall,
        compactPhone && styles.entryCardPhone,
        tall && compactPhone && styles.entryCardTallPhone,
      ]}
    >
      <View style={styles.entryIconSlot}>
        <IconAvatar
          icon={entry.icon}
          color={entry.color}
          bg={entry.bg}
          size={iconSize}
          iconOffsetX={nudge?.x ?? 0}
          iconOffsetY={nudge?.y ?? 0}
        />
      </View>
      <View style={styles.entryText}>
        <Text style={styles.entryTitle}>{entry.title}</Text>
        <Text style={styles.entrySubtitle} numberOfLines={compact ? 1 : 2}>
          {entry.subtitle}
        </Text>
      </View>
      <View style={styles.entryChevronSlot}>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.text.quaternary}
        />
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  scroll: { /* paddingTop/Bottom 由 useSafeAreaInsets 动态注入 */ },
  container: {
    width: '100%',
    maxWidth: SPACING.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: SPACING.page,
  },

  // greeting
  greeting: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
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
  reminderTextWrap: { flex: 1, marginLeft: SPACING.md },
  reminderTitle: { ...TYPE.headline, color: COLORS.text.primary },
  reminderSub: { ...TYPE.footnote, color: COLORS.text.tertiary, marginTop: 2 },

  // entries
  primaryColumn: { gap: SPACING.md },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 84,
  },
  entryCardTall: { minHeight: 192 },
  entryCardPhone: { borderRadius: 14 },
  entryCardTallPhone: { minHeight: 160 },
  entryIconSlot: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryText: { flex: 1, marginLeft: SPACING.sm },
  entryChevronSlot: {
    width: 20,
    alignItems: 'flex-end',
  },
  entryTitle: { ...TYPE.title3, color: COLORS.text.primary, marginBottom: 4 },
  entrySubtitle: { ...TYPE.footnote, color: COLORS.text.secondary },
});
