/**
 * React Native Paper MD3 主题配置。
 *
 * 核心色板见 doc/DESIGN.md：
 * - primary = sky-500 (#0EA5E9)
 * - background = slate-50 (#F8FAFC)
 * - surface = white
 * - error = rose-600 (#E11D48)
 *
 * roundness = 10（几何化，禁胶囊）
 */

import { MD3LightTheme, configureFonts } from 'react-native-paper';
import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'PingFang SC',
  android: 'sans-serif',
  default: 'system-ui',
});

const fonts = configureFonts({
  config: {
    fontFamily,
  },
});

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 10,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0EA5E9',
    onPrimary: '#FFFFFF',
    primaryContainer: '#E0F2FE',
    onPrimaryContainer: '#0C4A6E',

    secondary: '#64748B',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#F1F5F9',
    onSecondaryContainer: '#0F172A',

    tertiary: '#475569',
    onTertiary: '#FFFFFF',

    surface: '#FFFFFF',
    onSurface: '#0F172A',
    surfaceVariant: '#F1F5F9',
    onSurfaceVariant: '#475569',

    background: '#F8FAFC',
    onBackground: '#0F172A',

    error: '#E11D48',
    onError: '#FFFFFF',
    errorContainer: '#FFE4E6',
    onErrorContainer: '#9F1239',

    outline: '#CBD5E1',
    outlineVariant: '#E2E8F0',

    elevation: {
      level0: 'transparent',
      level1: '#F8FAFC',
      level2: '#F1F5F9',
      level3: '#E2E8F0',
      level4: '#CBD5E1',
      level5: '#94A3B8',
    },
  },
  fonts,
};

export type AppTheme = typeof paperTheme;
