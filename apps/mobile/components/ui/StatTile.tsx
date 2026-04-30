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
      <View style={styles.iconSlot}>
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={color ?? COLORS.text.tertiary}
          />
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <Text
        style={[styles.value, color ? { color } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {value}
      </Text>
      <View style={styles.hintSlot}>
        {hint ? (
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 160,
    width: '100%',
  },
  iconSlot: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  label: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    lineHeight: 17,
    width: '100%',
    minHeight: 34,
  },
  value: {
    ...TYPE.title2,
    color: COLORS.text.primary,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    width: '100%',
    marginTop: 4,
    minHeight: 30,
  },
  hintSlot: {
    width: '100%',
    minHeight: 32,
    marginTop: 4,
    justifyContent: 'flex-start',
  },
  hint: {
    ...TYPE.caption,
    color: COLORS.text.quaternary,
    textAlign: 'center',
    lineHeight: 15,
    width: '100%',
  },
});
