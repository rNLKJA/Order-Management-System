/**
 * 面板占位页（Phase 2 合并后：作为各功能入口）。
 *
 * Phase 4 会把这个页面换成真实的指标卡 + 续卡提醒表 + 7 日趋势图。
 */

import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
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
            已就绪
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
            · 会员管理 / 购卡 / 升级 / 财务
          </Text>
          <Text variant="bodyMedium" style={[styles.listItem, { color: theme.colors.onSurfaceVariant }]}>
            · 下一阶段（Phase 2.5+）：每日订餐 + 出餐视图
          </Text>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon="account-group"
        onPress={() => router.push('/(app)/members')}
        style={styles.actionBtn}
      >
        会员管理
      </Button>

      <Button
        mode="contained"
        icon="cash-multiple"
        onPress={() => router.push('/(app)/finance')}
        style={styles.actionBtn}
      >
        财务记账
      </Button>

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
  actionBtn: {
    marginTop: 4,
    borderRadius: 10,
  },
  signOut: {
    marginTop: 16,
    alignSelf: 'flex-start',
    borderRadius: 10,
  },
});
