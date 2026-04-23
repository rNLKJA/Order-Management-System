/**
 * 用户查询 + 当前用户头像上传。
 */

import type { AuthUser } from '@meal/shared';
import { api } from './client';

export interface ApiUser {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'staff';
  is_active: boolean;
  avatar_url?: string | null;
}

export const usersApi = {
  list: () => api.get<{ users: ApiUser[] }>('/api/users'),

  /** 上传当前用户头像（base64 data URL） */
  updateMyAvatar: (avatar: string) =>
    api.patch<{ user: AuthUser }>('/api/users/me/avatar', { avatar }),

  /** 清空当前用户头像 */
  clearMyAvatar: () => api.delete<{ user: AuthUser }>('/api/users/me/avatar'),
};
