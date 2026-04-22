/**
 * 应用根 Layout：
 * - PaperProvider 挂主题
 * - TanStack Query provider
 * - 根据登录态把 expo-router 的 segment 路由到 (auth) 或 (app)
 */

import { Stack, Redirect, useSegments } from 'expo-router';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useMemo } from 'react';
import { paperTheme } from '../theme/paperTheme';
import { useAuth } from '../hooks/useAuth';

function RootNavigation() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: paperTheme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={paperTheme.colors.primary} />
      </View>
    );
  }

  const inAuthGroup = segments[0] === '(auth)';

  if (!user && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }
  if (user && inAuthGroup) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
    [],
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <StatusBar style="dark" />
          <RootNavigation />
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
