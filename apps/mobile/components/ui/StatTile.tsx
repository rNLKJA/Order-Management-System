/**
 * 速览格：label + value（居中，等宽数字）。
 * 可选 icon（Ionicons outline）与 trend 颜色。
 */

import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { COLORS, SPACING, TYPE } from '../../theme/paperTheme';

export interface StatTileProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  tint?: 'info' | 'warn' | 'ok' | 'danger';
  hint?: string;
}

export function StatTile({ label, value, icon, color, tint, hint }: StatTileProps) {
  return (
    <GlassSurface level={1} tint={tint} padding={SPACING.base} style={styles.tile}>
      <View style={styles.row}>
        {icon ? (
          <Ionicons
            name={icon}
            size={16}
            color={color ?? COLORS.text.tertiary}
            style={styles.icon}
          />
        ) : null}
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      <Text
        style={[styles.value, color ? { color } : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {hint ? <Text style={styles.hint} numberOfLines={1}>{hint}</Text> : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', minHeight: 86 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  icon: {},
  label: { ...TYPE.caption, color: COLORS.text.tertiary, textAlign: 'center' },
  value: {
    ...TYPE.title2,
    color: COLORS.text.primary,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  hint: { ...TYPE.caption, color: COLORS.text.quaternary, marginTop: 2, textAlign: 'center' },
});
