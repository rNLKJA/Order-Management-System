/**
 * 主界面 — v3 Bento + 毛玻璃。
 * 布局：欢迎卡（左图标右文案）→ 速览 4 连格 → 余餐提醒 → 快捷操作（首屏四项 + 分隔 + 可展开更多）。
 */

import { useRef, useState, useMemo } from 'react';
import { StyleSheet, ScrollView, View, useWindowDimensions, Pressable } from 'react-native';
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
  FloatingBottomBar,
  floatingBottomReserve,
} from '../../components/ui';
import { useScrollToTopOnFocus } from '../../hooks/useScrollToTopOnFocus';

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
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(scrollRef);

  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  /** 含双段图标+文案与 FloatingBottomBar 胶囊内边距，避免压住快捷入口 */
  const homeBottomNavReserve = useMemo(
    () => floatingBottomReserve(88, insets.bottom),
    [insets.bottom],
  );
  const { width } = useWindowDimensions();
  const isCompactPhone = width <= 430;
  const [todayQuickTab, setTodayQuickTab] = useState<'summary' | 'fulfillment'>('summary');
  const [moreShortcutsOpen, setMoreShortcutsOpen] = useState(false);
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
      key: 'orders-manage',
      title: '每日订餐',
      subtitle: ordersToday.isLoading
        ? '加载中...'
        : `今日 ${totalCount} 份 · 待出 ${pendingCount}`,
      icon: 'restaurant-outline',
      color: COLORS.success,
      bg: COLORS.successSoft,
      route: '/(app)/orders?group=manage&tab=entry',
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

  const primaryShortcutKeys = ['members', 'orders-manage', 'walkins', 'orders-fulfillment'] as const;
  const moreShortcutKeys = ['finance', 'orders-stats', 'users', 'admin', 'audit-logs', 'profile'] as const;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          // 手动应用顶部安全区：状态栏 / 刘海屏 / 动态岛都让开
          // 加 SPACING.sm 保证即使 insets.top = 0（如 Android 透明状态栏）也有呼吸
          { paddingTop: Math.max(insets.top, 20) + SPACING.sm },
          { paddingBottom: homeBottomNavReserve + SPACING.xxl },
        ]}
      >
        <View style={styles.container}>
            {/* 欢迎卡（与登录页同语言：左图标 + 右文案） */}
            <View style={styles.greeting}>
              <GlassSurface padding={SPACING.md} style={styles.heroCard}>
                <IconAvatar
                  icon="sparkles-outline"
                  size={46}
                  color={COLORS.brand}
                  bg="rgba(0,122,255,0.14)"
                />
                <View style={styles.heroTextWrap}>
                  <Text style={styles.greetingDate}>{formatDate(new Date())}</Text>
                  <View style={styles.greetingRow}>
                    <Text style={styles.greetingHello}>{timeGreeting}，</Text>
                    <Text style={styles.greetingName}>{user?.full_name ?? '朋友'}</Text>
                  </View>
                </View>
              </GlassSurface>
            </View>

            {/* 汇总 / 履约速览（口径由底栏切换；无额外标题以减轻首屏噪音） */}
            <View style={styles.block}>
              <BentoGrid gap={SPACING.md}>
                {todayQuickTab === 'summary' ? (
                  <>
                    <Bento span={3} mobileSpan={6}>
                      <StatTile
                        layout="compact"
                        label="今日总收入"
                        value={formatCNY(fin.income)}
                        icon="arrow-up-circle-outline"
                        color={COLORS.brand}
                        tint="info"
                        hint="账本全部收入（含预收等）"
                      />
                    </Bento>
                    <Bento span={3} mobileSpan={6}>
                      <StatTile
                        layout="compact"
                        label="今日支出"
                        value={formatCNY(fin.expense)}
                        icon="arrow-down-circle-outline"
                        color={COLORS.danger}
                        tint="danger"
                      />
                    </Bento>
                    <Bento span={3} mobileSpan={6}>
                      <StatTile
                        layout="compact"
                        label="今日净额"
                        value={formatCNY(fin.net)}
                        icon={fin.net >= 0 ? 'checkmark-circle-outline' : 'close-circle-outline'}
                        color={fin.net >= 0 ? COLORS.success : COLORS.danger}
                        tint={fin.net >= 0 ? 'ok' : 'danger'}
                        hint="总收入减总支出"
                      />
                    </Bento>
                    <Bento span={3} mobileSpan={6}>
                      <StatTile
                        layout="compact"
                        label="待出餐"
                        value={`${pendingCount} 份`}
                        icon="time-outline"
                        color={COLORS.warning}
                        tint="warn"
                      />
                    </Bento>
                  </>
                ) : (
                  <>
                    <Bento span={3} mobileSpan={6}>
                      <StatTile
                        layout="compact"
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
                        layout="compact"
                        label="今日支出"
                        value={formatCNY(fin.expense)}
                        icon="arrow-down-circle-outline"
                        color={COLORS.danger}
                        tint="danger"
                      />
                    </Bento>
                    <Bento span={3} mobileSpan={6}>
                      <StatTile
                        layout="compact"
                        label="今日净额"
                        value={formatCNY(fin.realized_net)}
                        icon={fin.realized_net >= 0 ? 'checkmark-circle-outline' : 'close-circle-outline'}
                        color={fin.realized_net >= 0 ? COLORS.success : COLORS.danger}
                        tint={fin.realized_net >= 0 ? 'ok' : 'danger'}
                        hint="履约收入减当日支出"
                      />
                    </Bento>
                    <Bento span={3} mobileSpan={6}>
                      <StatTile
                        layout="compact"
                        label="待出餐"
                        value={`${pendingCount} 份`}
                        icon="time-outline"
                        color={COLORS.warning}
                        tint="warn"
                      />
                    </Bento>
                  </>
                )}
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
                  <View style={styles.reminderIconSlot}>
                    <IconAvatar
                      icon="alert-circle-outline"
                      color={COLORS.warning}
                      bg="rgba(255,149,0,0.18)"
                      size={38}
                    />
                  </View>
                  <View style={styles.reminderTextWrap}>
                    <Text style={styles.reminderTitle}>
                      {renewalCount} 位会员余餐不足
                    </Text>
                    <Text style={styles.reminderSub}>点击查看续卡跟进列表</Text>
                  </View>
                  <View style={styles.reminderChevronSlot}>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.warning}
                    />
                  </View>
                </PressableCard>
              </View>
            ) : null}

            {/* 快捷操作：首屏四项（会员 → 每日订餐 → 散客 → 出餐），其余收在分隔线下方 */}
            <View style={styles.block}>
              <SectionLabel>快捷操作</SectionLabel>
              <BentoGrid gap={SPACING.md}>
                {primaryShortcutKeys.map((key) =>
                  entriesByKey[key] ? (
                    <Bento key={key} span={6} mobileSpan={12}>
                      <QuickEntryCard entry={entriesByKey[key]!} compactPhone={isCompactPhone} />
                    </Bento>
                  ) : null,
                )}
              </BentoGrid>

              <View style={styles.shortcutsDividerWrap} accessibilityElementsHidden>
                <View style={styles.shortcutsDividerLine} />
              </View>

              <Pressable
                onPress={() => setMoreShortcutsOpen((v) => !v)}
                style={({ pressed }) => [styles.shortcutsMoreToggle, pressed && { opacity: 0.72 }]}
                accessibilityRole="button"
                accessibilityLabel={moreShortcutsOpen ? '收起更多快捷入口' : '展开更多快捷入口'}
              >
                <View style={styles.shortcutsMoreToggleRow}>
                  <Text style={styles.shortcutsMoreToggleText}>
                    {moreShortcutsOpen ? '收起' : '更多功能'}
                  </Text>
                  <Ionicons
                    name={moreShortcutsOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={COLORS.text.tertiary}
                  />
                </View>
                <Text style={styles.shortcutsMoreToggleHint}>
                  财务流水、订餐数据、员工名单与账号等
                </Text>
              </Pressable>

              {moreShortcutsOpen ? (
                <BentoGrid gap={SPACING.md}>
                  {moreShortcutKeys
                    .filter((key) => Boolean(entriesByKey[key]))
                    .map((key) => (
                      <Bento key={key} span={6} mobileSpan={12}>
                        <QuickEntryCard entry={entriesByKey[key]!} compact compactPhone={isCompactPhone} />
                      </Bento>
                    ))}
                </BentoGrid>
              ) : null}
            </View>
          </View>
      </ScrollView>
      <FloatingBottomBar>
        <View style={styles.segmentedBar}>
          <Pressable
            style={[styles.segment, todayQuickTab === 'summary' && styles.segmentActive]}
            onPress={() => setTodayQuickTab('summary')}
          >
            <View style={styles.segmentInner}>
              <Ionicons
                name="pie-chart-outline"
                size={18}
                color={todayQuickTab === 'summary' ? COLORS.brand : COLORS.text.tertiary}
              />
              <Text
                style={[
                  styles.segmentText,
                  todayQuickTab === 'summary' && styles.segmentTextActive,
                ]}
                numberOfLines={1}
              >
                汇总
              </Text>
            </View>
          </Pressable>
          <Pressable
            style={[styles.segment, todayQuickTab === 'fulfillment' && styles.segmentActive]}
            onPress={() => setTodayQuickTab('fulfillment')}
          >
            <View style={styles.segmentInner}>
              <Ionicons
                name="ribbon-outline"
                size={18}
                color={todayQuickTab === 'fulfillment' ? COLORS.brand : COLORS.text.tertiary}
              />
              <Text
                style={[
                  styles.segmentText,
                  todayQuickTab === 'fulfillment' && styles.segmentTextActive,
                ]}
                numberOfLines={1}
              >
                履约
              </Text>
            </View>
          </Pressable>
        </View>
      </FloatingBottomBar>
      </View>
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
        <Text
          style={[styles.entrySubtitle, (compact || compactPhone) && styles.entrySubtitleCompact]}
          numberOfLines={2}
        >
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
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
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
    marginBottom: 4,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  greetingHello: { ...TYPE.title1, color: COLORS.text.tertiary, fontWeight: '500' },
  greetingName: { ...TYPE.title1, color: COLORS.text.primary },

  block: { marginBottom: SPACING.lg },

  segmentedBar: {
    flexDirection: 'row',
    gap: 4,
    padding: 2,
    backgroundColor: 'transparent',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  segmentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentActive: {
    backgroundColor: 'rgba(118,118,128,0.16)',
  },
  segmentText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: '500',
    flexShrink: 1,
    minWidth: 0,
  },
  segmentTextActive: { color: COLORS.text.primary, fontWeight: '600' },

  /** 纵向：子项 stretch 到同一行高，各槽内 justifyContent:center 实现图标/文案/箭头垂直居中 */
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACING.sm,
  },
  reminderIconSlot: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTextWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  reminderTitle: {
    ...TYPE.headline,
    color: COLORS.text.primary,
    width: '100%',
  },
  reminderSub: {
    ...TYPE.footnote,
    color: COLORS.text.tertiary,
    marginTop: 2,
    width: '100%',
  },
  reminderChevronSlot: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  shortcutsDividerWrap: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  shortcutsDividerLine: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: COLORS.text.quaternary,
    borderRadius: 1,
  },
  shortcutsMoreToggle: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  shortcutsMoreToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shortcutsMoreToggleText: {
    ...TYPE.caption,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  shortcutsMoreToggleHint: {
    ...TYPE.footnote,
    color: COLORS.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
  },

  // entries
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
  entrySubtitleCompact: { fontSize: 12, lineHeight: 16 },
});
