import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, ActivityIndicator } from 'react-native-paper';
import { View } from 'react-native';

export default function AuthLayout() {
  const { user, loading } = useAuth();
  const theme = useTheme();

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

  if (user) {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
