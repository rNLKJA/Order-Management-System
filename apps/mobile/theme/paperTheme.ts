/**
 * iOS 风格设计主题。
 *
 * 色彩参照 Apple Human Interface Guidelines：
 * - 动态蓝 iOS Blue  #007AFF
 * - 系统背景        #F2F2F7  (Grouped Background)
 * - 卡片背景        #FFFFFF
 * - 主文字          #000000 / #1C1C1E
 * - 次文字          #8E8E93  (Label Secondary)
 * - 分割线          #C6C6C8
 * - 成功            #34C759
 * - 警告            #FF9500
 * - 危险            #FF3B30
 */

import { MD3LightTheme } from 'react-native-paper';

export const IOS_COLORS = {
  // 品牌蓝
  blue: '#007AFF',
  blueLight: '#E3F0FF',
  // 背景
  systemGrouped: '#F2F2F7',
  systemSecondary: '#EFEFF4',
  card: '#FFFFFF',
  // 文字
  label: '#000000',
  labelSecondary: '#8E8E93',
  labelTertiary: '#C7C7CC',
  // 状态
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  yellow: '#FFCC00',
  purple: '#AF52DE',
  // 边框
  separator: '#C6C6C8',
  separatorLight: '#E5E5EA',
  // 填充
  fillLight: 'rgba(120,120,128,0.12)',
  fillMedium: 'rgba(120,120,128,0.2)',
};

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: IOS_COLORS.blue,
    onPrimary: '#FFFFFF',
    primaryContainer: IOS_COLORS.blueLight,
    onPrimaryContainer: '#003380',
    secondary: IOS_COLORS.labelSecondary,
    onSecondary: '#FFFFFF',
    surface: IOS_COLORS.card,
    onSurface: IOS_COLORS.label,
    surfaceVariant: IOS_COLORS.systemGrouped,
    onSurfaceVariant: IOS_COLORS.labelSecondary,
    background: IOS_COLORS.systemGrouped,
    onBackground: IOS_COLORS.label,
    error: IOS_COLORS.red,
    onError: '#FFFFFF',
    errorContainer: '#FFE5E5',
    onErrorContainer: '#8B0000',
    outline: IOS_COLORS.separator,
    outlineVariant: IOS_COLORS.separatorLight,
    elevation: {
      level0: 'transparent',
      level1: IOS_COLORS.card,
      level2: IOS_COLORS.systemGrouped,
      level3: '#EBEBF0',
      level4: '#E5E5EA',
      level5: '#D1D1D6',
    },
  },
};

export type AppTheme = typeof paperTheme;
