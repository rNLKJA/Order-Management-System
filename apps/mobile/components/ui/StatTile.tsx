/**
 * 速览格：label + value（居中，等宽数字）。
 * 可选 icon（Ionicons outline）与 trend 颜色。
 * `layout="compact"`：图标与标题同一行，适合统计页多格并排。
 */

import { memo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { BREAKPOINT, COLORS, SPACING, TYPE } from '../../theme/paperTheme';

export interface StatTileProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  tint?: 'info' | 'warn' | 'ok' | 'danger';
  hint?: string;
  /** 紧凑：首行「图标 + 标题」横向排列，整体高度更低 */
  layout?: 'stacked' | 'compact';
}

function StatTileInner({
  label,
  value,
  icon,
  color,
  tint,
  hint,
  layout = 'stacked',
}: StatTileProps) {
  const { width } = useWindowDimensions();
  const narrow = width < BREAKPOINT.xs;
  const veryNarrow = width < 360;
  const compact = layout === 'compact';

  const baseValue = veryNarrow ? 22 : narrow ? 26 : 32;
  const valueFontSize = compact ? Math.max(18, baseValue - 4) : baseValue;
  const valueLineHeight = compact
    ? Math.round(valueFontSize * 1.15)
    : veryNarrow
      ? 28
      : narrow
        ? 32
        : 38;
  /** 紧凑格：高度与是否带 hint 无关，避免同排卡片因副标题有无而高低不齐 */
  const tileMinHeight = compact
    ? narrow
      ? 104
      : 118
    : narrow
      ? 136
      : 156;

  const pad = compact ? SPACING.xs + 2 : narrow ? SPACING.md : SPACING.base;
  const iconSize = compact ? 15 : narrow ? 16 : 18;

  const body = compact ? (
    <>
      <View style={styles.compactHeader}>
        {icon ? (
          <Ionicons name={icon} size={iconSize} color={color ?? COLORS.text.tertiary} />
        ) : null}
        <Text style={styles.compactLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.valueSlot}>
        <Text
          style={[
            styles.value,
            { fontSize: valueFontSize, lineHeight: valueLineHeight, minHeight: valueLineHeight },
            color ? { color } : null,
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.45}
        >
          {value}
        </Text>
      </View>
      {hint ? (
        <View style={styles.hintSlotCompactWrap}>
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        </View>
      ) : null}
    </>
  ) : (
    <>
      <View style={styles.iconSlot}>
        {icon ? (
          <Ionicons
            name={icon}
            size={iconSize}
            color={color ?? COLORS.text.tertiary}
          />
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.valueSlot}>
        <Text
          style={[
            styles.value,
            { fontSize: valueFontSize, lineHeight: valueLineHeight, minHeight: valueLineHeight },
            color ? { color } : null,
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.45}
        >
          {value}
        </Text>
      </View>
      {hint ? (
        <View style={styles.hintSlot}>
          <Text style={styles.hint} numberOfLines={narrow ? 3 : 2}>
            {hint}
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <GlassSurface
      level={1}
      tint={tint}
      padding={pad}
      style={[
        styles.tile,
        compact && styles.tileCompact,
        { minHeight: tileMinHeight },
      ]}
    >
      {body}
    </GlassSurface>
  );
}

export const StatTile = memo(StatTileInner);

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    flexDirection: 'column',
  },
  tileCompact: {
    justifyContent: 'center',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    width: '100%',
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  valueSlot: {
    width: '100%',
    alignItems: 'stretch',
  },
  compactLabel: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
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
    minHeight: 30,
  },
  value: {
    fontWeight: '700',
    letterSpacing: -0.4,
    color: COLORS.text.primary,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    width: '100%',
    marginTop: 0,
  },
  hintSlot: {
    width: '100%',
    marginTop: 4,
    justifyContent: 'flex-start',
  },
  hintSlotCompactWrap: {
    width: '100%',
    marginTop: 4,
    paddingTop: 2,
  },
  hint: {
    ...TYPE.caption,
    color: COLORS.text.quaternary,
    textAlign: 'center',
    lineHeight: 15,
    width: '100%',
    fontSize: 11,
  },
});
