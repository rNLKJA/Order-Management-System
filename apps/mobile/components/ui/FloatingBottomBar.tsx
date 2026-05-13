/**
 * 底部悬浮导航：外层透明，内层白色胶囊 + 下投影（参考 Uber 类悬浮条）。
 * 子组件放在胶囊内，勿再各自套一层大底色，以免「盒中盒」。
 */
import { Platform, StyleSheet, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MIN_BOTTOM = 10;
const TOP_PAD = 10;

export function floatingBottomReserve(contentHeight: number, bottomInset: number): number {
  return TOP_PAD + contentHeight + Math.max(bottomInset, MIN_BOTTOM);
}

export type FloatingBottomBarProps = ViewProps & {
  /** 覆盖胶囊容器样式（例如略收窄） */
  pillStyle?: StyleProp<ViewStyle>;
};

export function FloatingBottomBar({ children, style, pillStyle, ...rest }: FloatingBottomBarProps) {
  const insets = useSafeAreaInsets();
  const padBottom = Math.max(insets.bottom, MIN_BOTTOM);
  return (
    <View
      {...rest}
      style={[styles.shell, { paddingBottom: padBottom, paddingTop: TOP_PAD }, style]}
      pointerEvents="box-none"
    >
      <View style={styles.centerTrack} pointerEvents="box-none">
        <View style={[styles.pill, pillStyle]} pointerEvents="auto">
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  centerTrack: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    alignItems: 'stretch',
  },
  pill: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 14 },
      default: {},
    }),
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 8px 28px rgba(0,0,0,0.1), 0 2px 10px rgba(0,0,0,0.06)',
        } as object)
      : {}),
  },
});
