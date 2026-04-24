/**
 * 会员列表（正式会员）— v3 Glass + Bento。
 */

import { useMemo, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { type MockMember } from '../../../constants/mockData';
import { useMembersViewWithLimit } from '../../../hooks/useMembersView';
import {
  AppHeader,
  MeshBackground,
  GlassSurface,
  SectionLabel,
  BentoGrid,
  Bento,
  StatTile,
  PressableCard,
  StatusChip,
  IconAvatar,
} from '../../../components/ui';
import { COLORS, SPACING, TYPE } from '../../../theme/paperTheme';

type MemberFilter = 'all' | 'hospital' | 'regular' | 'expired';
const LIMIT_OPTIONS = [10, 50, 100, 200] as const;
type LimitOption = (typeof LIMIT_OPTIONS)[number];

export default function MembersScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [limit, setLimit] = useState<LimitOption>(50);

  const { data, isLoading, error, refetch } = useMembersViewWithLimit(limit);
  // 会员档案只显示正式会员，散客走 /walkins 独立目录
  const members = (data ?? []).filter((m) => !m.is_walkin);

  const filtered = members.filter((m) => {
    const q = query.toLowerCase();
    const matchQ = !q || [m.name, m.nickname, m.phone, m.wechat_id, m.uid]
      .some((v) => v.toLowerCase().includes(q));
    const matchFilter =
      filter === 'all' ||
      (filter === 'hospital' && m.is_hospital) ||
      (filter === 'regular' && !m.is_hospital) ||
      (filter === 'expired' && !m.active_card);
    return matchQ && matchFilter;
  });

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
            <Pressable onPress={() => router.push('/(app)/members/new')} style={styles.addBtn} hitSlop={8}>
              <Ionicons name="add" size={22} color={COLORS.brand} />
              <Text style={styles.addBtnText}>新增</Text>
            </Pressable>
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={undefined}
        >
          <View style={styles.container}>
            <View style={styles.block}>
              <SectionLabel>概览</SectionLabel>
              <BentoGrid gap={SPACING.md}>
                <Bento span={3} mobileSpan={6}>
                  <StatTile label="总会员" value={`${members.length}`} icon="people-outline" color={COLORS.brand} tint="info" />
                </Bento>
                <Bento span={3} mobileSpan={6}>
                  <StatTile label="院内" value={`${hospitalCount}`} icon="business-outline" color={COLORS.info} tint="warn" />
                </Bento>
                <Bento span={3} mobileSpan={6}>
                  <StatTile label="院外" value={`${regularCount}`} icon="home-outline" color={COLORS.success} tint="ok" />
                </Bento>
                <Bento span={3} mobileSpan={6}>
                  <StatTile label="需续卡" value={`${expiredCount}`} icon="alert-circle-outline" color={COLORS.warning} tint="danger" />
                </Bento>
              </BentoGrid>
            </View>

            <View style={styles.block}>
              <SectionLabel>筛选</SectionLabel>
              <GlassSurface padding={SPACING.md} style={styles.filterCard}>
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
                <View style={styles.filterRow}>
                  {(['all', 'hospital', 'regular', 'expired'] as const).map((f) => (
                    <Pressable key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => setFilter(f)}>
                      <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                        {f === 'all' ? '全部' : f === 'hospital' ? '院内' : f === 'regular' ? '院外' : '需续卡'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.limitRow}>
                  <Text style={styles.limitLabel}>每次加载</Text>
                  {LIMIT_OPTIONS.map((n) => (
                    <Pressable key={n} style={[styles.limitChip, limit === n && styles.limitChipActive]} onPress={() => setLimit(n)}>
                      <Text style={[styles.limitChipText, limit === n && styles.limitChipTextActive]}>{n}</Text>
                    </Pressable>
                  ))}
                  <Text style={styles.filterCount}>{filtered.length} 位</Text>
                </View>
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
  block: { marginBottom: SPACING.lg },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 2 },
  addBtnText: { ...TYPE.body, color: COLORS.brand, fontWeight: '600' },

  filterCard: { gap: SPACING.sm },
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
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.systemGrouped },
  filterChipActive: { backgroundColor: COLORS.brand },
  filterChipText: { ...TYPE.caption, color: COLORS.text.tertiary, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  limitLabel: { ...TYPE.caption, color: COLORS.text.tertiary, marginRight: 4 },
  limitChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: COLORS.systemGrouped },
  limitChipActive: { backgroundColor: COLORS.brandSoft },
  limitChipText: { ...TYPE.caption, color: COLORS.text.tertiary, fontWeight: '600' },
  limitChipTextActive: { color: COLORS.brand },
  filterCount: { marginLeft: 'auto', ...TYPE.caption, color: COLORS.text.tertiary },

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
