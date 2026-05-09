/**
 * 订餐屏共享常量与类型（与 apps/mobile/app/(app)/orders 对齐）。
 */

import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';

export const STATUS_MAP = {
  pending: { label: '待出餐', color: IOS_COLORS.orange, bg: '#FFF4E5' },
  fulfilled: { label: '已出餐', color: IOS_COLORS.blue, bg: IOS_COLORS.blueLight },
  delivered: { label: '已送达', color: '#34C759', bg: '#E8F8ED' },
  cancelled: { label: '已取消', color: IOS_COLORS.labelSecondary, bg: IOS_COLORS.fillLight },
} as const;

export const ADHOC_DEFAULT_PRICE = 35;

export const DELIVERY_FAIL_REASON_OPTIONS = [
  '地址信息有误',
  '客户临时取消收餐',
  '联系不上客户',
  '配送超时，餐品不宜送达',
  '配送资源不足',
  '其他',
] as const;

export type TabKey =
  | 'overview'
  | 'entry'
  | 'entry_batch'
  | 'entry_gift'
  | 'prep'
  | 'delivery'
  | 'courier';
export type PrimaryTab = 'manage' | 'fulfillment';

export const LIMIT_OPTIONS = [10, 50, 100, 200] as const;
export type LimitOption = (typeof LIMIT_OPTIONS)[number];

export const TABS: {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'overview', label: '总览', icon: 'list-outline' },
  { key: 'entry', label: '录入', icon: 'person-outline' },
  { key: 'entry_batch', label: '批量录入', icon: 'people-outline' },
  { key: 'entry_gift', label: '赠送餐', icon: 'gift-outline' },
  { key: 'prep', label: '出餐', icon: 'fast-food-outline' },
  { key: 'delivery', label: '送餐', icon: 'bicycle-outline' },
  { key: 'courier', label: '快递', icon: 'cube-outline' },
];
