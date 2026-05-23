import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/paperTheme';
import { floatingBottomReserve } from './FloatingBottomBar';

export type FloatingSegmentItem<K extends string = string> = {
  key: K;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export type FloatingSegmentBarProps<K extends string = string> = {
  segments: readonly FloatingSegmentItem<K>[];
  value: K | null;
  onChange: (key: K) => void;
  /** 4 段及以上：略缩小字号与图标，避免挤爆 */
  compact?: boolean;
};

/** 段条在 FloatingBottomBar 胶囊内的内容高度（不含 safe area） */
export const FLOATING_SEGMENT_BAR_HEIGHT = 44;

const FLOATING_SEGMENT_PILL_PAD = 16;

export function floatingSegmentBarReserve(bottomInset: number): number {
  return floatingBottomReserve(FLOATING_SEGMENT_BAR_HEIGHT + FLOATING_SEGMENT_PILL_PAD, bottomInset);
}

export function FloatingSegmentBar<K extends string>({
  segments,
  value,
  onChange,
  compact = segments.length >= 4,
}: FloatingSegmentBarProps<K>) {
  return (
    <View style={styles.track}>
      {segments.map((seg) => {
        const active = value === seg.key;
        return (
          <Pressable
            key={seg.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(seg.key)}
            style={({ pressed }) => [
              styles.segment,
              compact && styles.segmentCompact,
              active && styles.segmentActive,
              pressed && !active && styles.segmentPressed,
            ]}
          >
            <Ionicons
              name={seg.icon}
              size={compact ? 14 : 16}
              color={active ? COLORS.brand : COLORS.text.tertiary}
            />
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                active && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: FLOATING_SEGMENT_BAR_HEIGHT,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  segmentCompact: {
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 40,
  },
  segmentActive: {
    backgroundColor: COLORS.brandSoft,
    borderColor: 'rgba(0,122,255,0.12)',
  },
  segmentPressed: {
    opacity: 0.72,
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    color: COLORS.text.secondary,
    flexShrink: 1,
    minWidth: 0,
  },
  labelCompact: {
    fontSize: 11,
    lineHeight: 13,
  },
  labelActive: {
    color: COLORS.brand,
    fontWeight: '700',
  },
});
