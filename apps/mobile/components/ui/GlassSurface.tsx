/**
 * 毛玻璃表面。见 DESIGN.md §1 / §5。
 *
 * Web: backdrop-filter: blur(20px) + 半透明白。
 * Native: 半透明白 + 轻阴影 + 内描边（近似）。
 *
 * 三种层级（level 1/2/3）对应 GLASS.surface1/2/3。
 * tint 用于语义着色：'info' | 'warn' | 'ok' | 'danger'。
 */

import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { GLASS, RADIUS, SHADOW } from '../../theme/paperTheme';

export interface GlassSurfaceProps extends ViewProps {
  level?: 1 | 2 | 3;
  tint?: 'info' | 'warn' | 'ok' | 'danger';
  radius?: keyof typeof RADIUS;
  padding?: number;
  elevated?: boolean;
}

const webGlass = Platform.OS === 'web'
  ? ({
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    } as any)
  : {};

export function GlassSurface({
  level = 1,
  tint,
  radius = 'lg',
  padding,
  elevated = false,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const surface =
    level === 1 ? GLASS.surface1 : level === 2 ? GLASS.surface2 : GLASS.surface3;

  const tintLayer: ViewStyle | null = tint
    ? {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: GLASS.tint[tint],
      }
    : null;

  return (
    <View
      {...rest}
      style={[
        styles.base,
        webGlass,
        {
          backgroundColor: surface,
          borderRadius: RADIUS[radius],
          padding,
        },
        elevated ? SHADOW.raised : SHADOW.card,
        style,
      ]}
    >
      {tintLayer ? <View style={tintLayer} pointerEvents="none" /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
