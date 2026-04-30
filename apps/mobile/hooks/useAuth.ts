/**
 * 登录态管理。
 *
 * - Native（iOS / Android）：SecureStore（Keychain / Keystore）
 * - Web：localStorage（受站点同源保护；真部署时可切 HttpOnly Cookie）
 *
 * 提供 useAuth()：{ user, loading, signIn, signOut, refresh }
 *
 * 401 / 令牌过期：api/client 会 clearCredentials + emitAuthSessionReset，本模块订阅后立刻 user=null，
 * 与「默认一天后登出」（服务端 JWT exp）一致。
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { AuthUser, LoginResponse } from '@meal/shared';
import { api } from '../api/client';
import {
  cacheUser,
  clearCredentials,
  getToken,
  readCachedUser,
  setToken as persistToken,
} from '../lib/authStorage';
import { subscribeAuthSessionReset } from '../lib/authSession';

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

subscribeAuthSessionReset(() => {
  setState({ user: null, loading: false });
});

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
      await clearCredentials();
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
    await clearCredentials();
    setState({ user: null, loading: false });
  }
}

async function signInInternal(username: string, password: string): Promise<void> {
  const res = await api.post<LoginResponse>('/api/auth/login', { username, password });
  await persistToken(res.token);
  await cacheUser(res.user);
  setState({ user: res.user, loading: false });
}

async function signOutInternal(): Promise<void> {
  await clearCredentials();
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
