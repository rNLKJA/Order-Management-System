/**
 * 三种按钮：primary（填充品牌色）/ secondary（白底 + 描边）/ ghost（纯文字）。
 * 统一圆角、统一按下反馈。
 */

import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GLASS, MOTION, RADIUS } from '../../theme/paperTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  fullWidth,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const colors = VARIANT[variant];
  const h = size === 'sm' ? 36 : 46;
  const fontSize = size === 'sm' ? 14 : 16;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { height: h, backgroundColor: colors.bg },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && { opacity: MOTION.pressOpacity, transform: [{ scale: 0.99 }] },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={16} color={colors.fg} style={styles.icon} /> : null}
          <Text
            allowFontScaling={false}
            style={[
              styles.label,
              {
                color: colors.fg,
                fontSize,
                lineHeight: fontSize,
              },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANT: Record<ButtonVariant, { fg: string; bg: string }> = {
  primary: { fg: '#fff', bg: COLORS.brand },
  secondary: { fg: COLORS.brand, bg: GLASS.surface1 },
  ghost: { fg: COLORS.brand, bg: 'transparent' },
  danger: { fg: '#fff', bg: COLORS.danger },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: 6 },
  label: {
    fontWeight: '600',
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' } : null),
  },
});
