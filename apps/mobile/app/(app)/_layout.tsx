/**
 * 登录后的主 Layout。
 *
 * MVP 阶段（Phase 1）暂时只放 Stack，下一步（Phase 2）再加响应式 Tab / Drawer 切换。
 */

import { Stack } from 'expo-router';
import { useTheme } from 'react-native-paper';

export default function AppLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: '面板' }} />
      <Stack.Screen name="members/index" options={{ headerShown: false }} />
      <Stack.Screen name="members/new" options={{ headerShown: false }} />
      <Stack.Screen name="members/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
