/**
 * 统一顶部导航栏 — 透明底 + 绝对居中标题（左右按钮不等宽时标题仍居中）。
 */

import { Pressable, View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '../../theme/paperTheme';
import { headerStyles as styles } from './headerStyles';

export interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export function AppHeader({
  title,
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
      <View style={styles.row}>
        <View style={styles.side}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="返回"
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={22} color={COLORS.brand} />
              <Text style={styles.backText}>返回</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
      <View style={styles.titleWrap} pointerEvents="none">
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

/** 右侧文字操作（与旧版「+ 新增」同款：图标 + 蓝字，无胶囊底） */
export function HeaderTextAction({
  label,
  onPress,
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.textAction,
        disabled && styles.textActionDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={22} color={COLORS.brand} /> : null}
      <Text style={styles.textActionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
