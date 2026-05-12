/**
 * 其他零售商品目录（/api/finance/retail-products，与 /api/retail-products 等价）。
 */

import type { RetailProductCreateInput, RetailProductPatchInput } from '@meal/shared';
import { api } from './client';

export interface RetailProductDTO {
  id: number;
  name: string;
  detail: string;
  is_active: boolean;
  sort_order: number;
  created_by_user_id: number;
  created_at: string | number;
  updated_at: string | number;
}

const BASE = '/api/finance/retail-products';

export function listRetailProducts(includeInactive = false) {
  const q = includeInactive ? '?include_inactive=true' : '';
  return api.get<{ products: RetailProductDTO[] }>(`${BASE}${q}`);
}

export function createRetailProduct(body: RetailProductCreateInput) {
  return api.post<{ product: RetailProductDTO }>(BASE, body);
}

export function patchRetailProduct(id: number, body: RetailProductPatchInput) {
  return api.patch<{ product: RetailProductDTO }>(`${BASE}/${id}`, body);
}
