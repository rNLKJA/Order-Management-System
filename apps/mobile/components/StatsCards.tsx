/**
 * 会员累计数据卡 - MEA-14。
 *
 * 展示三个指标：累计购买餐数 / 累计消费餐数 / 累计消费金额。
 */

import { View, StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

interface StatsCardsProps {
  totalPurchasedMeals: number;
  totalConsumedMeals: number;
  totalPaidAmount: number;
}

export function StatsCards({
  totalPurchasedMeals,
  totalConsumedMeals,
  totalPaidAmount,
}: StatsCardsProps) {
  const theme = useTheme();

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          累计数据
        </Text>
        <View style={styles.grid}>
          <StatCell
            label="累计购买餐数"
            value={`${totalPurchasedMeals} 餐`}
            color={theme.colors.primary}
          />
          <StatCell
            label="累计消费餐数"
            value={`${totalConsumedMeals} 餐`}
            color={theme.colors.secondary}
          />
          <StatCell
            label="累计消费金额"
            value={`¥${totalPaidAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            color={theme.colors.tertiary ?? theme.colors.primary}
          />
        </View>
      </Card.Content>
    </Card>
  );
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.cell, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Text variant="headlineSmall" style={[styles.cellValue, { color }]}>
        {value}
      </Text>
      <Text
        variant="bodySmall"
        style={[styles.cellLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12 },
  sectionTitle: { fontWeight: '600', marginBottom: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    flex: 1,
    minWidth: 100,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cellValue: {
    fontWeight: '700',
    textAlign: 'center',
  },
  cellLabel: {
    marginTop: 4,
    textAlign: 'center',
  },
});
