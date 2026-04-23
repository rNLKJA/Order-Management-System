/**
 * 每日订餐 — 今日视图（午/晚分组）
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { IOS_COLORS } from '../../../theme/paperTheme';
import { MOCK_TODAY_ORDERS, type MockOrder } from '../../../constants/mockData';

const STATUS_MAP = {
  pending: { label: '待出餐', color: IOS_COLORS.orange, bg: '#FFF4E5' },
  fulfilled: { label: '已出餐', color: IOS_COLORS.blue, bg: IOS_COLORS.blueLight },
  delivered: { label: '已送达', color: '#34C759', bg: '#E8F8ED' },
  cancelled: { label: '已取消', color: IOS_COLORS.labelSecondary, bg: IOS_COLORS.fillLight },
};

export default function OrdersScreen() {
  const [date] = useState('2026-04-23');
  const [mealFilter, setMealFilter] = useState<'all' | 'lunch' | 'dinner'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'fulfilled' | 'delivered' | 'cancelled'>('all');

  const filtered = MOCK_TODAY_ORDERS.filter((o) => {
    if (mealFilter !== 'all' && o.meal_type !== mealFilter) return false;
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    return true;
  });

  const lunch = filtered.filter((o) => o.meal_type === 'lunch');
  const dinner = filtered.filter((o) => o.meal_type === 'dinner');

  const sections = [
    ...(lunch.length > 0 ? [{ title: '午餐', data: lunch }] : []),
    ...(dinner.length > 0 ? [{ title: '晚餐', data: dinner }] : []),
  ];

  const pending = MOCK_TODAY_ORDERS.filter((o) => o.status === 'pending').length;
  const totalLunch = MOCK_TODAY_ORDERS.filter((o) => o.meal_type === 'lunch')
    .reduce((sum, o) => sum + o.quantity, 0);
  const totalDinner = MOCK_TODAY_ORDERS.filter((o) => o.meal_type === 'dinner')
    .reduce((sum, o) => sum + o.quantity, 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* 导航栏 */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ 返回</Text>
        </Pressable>
        <View>
          <Text style={styles.navTitle}>每日订餐</Text>
          <Text style={styles.navDate}>今日 4月23日</Text>
        </View>
        <Pressable>
          <Text style={styles.addBtn}>+ 录入</Text>
        </Pressable>
      </View>

      {/* 今日汇总条 */}
      <View style={styles.summaryBar}>
        <SummaryItem label="午餐" value={`${totalLunch}份`} color={IOS_COLORS.blue} />
        <View style={styles.summaryDivider} />
        <SummaryItem label="晚餐" value={`${totalDinner}份`} color="#AF52DE" />
        <View style={styles.summaryDivider} />
        <SummaryItem label="待出餐" value={`${pending}份`} color={IOS_COLORS.orange} />
        <View style={styles.summaryDivider} />
        <SummaryItem label="总计" value={`${totalLunch + totalDinner}份`} color={IOS_COLORS.label} />
      </View>

      {/* 筛选条 */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          {(['all', 'lunch', 'dinner'] as const).map((v) => (
            <Pressable
              key={v}
              style={[styles.chip, mealFilter === v && styles.chipActive]}
              onPress={() => setMealFilter(v)}
            >
              <Text style={[styles.chipText, mealFilter === v && styles.chipTextActive]}>
                {v === 'all' ? '全部' : v === 'lunch' ? '午餐' : '晚餐'}
              </Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          {(['all', 'pending', 'fulfilled', 'delivered'] as const).map((v) => (
            <Pressable
              key={v}
              style={[styles.chip, statusFilter === v && styles.chipStatusActive]}
              onPress={() => setStatusFilter(v)}
            >
              <Text style={[styles.chipText, statusFilter === v && styles.chipTextActive]}>
                {v === 'all' ? '全部状态' : STATUS_MAP[v].label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 订单列表 */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTitle}>
              {section.title === '午餐' ? '🌤 午餐' : '🌙 晚餐'}
            </Text>
            <Text style={styles.sectionCount}>
              {section.data.reduce((s, o) => s + o.quantity, 0)} 份
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <OrderRow
            order={item}
            isLast={index === section.data.length - 1}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>暂无订餐记录</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function OrderRow({ order, isLast }: { order: MockOrder; isLast: boolean }) {
  const s = STATUS_MAP[order.status];
  const isAdhoc = !order.card_type;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.orderRow,
        isLast && styles.orderRowLast,
        pressed && { backgroundColor: IOS_COLORS.fillLight },
      ]}
    >
      {/* 左侧：会员信息 */}
      <View style={[styles.orderAvatar, { backgroundColor: order.is_hospital ? IOS_COLORS.blueLight : '#E8F8ED' }]}>
        <Text style={styles.orderAvatarText}>
          {order.member_nickname?.[0] ?? order.member_name[0]}
        </Text>
      </View>

      <View style={styles.orderContent}>
        <View style={styles.orderTop}>
          <Text style={styles.orderName}>
            {order.member_nickname || order.member_name}
          </Text>
          {order.is_hospital && (
            <View style={styles.hospitalBadge}><Text style={styles.hospitalText}>院内</Text></View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
            <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
          </View>
        </View>

        {/* 卡/散餐类型 */}
        <View style={styles.orderMeta}>
          {isAdhoc ? (
            <Text style={styles.adhocTag}>散餐 ¥{order.amount}</Text>
          ) : (
            <Text style={styles.cardTag}>{order.card_type}</Text>
          )}
          <Text style={styles.orderQty}>{order.quantity} 份</Text>
        </View>

        {/* 忌口 / 备注 */}
        {order.dietary_notes ? (
          <Text style={styles.orderNote}>忌：{order.dietary_notes}</Text>
        ) : null}
        {order.notes ? (
          <Text style={styles.orderNote}>备注：{order.notes}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: IOS_COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  backText: { fontSize: 17, color: IOS_COLORS.blue, width: 60 },
  navTitle: { fontSize: 16, fontWeight: '600', color: IOS_COLORS.label, textAlign: 'center' },
  navDate: { fontSize: 12, color: IOS_COLORS.labelSecondary, textAlign: 'center' },
  addBtn: { fontSize: 17, color: IOS_COLORS.blue, width: 60, textAlign: 'right' },

  summaryBar: {
    flexDirection: 'row', backgroundColor: IOS_COLORS.card,
    paddingVertical: 14, paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  summaryLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: IOS_COLORS.separatorLight, marginVertical: 4 },

  filterSection: {
    backgroundColor: IOS_COLORS.card,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16,
    backgroundColor: IOS_COLORS.fillLight,
  },
  chipActive: { backgroundColor: IOS_COLORS.blue },
  chipStatusActive: { backgroundColor: '#34C759' },
  chipText: { fontSize: 13, color: IOS_COLORS.labelSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: IOS_COLORS.systemGrouped,
  },
  sectionHeaderTitle: { fontSize: 16, fontWeight: '700', color: IOS_COLORS.label },
  sectionCount: { fontSize: 14, color: IOS_COLORS.labelSecondary },

  orderRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: IOS_COLORS.card, paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: IOS_COLORS.separatorLight,
  },
  orderRowLast: { borderBottomWidth: 0 },

  orderAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  orderAvatarText: { fontSize: 18, fontWeight: '600', color: IOS_COLORS.blue },
  orderContent: { flex: 1, gap: 4 },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  orderName: { fontSize: 15, fontWeight: '600', color: IOS_COLORS.label },
  hospitalBadge: { backgroundColor: IOS_COLORS.blueLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  hospitalText: { fontSize: 11, color: IOS_COLORS.blue, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' },
  orderMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTag: { fontSize: 12, color: IOS_COLORS.labelSecondary, backgroundColor: IOS_COLORS.fillLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  adhocTag: { fontSize: 12, color: '#FF9500', backgroundColor: '#FFF4E5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  orderQty: { fontSize: 14, fontWeight: '600', color: IOS_COLORS.label },
  orderNote: { fontSize: 13, color: IOS_COLORS.orange, lineHeight: 18 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 16, color: IOS_COLORS.labelSecondary },
});
