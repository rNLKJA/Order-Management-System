/**
 * 统一顶部导航栏，见 DESIGN.md §11。
 * 左：‹ 返回（可选 showBack=false 隐藏）；中：标题；右：可选操作槽。
 */

import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SPACING, TYPE } from '../../theme/paperTheme';

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export function AppHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  right,
  style,
}: AppHeaderProps) {
  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/(app)');
  };

  return (
    <View style={[styles.bar, style]}>
      <View style={styles.slot}>
        {showBack && (
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.brand} />
            <Text style={styles.backText}>返回</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.titleWrap} pointerEvents="none">
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.slot, styles.slotRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    minHeight: 48,
  },
  slot: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  slotRight: { justifyContent: 'flex-end' },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 4 },
  pressed: { opacity: 0.6 },
  backText: { ...TYPE.body, color: COLORS.brand, marginLeft: 2 },
  titleWrap: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { ...TYPE.headline, color: COLORS.text.primary },
  subtitle: { ...TYPE.caption, color: COLORS.text.tertiary },
});
