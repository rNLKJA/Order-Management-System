/**
 * 登录态管理。
 *
 * - Native（iOS / Android）：SecureStore（Keychain / Keystore）
 * - Web：localStorage（受站点同源保护；真部署时可切 HttpOnly Cookie）
 *
 * 提供：
 * - getToken / setToken / clearToken 原子操作
 * - useAuth() hook 提供 { user, loading, signIn, signOut }
 *
 * 状态共享：
 * - 所有 useAuth() 实例共享同一份模块级 state（订阅模式），
 *   避免登录后 login 页更新了本地 state 但 index 重定向页拿不到新 user 的 bug。
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { AuthUser, LoginResponse } from '@meal/shared';
import { api } from '../api/client';

// SecureStore 只在 native 上可用；Web 用 localStorage
// 用动态 require 避免 Web bundle 里直接 import 导致崩溃
let SecureStore: typeof import('expo-secure-store') | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
}

const TOKEN_KEY = 'meal.auth.token';
const USER_KEY = 'meal.auth.user';

const isWeb = Platform.OS === 'web';

async function readRaw(key: string): Promise<string | null> {
  if (isWeb) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  }
  return SecureStore!.getItemAsync(key);
}
async function writeRaw(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore!.setItemAsync(key, value);
}
async function deleteRaw(key: string): Promise<void> {
  if (isWeb) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore!.deleteItemAsync(key);
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

// ============================================================
// 模块级共享 store（所有 useAuth 实例订阅同一份状态）
// ============================================================

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

let state: AuthState = { user: null, loading: true };
const listeners = new Set<() => void>();

function getSnapshot(): AuthState {
  return state;
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function setState(next: Partial<AuthState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

// 只在首次挂载时执行一次的引导流程（读缓存 + 校验 token）
let bootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  if (bootstrapped) return;
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const cached = await readCachedUser();
    if (cached) setState({ user: cached });

    const token = await getToken();
    if (!token) {
      setState({ user: null, loading: false });
      bootstrapped = true;
      return;
    }
    try {
      const { user } = await api.get<{ user: AuthUser }>('/api/auth/me');
      await cacheUser(user);
      setState({ user, loading: false });
    } catch {
      await clearToken();
      setState({ user: null, loading: false });
    } finally {
      bootstrapped = true;
    }
  })();
  return bootstrapPromise;
}

async function refreshInternal(): Promise<void> {
  const token = await getToken();
  if (!token) {
    setState({ user: null, loading: false });
    return;
  }
  try {
    const { user } = await api.get<{ user: AuthUser }>('/api/auth/me');
    await cacheUser(user);
    setState({ user, loading: false });
  } catch {
    await clearToken();
    setState({ user: null, loading: false });
  }
}

async function signInInternal(username: string, password: string): Promise<void> {
  const res = await api.post<LoginResponse>('/api/auth/login', { username, password });
  await setToken(res.token);
  await cacheUser(res.user);
  setState({ user: res.user, loading: false });
}

async function signOutInternal(): Promise<void> {
  await clearToken();
  setState({ user: null, loading: false });
}

export interface UseAuthResult {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void bootstrap();
  }, []);

  const signIn = useCallback(signInInternal, []);
  const signOut = useCallback(signOutInternal, []);
  const refresh = useCallback(refreshInternal, []);

  return {
    user: snapshot.user,
    loading: snapshot.loading,
    signIn,
    signOut,
    refresh,
  };
}
