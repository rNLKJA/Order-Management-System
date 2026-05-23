import type { MockOrder } from '../../constants/mockData';
import { DEFAULT_SHOP_NAME, type MealLabelData } from './types';

export function displayCustomerName(order: MockOrder): string {
  return (order.member_nickname || order.member_name || order.customer_name || `#${order.member_id}`).trim();
}

export function buildMealLabelTags(order: MockOrder): string[] {
  const tags: string[] = [];
  if (order.is_hospital) tags.push('院内');
  else tags.push('院外');
  if (order.card_type === null) tags.push('散餐');
  if (order.is_staff_meal) tags.push('员工餐');
  if (order.is_gift) tags.push('赠送');
  return tags;
}

export function mapOrderToMealLabel(order: MockOrder, shopName = DEFAULT_SHOP_NAME): MealLabelData {
  return {
    shopName: shopName.trim() || DEFAULT_SHOP_NAME,
    customerName: displayCustomerName(order),
    mealTypeLabel: order.meal_type === 'lunch' ? '午餐' : '晚餐',
    quantity: 1,
    tags: buildMealLabelTags(order),
    dietaryNotes: order.dietary_notes?.trim() || null,
    orderNotes: order.notes?.trim() || null,
    orderId: order.id,
    orderDate: order.order_date,
  };
}

/** 按餐盒展开：2 份订单 → 2 张标签，每张「1 份 (1/2)」「1 份 (2/2)」 */
export function mapOrdersToMealLabels(orders: MockOrder[], shopName = DEFAULT_SHOP_NAME): MealLabelData[] {
  const labels: MealLabelData[] = [];
  for (const order of orders) {
    const copies = Math.max(1, Math.floor(order.quantity));
    for (let i = 0; i < copies; i++) {
      labels.push({
        ...mapOrderToMealLabel(order, shopName),
        copyIndex: copies > 1 ? i + 1 : undefined,
        copyTotal: copies > 1 ? copies : undefined,
      });
    }
  }
  return labels;
}
