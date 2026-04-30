/**
 * 登录凭据本地持久化（与 useAuth 解耦，避免 api/client 与 useAuth 循环依赖）。
 */

import { Platform } from 'react-native';
import type { AuthUser } from '@meal/shared';

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

export async function clearCredentials(): Promise<void> {
  await Promise.all([deleteRaw(TOKEN_KEY), deleteRaw(USER_KEY)]);
}

export async function cacheUser(user: AuthUser): Promise<void> {
  await writeRaw(USER_KEY, JSON.stringify(user));
}

export async function readCachedUser(): Promise<AuthUser | null> {
  const raw = await readRaw(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}
