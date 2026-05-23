/**
 * 会员列表（正式会员）— v3 Glass + Bento。
 */

import { useMemo, useRef, useState, useDeferredValue } from 'react';
import { View, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { type MockMember } from '../../../constants/mockData';
import { useMembersViewWithLimit } from '../../../hooks/useMembersView';
import {
  AppHeader,
  HeaderTextAction,
  MeshBackground,
  GlassSurface,
  SectionLabel,
  PressableCard,
  StatusChip,
  IconAvatar,
} from '../../../components/ui';
import { COLORS, SPACING, TYPE } from '../../../theme/paperTheme';
import { useScrollToTopOnFocus } from '../../../hooks/useScrollToTopOnFocus';

type MemberFilter = 'all' | 'hospital' | 'regular' | 'expired';

/** 与 GET /api/members 上限一致；不再展示「每次加载」选择，避免小批量 + 本地筛选漏人 */
const MEMBERS_LIST_LIMIT = 500;

export default function MembersScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(scrollRef);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('all');

  const normalizedQuery = query.trim().normalize('NFC');
  const deferredServerQ = useDeferredValue(normalizedQuery);
  const qLower = normalizedQuery.toLowerCase();

  const { data, isLoading, error, refetch } = useMembersViewWithLimit(MEMBERS_LIST_LIMIT, deferredServerQ);
  // 会员档案只显示正式会员，散客走 /walkins 独立目录
  const members = (data ?? []).filter((m) => !m.is_walkin);

  const isSearchMode = normalizedQuery.length > 0;

  const filtered = useMemo(() => {
    const list = members.filter((m) => {
      const matchQ =
        !normalizedQuery ||
        [m.name, m.nickname, m.phone, m.wechat_id, m.uid].some((v) =>
          v.normalize('NFC').toLowerCase().includes(qLower),
        );
      const matchFilter =
        filter === 'all' ||
        (filter === 'hospital' && m.is_hospital) ||
        (filter === 'regular' && !m.is_hospital) ||
        (filter === 'expired' && !m.active_card);
      return matchQ && matchFilter;
    });
    list.sort((a, b) => {
      const aNeed = !a.active_card ? 1 : 0;
      const bNeed = !b.active_card ? 1 : 0;
      if (bNeed !== aNeed) return bNeed - aNeed;
      return a.id - b.id;
    });
    return list;
  }, [members, normalizedQuery, qLower, filter]);

  const expiredCount = members.filter((m) => !m.active_card).length;
  const hospitalCount = useMemo(() => members.filter((m) => m.is_hospital).length, [members]);
  const regularCount = members.length - hospitalCount;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader
          title="会员档案"
          right={
            <HeaderTextAction
              label="新增"
              icon="add"
              onPress={() => router.push('/(app)/members/new')}
            />
          }
        />

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={undefined}
        >
          <View style={styles.container}>
            <View style={styles.block}>
              <SectionLabel>筛选</SectionLabel>
              <GlassSurface padding={SPACING.md} style={styles.filterCard}>
                <View style={styles.statsRow}>
                  <MemberStatCell
                    label={isSearchMode ? '搜索' : '总会员'}
                    value={members.length}
                    color={COLORS.brand}
                    active={filter === 'all'}
                    onPress={() => setFilter('all')}
                  />
                  <View style={styles.statDivider} />
                  <MemberStatCell
                    label="院内"
                    value={hospitalCount}
                    color={COLORS.info}
                    active={filter === 'hospital'}
                    onPress={() => setFilter('hospital')}
                  />
                  <View style={styles.statDivider} />
                  <MemberStatCell
                    label="院外"
                    value={regularCount}
                    color={COLORS.success}
                    active={filter === 'regular'}
                    onPress={() => setFilter('regular')}
                  />
                  <View style={styles.statDivider} />
                  <MemberStatCell
                    label="需续卡"
                    value={expiredCount}
                    color={COLORS.warning}
                    active={filter === 'expired'}
                    onPress={() => setFilter('expired')}
                  />
                </View>
                <View style={styles.statsFilterDivider} />
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={16} color={COLORS.text.tertiary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="搜索姓名、昵称、手机号..."
                    placeholderTextColor={COLORS.text.quaternary}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                  />
                  {query ? (
                    <Pressable onPress={() => setQuery('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={COLORS.text.quaternary} />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.listSortHint}>无有效餐卡的会员排在前面，便于点开续卡。</Text>
              </GlassSurface>
            </View>

            <View style={styles.block}>
              <SectionLabel>{`会员列表 · ${filtered.length}`}</SectionLabel>
              {isLoading ? (
                <View style={styles.empty}>
                  <ActivityIndicator color={COLORS.brand} />
                  <Text style={styles.emptyText}>加载中...</Text>
                </View>
              ) : error ? (
                <GlassSurface padding={SPACING.base} tint="danger" style={styles.emptyCard}>
                  <Text style={styles.emptyError}>加载失败：{error.message}</Text>
                  <Pressable onPress={() => void refetch()}>
                    <Text style={styles.retryLink}>重试</Text>
                  </Pressable>
                </GlassSurface>
              ) : filtered.length === 0 ? (
                <GlassSurface padding={SPACING.base} style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    {members.length === 0 ? '还没有会员，点击右上角“新增”开始。' : '没有找到匹配的会员。'}
                  </Text>
                </GlassSurface>
              ) : (
                filtered.map((item) => <MemberRow key={item.id} member={item} />)
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MemberStatCell({
  label,
  value,
  color,
  active,
  onPress,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCell,
        active && styles.statCellActive,
        pressed && !active && { opacity: 0.72 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, active && styles.statLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function MemberRow({ member }: { member: MockMember }) {
  const card = member.active_card;
  const expired = !card;
  const renewal = card && card.remaining_meals <= 2;
  const progressPct = card ? (card.remaining_meals / card.total_meals) * 100 : 0;
  const progressColor = progressPct > 50 ? '#34C759' : progressPct > 20 ? '#FF9500' : '#FF3B30';
  const lastCard = member.card_history[member.card_history.length - 1];

  return (
    <PressableCard
      style={styles.row}
      onPress={() => router.push(`/(app)/members/${member.id}` as never)}
      padding={SPACING.base}
    >
      <IconAvatar
        icon="person-outline"
        size={50}
        bg={expired ? COLORS.systemGrouped : member.is_hospital ? COLORS.brandSoft : '#E8F8ED'}
        color={expired ? COLORS.text.tertiary : member.is_hospital ? COLORS.brand : COLORS.success}
      />
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.memberName}>
            {member.nickname ? `${member.nickname}` : member.name}
          </Text>
          <StatusChip label={member.is_hospital ? '院内' : '院外'} variant={member.is_hospital ? 'hospital' : 'regular'} />
          {expired ? <StatusChip label="需续卡" variant="warning" /> : null}
          {renewal ? <StatusChip label="临界" variant="danger" /> : null}
        </View>
        <Text style={styles.memberSub}>{member.name} · {member.phone}</Text>
        <Text style={styles.memberMeta} numberOfLines={1}>
          UID {member.uid}
          {member.wechat_id ? ` · 微信 ${member.wechat_id}` : ''}
        </Text>
        {card ? (
          <Text style={styles.cardInfo}>
            {card.card_name} · 剩余 {card.remaining_meals}/{card.total_meals} 份
          </Text>
        ) : (
          <Text style={styles.noCard}>{lastCard ? `上次：${lastCard.card_name} · 已用完` : '暂无购卡记录'}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.text.quaternary} style={styles.rowArrow} />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  scroll: { paddingBottom: 32 },
  container: {
    width: '100%',
    maxWidth: SPACING.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: SPACING.page,
  },
  block: { marginBottom: SPACING.md },
  filterCard: { gap: SPACING.sm },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 10,
  },
  statCellActive: {
    backgroundColor: COLORS.brandSoft,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    fontWeight: '600',
  },
  statLabelActive: {
    color: COLORS.brand,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 4,
  },
  statsFilterDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.systemGrouped,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
  },
  searchInput: { flex: 1, ...TYPE.body, color: COLORS.text.primary },
  listSortHint: {
    ...TYPE.caption,
    color: COLORS.text.quaternary,
    marginTop: 4,
    lineHeight: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  rowContent: { flex: 1, gap: 4, minWidth: 0, marginLeft: SPACING.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  memberName: { ...TYPE.headline, color: COLORS.text.primary },
  memberSub: { ...TYPE.caption, color: COLORS.text.tertiary },
  memberMeta: { ...TYPE.caption, color: COLORS.text.quaternary, marginTop: 1 },
  cardInfo: { ...TYPE.caption, color: COLORS.text.secondary, fontVariant: ['tabular-nums'] },
  noCard: { ...TYPE.caption, color: COLORS.text.quaternary },
  rowArrow: { marginLeft: 4 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyCard: { alignItems: 'center', gap: 8 },
  emptyText: { ...TYPE.body, color: COLORS.text.tertiary, textAlign: 'center' },
  emptyError: { ...TYPE.body, color: COLORS.danger, textAlign: 'center' },
  retryLink: { ...TYPE.body, color: COLORS.brand, fontWeight: '600' },
});
