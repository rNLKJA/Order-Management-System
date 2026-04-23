/**
 * 统一状态标签，见 DESIGN.md §2 / §8。
 * variant 对应 CHIP 预设；也可自定义 fg/bg。
 */

import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { CHIP, RADIUS, TYPE } from '../../theme/paperTheme';

type Variant = keyof typeof CHIP;

export interface StatusChipProps {
  label: string;
  variant?: Variant;
  fg?: string;
  bg?: string;
  /** 是否显示左侧小圆点（适合订单状态） */
  dot?: boolean;
  style?: ViewStyle;
}

export function StatusChip({ label, variant = 'neutral', fg, bg, dot = false, style }: StatusChipProps) {
  const color = fg ?? CHIP[variant].fg;
  const background = bg ?? CHIP[variant].bg;
  return (
    <View style={[styles.chip, { backgroundColor: background }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { ...TYPE.caption, fontWeight: '600' },
});
