/**
 * 用户只读查询。把卡片 / 财务里的 `*_user_id` 映射到可展示的名字。
 */

import { api } from './client';

export interface ApiUser {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'staff';
  is_active: boolean;
}

export const usersApi = {
  list: () => api.get<{ users: ApiUser[] }>('/api/users'),
};
