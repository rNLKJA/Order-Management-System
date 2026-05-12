/**
 * 真实会员数据 hooks（对 MockMember 形状兼容，屏幕组件几乎无需改 JSX）。
 *
 * 设计：
 *  - 用 `@tanstack/react-query` 做缓存和 focus 重取，避免原来 MOCK_MEMBERS 模块级
 *    原地 mutate 的"刷新即重置"问题。
 *  - 所有操作（购卡/升级/续卡/改会员）完成后，调 `useInvalidateMembersView()`
 *    拿到的 invalidate 函数即可刷新所有订阅者。
 *
 * 列表性能：当前拉会员 + 对每个会员再拉卡，N+1 请求。数据量小（几十人）时可接受。
 * Phase 4 如果会员数上千，考虑后端改 `/api/members?include_cards=true` 批量返回。
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { membersApi, type Member } from '../api/members';
import { cardsApi, type Card } from '../api/cards';
import { ordersApi, type DailyOrder } from '../api/orders';
import { usersApi, type ApiUser } from '../api/users';
import { listFinance } from '../api/finance';
import {
  apiToMockMember,
  usersById as indexUsers,
} from '../lib/member-view';
import type { MockMember } from '../constants/mockData';

const KEYS = {
  users: ['users'] as const,
  membersList: (limit: number, serverSearch: string) =>
    ['members', 'list', limit, serverSearch] as const,
  member: (id: number) => ['members', 'detail', id] as const,
  /** 会员维度的订餐流水（GET /api/orders?member_id=） */
  memberOrders: (id: number, limit: number) => ['members', 'detail', id, 'orders', limit] as const,
  memberCards: (id: number) => ['members', id, 'cards'] as const,
};

/** 拉 users 字典。缓存较久，续写后续查找用。 */
export function useUsersMap() {
  return useQuery({
    queryKey: KEYS.users,
    queryFn: async () => {
      const { users } = await usersApi.list();
      return indexUsers(users);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface UseMembersViewResult {
  data: MockMember[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * 全量会员 + 每人所有卡 → MockMember[]（按 id 升序）。
 * 聚焦页面时自动重取。
 */
export function useMembersView(): UseMembersViewResult {
  return useMembersViewWithLimit(500, '');
}

export function useMembersViewWithLimit(
  listLimit: number,
  /** 非空时走服务端 `q` 搜索（避免只拉前 N 条导致搜不到老会员） */
  serverSearch = '',
): UseMembersViewResult {
  const usersQuery = useUsersMap();
  const queryClient = useQueryClient();
  const browseLimit = Math.min(500, Math.max(1, Math.floor(listLimit)));

  const query = useQuery({
    queryKey: KEYS.membersList(browseLimit, serverSearch.trim()),
    enabled: !!usersQuery.data,
    queryFn: async (): Promise<MockMember[]> => {
      const q = serverSearch.trim();
      const searchLimit = 500;
      const { items } = await membersApi.list(
        q.length > 0
          ? { limit: searchLimit, type: 'all', include_archived: false, q }
          : { limit: browseLimit, type: 'all', include_archived: false },
      );
      const usersMap = usersQuery.data ?? {};
      const results = await Promise.all(
        items.map(async (m) => {
          let cards: Card[] = [];
          try {
            const r = await cardsApi.list(m.id, 'all');
            cards = r.cards;
          } catch {
            // 常见原因：生产 SQLite 未跑 cards 相关 migration，/api/cards 500。
            // 仍返回会员行，避免整页「会员档案」空白。
            cards = [];
          }
          return apiToMockMember(m, cards, usersMap);
        }),
      );
      return results.sort((a, b) => a.id - b.id);
    },
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['members', 'list'] });
    }, [queryClient]),
  );

  return {
    data: query.data,
    isLoading: query.isLoading || usersQuery.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? (usersQuery.error as Error | null),
    refetch: async () => {
      await query.refetch();
    },
  };
}

export interface UseMemberViewResult {
  data: MockMember | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  notFound: boolean;
}

/** 单个会员 + 其所有卡 → MockMember。 */
/** 某会员的订餐流水（出餐记录），与会员详情页共用缓存失效。 */
export function useMemberOrders(
  memberId: number,
  enabled: boolean,
  limit: 10 | 50 | 100 | 200 = 200,
) {
  return useQuery({
    queryKey: KEYS.memberOrders(memberId, limit),
    enabled: Number.isFinite(memberId) && memberId > 0 && enabled,
    queryFn: async (): Promise<DailyOrder[]> =>
      (await ordersApi.list({ member_id: memberId, status: 'all', limit })).orders,
    refetchOnWindowFocus: true,
  });
}

export function useMemberView(id: number): UseMemberViewResult {
  const usersQuery = useUsersMap();
  const queryClient = useQueryClient();
  const validId = Number.isFinite(id) && id > 0;

  const query = useQuery({
    queryKey: KEYS.member(id),
    enabled: validId && !!usersQuery.data,
    queryFn: async (): Promise<
      { member: MockMember } | { notFound: true }
    > => {
      try {
        const { member } = await membersApi.detail(id);
        let cards: Card[] = [];
        try {
          const r = await cardsApi.list(id, 'all');
          cards = r.cards;
        } catch {
          cards = [];
        }
        return {
          member: apiToMockMember(member, cards, usersQuery.data ?? {}),
        };
      } catch (e) {
        if (isNotFoundError(e)) {
          return { notFound: true };
        }
        throw e;
      }
    },
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      if (validId) {
        void queryClient.invalidateQueries({ queryKey: KEYS.member(id) });
      }
    }, [queryClient, id, validId]),
  );

  const result = query.data;
  return {
    data: result && 'member' in result ? result.member : undefined,
    notFound: !!(result && 'notFound' in result),
    isLoading: query.isLoading || usersQuery.isLoading,
    error: (query.error as Error | null) ?? (usersQuery.error as Error | null),
    refetch: async () => {
      await query.refetch();
    },
  };
}

/**
 * 所有变更（购卡/升级/续卡/改会员）走完后调用，刷新所有订阅者。
 */
export function useInvalidateMembersView(): (memberId?: number) => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    async (memberId?: number) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['members', 'list'] }),
        memberId != null
          ? Promise.all([
              queryClient.invalidateQueries({ queryKey: KEYS.member(memberId) }),
              queryClient.invalidateQueries({ queryKey: ['members', 'detail', memberId, 'orders'] }),
            ])
          : Promise.resolve(),
      ]);
    },
    [queryClient],
  );
}

/**
 * 今日财务快照：收入 / 支出 / 净额，直接来自 /api/finance?from=YYYY-MM-DD&to=YYYY-MM-DD 的 summary。
 */
export function useFinanceToday(dateISO: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['finance', 'today', dateISO],
    queryFn: async () => {
      const { summary } = await listFinance({ from: dateISO, to: dateISO, limit: 500 });
      return summary;
    },
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['finance', 'today', dateISO] });
    }, [queryClient, dateISO]),
  );

  return query;
}

/** `api/client.ts` 的 ApiError 没有直接导出，这里做结构化判断。 */
function isNotFoundError(e: unknown): boolean {
  if (e && typeof e === 'object' && 'status' in e) {
    const s = (e as { status?: number }).status;
    return s === 404;
  }
  return false;
}
