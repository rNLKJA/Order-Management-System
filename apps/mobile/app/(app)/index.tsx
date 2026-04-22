/**
 * 面板占位页（Phase 1 收尾）。
 *
 * Phase 2 会把这个页面换成真实的指标卡 + 续卡提醒表 + 7 日趋势图。
 */

import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, useTheme } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
    >
      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={{ fontWeight: '600' }}>
            你好，{user?.full_name ?? '未登录'}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            当前身份：{user?.role === 'admin' ? '管理员' : '员工'}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            用户名：{user?.username}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: '600' }}>
            Phase 1 完成度
          </Text>
          <Text variant="bodyMedium" style={styles.listItem}>
            · Turborepo + pnpm workspace
          </Text>
          <Text variant="bodyMedium" style={styles.listItem}>
            · Turso + Drizzle schema
          </Text>
          <Text variant="bodyMedium" style={styles.listItem}>
            · 认证（argon2id + HS256 JWT）
          </Text>
          <Text variant="bodyMedium" style={styles.listItem}>
            · Expo + React Native Paper 主题
          </Text>
          <Text variant="bodyMedium" style={[styles.listItem, { color: theme.colors.onSurfaceVariant }]}>
            · 下一阶段（Phase 2）：会员 / 卡 / 订餐 / 财务
          </Text>
        </Card.Content>
      </Card>

      <Button mode="outlined" onPress={signOut} style={styles.signOut}>
        退出登录
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 12,
  },
  listItem: {
    marginTop: 6,
  },
  signOut: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 10,
  },
});
