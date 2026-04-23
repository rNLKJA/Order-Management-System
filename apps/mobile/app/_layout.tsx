/**
 * 根 Layout：Providers 包裹 + Stack
 * 规则：必须在每次 render 都输出 navigator（Stack/Tabs/Slot），
 * 否则 Expo Router 会抛 "navigated before mounting" 错误。
 * 认证逻辑移到 app/index.tsx（Redirect）和 (app)/_layout.tsx（useEffect）。
 */

import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { paperTheme } from '../theme/paperTheme';

export default function RootLayout() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
    [],
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
