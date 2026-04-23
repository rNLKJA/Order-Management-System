/**
 * 会员列表 — iOS 风格，含 mock data
 */

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../../theme/paperTheme';
import { MOCK_MEMBERS, type MockMember } from '../../../constants/mockData';
import { AppHeader, MeshBackground } from '../../../components/ui';

type MemberFilter = 'all' | 'hospital' | 'regular' | 'expired';

export default function MembersScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('all');

  const filtered = MOCK_MEMBERS.filter((m) => {
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

  const expiredCount = MOCK_MEMBERS.filter((m) => !m.active_card).length;

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <AppHeader
        title="会员档案"
        right={
          <Pressable
            onPress={() => router.push('/(app)/members/new')}
            style={styles.addBtn}
            hitSlop={8}
          >
            <Ionicons name="add" size={22} color={IOS_COLORS.blue} />
            <Text style={styles.addBtnText}>新增</Text>
          </Pressable>
        }
      />

      {/* 搜索框 */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={IOS_COLORS.labelSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索姓名、昵称、手机号..."
            placeholderTextColor={IOS_COLORS.labelTertiary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={IOS_COLORS.labelTertiary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 筛选标签 */}
      <View style={styles.filterRow}>
        {(['all', 'hospital', 'regular', 'expired'] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all'
                ? '全部'
                : f === 'hospital'
                ? '院内'
                : f === 'regular'
                ? '院外'
                : `已过期${expiredCount > 0 ? ` ${expiredCount}` : ''}`}
            </Text>
          </Pressable>
        ))}
        <Text style={styles.filterCount}>{filtered.length} 位</Text>
      </View>

      {/* 列表 */}
      <FlatList
        data={filtered}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <MemberRow member={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>—</Text>
            <Text style={styles.emptyText}>没有找到匹配的会员</Text>
          </View>
        }
      />
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
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/(app)/members/${member.id}` as never)}
    >
      {/* 头像 */}
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: expired
              ? '#F2F2F7'
              : member.is_hospital
              ? IOS_COLORS.blueLight
              : '#E8F8ED',
          },
        ]}
      >
        <Text style={[styles.avatarText, expired && { color: IOS_COLORS.labelTertiary }]}>
          {member.nickname?.[0] ?? member.name[0]}
        </Text>
      </View>

      {/* 主信息 */}
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.memberName}>
            {member.nickname ? `${member.nickname}` : member.name}
          </Text>
          {member.is_hospital && (
            <View style={styles.hospitalBadge}><Text style={styles.hospitalText}>院内</Text></View>
          )}
          {expired && (
            <View style={styles.expiredBadge}><Text style={styles.expiredText}>已过期</Text></View>
          )}
          {renewal && (
            <View style={styles.renewalBadge}><Text style={styles.renewalText}>续卡</Text></View>
          )}
        </View>

        <Text style={styles.memberSub}>{member.name} · {member.phone}</Text>

        {/* 卡片进度 / 过期状态 */}
        {card ? (
          <View style={styles.cardBar}>
            <Text style={styles.cardLabel}>{card.card_name}</Text>
            <View style={styles.progress}>
              <View style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: progressColor }]} />
            </View>
            <Text style={[styles.cardRemain, { color: progressColor }]}>
              剩 {card.remaining_meals} 餐
            </Text>
          </View>
        ) : (
          <Text style={styles.noCard}>
            {lastCard
              ? `上次：${lastCard.card_name} · 已用完`
              : '暂无购卡记录'}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color={IOS_COLORS.labelTertiary} style={styles.rowArrow} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },

  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 2 },
  addBtnText: { fontSize: 15, color: IOS_COLORS.blue, fontWeight: '500' },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: IOS_COLORS.fillLight,
    borderRadius: 10, paddingHorizontal: 10, height: 36, gap: 6,
  },
  searchIcon: { marginRight: 2 },
  searchInput: { flex: 1, fontSize: 15, color: IOS_COLORS.label },
  clearBtn: { fontSize: 16, color: IOS_COLORS.labelSecondary, padding: 4 },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: IOS_COLORS.fillLight,
  },
  filterChipActive: { backgroundColor: IOS_COLORS.blue },
  filterChipText: { fontSize: 13, color: IOS_COLORS.labelSecondary },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  filterCount: { marginLeft: 'auto', fontSize: 13, color: IOS_COLORS.labelSecondary },

  list: { paddingBottom: 32, paddingHorizontal: 12, gap: 8 },
  separator: { height: 0 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  rowPressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 20, fontWeight: '600', color: IOS_COLORS.blue },
  rowContent: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontSize: 16, fontWeight: '600', color: IOS_COLORS.label },
  hospitalBadge: {
    backgroundColor: IOS_COLORS.blueLight,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  hospitalText: { fontSize: 11, color: IOS_COLORS.blue, fontWeight: '600' },
  renewalBadge: {
    backgroundColor: '#FFF4E5',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  renewalText: { fontSize: 11, color: IOS_COLORS.orange, fontWeight: '600' },
  expiredBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  expiredText: { fontSize: 11, color: IOS_COLORS.labelSecondary, fontWeight: '600' },
  memberSub: { fontSize: 13, color: IOS_COLORS.labelSecondary },
  cardBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  cardLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary, width: 32 },
  progress: { flex: 1, height: 4, backgroundColor: IOS_COLORS.fillMedium, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  cardRemain: { fontSize: 12, fontWeight: '600', width: 42, textAlign: 'right' },
  noCard: { fontSize: 13, color: IOS_COLORS.labelTertiary },
  rowArrow: { marginLeft: 2 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 16, color: IOS_COLORS.labelSecondary },
});
