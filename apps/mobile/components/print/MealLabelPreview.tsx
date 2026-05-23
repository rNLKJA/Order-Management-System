import { View, Text, StyleSheet } from 'react-native';
import { IOS_COLORS } from '../../theme/paperTheme';
import type { MealLabelData } from '../../lib/print';

export function MealLabelPreview({ label }: { label: MealLabelData }) {
  return (
    <View style={styles.card}>
      <Text style={styles.shop}>{label.shopName}</Text>
      <View style={styles.rule} />
      <Text style={styles.mealType}>{label.mealTypeLabel}</Text>
      <Text style={styles.mainLine}>
        {label.customerName} · {label.quantity} 份
      </Text>
      {label.tags.length > 0 ? (
        <Text style={styles.tags}>{label.tags.join('  ')}</Text>
      ) : null}
      {label.dietaryNotes ? (
        <Text style={styles.note}>忌口：{label.dietaryNotes}</Text>
      ) : null}
      {label.orderNotes ? (
        <Text style={styles.note}>备注：{label.orderNotes}</Text>
      ) : null}
      <Text style={styles.footer}>
        #{label.orderId} · {label.orderDate}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    maxWidth: 280,
    alignSelf: 'center',
    width: '100%',
  },
  shop: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: IOS_COLORS.label,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(17,17,17,0.2)',
    marginVertical: 2,
  },
  mealType: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    color: IOS_COLORS.label,
  },
  mainLine: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    color: IOS_COLORS.label,
  },
  tags: {
    fontSize: 13,
    textAlign: 'center',
    color: IOS_COLORS.blue,
    fontWeight: '600',
  },
  note: {
    fontSize: 13,
    color: '#8A5A00',
    lineHeight: 18,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    color: IOS_COLORS.labelSecondary,
    marginTop: 4,
  },
});
