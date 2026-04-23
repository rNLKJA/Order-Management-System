/**
 * 方形圆角 icon 底座。替代 emoji 占位。
 */

import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../../theme/paperTheme';

export interface IconAvatarProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  bg?: string;
  style?: ViewStyle;
}

export function IconAvatar({
  icon,
  size = 44,
  color = COLORS.brand,
  bg = COLORS.brandSoft,
  style,
}: IconAvatarProps) {
  return (
    <View
      style={[
        styles.root,
        { width: size, height: size, backgroundColor: bg },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
