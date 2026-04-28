/**
 * 今日订单 hook（按 Asia/Shanghai 业务日）—— 真数据版本。
 *
 * 背后接 GET /api/orders/today，后端已经做好时区对齐。
 * - 聚焦页面时自动重取（useFocusEffect + invalidate）
 * - 所有订单相关的 mutation（创建 / 状态切换 / 取消）成功后调 useInvalidateOrders() 刷新所有订阅者。
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { ordersApi, type DailyOrder } from '../api/orders';

const KEYS = {
  root: ['orders'] as const,
  today: ['orders', 'today'] as const,
  byDate: (date: string) => ['orders', 'date', date] as const,
};

export interface UseOrdersTodayResult {
  data: DailyOrder[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useOrdersToday(): UseOrdersTodayResult {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: KEYS.today,
    queryFn: async () => {
      const { orders } = await ordersApi.today();
      return orders;
    },
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: KEYS.root });
    }, [queryClient]),
  );

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: async () => {
      await query.refetch();
    },
  };
}

export function useOrdersByDate(date: string): UseOrdersTodayResult {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: KEYS.byDate(date),
    queryFn: async () => {
      const { orders } = await ordersApi.list({
        date,
        status: 'all',
        limit: 500,
      });
      return orders;
    },
    enabled: !!date,
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: KEYS.root });
    }, [queryClient]),
  );

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: async () => {
      await query.refetch();
    },
  };
}

/** 创建 / 改状态 / 取消订单后调一次，刷新首页 + 订餐页所有订阅者。 */
export function useInvalidateOrders(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: KEYS.root });
  }, [queryClient]);
}
