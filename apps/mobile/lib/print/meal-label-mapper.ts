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
    quantity: order.quantity,
    tags: buildMealLabelTags(order),
    dietaryNotes: order.dietary_notes?.trim() || null,
    orderNotes: order.notes?.trim() || null,
    orderId: order.id,
    orderDate: order.order_date,
  };
}

export function mapOrdersToMealLabels(orders: MockOrder[], shopName = DEFAULT_SHOP_NAME): MealLabelData[] {
  return orders.map((order) => mapOrderToMealLabel(order, shopName));
}
