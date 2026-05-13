/**
 * Bento 12 列栅格，见 DESIGN.md §7。
 *
 * 用法：
 * ```
 * <BentoGrid>
 *   <Bento span={8}>大卡</Bento>
 *   <Bento span={4}>速览</Bento>
 * </BentoGrid>
 * ```
 *
 * 小屏（宽度 < `BREAKPOINT.sm`）时：若提供 `mobileSpan` 则优先采用，否则按旧规则折叠（span≤4 → 8，否则 12）。
 * 用 padding-half 模拟 gap，保证在 RN 和 Web 都一致。
 */

import { Children, cloneElement, isValidElement, useMemo } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewProps,
} from 'react-native';
import { BREAKPOINT, SPACING } from '../../theme/paperTheme';

export interface BentoGridProps extends ViewProps {
  gap?: number;
}

export function BentoGrid({ gap = SPACING.md, style, children, ...rest }: BentoGridProps) {
  const half = gap / 2;
  const mapped = Children.map(children, (child) => {
    if (isValidElement(child)) {
      return cloneElement(child as React.ReactElement<BentoInjectedProps>, { __gap: gap });
    }
    return child;
  });

  return (
    <View
      {...rest}
      style={[
        styles.grid,
        { marginHorizontal: -half, marginVertical: -half },
        style,
      ]}
    >
      {mapped}
    </View>
  );
}

interface BentoInjectedProps {
  __gap?: number;
}

export interface BentoProps extends ViewProps, BentoInjectedProps {
  span?: number;
  mobileSpan?: number;
}

export function Bento({
  span = 12,
  mobileSpan,
  __gap = SPACING.md,
  style,
  children,
  ...rest
}: BentoProps) {
  const { width } = useWindowDimensions();
  /** 与 `BREAKPOINT.sm` 对齐：避免 480–768px 仍按桌面列宽排 4 枚速览格导致挤压截断 */
  const isNarrow = width < BREAKPOINT.sm;
  const half = __gap / 2;

  const effective = useMemo(() => {
    if (!isNarrow) return span;
    if (mobileSpan != null) return mobileSpan;
    if (span <= 4) return 8;
    return 12;
  }, [isNarrow, span, mobileSpan]);

  const widthPct = `${(effective / 12) * 100}%`;

  return (
    <View
      {...rest}
      style={[
        { width: widthPct as any, paddingHorizontal: half, paddingVertical: half },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
});
