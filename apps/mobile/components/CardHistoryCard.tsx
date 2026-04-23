/**
 * 卡历史记录卡片 - MEA-14。
 *
 * 展示会员所有历史卡（active / upgraded / exhausted），每条显示：
 * - 卡种名称 + 状态 Badge（进行中 / 已升级 / 已用完）
 * - 总餐 / 已用 / 剩余 / 金额 / 购卡日期
 * - 升级来源（若有则显示"升级自 #ID"）
 */

import { View, StyleSheet } from 'react-native';
import { Card, Chip, Text, ProgressBar, useTheme } from 'react-native-paper';
import { getCardSpec } from '@meal/shared';
import type { Card as CardModel } from '../api/cards';
import { formatDateTime } from '@meal/shared';

interface CardHistoryCardProps {
  cards: CardModel[];
}

export function CardHistoryCard({ cards }: CardHistoryCardProps) {
  const theme = useTheme();

  if (cards.length === 0) {
    return (
      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            订阅记录
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            暂无订阅记录
          </Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          订阅记录（共 {cards.length} 张）
        </Text>
        {cards.map((card, index) => (
          <CardHistoryItem key={card.id} card={card} isLast={index === cards.length - 1} />
        ))}
      </Card.Content>
    </Card>
  );
}

function CardHistoryItem({ card, isLast }: { card: CardModel; isLast: boolean }) {
  const theme = useTheme();
  const spec = getCardSpec(card.is_hospital, card.card_code);
  const cardName = spec?.name ?? card.card_code;
  const progress = card.total_meals > 0 ? card.used_meals / card.total_meals : 0;

  const statusLabel =
    card.status === 'active'
      ? '进行中'
      : card.status === 'upgraded'
        ? '已升级'
        : '已用完';

  const statusColor =
    card.status === 'active'
      ? theme.colors.primary
      : card.status === 'upgraded'
        ? theme.colors.secondary
        : theme.colors.error;

  return (
    <View style={[styles.item, !isLast && styles.itemBorder]}>
      <View style={styles.itemHeader}>
        <Text variant="bodyLarge" style={styles.cardName}>
          {cardName}
          {card.is_hospital ? '（院内）' : '（院外）'}
        </Text>
        <Chip
          compact
          style={[styles.statusChip, { backgroundColor: `${statusColor}20` }]}
          textStyle={{ color: statusColor, fontSize: 11 }}
        >
          {statusLabel}
        </Chip>
      </View>

      {card.status === 'active' && (
        <ProgressBar
          progress={progress}
          color={theme.colors.primary}
          style={styles.progressBar}
        />
      )}

      <View style={styles.itemStats}>
        <StatPair label="总餐" value={`${card.total_meals} 餐`} />
        <StatPair label="已用" value={`${card.used_meals} 餐`} />
        <StatPair label="剩余" value={`${card.remaining_meals} 餐`} />
        <StatPair
          label="金额"
          value={`¥${card.paid_amount.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`}
        />
      </View>

      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        购卡：{formatDateTime(new Date(card.purchased_at))}
      </Text>

      {card.upgraded_from_id != null && (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          升级自 #{card.upgraded_from_id}
        </Text>
      )}
    </View>
  );
}

function StatPair({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.statPair}>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12 },
  sectionTitle: { fontWeight: '600', marginBottom: 12 },
  item: {
    paddingVertical: 12,
    gap: 6,
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: { fontWeight: '600', flex: 1 },
  statusChip: { marginLeft: 8 },
  progressBar: { height: 6, borderRadius: 3, marginVertical: 4 },
  itemStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statPair: {
    alignItems: 'center',
    minWidth: 56,
  },
});
