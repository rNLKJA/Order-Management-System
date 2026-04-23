/**
 * 可点击的玻璃卡片（带 scale + opacity 反馈）。
 * 用于 Bento 主入口、列表行等。
 */

import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import { GlassSurface, type GlassSurfaceProps } from './GlassSurface';
import { MOTION } from '../../theme/paperTheme';

export interface PressableCardProps
  extends Omit<PressableProps, 'style' | 'children'>,
    Pick<GlassSurfaceProps, 'level' | 'tint' | 'radius' | 'padding' | 'elevated'> {
  style?: ViewStyle;
  children?: ReactNode;
}

export function PressableCard({
  level,
  tint,
  radius,
  padding,
  elevated,
  style,
  children,
  ...rest
}: PressableCardProps) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        pressed && {
          opacity: MOTION.pressOpacity,
          transform: [{ scale: MOTION.pressScale }],
        },
      ]}
    >
      <GlassSurface
        level={level}
        tint={tint}
        radius={radius}
        padding={padding}
        elevated={elevated}
        style={style}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}
