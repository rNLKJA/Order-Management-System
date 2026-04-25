/**
 * 方形圆角 icon 底座。替代 emoji 占位。
 */

import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../../theme/paperTheme';
import type { StyleProp, TextStyle } from 'react-native';

export interface IconAvatarProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  /** 视觉微调：用于个别 icon 的光学校正 */
  iconOffsetX?: number;
  /** 视觉微调：用于个别 icon 的光学校正 */
  iconOffsetY?: number;
  iconStyle?: StyleProp<TextStyle>;
}

export function IconAvatar({
  icon,
  size = 44,
  color = COLORS.brand,
  bg = COLORS.brandSoft,
  style,
  iconOffsetX = 0,
  iconOffsetY = 0,
  iconStyle,
}: IconAvatarProps) {
  return (
    <View
      style={[
        styles.root,
        { width: size, height: size, backgroundColor: bg },
        style,
      ]}
    >
      <Ionicons
        name={icon}
        size={Math.round(size * 0.5)}
        color={color}
        style={[
          iconStyle,
          (iconOffsetX !== 0 || iconOffsetY !== 0) && {
            transform: [{ translateX: iconOffsetX }, { translateY: iconOffsetY }],
          },
        ]}
      />
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
