import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { PressableCard, IconAvatar } from '../ui';
import { COLORS, SPACING, TYPE } from '../../theme/paperTheme';

export type HomeEntryDef = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  route: string;
};

const ICON_OPTICAL_NUDGE: Partial<
  Record<HomeEntryDef['icon'], { x?: number; y?: number }>
> = {
  'wallet-outline': { x: 0.5, y: -0.5 },
  'bar-chart-outline': { x: 0.5, y: -1 },
};

type Props = {
  entry: HomeEntryDef;
  compact?: boolean;
  compactPhone?: boolean;
  /** 主入口「每日订餐」：全宽强调样式 */
  featured?: boolean;
};

function HomeQuickEntryCardInner({ entry, compact, compactPhone, featured }: Props) {
  const iconSize = featured ? 48 : compact ? 40 : 42;
  const nudge = ICON_OPTICAL_NUDGE[entry.icon];

  return (
    <PressableCard
      tint={featured ? 'ok' : undefined}
      padding={featured ? SPACING.lg : compact ? SPACING.base : SPACING.lg}
      onPress={() => router.push(entry.route as never)}
      style={[
        styles.entryCard,
        compact && styles.entryCardCompact,
        compactPhone && styles.entryCardPhone,
        featured && styles.entryCardFeatured,
      ]}
    >
      {featured ? <View style={styles.featuredAccent} /> : null}
      <View style={styles.entryIconSlot}>
        <IconAvatar
          icon={entry.icon}
          color={entry.color}
          bg={entry.bg}
          size={iconSize}
          iconOffsetX={nudge?.x ?? 0}
          iconOffsetY={nudge?.y ?? 0}
        />
      </View>
      <View style={styles.entryText}>
        <View style={styles.titleRow}>
          <Text style={[styles.entryTitle, featured && styles.entryTitleFeatured]}>
            {entry.title}
          </Text>
          {featured ? (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>常用</Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[
            styles.entrySubtitle,
            (compact || compactPhone) && !featured && styles.entrySubtitleCompact,
            featured && styles.entrySubtitleFeatured,
          ]}
          numberOfLines={featured ? 2 : 2}
        >
          {entry.subtitle}
        </Text>
        {featured ? (
          <Text style={styles.featuredCta}>点击进入录入 · 总览与批量</Text>
        ) : null}
      </View>
      <View style={styles.entryChevronSlot}>
        <Ionicons
          name="chevron-forward"
          size={featured ? 20 : 18}
          color={featured ? COLORS.success : COLORS.text.quaternary}
        />
      </View>
    </PressableCard>
  );
}

export const HomeQuickEntryCard = memo(HomeQuickEntryCardInner);

const styles = StyleSheet.create({
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryCardCompact: {
    minHeight: 84,
  },
  entryCardPhone: {
    borderRadius: 14,
  },
  entryCardFeatured: {
    minHeight: 96,
    borderWidth: 1.5,
    borderColor: 'rgba(52,199,89,0.35)',
    overflow: 'hidden',
  },
  featuredAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: COLORS.success,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  entryIconSlot: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryText: { flex: 1, marginLeft: SPACING.sm, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  entryTitle: { ...TYPE.title3, color: COLORS.text.primary },
  entryTitleFeatured: { fontSize: 18, fontWeight: '700' },
  featuredBadge: {
    backgroundColor: COLORS.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  featuredBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
  },
  entrySubtitle: { ...TYPE.footnote, color: COLORS.text.secondary },
  entrySubtitleCompact: { fontSize: 12, lineHeight: 16 },
  entrySubtitleFeatured: { fontSize: 14, lineHeight: 19 },
  featuredCta: {
    ...TYPE.caption,
    color: COLORS.success,
    fontWeight: '600',
    marginTop: 6,
  },
  entryChevronSlot: {
    width: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
