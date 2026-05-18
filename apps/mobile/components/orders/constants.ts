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
  | 'retail'
  | 'prep'
  | 'delivery'
  | 'courier';
export type PrimaryTab = 'manage' | 'fulfillment';

export const TABS: {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'overview', label: '总览', icon: 'list-outline' },
  { key: 'entry', label: '录入', icon: 'person-outline' },
  { key: 'entry_batch', label: '批量录入', icon: 'people-outline' },
  { key: 'entry_gift', label: '赠送餐', icon: 'gift-outline' },
  { key: 'retail', label: '零售', icon: 'pricetag-outline' },
  { key: 'prep', label: '出餐', icon: 'fast-food-outline' },
  { key: 'delivery', label: '送餐', icon: 'bicycle-outline' },
  { key: 'courier', label: '快递', icon: 'cube-outline' },
];

/** 底部 Tab 切换时，顶部说明区文案（与 TABS 图标一致） */
export const ORDER_TAB_PAGE_META: Record<
  TabKey,
  { title: string; description: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  overview: {
    title: '总览',
    icon: 'list-outline',
    description: '按日期查看订餐份数、出餐与送达进度',
  },
  entry: {
    title: '录入',
    icon: 'person-outline',
    description: '为一位会员或散客录单，须上传订餐凭证',
  },
  entry_batch: {
    title: '批量录入',
    icon: 'people-outline',
    description: '搜索加人 → 设午/晚份数 → 配送备注，共用凭证',
  },
  entry_gift: {
    title: '赠送餐',
    icon: 'gift-outline',
    description: '赠送餐不扣次；批量加人后每人单独设份数',
  },
  retail: {
    title: '零售',
    icon: 'pricetag-outline',
    description: '维护产品目录、记一笔销售、看当日流水',
  },
  prep: {
    title: '出餐',
    icon: 'fast-food-outline',
    description: '今日待出餐订单，标记已出餐',
  },
  delivery: {
    title: '送餐',
    icon: 'bicycle-outline',
    description: '员工自送订单，标记送达或送餐失败',
  },
  courier: {
    title: '快递',
    icon: 'cube-outline',
    description: '外包快递订单，标记送达或配送失败',
  },
};

export function orderTabPageMeta(tab: TabKey) {
  return ORDER_TAB_PAGE_META[tab];
}
