/**
 * 余餐不足提醒 — v3 玻璃 + Bento。
 */

import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPE } from '../../../theme/paperTheme';
import { MOCK_MEMBERS, type MockMember } from '../../../constants/mockData';
import {
  AppHeader,
  GlassSurface,
  IconAvatar,
  MeshBackground,
  PressableCard,
  StatusChip,
} from '../../../components/ui';

function membersLowBalance(): MockMember[] {
  return MOCK_MEMBERS.filter(
    (m) => m.active_card && m.active_card.remaining_meals <= 2,
  );
}

export default function RemindersScreen() {
  const list = membersLowBalance();

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.container}>
          <AppHeader title="余餐不足提醒" subtitle={`共 ${list.length} 人需跟进`} />

          <GlassSurface
            tint="warn"
            padding={SPACING.base}
            style={styles.hint}
          >
            <View style={styles.hintRow}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={COLORS.warning}
              />
              <Text style={styles.hintText}>
                以下会员剩余餐数小于等于 2，建议联系续卡或升级。
              </Text>
            </View>
          </GlassSurface>

          <FlatList
            data={list}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <GlassSurface padding={SPACING.xl} style={styles.empty}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={32}
                  color={COLORS.success}
                />
                <Text style={styles.emptyTitle}>暂无需要跟进的会员</Text>
                <Text style={styles.emptySub}>所有会员余餐均高于 2 份</Text>
              </GlassSurface>
            }
            renderItem={({ item }) => {
              const c = item.active_card!;
              return (
                <PressableCard
                  padding={SPACING.base}
                  onPress={() =>
                    router.push(`/(app)/members/${item.id}` as never)
                  }
                  style={styles.row}
                >
                  <IconAvatar
                    icon="person-outline"
                    color={COLORS.warning}
                    bg="rgba(255,149,0,0.15)"
                    size={40}
                  />
                  <View style={styles.rowMain}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{item.nickname || item.name}</Text>
                      <StatusChip
                        label={`剩 ${c.remaining_meals}`}
                        variant="warning"
                        dot
                      />
                    </View>
                    <Text style={styles.uid} numberOfLines={1}>
                      {item.uid}
                    </Text>
                    <Text style={styles.meals}>
                      {c.card_name} · {c.remaining_meals}/{c.total_meals} 份
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.text.quaternary}
                  />
                </PressableCard>
              );
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: SPACING.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: SPACING.page,
  },
  hint: { marginTop: SPACING.sm, marginBottom: SPACING.md },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  hintText: { ...TYPE.footnote, color: COLORS.text.secondary, flex: 1 },
  listContent: { paddingBottom: 32, gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowMain: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 2 },
  name: { ...TYPE.headline, color: COLORS.text.primary },
  uid: { ...TYPE.footnote, color: COLORS.text.tertiary },
  meals: { ...TYPE.footnote, color: COLORS.warning, marginTop: 2 },
  empty: { alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.lg },
  emptyTitle: { ...TYPE.headline, color: COLORS.text.primary },
  emptySub: { ...TYPE.footnote, color: COLORS.text.tertiary, textAlign: 'center' },
});
