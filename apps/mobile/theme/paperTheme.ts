/**
 * Design System v3 — Glassmorphism + Bento + Apple/Material 融合
 * 规范见 doc/DESIGN.md。所有页面必须通过本文件拿 token，禁止硬编码色值。
 */

import { Platform } from 'react-native';
import { MD3LightTheme } from 'react-native-paper';

// ===== 语义色 =====
export const COLORS = {
  brand: '#007AFF',
  brandSoft: '#E3F0FF',
  success: '#34C759',
  successSoft: '#E8F8ED',
  warning: '#FF9500',
  warningSoft: '#FFF4E5',
  danger: '#FF3B30',
  dangerSoft: '#FFE5E5',
  info: '#5856D6',
  infoSoft: '#F0F0FF',

  text: {
    primary: '#1C1C1E',
    secondary: '#3A3A3C',
    tertiary: '#8E8E93',
    quaternary: '#C7C7CC',
    inverse: '#FFFFFF',
  },

  // 页面底色 / 系统灰阶（玻璃之下）
  systemGrouped: '#F2F2F7',
  systemSecondary: '#EFEFF4',
  cardOpaque: '#FFFFFF', // 降级或非玻璃场景

  // Mesh 渐变起止点（见 MeshBackground）
  mesh: {
    a: '#F2F6FF',
    b: '#FFF7F0',
    c: '#F0FFF4',
    spotBlue: 'rgba(0,122,255,0.12)',
    spotGreen: 'rgba(52,199,89,0.10)',
    spotOrange: 'rgba(255,149,0,0.10)',
  },
} as const;

// ===== 毛玻璃 =====
export const GLASS = {
  surface1: 'rgba(255,255,255,0.72)',
  surface2: 'rgba(255,255,255,0.56)',
  surface3: 'rgba(255,255,255,0.40)',
  border: 'rgba(255,255,255,0.65)',
  outline: 'rgba(0,0,0,0.06)',
  tint: {
    info: 'rgba(0,122,255,0.12)',
    warn: 'rgba(255,149,0,0.12)',
    ok: 'rgba(52,199,89,0.12)',
    danger: 'rgba(255,59,48,0.10)',
  },
} as const;

// ===== Status Chip 配色（统一） =====
export const CHIP = {
  pending: { fg: COLORS.warning, bg: COLORS.warningSoft },
  fulfilled: { fg: COLORS.brand, bg: COLORS.brandSoft },
  delivered: { fg: COLORS.success, bg: COLORS.successSoft },
  cancelled: { fg: COLORS.text.tertiary, bg: COLORS.systemGrouped },
  hospital: { fg: COLORS.brand, bg: COLORS.brandSoft },
  regular: { fg: COLORS.success, bg: COLORS.successSoft },
  lunch: { fg: COLORS.warning, bg: '#FFF8E1' },
  dinner: { fg: COLORS.info, bg: COLORS.infoSoft },
  neutral: { fg: COLORS.text.secondary, bg: COLORS.systemGrouped },
  warning: { fg: COLORS.warning, bg: COLORS.warningSoft },
  danger: { fg: COLORS.danger, bg: COLORS.dangerSoft },
} as const;

// ===== 圆角 =====
export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

// ===== 间距 =====
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  page: 16,
  maxWidth: 720,
} as const;

// ===== 阴影 =====
export const SHADOW = Platform.select({
  web: {
    card: { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' } as any,
    raised: { boxShadow: '0 4px 24px rgba(0,0,0,0.10)' } as any,
    modal: { boxShadow: '0 16px 48px rgba(0,0,0,0.18)' } as any,
  },
  default: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    } as any,
    raised: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 6,
    } as any,
    modal: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.18,
      shadowRadius: 48,
      elevation: 12,
    } as any,
  },
}) as {
  card: Record<string, unknown>;
  raised: Record<string, unknown>;
  modal: Record<string, unknown>;
};

// ===== 字体层级 =====
export const TYPE = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  title3: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
  callout: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

// ===== Motion =====
export const MOTION = {
  pressScale: 0.985,
  pressOpacity: 0.92,
  rippleColor: 'rgba(0,0,0,0.04)',
  durationFast: 120,
  durationBase: 200,
} as const;

// ===== 响应式断点 =====
export const BREAKPOINT = {
  xs: 480,
  sm: 768,
  md: 1024,
} as const;

// ===== 兼容旧代码的 IOS_COLORS（保留，逐步迁移）=====
export const IOS_COLORS = {
  blue: COLORS.brand,
  blueLight: COLORS.brandSoft,
  systemGrouped: COLORS.systemGrouped,
  systemSecondary: COLORS.systemSecondary,
  card: COLORS.cardOpaque,
  label: COLORS.text.primary,
  labelSecondary: COLORS.text.tertiary,
  labelTertiary: COLORS.text.quaternary,
  green: COLORS.success,
  orange: COLORS.warning,
  red: COLORS.danger,
  yellow: '#FFCC00',
  purple: COLORS.info,
  separator: '#C6C6C8',
  separatorLight: '#E5E5EA',
  fillLight: 'rgba(120,120,128,0.12)',
  fillMedium: 'rgba(120,120,128,0.2)',
};

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 14,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.brand,
    onPrimary: '#FFFFFF',
    primaryContainer: COLORS.brandSoft,
    onPrimaryContainer: '#003380',
    secondary: COLORS.text.tertiary,
    onSecondary: '#FFFFFF',
    surface: COLORS.cardOpaque,
    onSurface: COLORS.text.primary,
    surfaceVariant: COLORS.systemGrouped,
    onSurfaceVariant: COLORS.text.tertiary,
    background: COLORS.systemGrouped,
    onBackground: COLORS.text.primary,
    error: COLORS.danger,
    onError: '#FFFFFF',
    errorContainer: COLORS.dangerSoft,
    onErrorContainer: '#8B0000',
    outline: '#C6C6C8',
    outlineVariant: '#E5E5EA',
    elevation: {
      level0: 'transparent',
      level1: COLORS.cardOpaque,
      level2: COLORS.systemGrouped,
      level3: '#EBEBF0',
      level4: '#E5E5EA',
      level5: '#D1D1D6',
    },
  },
};

export type AppTheme = typeof paperTheme;
