/**
 * 登录后 Layout。
 * 用 useEffect 做认证守卫（不在 render 里条件返回），保证 Stack 始终渲染。
 */

import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function AppLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, loading]);

  // 始终渲染 Stack，让 Expo Router 导航树保持挂载
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="members/index" />
      <Stack.Screen name="members/[id]" />
      <Stack.Screen name="members/new" />
      <Stack.Screen name="orders/index" />
      <Stack.Screen name="orders/stats" />
      <Stack.Screen name="walkins/index" />
      <Stack.Screen name="walkins/[id]" />
      <Stack.Screen name="users/index" />
      <Stack.Screen name="users/[id]" />
      <Stack.Screen name="admin/index" />
      <Stack.Screen name="audit-logs/index" />
      <Stack.Screen name="finance/index" />
      <Stack.Screen name="reminders/index" />
      <Stack.Screen name="profile/index" />
      <Stack.Screen name="profile/privacy" />
    </Stack>
  );
}
