/**
 * 登录后的主 Layout。
 * 在这里检查认证状态：未登录 → 跳到 /(auth)/login。
 */

import { Stack, Redirect } from 'expo-router';
import { useTheme, ActivityIndicator } from 'react-native-paper';
import { View } from 'react-native';
import { useAuth } from '../../hooks/useAuth';

export default function AppLayout() {
  const theme = useTheme();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

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
      <Stack.Screen name="finance/index" options={{ title: '记账' }} />
      <Stack.Screen name="orders/index" options={{ title: '每日订餐' }} />
    </Stack>
  );
}
