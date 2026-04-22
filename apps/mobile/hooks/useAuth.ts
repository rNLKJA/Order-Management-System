/**
 * 登录态管理。
 *
 * - Native（iOS / Android）：SecureStore（Keychain / Keystore）
 * - Web：localStorage（受站点同源保护；真部署时可切 HttpOnly Cookie）
 *
 * 提供：
 * - getToken / setToken / clearToken 原子操作
 * - useAuth() hook 提供 { user, loading, signIn, signOut }
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AuthUser, LoginResponse } from '@meal/shared';
import { api } from '../api/client';

const TOKEN_KEY = 'meal.auth.token';
const USER_KEY = 'meal.auth.user';

const isWeb = Platform.OS === 'web';

async function readRaw(key: string): Promise<string | null> {
  if (isWeb) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}
async function writeRaw(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
async function deleteRaw(key: string): Promise<void> {
  if (isWeb) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getToken(): Promise<string | null> {
  return readRaw(TOKEN_KEY);
}
export async function setToken(token: string): Promise<void> {
  await writeRaw(TOKEN_KEY, token);
}
export async function clearToken(): Promise<void> {
  await Promise.all([deleteRaw(TOKEN_KEY), deleteRaw(USER_KEY)]);
}

async function cacheUser(user: AuthUser): Promise<void> {
  await writeRaw(USER_KEY, JSON.stringify(user));
}
async function readCachedUser(): Promise<AuthUser | null> {
  const raw = await readRaw(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export interface UseAuthResult {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.get<{ user: AuthUser }>('/api/auth/me');
      await cacheUser(user);
      setUser(user);
    } catch {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 先从缓存回填，再静默 refresh 校验
    (async () => {
      const cached = await readCachedUser();
      if (cached) setUser(cached);
      await refresh();
    })();
  }, [refresh]);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await api.post<LoginResponse>('/api/auth/login', { username, password });
    await setToken(res.token);
    await cacheUser(res.user);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return { user, loading, signIn, signOut, refresh };
}
