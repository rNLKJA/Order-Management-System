/**
 * 分组小标题（全大写、灰、小字）。
 */

import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING, TYPE } from '../../theme/paperTheme';

export type SectionLabelProps = {
  children: string;
  align?: 'left' | 'center';
};

export function SectionLabel({ children, align = 'left' }: SectionLabelProps) {
  return (
    <Text style={[styles.label, align === 'center' && styles.labelCenter]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
    paddingHorizontal: 4,
    marginBottom: SPACING.sm,
  },
  labelCenter: {
    textAlign: 'center',
    width: '100%',
    alignSelf: 'center',
  },
});
